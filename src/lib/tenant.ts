import { auth } from "@clerk/nextjs/server";
import { getTenantByClerkOrgId } from "@/db/queries/tenants";
import type { Tenant } from "@/db/schema";

// すべてのDBクエリは tenant_id でスコープを絞る (CLAUDE.md ルール1)
// ページコンポーネント / API ルート / Server Action から必ずこの2関数を経由する。

export class TenantResolutionError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "unauthenticated"
      | "no_active_organization"
      | "tenant_not_found"
      | "tenant_inactive",
  ) {
    super(message);
    this.name = "TenantResolutionError";
  }
}

export async function getCurrentTenant(): Promise<Tenant> {
  const { userId, orgId } = await auth();

  if (!userId) {
    throw new TenantResolutionError(
      "Not authenticated",
      "unauthenticated",
    );
  }
  if (!orgId) {
    throw new TenantResolutionError(
      "No active Clerk organization. Ask the user to select an organization.",
      "no_active_organization",
    );
  }

  const tenant = await getTenantByClerkOrgId(orgId);
  if (!tenant) {
    // Clerk Webhook の organization.created がまだ届いていない可能性がある。
    // 通常は数秒以内に同期されるので、UI側でリトライ案内する。
    throw new TenantResolutionError(
      `Tenant for Clerk org ${orgId} not found (webhook may not have synced yet)`,
      "tenant_not_found",
    );
  }
  if (!tenant.isActive) {
    throw new TenantResolutionError(
      `Tenant ${tenant.id} is inactive`,
      "tenant_inactive",
    );
  }

  return tenant;
}

export async function getCurrentTenantId(): Promise<string> {
  const tenant = await getCurrentTenant();
  return tenant.id;
}
