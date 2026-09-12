"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { User } from "@/types/api";

export default function AdminUsersPage(): React.JSX.Element {
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch<User[]>("/admin/users"),
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-accent">Админка</p>
        <h2 className="mt-1 text-3xl font-semibold text-navy">Команда</h2>
        <p className="mt-2 text-sm text-slate-600">
          Полный CRUD-редактор пользователей — на Этапе 7. Сейчас доступен просмотр.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Пользователи</CardTitle>
          <CardDescription>{usersQuery.data?.length ?? 0} аккаунтов</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(usersQuery.data ?? []).map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-900">{user.full_name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-medium text-navy">{user.role === "admin" ? "РОП" : "Менеджер"}</p>
                <p className="text-xs text-slate-500">{user.is_active ? "активен" : "отключён"}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
