import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { tenants, type Tenant } from "@/db/schema";

export async function getTenantByClerkOrgId(
  clerkOrgId: string,
): Promise<Tenant | null> {
  const [row] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.clerkOrgId, clerkOrgId))
    .limit(1);
  return row ?? null;
}

export async function upsertTenantFromClerkOrg(input: {
  clerkOrgId: string;
  name: string;
  slug: string;
}): Promise<Tenant> {
  const [row] = await db
    .insert(tenants)
    .values({
      clerkOrgId: input.clerkOrgId,
      name: input.name,
      slug: input.slug,
    })
    .onConflictDoUpdate({
      target: tenants.clerkOrgId,
      set: {
        name: input.name,
        slug: input.slug,
      },
    })
    .returning();
  return row;
}

export async function softDeleteTenantByClerkOrgId(
  clerkOrgId: string,
): Promise<void> {
  await db
    .update(tenants)
    .set({ isActive: false })
    .where(eq(tenants.clerkOrgId, clerkOrgId));
}
