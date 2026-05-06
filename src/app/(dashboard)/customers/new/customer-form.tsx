"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createCustomerAction, type CreateCustomerState } from "./actions";

const initial: CreateCustomerState = {};

export function CustomerForm() {
  const [state, formAction, isPending] = useActionState(
    createCustomerAction,
    initial,
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.formError ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.formError}
        </div>
      ) : null}

      <Field
        label="氏名"
        name="name"
        required
        error={state.fieldErrors?.name}
        placeholder="山田 花子"
      />
      <Field
        label="カナ"
        name="nameKana"
        error={state.fieldErrors?.nameKana}
        placeholder="ヤマダ ハナコ"
        hint="ひらがな・カタカナどちらでも検索できます"
      />
      <Field
        label="電話番号"
        name="phoneFull"
        type="tel"
        error={state.fieldErrors?.phoneFull}
        placeholder="090-1234-5678"
        hint="下4桁を検索キーとして自動抽出します"
      />

      <div>
        <label
          htmlFor="notes"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          メモ
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
          placeholder="施術メモなど"
        />
        {state.fieldErrors?.notes ? (
          <p className="mt-1 text-xs text-red-600">{state.fieldErrors.notes}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {isPending ? "登録中…" : "登録"}
        </button>
        <Link
          href="/customers"
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          キャンセル
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  error,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="mb-1 block text-sm font-medium text-gray-700"
      >
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
}
