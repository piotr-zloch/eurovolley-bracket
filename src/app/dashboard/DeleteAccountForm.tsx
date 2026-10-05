"use client";

import { useActionState, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { deleteAccount, type AuthState } from "@/app/login/actions";

export default function DeleteAccountForm({ dict }: { dict: Dict }) {
  const t = dict.auth;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(deleteAccount, {});
  const [typed, setTyped] = useState("");

  return (
    <form action={formAction} className="mt-10 flex flex-col gap-3 rounded border border-red-200 p-4">
      <h2 className="font-semibold text-red-700">{t.deleteTitle}</h2>
      <p className="text-sm text-gray-600">{t.deleteHelp}</p>
      {state.error && <p className="rounded bg-red-100 p-2 text-sm text-red-700">{state.error}</p>}
      <label htmlFor="delete_confirm" className="text-sm font-medium">
        {t.deleteConfirmLabel}
      </label>
      <input
        id="delete_confirm"
        name="confirm"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        className="rounded border px-3 py-2"
      />
      <button
        disabled={pending || typed.trim().toUpperCase() !== t.deleteConfirmWord}
        className="rounded bg-red-600 px-3 py-2 text-white disabled:opacity-40"
      >
        {pending ? t.deleting : t.deleteButton}
      </button>
    </form>
  );
}
