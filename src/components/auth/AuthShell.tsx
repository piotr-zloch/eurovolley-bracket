"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";

export function AuthCard({
  title,
  subtitle,
  error,
  message,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  error?: string;
  message?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-sm flex-col justify-center gap-5 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>

      {/* role=alert so screen readers announce it when it appears after a failed submit */}
      {error && (
        <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {message}
        </p>
      )}

      {children}

      {footer && <div className="text-center text-sm text-gray-500">{footer}</div>}
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  ...props
}: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        {...props}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="rounded border px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Password input with a show/hide toggle — typing a password blind on a phone is error-prone. */
export function PasswordField({
  id,
  label,
  hint,
  dict,
  ...props
}: { id: string; label: string; hint?: string; dict: Dict } & React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          {...props}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="w-full rounded border px-3 py-2 pr-16 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 px-3 text-xs text-gray-500 hover:text-gray-800"
        >
          {visible ? dict.auth.hide : dict.auth.show}
        </button>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-gray-400">
          {hint}
        </p>
      )}
    </div>
  );
}

export function SubmitButton({ pending, label, pendingLabel }: { pending: boolean; label: string; pendingLabel: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-blue-600 px-3 py-2.5 font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
