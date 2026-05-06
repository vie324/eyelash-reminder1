import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { tryGetCurrentTenant } from "@/lib/tenant";
import { getCustomerById } from "@/db/queries/customers";
import { SetupBanner } from "@/components/setup-banner";
import type { Customer } from "@/db/schema";

const TZ = "Asia/Tokyo";

type Props = { params: Promise<{ id: string }> };

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const resolution = await tryGetCurrentTenant();
  const tenantId = resolution.status === "ok" ? resolution.tenant.id : null;

  let customer: Customer | null = null;
  if (tenantId) {
    try {
      customer = await getCustomerById(tenantId, id);
    } catch (e) {
      console.error("[customer-detail] fetch failed", e);
    }
  }

  if (tenantId && !customer) {
    notFound();
  }

  return (
    <div>
      <SetupBanner resolution={resolution} />

      <nav className="mb-2 text-sm">
        <Link href="/customers" className="text-gray-500 hover:text-gray-900">
          ← 顧客一覧
        </Link>
      </nav>

      {customer ? (
        <CustomerDetail customer={customer} />
      ) : (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-sm text-gray-600">
            データベース未接続のためプレビューを表示できません。
          </p>
        </div>
      )}
    </div>
  );
}

function CustomerDetail({ customer }: { customer: Customer }) {
  const linked = Boolean(customer.lineUserId);
  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {customer.nameKana ?? "—"}
            {customer.phoneLast4 ? `  ・  ☎︎ ****${customer.phoneLast4}` : ""}
          </p>
        </div>
        <div>
          {linked ? (
            <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
              LINE紐付け済
            </span>
          ) : (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
              LINE未紐付け
            </span>
          )}
        </div>
      </div>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card title="基本情報">
          <Row label="氏名" value={customer.name} />
          <Row label="カナ" value={customer.nameKana ?? "—"} />
          <Row label="電話番号" value={customer.phoneFull ?? "—"} />
          <Row label="登録日" value={formatDate(customer.createdAt)} />
        </Card>

        <Card title="LINE">
          <Row
            label="状態"
            value={linked ? "紐付け済" : "未紐付け"}
          />
          <Row
            label="表示名"
            value={customer.lineDisplayName ?? "—"}
          />
          <Row
            label="紐付け日時"
            value={
              customer.linkedAt ? formatDate(customer.linkedAt) : "—"
            }
          />
          {customer.linePictureUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={customer.linePictureUrl}
              alt="LINE profile"
              className="mt-2 h-12 w-12 rounded-full"
            />
          ) : null}
        </Card>
      </section>

      <section className="mb-6">
        <Card title="メモ">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {customer.notes?.trim() || "—"}
          </p>
        </Card>
      </section>

      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          アクション
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ActionPlaceholder
            title={linked ? "LINE紐付けをやり直す" : "LINEを紐付ける"}
            desc="QRコードを発行してお客様に読み取ってもらう"
            phase="Phase 3"
          />
          <ActionPlaceholder
            title="次回予約を登録"
            desc="2週後 同曜日 同時刻 サジェスト対応"
            phase="Phase 4"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-500 uppercase tracking-wide">
          リマインド履歴
        </h2>
        <div className="rounded-lg border border-dashed border-gray-300 bg-white px-6 py-8 text-center text-sm text-gray-500">
          Phase 4以降で実装します
        </div>
      </section>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
        {title}
      </p>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-right text-gray-900">{value}</span>
    </div>
  );
}

function ActionPlaceholder({
  title,
  desc,
  phase,
}: {
  title: string;
  desc: string;
  phase: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-gray-300 bg-white/60 px-4 py-3 text-gray-500">
      <p className="font-medium text-gray-700">{title}</p>
      <p className="mt-0.5 text-xs">{desc}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wide text-gray-400">
        {phase}で実装
      </p>
    </div>
  );
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(toZonedTime(d, TZ), "yyyy/MM/dd HH:mm");
}
