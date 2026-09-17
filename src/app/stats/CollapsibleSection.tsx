"use client";

import { useState } from "react";

export default function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="mb-12">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-start justify-between text-left"
        aria-expanded={open}
      >
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
        </div>
        <span className="ml-4 mt-1 flex-shrink-0 text-gray-400 transition-colors group-hover:text-gray-600">
          {open ? "▲" : "▼"}
        </span>
      </button>
      {open && <div className="mt-4">{children}</div>}
    </section>
  );
}
