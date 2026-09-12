"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Flag, Loader2 } from "lucide-react";

import { ChatComposer } from "@/components/training/chat-composer";
import { ChatMessages } from "@/components/training/chat-messages";
import { HintsPanel } from "@/components/training/hints-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/cookies";
import { CLIENT_ROLE_LABELS, DIFFICULTY_LABELS, STATUS_LABELS } from "@/lib/labels";
import type { Hint, Training, TrainingCompleteResponse } from "@/types/training";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

export default function TrainingSessionPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sending, setSending] = useState(false);
  const [pendingAssistant, setPendingAssistant] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);

  const trainingQuery = useQuery({
    queryKey: ["training", params.id],
    queryFn: () => apiFetch<Training>(`/trainings/${params.id}`),
    enabled: Boolean(params.id),
    refetchOnWindowFocus: false,
  });

  const training = trainingQuery.data;
  const active =
    training?.status === "created" || training?.status === "in_progress";

  async function refreshTraining(): Promise<Training> {
    const fresh = await apiFetch<Training>(`/trainings/${params.id}`);
    queryClient.setQueryData(["training", params.id], fresh);
    await queryClient.invalidateQueries({ queryKey: ["trainings"] });
    await queryClient.invalidateQueries({ queryKey: ["stats", "me"] });
    return fresh;
  }

  async function sendMessage(content: string): Promise<void> {
    if (!training || !active) {
      return;
    }
    setSending(true);
    setError(null);
    setPendingAssistant("");

    const optimistic: Training = {
      ...training,
      messages: [
        ...training.messages,
        {
          id: `local-${Date.now()}`,
          role: "user",
          content,
          tokens_used: 0,
          cost_rub: "0",
          created_at: new Date().toISOString(),
        },
      ],
    };
    queryClient.setQueryData(["training", params.id], optimistic);

    try {
      const token = getAccessToken();
      const response = await fetch(`${API_BASE}/trainings/${params.id}/messages/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content }),
      });

      if (!response.ok || !response.body) {
        // fallback to non-stream
        await apiFetch<Training>(`/trainings/${params.id}/messages`, {
          method: "POST",
          body: JSON.stringify({ content }),
        });
        await refreshTraining();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk
            .split("\n")
            .find((item) => item.startsWith("data:"));
          if (!line) {
            continue;
          }
          const payload = JSON.parse(line.slice(5).trim()) as {
            delta?: string;
            done?: boolean;
          };
          if (payload.delta) {
            assembled += payload.delta;
            setPendingAssistant(assembled);
          }
        }
      }

      await refreshTraining();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка отправки сообщения");
      await refreshTraining();
    } finally {
      setPendingAssistant("");
      setSending(false);
    }
  }

  async function requestHint(): Promise<void> {
    setHintLoading(true);
    setError(null);
    try {
      const hint = await apiFetch<Hint>(`/trainings/${params.id}/hints`, {
        method: "POST",
      });
      queryClient.setQueryData<Training>(["training", params.id], (current) =>
        current
          ? { ...current, hints: [...current.hints, hint] }
          : current,
      );
      await refreshTraining();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось получить подсказку");
    } finally {
      setHintLoading(false);
    }
  }

  const completeMutation = useMutation({
    mutationFn: async () =>
      apiFetch<TrainingCompleteResponse>(`/trainings/${params.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ run_analysis: true }),
      }),
    onSuccess: async (data) => {
      queryClient.setQueryData(["training", params.id], data);
      await queryClient.invalidateQueries({ queryKey: ["trainings"] });
      await queryClient.invalidateQueries({ queryKey: ["stats", "me"] });
      router.push(`/trainings/${params.id}/analysis`);
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Не удалось завершить тренировку");
    },
  });

  const abortMutation = useMutation({
    mutationFn: async () =>
      apiFetch<Training>(`/trainings/${params.id}/abort`, { method: "POST" }),
    onSuccess: async (data) => {
      queryClient.setQueryData(["training", params.id], data);
      await queryClient.invalidateQueries({ queryKey: ["trainings"] });
    },
  });

  if (trainingQuery.isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Загружаем сессию…
      </div>
    );
  }

  if (!training) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-700">Тренировка не найдена</p>
        <Link href="/trainings" className="text-sm text-navy underline">
          К списку
        </Link>
      </div>
    );
  }

  if (!active) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Сессия завершена</CardTitle>
            <CardDescription>
              Статус: {STATUS_LABELS[training.status] ?? training.status}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Link
              href={`/trainings/${training.id}/analysis`}
              className="inline-flex h-10 items-center rounded-lg bg-navy px-4 text-sm font-medium text-white"
            >
              Открыть анализ
            </Link>
            <Link
              href="/trainings"
              className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm"
            >
              К списку
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] w-full max-w-7xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-accent">Переговоры</p>
          <h2 className="text-2xl font-semibold text-navy">
            {DIFFICULTY_LABELS[training.difficulty]} ·{" "}
            {CLIENT_ROLE_LABELS[training.client_role]}
          </h2>
          <p className="text-xs text-slate-500">
            Стоимость сессии: {Number(training.total_cost_rub).toFixed(4)} ₽ · цель — следующий шаг
            (BOM / встреча / NDA)
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={abortMutation.isPending || completeMutation.isPending}
            onClick={() => abortMutation.mutate()}
          >
            <Flag className="h-4 w-4" />
            Прервать
          </Button>
          <Button
            disabled={completeMutation.isPending || sending}
            onClick={() => completeMutation.mutate()}
          >
            {completeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Завершить и разобрать
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.6fr_0.9fr]">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="min-h-0 flex-1">
            <ChatMessages
              messages={training.messages}
              pendingAssistant={pendingAssistant}
              sending={sending}
            />
          </div>
          <ChatComposer disabled={!active} sending={sending} onSend={sendMessage} />
        </div>
        <div className="min-h-0">
          <HintsPanel
            hints={training.hints}
            loading={hintLoading}
            disabled={!active || sending}
            onRequestHint={requestHint}
          />
        </div>
      </div>
    </div>
  );
}
