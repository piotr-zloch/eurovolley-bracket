"use client";

import { useActionState } from "react";
import type { Dict } from "@/lib/i18n";
import { PasswordField } from "@/components/auth/AuthShell";
import { changePassword, type AuthState } from "@/app/login/actions";

/**
 * Changing a password without leaving the app.
 *
 * Until this existed the only route was the recovery email, which meant logging out and waiting
 * on mail delivery — no use to someone who simply wants a different password, and no use at all
 * if the email never arrives.
 */
export default function ChangePasswordForm({ dict }: { dict: Dict }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(changePassword, {});
  const t = dict.auth;

  return (
    <form action={formAction} className="mb-8 flex flex-col gap-3 rounded border p-4">
      <div>
        <h2 className="text-sm font-medium">{t.changePasswordTitle}</h2>
        <p className="text-xs text-gray-500">{t.changePasswordHelp}</p>
      </div>

      {/* role=alert / role=status so a screen reader announces the outcome, which is otherwise
          only a colour change on a page the user never left. */}
      {state.error && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-800">
          {state.success}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <PasswordField
          id="current_password"
          name="current_password"
          label={t.currentPassword}
          required
          autoComplete="current-password"
          dict={dict}
        />
        <PasswordField
          id="new_password"
          name="password"
          label={t.newPassword}
          hint={t.passwordHelp}
          required
          minLength={8}
          autoComplete="new-password"
          dict={dict}
        />
        <PasswordField
          id="confirm_new_password"
          name="confirm_password"
          label={t.confirmPassword}
          required
          minLength={8}
          autoComplete="new-password"
          dict={dict}
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? t.saving : t.changePassword}
      </button>
    </form>
  );
}
