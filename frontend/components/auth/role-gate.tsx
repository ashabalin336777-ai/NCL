"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/store/auth";
import type { UserRole } from "@/types/api";
import { roleLabel } from "@/lib/roles";

export function RoleGate({
  allow,
  children,
  fallback = "/dashboard",
}: {
  allow: UserRole[];
  children: React.ReactNode;
  fallback?: string;
}): React.JSX.Element | null {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  const allowed = user != null && allow.includes(user.role);

  useEffect(() => {
    // AppShell already waits for auth; only bounce wrong roles after hydrate.
    if (!hydrated || !user) return;
    if (!allowed) {
      const timer = window.setTimeout(() => {
        router.replace(fallback);
      }, 1200);
      return () => window.clearTimeout(timer);
    }
  }, [allowed, fallback, hydrated, router, user]);

  if (!hydrated || !user) {
    return <div className="p-8 text-sm text-slate-500">Проверка доступа…</div>;
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-amber-500/20 bg-amber-500/10 p-6 text-sm text-amber-100">
        <p className="font-medium">Раздел недоступен для роли «{roleLabel(user.role)}».</p>
        <p className="mt-2 text-amber-200/80">
          Нужна роль: {allow.map(roleLabel).join(" / ")}. Сейчас откроется дашборд…
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
