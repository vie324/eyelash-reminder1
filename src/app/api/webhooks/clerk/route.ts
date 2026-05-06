import { NextResponse } from "next/server";
import { Webhook } from "svix";
import {
  getTenantByClerkOrgId,
  softDeleteTenantByClerkOrgId,
  upsertTenantFromClerkOrg,
} from "@/db/queries/tenants";
import {
  mapClerkOrgRole,
  softDeleteStaffUser,
  updateStaffUserProfile,
  updateStaffUserRole,
  upsertStaffUserFromMembership,
} from "@/db/queries/staff-users";
import {
  insertWebhookEvent,
  markWebhookEventProcessed,
} from "@/db/queries/webhook-events";

export const runtime = "nodejs";

// Clerk webhook payload (購読しているイベントのみ narrow)
type ClerkOrganizationData = {
  id: string;
  name: string;
  slug: string;
};

type ClerkPublicUserData = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  identifier: string;
};

type ClerkOrgMembershipData = {
  id: string;
  role: string;
  organization: ClerkOrganizationData;
  public_user_data: ClerkPublicUserData;
};

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkUserData = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  primary_email_address_id: string | null;
  email_addresses: ClerkEmailAddress[];
};

type ClerkWebhookEvent =
  | { type: "organization.created"; data: ClerkOrganizationData }
  | { type: "organization.updated"; data: ClerkOrganizationData }
  | { type: "organization.deleted"; data: { id: string } }
  | { type: "organizationMembership.created"; data: ClerkOrgMembershipData }
  | { type: "organizationMembership.updated"; data: ClerkOrgMembershipData }
  | { type: "organizationMembership.deleted"; data: ClerkOrgMembershipData }
  | { type: "user.updated"; data: ClerkUserData }
  | { type: string; data: unknown };

function fullName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  return [first, last].filter((s): s is string => Boolean(s)).join(" ").trim();
}

function primaryEmail(user: ClerkUserData): string {
  if (user.primary_email_address_id) {
    const found = user.email_addresses.find(
      (e) => e.id === user.primary_email_address_id,
    );
    if (found) return found.email_address;
  }
  return user.email_addresses[0]?.email_address ?? "";
}

export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[clerk-webhook] CLERK_WEBHOOK_SECRET is not set");
    return new NextResponse("server misconfigured", { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return new NextResponse("missing svix headers", { status: 400 });
  }

  const body = await req.text();

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error("[clerk-webhook] signature verification failed", err);
    return new NextResponse("invalid signature", { status: 401 });
  }

  let auditId: string | null = null;
  try {
    const audit = await insertWebhookEvent({
      eventType: `clerk.${event.type}`,
      rawPayload: JSON.parse(body),
    });
    auditId = audit.id;
  } catch (err) {
    // 監査ログのINSERT失敗は致命的ではないので進める（処理を止めるとリトライループになる）
    console.error("[clerk-webhook] failed to insert webhook_events", err);
  }

  try {
    await dispatch(event);
    if (auditId) await markWebhookEventProcessed(auditId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[clerk-webhook] handler failed for ${event.type}`, err);
    if (auditId) {
      await markWebhookEventProcessed(auditId, message).catch(() => {});
    }
    // Clerkに5xxを返してリトライさせる
    return new NextResponse("handler failed", { status: 500 });
  }
}

async function dispatch(event: ClerkWebhookEvent): Promise<void> {
  switch (event.type) {
    case "organization.created":
    case "organization.updated": {
      const org = event.data as ClerkOrganizationData;
      await upsertTenantFromClerkOrg({
        clerkOrgId: org.id,
        name: org.name,
        slug: org.slug,
      });
      return;
    }

    case "organization.deleted": {
      const org = event.data as { id: string };
      await softDeleteTenantByClerkOrgId(org.id);
      return;
    }

    case "organizationMembership.created":
    case "organizationMembership.updated": {
      const m = event.data as ClerkOrgMembershipData;
      const tenant = await getTenantByClerkOrgId(m.organization.id);
      if (!tenant) {
        // organization.created がまだ届いていない場合に備えて作成
        await upsertTenantFromClerkOrg({
          clerkOrgId: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
        });
      }
      const tenantId =
        tenant?.id ??
        (await getTenantByClerkOrgId(m.organization.id))!.id;

      if (event.type === "organizationMembership.created") {
        await upsertStaffUserFromMembership({
          userId: m.public_user_data.user_id,
          tenantId,
          email: m.public_user_data.identifier,
          name:
            fullName(
              m.public_user_data.first_name,
              m.public_user_data.last_name,
            ) || m.public_user_data.identifier,
          role: mapClerkOrgRole(m.role),
        });
      } else {
        await updateStaffUserRole({
          userId: m.public_user_data.user_id,
          tenantId,
          role: mapClerkOrgRole(m.role),
        });
      }
      return;
    }

    case "organizationMembership.deleted": {
      const m = event.data as ClerkOrgMembershipData;
      const tenant = await getTenantByClerkOrgId(m.organization.id);
      if (!tenant) return;
      await softDeleteStaffUser({
        userId: m.public_user_data.user_id,
        tenantId: tenant.id,
      });
      return;
    }

    case "user.updated": {
      const user = event.data as ClerkUserData;
      const email = primaryEmail(user);
      const name =
        fullName(user.first_name, user.last_name) || email;
      await updateStaffUserProfile({
        userId: user.id,
        email: email || undefined,
        name: name || undefined,
      });
      return;
    }

    default:
      console.warn(`[clerk-webhook] unhandled event type: ${event.type}`);
      return;
  }
}
