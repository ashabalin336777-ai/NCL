"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";

const managerLinks = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/trainings", label: "Тренировки", icon: MessageSquare },
];

const adminLinks = [
  { href: "/admin/users", label: "Команда", icon: Users },
  { href: "/admin/knowledge", label: "База знаний", icon: BookOpen },
  { href: "/admin/settings", label: "AI-настройки", icon: Settings },
];

export function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const links = user?.role === "admin" ? [...managerLinks, ...adminLinks] : managerLinks;

  async function onLogout(): Promise<void> {
    await logout();
    router.replace("/login");
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">NeuroCloser</p>
        <h1 className="mt-1 text-lg font-semibold text-navy">NCL Sales Trainer</h1>
        <p className="mt-1 text-xs text-slate-500">Тренажёр дожатия сделок с ИИ</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {links.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-navy text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <div className="mb-3">
          <p className="truncate text-sm font-medium text-slate-900">{user?.full_name}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-accent">
            {user?.role === "admin" ? "РОП" : "Менеджер"}
          </p>
        </div>
        <Button variant="outline" className="w-full" onClick={() => void onLogout()}>
          <LogOut className="h-4 w-4" />
          Выйти
        </Button>
      </div>
    </aside>
  );
}
