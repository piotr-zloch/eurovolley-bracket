"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Dict } from "@/lib/i18n";
import { AuthCard, Field, PasswordField, SubmitButton } from "@/components/auth/AuthShell";
import { login, type AuthState } from "./actions";

export default function LoginForm({
  dict,
  message,
  fromPredictions = false,
}: {
  dict: Dict;
  message?: string;
  fromPredictions?: boolean;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(login, {});
  const t = dict.auth;

  return (
    <AuthCard
      title={dict.appName}
      subtitle={t.signInTitle}
      error={state.error}
      message={message ?? (fromPredictions ? t.draftWaitingLogin : undefined)}
      footer={
        <>
          {t.noAccount}{" "}
          <Link href={fromPredictions ? "/signup?from=predictions" : "/signup"} className="text-blue-600 underline">
            {t.signUp}
          </Link>
        </>
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
        <PasswordField
          id="password"
          name="password"
          label={t.password}
          required
          autoComplete="current-password"
          dict={dict}
        />
        <div className="-mt-2 text-right">
          <Link href="/forgot-password" className="text-xs text-gray-500 underline">
            {t.forgotPassword}
          </Link>
        </div>
        <SubmitButton pending={pending} label={t.logIn} pendingLabel={t.signingIn} />
      </form>
    </AuthCard>
  );
}
