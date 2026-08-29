"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { Dict } from "@/lib/i18n";
import { USERNAME_MAX, USERNAME_MIN } from "@/lib/username";
import { AuthCard, Field, PasswordField, SubmitButton } from "@/components/auth/AuthShell";
import { signup, type AuthState } from "@/app/login/actions";

export default function SignupForm({
  dict,
  fromPredictions = false,
}: {
  dict: Dict;
  fromPredictions?: boolean;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signup, {});
  const t = dict.auth;

  return (
    <AuthCard
      title={dict.appName}
      subtitle={t.signUpTitle}
      error={state.error}
      message={fromPredictions ? t.draftWaiting : undefined}
      footer={
        <>
          {t.haveAccount}{" "}
          <Link href={fromPredictions ? "/login?from=predictions" : "/login"} className="text-blue-600 underline">
            {t.logIn}
          </Link>
        </>
      }
    >
      <form action={formAction} className="flex flex-col gap-4">
        <Field
          id="username"
          name="username"
          type="text"
          label={t.username}
          hint={t.usernameHelp}
          required
          minLength={USERNAME_MIN}
          maxLength={USERNAME_MAX}
          autoComplete="nickname"
          defaultValue={state.values?.username ?? ""}
        />
        <Field
          id="email"
          name="email"
          type="email"
          label={t.email}
          hint={t.emailHelp}
          required
          autoComplete="email"
          defaultValue={state.values?.email ?? ""}
        />
        <PasswordField
          id="password"
          name="password"
          label={t.password}
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
        <SubmitButton pending={pending} label={t.signUp} pendingLabel={t.signingUp} />
      </form>
    </AuthCard>
  );
}
