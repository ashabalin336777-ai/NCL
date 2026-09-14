"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { useAuthStore } from "@/store/auth";

export function AppShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login");
    }
  }, [hydrated, user, router]);

  if (!hydrated || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0F19] text-sm text-slate-400">
        Загрузка…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0B0F19]">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-auto p-6 md:p-8">{children}</div>
      </main>
    </div>
  );
}
