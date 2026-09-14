"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { RoleGate } from "@/components/auth/role-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";
import { roleLabel } from "@/lib/roles";
import { fieldSelectClass } from "@/lib/utils";
import type { User, UserRole } from "@/types/api";

export default function DevUsersPage(): React.JSX.Element {
  return (
    <RoleGate allow={["developer"]}>
      <UsersInner />
    </RoleGate>
  );
}

function UsersInner(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<UserRole>("manager");
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["dev", "users"],
    queryFn: () => apiFetch<User[]>("/dev/users"),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<User>("/dev/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role,
          is_active: true,
        }),
      }),
    onSuccess: async () => {
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("manager");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["dev", "users"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Ошибка создания");
    },
  });

  const toggleActive = useMutation({
    mutationFn: (user: User) =>
      apiFetch<User>(`/dev/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !user.is_active }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dev", "users"] });
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-accent">Админка разработчика</p>
        <h2 className="mt-1 text-3xl font-semibold text-slate-50">Пользователи</h2>
        <p className="mt-2 text-sm text-slate-400">
          Создание РОПа, менеджеров и других developer-аккаунтов.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Новый пользователь</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="full_name">ФИО</Label>
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="role">Роль</Label>
            <select
              id="role"
              className={fieldSelectClass}
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              <option value="manager">Менеджер</option>
              <option value="admin">РОП</option>
              <option value="developer">Разработчик</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending ||
                !email.trim() ||
                !password.trim() ||
                password.length < 8 ||
                !fullName.trim()
              }
            >
              Создать
            </Button>
            {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Все аккаунты</CardTitle>
          <CardDescription>{query.data?.length ?? 0}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(query.data ?? []).map((user) => (
            <div
              key={user.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-100">{user.full_name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="font-medium text-slate-100">{roleLabel(user.role)}</span>
                <span className="text-xs text-slate-500">
                  {user.is_active ? "активен" : "отключён"}
                </span>
                <Button size="sm" variant="outline" onClick={() => toggleActive.mutate(user)}>
                  {user.is_active ? "Отключить" : "Включить"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
