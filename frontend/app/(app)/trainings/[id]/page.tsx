"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Flag, Loader2 } from "lucide-react";

import { ChatComposer } from "@/components/training/chat-composer";
import { ChatMessages } from "@/components/training/chat-messages";
import { CompetencyRadar, ZERO_SCORES } from "@/components/training/competency-radar";
import { HintsPanel } from "@/components/training/hints-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, apiFetch } from "@/lib/api";
import { getAccessToken } from "@/lib/cookies";
import { CLIENT_ROLE_LABELS, DIFFICULTY_LABELS, STATUS_LABELS } from "@/lib/labels";
import { useAuthStore } from "@/store/auth";
import type {
  Hint,
  RadarScores,
  Training,
  TrainingCompleteResponse,
} from "@/types/training";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api/v1";

interface AnalyzeMessageResponse {
  scores: RadarScores;
  cost_rub: string;
  latency_ms: number;
  cached?: boolean;
}

export default function TrainingSessionPage(): React.JSX.Element {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [sending, setSending] = useState(false);
  const [pendingAssistant, setPendingAssistant] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hintLoading, setHintLoading] = useState(false);
  const [radarScores, setRadarScores] = useState<RadarScores>(ZERO_SCORES);
  const [radarLoading, setRadarLoading] = useState(false);

  const trainingQuery = useQuery({
    queryKey: ["training", params.id],
    queryFn: () => apiFetch<Training>(`/trainings/${params.id}`),
    enabled: Boolean(params.id),
    refetchOnWindowFocus: false,
  });

  const training = trainingQuery.data;
  const active =
    training?.status === "created" || training?.status === "in_progress";

  useEffect(() => {
    if (training?.radar_scores) {
      setRadarScores(training.radar_scores);
    }
  }, [training?.radar_scores]);

  async function refreshTraining(): Promise<Training> {
    const fresh = await apiFetch<Training>(`/trainings/${params.id}`);
    queryClient.setQueryData(["training", params.id], fresh);
    await queryClient.invalidateQueries({ queryKey: ["trainings"] });
    await queryClient.invalidateQueries({ queryKey: ["stats", "me"] });
    return fresh;
  }

  async function refreshRadar(messageId: string): Promise<void> {
    if (!messageId || messageId.startsWith("local-")) {
      return;
    }
    setRadarLoading(true);
    try {
      const result = await apiFetch<AnalyzeMessageResponse>(
        `/trainings/${params.id}/analyze-message`,
        {
          method: "POST",
          body: JSON.stringify({ message_id: messageId }),
        },
      );
      setRadarScores(result.scores);
    } catch {
      // Keep previous radar scores on timeout/error.
    } finally {
      setRadarLoading(false);
    }
  }

  function lastUserMessageId(session: Training, content: string): string | null {
    for (let index = session.messages.length - 1; index >= 0; index -= 1) {
      const item = session.messages[index];
      if (item.role === "user" && item.content === content && !item.id.startsWith("local-")) {
        return item.id;
      }
    }
    const lastUser = [...session.messages].reverse().find((item) => item.role === "user");
    return lastUser && !lastUser.id.startsWith("local-") ? lastUser.id : null;
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

      const useFallback = async (): Promise<Training> => {
        await apiFetch<Training>(`/trainings/${params.id}/messages`, {
          method: "POST",
          body: JSON.stringify({ content }),
        });
        return refreshTraining();
      };

      let fresh: Training | null = null;

      if (!response.ok || !response.body) {
        fresh = await useFallback();
      } else {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assembled = "";
        let sawDone = false;

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
            try {
              const payload = JSON.parse(line.slice(5).trim()) as {
                delta?: string;
                done?: boolean;
                error?: string;
              };
              if (payload.error) {
                throw new Error(payload.error);
              }
              if (payload.delta) {
                assembled += payload.delta;
                setPendingAssistant(assembled);
              }
              if (payload.done) {
                sawDone = true;
              }
            } catch (parseError) {
              if (parseError instanceof SyntaxError) {
                continue;
              }
              throw parseError;
            }
          }
        }

        if (!sawDone) {
          await refreshTraining();
          const current = queryClient.getQueryData<Training>(["training", params.id]);
          const last = current?.messages.at(-1);
          const prev = current?.messages.at(-2);
          const alreadyOk =
            last?.role === "assistant" &&
            (prev?.content === content || Boolean(assembled.trim()));
          if (!alreadyOk) {
            fresh = await useFallback();
          } else {
            fresh = current ?? (await refreshTraining());
          }
        } else {
          fresh = await refreshTraining();
        }
      }

      const session = fresh ?? (await refreshTraining());
      const messageId = lastUserMessageId(session, content);
      if (messageId) {
        void refreshRadar(messageId);
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Ошибка отправки сообщения. Нажмите «Отправить» ещё раз.",
      );
      await refreshTraining();
      throw err;
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
        current ? { ...current, hints: [...current.hints, hint] } : current,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось получить совет Terra");
    } finally {
      setHintLoading(false);
    }
  }

  const completeMutation = useMutation({
    mutationFn: () =>
      apiFetch<TrainingCompleteResponse>(`/trainings/${params.id}/complete`, {
        method: "POST",
        body: JSON.stringify({ run_analysis: false }),
      }),
    onSuccess: async (result) => {
      queryClient.setQueryData(["training", params.id], result);
      await queryClient.invalidateQueries({ queryKey: ["trainings"] });
      await queryClient.invalidateQueries({ queryKey: ["stats", "me"] });
      router.push(`/trainings/analysis/${params.id}`);
    },
    onError: async (err) => {
      const message =
        err instanceof ApiError ? err.message : "Не удалось завершить тренировку";
      // Double-click / race: session already closed on server — go to analysis.
      if (
        err instanceof ApiError &&
        (err.status === 409 || /already finished|уже заверш/i.test(message))
      ) {
        try {
          const fresh = await refreshTraining();
          if (fresh.status === "completed" || fresh.status === "aborted") {
            router.push(`/trainings/analysis/${params.id}`);
            return;
          }
        } catch {
          router.push(`/trainings/analysis/${params.id}`);
          return;
        }
      }
      setError(message);
    },
  });

  const abortMutation = useMutation({
    mutationFn: () =>
      apiFetch<Training>(`/trainings/${params.id}/abort`, { method: "POST" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["trainings"] });
      router.push("/trainings");
    },
  });

  if (trainingQuery.isLoading) {
    return <p className="text-sm text-slate-500">Загрузка сессии…</p>;
  }

  if (!training) {
    return (
      <div className="mx-auto max-w-xl">
        <p className="text-sm text-slate-600">Тренировка не найдена.</p>
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
              href={`/trainings/analysis/${training.id}`}
              className="inline-flex h-10 items-center rounded-lg bg-navy px-4 text-sm font-medium text-white"
            >
              Открыть разбор
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
            {training.client_brief
              ? `${training.client_brief.company_name} · ${training.client_brief.contact_name}`
              : `${DIFFICULTY_LABELS[training.difficulty]} · ${CLIENT_ROLE_LABELS[training.client_role]}`}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {DIFFICULTY_LABELS[training.difficulty]} ·{" "}
            {CLIENT_ROLE_LABELS[training.client_role]}
            {training.client_brief?.industry ? ` · ${training.client_brief.industry}` : ""}
          </p>
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
              managerName={user?.full_name}
              clientLabel={
                training.client_label ??
                (training.client_brief
                  ? `${training.client_brief.contact_name}, ${training.client_brief.company_name}`
                  : training.hidden_card
                    ? `${training.hidden_card.contact_name}, ${training.hidden_card.company_name}`
                    : null)
              }
              clientName={
                training.client_brief?.contact_name ??
                training.hidden_card?.contact_name
              }
              clientCompany={
                training.client_brief?.company_name ??
                training.hidden_card?.company_name
              }
            />
          </div>
          <ChatComposer disabled={!active} sending={sending} onSend={sendMessage} />
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-y-auto">
          <CompetencyRadar
            data={radarScores}
            isLoading={radarLoading}
            managerReplies={training.messages.filter((item) => item.role === "user").length}
            hintRequests={training.hints.length}
          />
          <div className="min-h-0 flex-1">
            <HintsPanel
              hints={training.hints}
              loading={hintLoading}
              disabled={!active || sending}
              onRequestHint={requestHint}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
