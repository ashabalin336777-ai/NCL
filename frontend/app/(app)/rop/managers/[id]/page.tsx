"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { RoleGate } from "@/components/auth/role-gate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { ManagerStats, TrainingListItem } from "@/types/api";

export default function RopManagerPage(): React.JSX.Element {
  return (
    <RoleGate allow={["admin", "developer"]}>
      <ManagerInner />
    </RoleGate>
  );
}

function ManagerInner(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const managerId = params.id;

  const statsQuery = useQuery({
    queryKey: ["rop", "manager", managerId],
    queryFn: () => apiFetch<ManagerStats>(`/rop/stats/managers/${managerId}`),
    enabled: Boolean(managerId),
  });
  const trainingsQuery = useQuery({
    queryKey: ["rop", "manager", managerId, "trainings"],
    queryFn: () =>
      apiFetch<TrainingListItem[]>(`/rop/trainings?manager_id=${managerId}&limit=50`),
    enabled: Boolean(managerId),
  });

  const stats = statsQuery.data;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <Link href="/rop/analytics" className="text-sm text-accent hover:underline">
          ← К аналитике
        </Link>
        <h2 className="mt-2 text-3xl font-semibold text-slate-50">
          {stats?.manager_name ?? "Менеджер"}
        </h2>
        <p className="text-sm text-slate-500">{stats?.manager_email}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Тренировок</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-semibold text-slate-50">
            {stats?.trainings_total ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Завершено</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-semibold text-slate-50">
            {stats?.trainings_completed ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Средний балл</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-semibold text-slate-50">
            {stats?.average_overall_score ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Расход AI</CardTitle>
          </CardHeader>
          <CardContent className="font-mono text-2xl font-semibold text-slate-50">
            {stats ? `${Number(stats.total_cost_rub).toFixed(2)} ₽` : "—"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Сессии</CardTitle>
          <CardDescription>Разбор Sol / радар</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(trainingsQuery.data ?? []).map((item) => (
            <Link
              key={item.id}
              href={
                item.status === "completed" || item.status === "aborted"
                  ? `/trainings/analysis/${item.id}`
                  : `/trainings/${item.id}`
              }
              className="flex justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm transition hover:border-accent/40 hover:bg-white/[0.04]"
            >
              <span className="text-slate-300">
                {new Date(item.created_at).toLocaleString("ru-RU")} · {item.status}
              </span>
              <div className="text-right">
                <span className="font-semibold text-slate-50">
                  {item.overall_score != null ? `${item.overall_score}/10` : "—"}
                </span>
                <p className="text-xs font-medium text-slate-500">
                  {Number(item.total_cost_rub).toFixed(2)} ₽
                </p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
