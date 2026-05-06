"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentTenantId } from "@/lib/tenant";
import { createCustomer } from "@/db/queries/customers";

const schema = z.object({
  name: z.string().min(1, "氏名は必須です").max(100),
  nameKana: z.string().max(100).optional().or(z.literal("")),
  phoneFull: z
    .string()
    .max(20)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || /^[\d\-+\s()]+$/.test(v),
      "電話番号に使えない文字が含まれています",
    ),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export type CreateCustomerState = {
  fieldErrors?: Partial<Record<"name" | "nameKana" | "phoneFull" | "notes", string>>;
  formError?: string;
};

export async function createCustomerAction(
  _prev: CreateCustomerState,
  formData: FormData,
): Promise<CreateCustomerState> {
  const parsed = schema.safeParse({
    name: formData.get("name") ?? "",
    nameKana: formData.get("nameKana") ?? "",
    phoneFull: formData.get("phoneFull") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    const fieldErrors: CreateCustomerState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof NonNullable<
        CreateCustomerState["fieldErrors"]
      >;
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { fieldErrors };
  }

  let tenantId: string;
  try {
    tenantId = await getCurrentTenantId();
  } catch (e) {
    return {
      formError:
        e instanceof Error
          ? `サロンが解決できません: ${e.message}`
          : "サロンが解決できません",
    };
  }

  let customerId: string;
  try {
    const customer = await createCustomer(tenantId, {
      name: parsed.data.name,
      nameKana: parsed.data.nameKana || null,
      phoneFull: parsed.data.phoneFull || null,
      notes: parsed.data.notes || null,
    });
    customerId = customer.id;
  } catch (e) {
    return {
      formError:
        e instanceof Error ? `登録に失敗しました: ${e.message}` : "登録に失敗しました",
    };
  }

  revalidatePath("/customers");
  redirect(`/customers/${customerId}`);
}
