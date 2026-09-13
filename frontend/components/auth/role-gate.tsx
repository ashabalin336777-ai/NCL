"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/store/auth";
import type { UserRole } from "@/types/api";

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
    if (!hydrated) return;
    if (!user || !allowed) {
      router.replace(fallback);
    }
  }, [allowed, fallback, hydrated, router, user]);

  if (!hydrated || !user || !allowed) {
    return (
      <div className="p-8 text-sm text-slate-500">Проверка доступа…</div>
    );
  }

  return <>{children}</>;
}
