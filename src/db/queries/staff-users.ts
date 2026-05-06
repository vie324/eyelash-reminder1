import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { staffUsers, type StaffUser } from "@/db/schema";

export type StaffRole = "admin" | "staff";

// Clerk org role ("org:admin", "org:member" など) を staff_users.role にマップ
export function mapClerkOrgRole(clerkRole: string | undefined): StaffRole {
  return clerkRole === "org:admin" ? "admin" : "staff";
}

export async function upsertStaffUserFromMembership(input: {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: StaffRole;
}): Promise<StaffUser> {
  const [row] = await db
    .insert(staffUsers)
    .values({
      id: input.userId,
      tenantId: input.tenantId,
      email: input.email,
      name: input.name,
      role: input.role,
      isActive: true,
    })
    .onConflictDoUpdate({
      target: staffUsers.id,
      set: {
        tenantId: input.tenantId,
        email: input.email,
        name: input.name,
        role: input.role,
        isActive: true,
      },
    })
    .returning();
  return row;
}

export async function updateStaffUserRole(input: {
  userId: string;
  tenantId: string;
  role: StaffRole;
}): Promise<void> {
  await db
    .update(staffUsers)
    .set({ role: input.role })
    .where(
      and(
        eq(staffUsers.id, input.userId),
        eq(staffUsers.tenantId, input.tenantId),
      ),
    );
}

export async function softDeleteStaffUser(input: {
  userId: string;
  tenantId: string;
}): Promise<void> {
  await db
    .update(staffUsers)
    .set({ isActive: false })
    .where(
      and(
        eq(staffUsers.id, input.userId),
        eq(staffUsers.tenantId, input.tenantId),
      ),
    );
}

export async function updateStaffUserProfile(input: {
  userId: string;
  email?: string;
  name?: string;
}): Promise<void> {
  const set: { email?: string; name?: string } = {};
  if (input.email !== undefined) set.email = input.email;
  if (input.name !== undefined) set.name = input.name;
  if (Object.keys(set).length === 0) return;

  await db.update(staffUsers).set(set).where(eq(staffUsers.id, input.userId));
}
