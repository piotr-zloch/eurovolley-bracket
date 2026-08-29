"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Dict } from "@/lib/i18n";
import { AuthCard, Field, SubmitButton } from "@/components/auth/AuthShell";
import { requestPasswordReset, type AuthState } from "@/app/login/actions";

export default function ForgotForm({ dict }: { dict: Dict }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});
  const t = dict.auth;

  return (
    <AuthCard
      title={t.forgotTitle}
      subtitle={t.forgotIntro}
      error={state.error}
      footer={
        <Link href="/login" className="text-blue-600 underline">
          {t.backToLogin}
        </Link>
      }
    >
      <form action={formAction} className="flex flex-col gap-4">
        <Field
          id="email"
          name="email"
          type="email"
          label={t.email}
          required
          autoComplete="email"
          defaultValue={state.values?.email ?? ""}
        />
        <SubmitButton pending={pending} label={t.sendResetLink} pendingLabel={t.sending} />
      </form>
    </AuthCard>
  );
}
