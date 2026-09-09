"use client";

import { useActionState } from "react";
import type { Dict } from "@/lib/i18n";
import { AuthCard, PasswordField, SubmitButton } from "@/components/auth/AuthShell";
import { updatePassword, type AuthState } from "@/app/login/actions";

export default function ResetForm({ dict }: { dict: Dict }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(updatePassword, {});
  const t = dict.auth;

  return (
    <AuthCard title={t.resetTitle} subtitle={t.resetIntro} error={state.error}>
      <form action={formAction} className="flex flex-col gap-4">
        <PasswordField
          id="password"
          name="password"
          label={t.newPassword}
          hint={t.passwordHelp}
          required
          minLength={8}
          autoComplete="new-password"
          dict={dict}
        />
        <PasswordField
          id="confirm_password"
          name="confirm_password"
          label={t.confirmPassword}
          required
          minLength={8}
          autoComplete="new-password"
          dict={dict}
        />
        <SubmitButton pending={pending} label={t.setNewPassword} pendingLabel={t.saving} />
      </form>
    </AuthCard>
  );
}
