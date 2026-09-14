"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BarChart3, MessageSquare } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  GlassCard,
  GlassCardContent,
  GlassCardDescription,
  GlassCardHeader,
  GlassCardTitle,
} from "@/components/ui/glass-card";
import { apiFetch } from "@/lib/api";
import { CLIENT_ROLE_LABELS, DIFFICULTY_LABELS, OUTCOME_LABELS, STATUS_LABELS } from "@/lib/labels";
import { useAuthStore } from "@/store/auth";
import type { ManagerStats, TrainingListItem } from "@/types/api";

const CHART_FILL = "url(#scoreGradient)";

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

function KpiCard({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <GlassCard className="col-span-12 sm:col-span-6 lg:col-span-3">
      <GlassCardContent className="p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <p className="mt-3 font-mono text-3xl font-semibold tracking-tight text-slate-50">{value}</p>
      </GlassCardContent>
    </GlassCard>
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

  const scoreChart = useMemo(
    () => [
      { name: "Итог", Балл: stats?.average_overall_score ?? 0 },
      { name: "Боль", Балл: stats?.average_needs_score ?? 0 },
      { name: "Презентация", Балл: stats?.average_presentation_score ?? 0 },
      { name: "Возражения", Балл: stats?.average_objections_score ?? 0 },
    ],
    [stats],
  );

  const outcomeChart = useMemo(() => {
    const entries = Object.entries(stats?.outcomes ?? {});
    return entries.map(([key, value]) => ({
      name: OUTCOME_LABELS[key] ?? key,
      count: value,
    }));
  }, [stats]);

  const hasScores = scoreChart.some((row) => row.Балл > 0);

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-12 gap-4">
      <GlassCard className="col-span-12 hover:border-white/10">
        <GlassCardContent className="flex flex-wrap items-end justify-between gap-4 p-6">
          <div>
            <p className="text-sm font-medium text-accent">Рабочий стол</p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-slate-50">
              Здравствуйте, {user?.full_name.split(" ")[0]}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Тренируйте выявление производственной боли, экспертную презентацию и закрытие на
              следующий шаг: BOM, встреча с инженером, NDA.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/trainings"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-white shadow-[0_0_15px_rgba(249,115,22,0.3)] hover:bg-accent-600"
            >
              Начать тренировку
              <ArrowRight className="h-4 w-4" />
            </Link>
            {user?.role === "admin" || user?.role === "developer" ? (
              <Link
                href="/rop/analytics"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-100 hover:border-accent/40"
              >
                Аналитика команды
              </Link>
            ) : null}
          </div>
        </GlassCardContent>
      </GlassCard>

      <KpiCard label="Всего тренировок" value={String(stats?.trainings_total ?? "—")} />
      <KpiCard label="Завершено" value={String(stats?.trainings_completed ?? "—")} />
      <KpiCard
        label="Средний балл"
        value={stats?.average_overall_score != null ? String(stats.average_overall_score) : "—"}
      />
      <KpiCard
        label="Стоимость AI, ₽"
        value={stats ? Number(stats.total_cost_rub).toFixed(2) : "—"}
      />

      <GlassCard className="col-span-12 lg:col-span-8">
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-accent" />
            Компетенции Sol
          </GlassCardTitle>
          <GlassCardDescription>Средние баллы по вашим завершённым сессиям</GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent className="h-64">
          {hasScores ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scoreChart} barSize={28}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F97316" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#1E3A8A" stopOpacity={0.85} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GlassTooltip />} cursor={{ fill: "rgba(249,115,22,0.08)" }} />
                <Bar dataKey="Балл" radius={[8, 8, 0, 0]} fill={CHART_FILL} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center text-sm text-slate-500">
              После первых разборов Sol здесь появится график компетенций.
            </p>
          )}
        </GlassCardContent>
      </GlassCard>

      <GlassCard className="col-span-12 lg:col-span-4">
        <GlassCardHeader>
          <GlassCardTitle>Фокус модели продаж</GlassCardTitle>
          <GlassCardDescription>Что оценивает Sol</GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent className="space-y-3 text-sm leading-6 text-slate-300">
          <p>1. Настойчивость и следующий шаг (BOM / встреча / NDA).</p>
          <p>2. Выявление бизнес-боли, а не только номенклатуры.</p>
          <p>3. Экспертная презентация: ОТК, прямые контракты, склад, аналоги.</p>
          {outcomeChart.length > 0 ? (
            <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Исходы</p>
              {outcomeChart.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-slate-400">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: index % 2 === 0 ? "#F97316" : "#1D4ED8" }}
                    />
                    {item.name}
                  </span>
                  <span className="font-mono text-slate-100">{item.count}</span>
                </div>
              ))}
            </div>
          ) : null}
        </GlassCardContent>
      </GlassCard>

      <GlassCard className="col-span-12">
        <GlassCardHeader>
          <GlassCardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-accent" />
            Недавние тренировки
          </GlassCardTitle>
          <GlassCardDescription>Последние сессии с AI-клиентом</GlassCardDescription>
        </GlassCardHeader>
        <GlassCardContent className="space-y-3">
          {(trainingsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">Пока нет тренировок. Создайте первую.</p>
          ) : (
            trainingsQuery.data?.map((item) => (
              <Link
                key={item.id}
                href={
                  item.status === "completed" || item.status === "aborted"
                    ? `/trainings/analysis/${item.id}`
                    : `/trainings/${item.id}`
                }
                className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 transition hover:border-accent/40 hover:bg-white/[0.04]"
              >
                <div>
                  <p className="text-sm font-medium text-slate-100">
                    {DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty} ·{" "}
                    {CLIENT_ROLE_LABELS[item.client_role] ?? item.client_role}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.industry ? `${item.industry} · ` : ""}
                    {new Date(item.created_at).toLocaleString("ru-RU")}
                  </p>
                  <p className="text-xs text-slate-400">
                    {STATUS_LABELS[item.status] ?? item.status}
                    {item.outcome ? ` · ${OUTCOME_LABELS[item.outcome] ?? item.outcome}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-sm font-semibold text-slate-50">
                    {item.overall_score != null ? `${item.overall_score}/10` : "без оценки"}
                  </span>
                  <p className="text-xs font-medium font-mono text-slate-500">
                    {Number(item.total_cost_rub).toFixed(2)} ₽
                  </p>
                </div>
              </Link>
            ))
          )}
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
