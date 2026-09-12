"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { NewTrainingForm } from "@/components/training/new-training-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { CLIENT_ROLE_LABELS, DIFFICULTY_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { TrainingListItem } from "@/types/api";

export default function TrainingsPage(): React.JSX.Element {
  const trainingsQuery = useQuery({
    queryKey: ["trainings"],
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
          {(trainingsQuery.data ?? []).map((item) => (
            <Link
              key={item.id}
              href={
                item.status === "completed" || item.status === "aborted"
                  ? `/trainings/${item.id}/analysis`
                  : `/trainings/${item.id}`
              }
              className="grid gap-2 rounded-xl border border-slate-200 px-4 py-3 transition hover:border-navy/30 hover:bg-navy-50 md:grid-cols-[1.4fr_1fr_auto]"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {DIFFICULTY_LABELS[item.difficulty] ?? item.difficulty} ·{" "}
                  {CLIENT_ROLE_LABELS[item.client_role] ?? item.client_role}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(item.created_at).toLocaleString("ru-RU")}
                </p>
              </div>
              <div className="text-sm text-slate-600">
                {STATUS_LABELS[item.status] ?? item.status}
                {item.outcome ? ` · ${item.outcome}` : ""}
              </div>
              <div className="text-sm font-semibold text-navy">
                {item.overall_score != null ? `${item.overall_score}/10` : "без оценки"}
              </div>
            </Link>
          ))}
          {!trainingsQuery.isLoading && (trainingsQuery.data?.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-500">Тренировок пока нет — создайте первую выше.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
