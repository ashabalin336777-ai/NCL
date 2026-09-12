"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";
import { CLIENT_ROLE_LABELS, DIFFICULTY_LABELS } from "@/lib/labels";
import type { Training } from "@/types/training";

function Score({ label, value }: { label: string; value: number }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-navy">{value}/10</p>
    </div>
  );
}

export default function TrainingAnalysisPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const query = useQuery({
    queryKey: ["training", params.id],
    queryFn: () => apiFetch<Training>(`/trainings/${params.id}`),
    enabled: Boolean(params.id),
  });

  const training = query.data;
  const analysis = training?.analysis;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-accent">Анализ Sol</p>
          <h2 className="mt-1 text-3xl font-semibold text-navy">Разбор полётов</h2>
          {training ? (
            <p className="mt-2 text-sm text-slate-600">
              {DIFFICULTY_LABELS[training.difficulty]} ·{" "}
              {CLIENT_ROLE_LABELS[training.client_role]}
            </p>
          ) : null}
        </div>
        <Link
          href={`/trainings/${params.id}`}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          К сессии
        </Link>
      </div>

      {query.isLoading ? <p className="text-sm text-slate-500">Загрузка…</p> : null}

      {!analysis ? (
        <Card>
          <CardHeader>
            <CardTitle>Анализ ещё не готов</CardTitle>
            <CardDescription>
              Завершите тренировку кнопкой «Завершить и разобрать», чтобы Sol выставил оценки.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Score label="Итог" value={analysis.overall_score} />
            <Score label="Потребности" value={analysis.needs_score} />
            <Score label="Презентация" value={analysis.presentation_score} />
            <Score label="Закрытие" value={analysis.objections_score} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Резюме</CardTitle>
              <CardDescription>Outcome: {analysis.summary_json.outcome ?? "—"}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm leading-7 text-slate-700">
              {analysis.summary_json.text}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Сильные стороны</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                  {analysis.strengths_json.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Зоны роста</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
                  {analysis.improvements_json.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {training?.hidden_card ? (
            <Card>
              <CardHeader>
                <CardTitle>Скрытая карточка клиента</CardTitle>
                <CardDescription>
                  {training.hidden_card.company_name} · {training.hidden_card.contact_name}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-slate-700">
                <p>
                  <span className="font-medium text-navy">Боль:</span>{" "}
                  {training.hidden_card.hidden_pain}
                </p>
                <p>
                  <span className="font-medium text-navy">Поверхностный запрос:</span>{" "}
                  {training.hidden_card.surface_request}
                </p>
                <p>
                  <span className="font-medium text-navy">Следующий шаг при доверии:</span>{" "}
                  {training.hidden_card.next_step_if_convinced}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
