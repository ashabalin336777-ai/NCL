"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, MessageSquare } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import type { ManagerStats, TrainingListItem } from "@/types/api";

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-navy">{value}</p>
    </div>
  );
}

export default function DashboardPage(): React.JSX.Element {
  const user = useAuthStore((state) => state.user);
  const statsQuery = useQuery({
    queryKey: ["stats", "me"],
    queryFn: () => apiFetch<ManagerStats>("/stats/me"),
  });
  const trainingsQuery = useQuery({
    queryKey: ["trainings", "recent"],
    queryFn: () => apiFetch<TrainingListItem[]>("/trainings?limit=5"),
  });

  const stats = statsQuery.data;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-accent">Рабочий стол</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-navy">
            Здравствуйте, {user?.full_name.split(" ")[0]}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Тренируйте выявление производственной боли, экспертную презентацию и закрытие на
            следующий шаг: BOM, встреча с инженером, NDA.
          </p>
        </div>
          <Link
            href="/trainings"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-navy px-4 text-sm font-medium text-white hover:bg-navy-700"
          >
            Начать тренировку
            <ArrowRight className="h-4 w-4" />
          </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Всего тренировок" value={String(stats?.trainings_total ?? "—")} />
        <Stat label="Завершено" value={String(stats?.trainings_completed ?? "—")} />
        <Stat
          label="Средний балл"
          value={stats?.average_overall_score != null ? String(stats.average_overall_score) : "—"}
        />
        <Stat
          label="Стоимость AI, ₽"
          value={stats ? Number(stats.total_cost_rub).toFixed(2) : "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-accent" />
              Недавние тренировки
            </CardTitle>
            <CardDescription>Последние сессии с AI-клиентом</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(trainingsQuery.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">Пока нет тренировок. Создайте первую на следующем этапе UI.</p>
            ) : (
              trainingsQuery.data?.map((item) => (
                <Link
                  key={item.id}
                  href={
                    item.status === "completed" || item.status === "aborted"
                      ? `/trainings/analysis/${item.id}`
                      : `/trainings/${item.id}`
                  }
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 transition hover:border-navy/30 hover:bg-navy-50"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {item.difficulty} · {item.client_role}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(item.created_at).toLocaleString("ru-RU")} · {item.status}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-navy">
                    {item.overall_score != null ? `${item.overall_score}/10` : "—"}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              Фокус модели продаж
            </CardTitle>
            <CardDescription>Что оценивает Sol</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-600">
            <p>1. Настойчивость и следующий шаг (BOM / встреча / NDA).</p>
            <p>2. Выявление бизнес-боли, а не только номенклатуры.</p>
            <p>3. Экспертная презентация: ОТК, прямые контракты, склад, аналоги.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
