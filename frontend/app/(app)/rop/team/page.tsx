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
import type { User } from "@/types/api";

export default function RopTeamPage(): React.JSX.Element {
  return (
    <RoleGate allow={["admin", "developer"]}>
      <TeamInner />
    </RoleGate>
  );
}

function TeamInner(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["rop", "users"],
    queryFn: () => apiFetch<User[]>("/rop/users"),
  });

  const create = useMutation({
    mutationFn: () =>
      apiFetch<User>("/rop/users", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          role: "manager",
          is_active: true,
        }),
      }),
    onSuccess: async () => {
      setFullName("");
      setEmail("");
      setPassword("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["rop", "users"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Ошибка создания");
    },
  });

  const toggle = useMutation({
    mutationFn: (user: User) =>
      apiFetch<User>(`/rop/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !user.is_active }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["rop", "users"] });
    },
  });

  const managers = (query.data ?? []).filter((user) => user.role === "manager");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-accent">Админка РОПа</p>
        <h2 className="mt-1 text-3xl font-semibold text-navy">Команда</h2>
        <p className="mt-2 text-sm text-slate-600">CRUD менеджеров вашей команды.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Добавить менеджера</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="name">ФИО</Label>
            <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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
          <div className="md:col-span-3">
            <Button
              onClick={() => create.mutate()}
              disabled={
                create.isPending ||
                !fullName.trim() ||
                !email.trim() ||
                password.length < 8
              }
            >
              Создать
            </Button>
            {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Менеджеры</CardTitle>
          <CardDescription>{managers.length}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {managers.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-900">{user.full_name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span>{roleLabel(user.role)}</span>
                <span className="text-xs text-slate-500">
                  {user.is_active ? "активен" : "отключён"}
                </span>
                <Button size="sm" variant="outline" onClick={() => toggle.mutate(user)}>
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
