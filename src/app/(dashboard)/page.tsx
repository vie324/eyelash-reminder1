import Link from "next/link";
import { tryGetCurrentTenant } from "@/lib/tenant";
import { countCustomers, countLinkedCustomers } from "@/db/queries/customers";
import { SetupBanner } from "@/components/setup-banner";

async function safeCount(fn: () => Promise<number>): Promise<number | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export default async function HomePage() {
  const resolution = await tryGetCurrentTenant();
  const tenantId =
    resolution.status === "ok" ? resolution.tenant.id : null;

  const [totalCustomers, linkedCustomers] = await Promise.all([
    tenantId ? safeCount(() => countCustomers(tenantId)) : Promise.resolve(null),
    tenantId
      ? safeCount(() => countLinkedCustomers(tenantId))
      : Promise.resolve(null),
  ]);

  return (
    <div>
      <SetupBanner resolution={resolution} />

      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">ホーム</h1>
        <p className="mt-1 text-sm text-gray-600">
          {resolution.status === "ok"
            ? `${resolution.tenant.name} の状況`
            : "サロンの状況"}
        </p>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="今日の送信予定" value="—" hint="Phase 5で実装" />
        <StatCard
          label="登録顧客数"
          value={totalCustomers ?? "—"}
        />
        <StatCard
          label="LINE紐付け済み"
          value={linkedCustomers ?? "—"}
          hint={
            totalCustomers && linkedCustomers !== null
              ? `${Math.round((linkedCustomers / Math.max(totalCustomers, 1)) * 100)}%`
              : undefined
          }
        />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          クイックアクション
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionCard
            href="/customers"
            title="顧客を検索"
            desc="電話下4桁・カナで検索"
          />
          <ActionCard
            href="/customers/new"
            title="顧客を新規登録"
            desc="新しいお客様を追加"
          />
          <ActionCard
            href="/reminders"
            title="リマインド一覧"
            desc="送信予定・履歴の確認"
            disabled
          />
          <ActionCard
            href="/settings"
            title="サロン設定"
            desc="LINE Channel・送信時刻"
            disabled
          />
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}

function ActionCard({
  href,
  title,
  desc,
  disabled,
}: {
  href: string;
  title: string;
  desc: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-white/50 px-4 py-3 text-gray-400">
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-xs">{desc}（後フェーズ）</p>
      </div>
    );
  }
  return (
    <Link
      href={href}
      className="rounded-lg border border-gray-200 bg-white px-4 py-3 transition hover:border-gray-900 hover:shadow-sm"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-xs text-gray-500">{desc}</p>
    </Link>
  );
}
