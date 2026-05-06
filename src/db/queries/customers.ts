import { and, desc, eq, ilike, isNotNull, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { customers, type Customer, type NewCustomer } from "@/db/schema";

// すべての関数は tenantId を必ず受け取る (CLAUDE.md ルール1)。
// ページ/ルートからは src/lib/tenant.ts の getCurrentTenantId() を経由して呼ぶ。

export type CustomerListFilters = {
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listCustomers(
  tenantId: string,
  filters: CustomerListFilters = {},
): Promise<Customer[]> {
  const { search, limit = 50, offset = 0 } = filters;

  const conditions = [
    eq(customers.tenantId, tenantId),
    eq(customers.isActive, true),
  ];

  if (search && search.trim()) {
    const trimmed = search.trim();
    // 数字のみなら電話下4桁前方一致、それ以外はカナ/名前 部分一致
    if (/^\d+$/.test(trimmed)) {
      conditions.push(ilike(customers.phoneLast4, `${trimmed}%`));
    } else {
      const like = `%${trimmed}%`;
      conditions.push(
        or(
          ilike(customers.nameKana, like),
          ilike(customers.name, like),
        )!,
      );
    }
  }

  return db
    .select()
    .from(customers)
    .where(and(...conditions))
    .orderBy(desc(customers.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countCustomers(tenantId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customers)
    .where(
      and(eq(customers.tenantId, tenantId), eq(customers.isActive, true)),
    );
  return row?.count ?? 0;
}

export async function countLinkedCustomers(tenantId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(customers)
    .where(
      and(
        eq(customers.tenantId, tenantId),
        eq(customers.isActive, true),
        isNotNull(customers.lineUserId),
      ),
    );
  return row?.count ?? 0;
}

export async function getCustomerById(
  tenantId: string,
  customerId: string,
): Promise<Customer | null> {
  const [row] = await db
    .select()
    .from(customers)
    .where(
      and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)),
    )
    .limit(1);
  return row ?? null;
}

export type CreateCustomerInput = {
  name: string;
  nameKana?: string | null;
  phoneFull?: string | null;
  notes?: string | null;
};

// 電話番号の数字下4桁を取り出す（半角数字のみ抽出）
export function extractPhoneLast4(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

export async function createCustomer(
  tenantId: string,
  input: CreateCustomerInput,
): Promise<Customer> {
  const values: NewCustomer = {
    tenantId,
    name: input.name,
    nameKana: input.nameKana?.trim() || null,
    phoneFull: input.phoneFull?.trim() || null,
    phoneLast4: extractPhoneLast4(input.phoneFull),
    notes: input.notes?.trim() || null,
  };

  const [row] = await db.insert(customers).values(values).returning();
  return row;
}

export async function updateCustomerNotes(
  tenantId: string,
  customerId: string,
  notes: string | null,
): Promise<void> {
  await db
    .update(customers)
    .set({ notes })
    .where(
      and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)),
    );
}

export async function softDeleteCustomer(
  tenantId: string,
  customerId: string,
): Promise<void> {
  await db
    .update(customers)
    .set({ isActive: false })
    .where(
      and(eq(customers.tenantId, tenantId), eq(customers.id, customerId)),
    );
}
