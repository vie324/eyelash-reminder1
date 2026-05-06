import type { TenantResolution } from "@/lib/tenant";

// Phase 2 段階では DATABASE_URL 等が未設定で tenant 解決が失敗してもUIが見えるように、
// 解決失敗時にこのバナーを表示してユーザに状況を伝える。
export function SetupBanner({
  resolution,
}: {
  resolution: TenantResolution;
}) {
  if (resolution.status === "ok") return null;

  const { code, message } = resolution;

  const titleByCode: Record<typeof code, string> = {
    unauthenticated: "サインインが必要です",
    no_active_organization: "サロン（Organization）を選択してください",
    tenant_not_found: "サロンの初期化が完了していません",
    tenant_inactive: "このサロンは停止中です",
    internal: "データベースに接続できません",
  };

  const helpByCode: Record<typeof code, string> = {
    unauthenticated: "ヘッダー右上からサインインしてください。",
    no_active_organization:
      "ヘッダーの組織スイッチャーから利用するサロンを選択してください。",
    tenant_not_found:
      "Clerk Webhookが届いていない可能性があります。少し待ってからリロード、もしくはサロンを再作成してください。",
    tenant_inactive: "管理者にお問い合わせください。",
    internal:
      "DATABASE_URL などの環境変数が未設定の可能性があります。表示中のデータはダミーです。",
  };

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
      <p className="font-semibold text-amber-900">{titleByCode[code]}</p>
      <p className="mt-1 text-amber-800">{helpByCode[code]}</p>
      {process.env.NODE_ENV !== "production" && message ? (
        <p className="mt-1 font-mono text-xs text-amber-700/70">{message}</p>
      ) : null}
    </div>
  );
}
