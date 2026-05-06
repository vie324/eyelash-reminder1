import Link from "next/link";
import { tryGetCurrentTenant } from "@/lib/tenant";
import { SetupBanner } from "@/components/setup-banner";
import { CustomerForm } from "./customer-form";

export default async function NewCustomerPage() {
  const resolution = await tryGetCurrentTenant();

  return (
    <div>
      <SetupBanner resolution={resolution} />

      <nav className="mb-2 text-sm">
        <Link href="/customers" className="text-gray-500 hover:text-gray-900">
          ← 顧客一覧
        </Link>
      </nav>

      <h1 className="mb-6 text-2xl font-bold tracking-tight">顧客の新規登録</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <CustomerForm />
      </div>
    </div>
  );
}
