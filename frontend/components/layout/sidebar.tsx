"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Settings,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/roles";
import { useAuthStore } from "@/store/auth";

type NavLink = { href: string; label: string; icon: typeof LayoutDashboard };

const managerLinks: NavLink[] = [
  { href: "/dashboard", label: "Дашборд", icon: LayoutDashboard },
  { href: "/trainings", label: "Тренировки", icon: MessageSquare },
];

const ropLinks: NavLink[] = [
  { href: "/rop/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/rop/team", label: "Команда", icon: Users },
  { href: "/rop/reports", label: "Отчёты", icon: FileText },
];

const developerLinks: NavLink[] = [
  { href: "/dev/billing", label: "Баланс", icon: Wallet },
  { href: "/dev/ai-settings", label: "AI-настройки", icon: Settings },
  { href: "/dev/prompts", label: "Промпты", icon: FileText },
  { href: "/dev/knowledge", label: "База знаний", icon: BookOpen },
  { href: "/dev/users", label: "Пользователи", icon: Users },
];

function NavSection({
  title,
  links,
  pathname,
}: {
  title?: string;
  links: NavLink[];
  pathname: string;
}): React.JSX.Element {
  return (
    <div className="space-y-1">
      {title ? (
        <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {title}
        </p>
      ) : null}
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
                ? "bg-navy text-white shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                : "text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar(): React.JSX.Element {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isDeveloper = user?.role === "developer";
  const isRop = user?.role === "admin" || isDeveloper;

  async function onLogout(): Promise<void> {
    await logout();
    router.replace("/login");
  }

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-white/5 bg-slate-900/60 backdrop-blur-xl">
      <div className="border-b border-white/5 px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">NeuroCloser</p>
        <h1 className="mt-1 text-lg font-semibold text-slate-100">NCL Sales Trainer</h1>
        <p className="mt-1 text-xs text-slate-500">Тренажёр дожатия сделок с ИИ</p>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
        <NavSection links={managerLinks} pathname={pathname} />
        {isRop ? <NavSection title="РОП" links={ropLinks} pathname={pathname} /> : null}
        {isDeveloper ? (
          <NavSection title="Платформа" links={developerLinks} pathname={pathname} />
        ) : null}
      </nav>

      <div className="border-t border-white/5 p-4">
        <div className="mb-3">
          <p className="truncate text-sm font-medium text-slate-100">{user?.full_name}</p>
          <p className="truncate text-xs text-slate-500">{user?.email}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide text-accent">
            {user ? roleLabel(user.role) : ""}
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full border-white/10 bg-transparent text-slate-200 hover:bg-white/5 hover:text-white"
          onClick={() => void onLogout()}
        >
          <LogOut className="h-4 w-4" />
          Выйти
        </Button>
      </div>
    </aside>
  );
}
