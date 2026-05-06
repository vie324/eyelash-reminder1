import Link from "next/link";
import { Suspense } from "react";
import { tryGetCurrentTenant } from "@/lib/tenant";
import { listCustomers } from "@/db/queries/customers";
import { SetupBanner } from "@/components/setup-banner";
import { CustomerSearchForm } from "./customer-search-form";
import type { Customer } from "@/db/schema";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export default async function CustomersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const resolution = await tryGetCurrentTenant();
  const tenantId = resolution.status === "ok" ? resolution.tenant.id : null;

  let customers: Customer[] = [];
  if (tenantId) {
    try {
      customers = await listCustomers(tenantId, { search: q });
    } catch (e) {
      console.error("[customers] list failed", e);
    }
  }

  return (
    <div>
      <SetupBanner resolution={resolution} />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">顧客</h1>
          <p className="mt-1 text-sm text-gray-600">
            {q
              ? `「${q}」の検索結果: ${customers.length}件`
              : `${customers.length}件`}
          </p>
        </div>
        <Link
          href="/customers/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          + 新規登録
        </Link>
      </div>

      <div className="mb-4">
        <Suspense>
          <CustomerSearchForm initial={q ?? ""} />
        </Suspense>
      </div>

      {customers.length === 0 ? (
        <EmptyState hasQuery={Boolean(q)} />
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 bg-white">
          {customers.map((c) => (
            <CustomerRow key={c.id} customer={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CustomerRow({ customer }: { customer: Customer }) {
  const linked = Boolean(customer.lineUserId);
  return (
    <li>
      <Link
        href={`/customers/${customer.id}`}
        className="flex items-center justify-between px-4 py-3 transition hover:bg-gray-50"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{customer.name}</p>
            {linked ? (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
                LINE紐付け済
              </span>
            ) : (
              <span className="rounded-full bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/20">
                未紐付け
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-gray-500">
            {customer.nameKana ?? "—"}
            {customer.phoneLast4 ? `  ・  ☎︎ ****${customer.phoneLast4}` : ""}
          </p>
        </div>
        <span className="text-gray-400">›</span>
      </Link>
    </li>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
      <p className="text-sm text-gray-600">
        {hasQuery
          ? "該当する顧客が見つかりませんでした。"
          : "まだ顧客が登録されていません。"}
      </p>
      {!hasQuery ? (
        <Link
          href="/customers/new"
          className="mt-3 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          最初の顧客を登録
        </Link>
      ) : null}
    </div>
  );
}
