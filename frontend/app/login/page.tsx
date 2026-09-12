"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/cookies";
import { useAuthStore } from "@/store/auth";

function LoginForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const loading = useAuthStore((state) => state.loading);
  const [email, setEmail] = useState("manager1@ncl.local");
  const [password, setPassword] = useState("ChangeMe_Manager_123");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (getAccessToken()) {
      router.replace(searchParams.get("next") || "/dashboard");
    }
  }, [router, searchParams]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace(searchParams.get("next") || "/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось войти");
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">NeuroCloser</p>
        <CardTitle className="text-2xl">NCL Sales Trainer</CardTitle>
        <CardDescription>
          Тренажёр дожатия сделок с ИИ для менеджеров B2B-продаж электронных компонентов.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </div>
          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          <Button className="w-full" type="submit" disabled={loading}>
            {loading ? "Входим…" : "Войти"}
          </Button>
        </form>
        <p className="mt-5 text-xs leading-5 text-slate-500">
          Seed: `manager1@ncl.local` / `ChangeMe_Manager_123` · РОП: `admin@ncl.local`
        </p>
      </CardContent>
    </Card>
  );
}

export default function LoginPage(): React.JSX.Element {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(30,58,138,0.12),_transparent_40%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.14),_transparent_35%)]" />
      <div className="relative z-10 w-full max-w-md">
        <Suspense fallback={<div className="text-sm text-slate-500">Загрузка…</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
