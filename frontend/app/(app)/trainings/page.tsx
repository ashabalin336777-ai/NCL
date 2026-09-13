"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { NewTrainingForm } from "@/components/training/new-training-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import {
  CLIENT_ROLE_LABELS,
  DIFFICULTY_LABELS,
  OUTCOME_LABELS,
  STATUS_LABELS,
} from "@/lib/labels";
import { useAuthStore } from "@/store/auth";
import type { TrainingListItem } from "@/types/api";

function ruLabel(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) {
    return "";
  }
  const key = String(value).trim();
  return map[key] ?? key;
}

export default function TrainingsPage(): React.JSX.Element {
  const user = useAuthStore((state) => state.user);
  const trainingsQuery = useQuery({
    queryKey: ["trainings", "history"],
    queryFn: () => apiFetch<TrainingListItem[]>("/trainings?limit=50"),
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-accent">Тренировки</p>
        <h2 className="mt-1 text-3xl font-semibold text-navy">Дожатие сделок</h2>
        <p className="mt-2 text-sm text-slate-600">
          Выберите сложность и роль клиента, ведите переговоры, просите совет Terra и завершайте
          разбор через Sol.
        </p>
      </div>

      <NewTrainingForm />

      <Card>
        <CardHeader>
          <CardTitle>История сессий</CardTitle>
          <CardDescription>
            {trainingsQuery.isLoading
              ? "Загрузка…"
              : `${trainingsQuery.data?.length ?? 0} записей`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(trainingsQuery.data ?? []).map((item) => {
            const statusRu = ruLabel(STATUS_LABELS, item.status);
            const outcomeRu = item.outcome ? ruLabel(OUTCOME_LABELS, item.outcome) : "";
            return (
              <Link
                key={item.id}
                href={
                  item.status === "completed" || item.status === "aborted"
                    ? `/trainings/analysis/${item.id}`
                    : `/trainings/${item.id}`
                }
                className="grid gap-2 rounded-xl border border-slate-200 px-4 py-3 transition hover:border-navy/30 hover:bg-navy-50 md:grid-cols-[1.4fr_1fr_auto]"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {ruLabel(DIFFICULTY_LABELS, item.difficulty)} ·{" "}
                    {ruLabel(CLIENT_ROLE_LABELS, item.client_role)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.industry ? `${item.industry} · ` : ""}
                    {new Date(item.created_at).toLocaleString("ru-RU")}
                  </p>
                  {user?.role === "admin" && item.manager_name ? (
                    <p className="text-xs text-slate-500">{item.manager_name}</p>
                  ) : null}
                </div>
                <div className="text-sm text-slate-600">
                  {outcomeRu ? `${statusRu} · ${outcomeRu}` : statusRu}
                </div>
                <div className="text-sm font-semibold text-navy">
                  {item.overall_score != null ? `${item.overall_score}/10` : "без оценки"}
                </div>
              </Link>
            );
          })}
          {!trainingsQuery.isLoading && (trainingsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-500">Тренировок пока нет — создайте первую выше.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
