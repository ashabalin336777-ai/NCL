"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { RoleGate } from "@/components/auth/role-gate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import type { StatsSeriesPoint, TeamStats, TrainingListItem } from "@/types/api";

function GlassTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string }>;
  label?: string;
}): React.JSX.Element | null {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/80 px-3 py-2 text-xs text-slate-100 shadow-glow-accent backdrop-blur-md">
      <p className="mb-1 font-medium text-slate-300">{label}</p>
      {payload.map((item) => (
        <p key={item.name}>
          {item.name}: <span className="font-mono font-semibold">{item.value ?? "—"}</span>
        </p>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 font-mono text-2xl font-semibold text-slate-50">{value}</p>
    </div>
  );
}

export default function RopAnalyticsPage(): React.JSX.Element {
  return (
    <RoleGate allow={["admin", "developer"]}>
      <AnalyticsInner />
    </RoleGate>
  );
}

function AnalyticsInner(): React.JSX.Element {
  const teamQuery = useQuery({
    queryKey: ["rop", "team"],
    queryFn: () => apiFetch<TeamStats>("/rop/stats/team"),
  });
  const seriesQuery = useQuery({
    queryKey: ["rop", "series"],
    queryFn: () => apiFetch<StatsSeriesPoint[]>("/rop/stats/series?granularity=week"),
  });
  const trainingsQuery = useQuery({
    queryKey: ["rop", "trainings"],
    queryFn: () => apiFetch<TrainingListItem[]>("/rop/trainings?limit=30"),
  });

  const team = teamQuery.data;
  const chartData = (seriesQuery.data ?? []).map((point) => ({
    period: point.period,
    score: point.average_overall_score,
    count: point.trainings_count,
  }));

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-accent">Админка РОПа</p>
        <h2 className="mt-1 text-3xl font-semibold text-slate-50">Аналитика команды</h2>
        <p className="mt-2 text-sm text-slate-400">
          Прогресс тренировок менеджеров и динамика среднего балла Sol.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Тренировок" value={String(team?.trainings_total ?? "—")} />
        <Stat label="Завершено" value={String(team?.trainings_completed ?? "—")} />
        <Stat
          label="% завершения"
          value={team ? `${team.completion_rate}%` : "—"}
        />
        <Stat
          label="Средний балл"
          value={
            team?.average_overall_score != null ? String(team.average_overall_score) : "—"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Динамика по неделям</CardTitle>
          <CardDescription>Средний overall score Sol</CardDescription>
        </CardHeader>
        <CardContent className="h-72">
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-500">Пока недостаточно данных для графика.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GlassTooltip />} cursor={{ stroke: "rgba(249,115,22,0.35)" }} />
                <Line type="monotone" dataKey="score" name="Балл" stroke="#F97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Менеджеры</CardTitle>
          <CardDescription>Кликните для детализации</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(team?.managers ?? []).map((manager) => (
            <Link
              key={manager.manager_id ?? manager.manager_email}
              href={`/rop/managers/${manager.manager_id}`}
              className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition hover:border-accent/40 hover:bg-white/[0.04]"
            >
              <div>
                <p className="font-medium text-slate-100">{manager.manager_name}</p>
                <p className="text-xs text-slate-500">{manager.manager_email}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-semibold text-slate-50">
                  {manager.average_overall_score != null
                    ? `${manager.average_overall_score}/10`
                    : "без оценки"}
                </p>
                <p className="text-xs text-slate-500">
                  {manager.trainings_completed}/{manager.trainings_total} завершено
                </p>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Последние тренировки команды</CardTitle>
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
              className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-sm transition hover:border-accent/40 hover:bg-white/[0.04]"
            >
              <div>
                <p className="font-medium text-slate-100">
                  {item.manager_name ?? "Менеджер"} · {item.difficulty}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(item.created_at).toLocaleString("ru-RU")}
                  {item.outcome ? ` · ${item.outcome}` : ""}
                </p>
              </div>
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
