"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { RoleGate } from "@/components/auth/role-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldTextareaClass } from "@/lib/utils";
import type { PromptItem } from "@/types/api";

const PROMPT_NAMES = [
  "client",
  "card_generator",
  "terra_hint",
  "sol_analyst",
  "radar_analyzer",
] as const;

const PROMPT_LABELS: Record<string, string> = {
  client: "Клиент (диалог)",
  card_generator: "Карточка клиента",
  terra_hint: "Terra (подсказки)",
  sol_analyst: "Sol (разбор)",
  radar_analyzer: "Радар реплики",
};

export default function DevPromptsPage(): React.JSX.Element {
  return (
    <RoleGate allow={["developer"]}>
      <PromptsInner />
    </RoleGate>
  );
}

function PromptsInner(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string>("client");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["dev", "prompts"],
    queryFn: () => apiFetch<PromptItem[]>("/dev/prompts"),
  });

  const versions = useMemo(
    () => (query.data ?? []).filter((item) => item.name === selected),
    [query.data, selected],
  );
  const active = versions.find((item) => item.is_active) ?? versions[0];

  useEffect(() => {
    if (active) {
      setText(active.system_prompt_text);
    } else {
      setText("");
    }
  }, [active?.id, selected]);

  const createVersion = useMutation({
    mutationFn: () =>
      apiFetch<PromptItem>("/dev/prompts", {
        method: "POST",
        body: JSON.stringify({
          name: selected,
          system_prompt_text: text,
          activate: true,
        }),
      }),
    onSuccess: async () => {
      setMessage("Новая версия сохранена и активирована");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["dev", "prompts"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Ошибка сохранения");
    },
  });

  const activate = useMutation({
    mutationFn: (id: string) =>
      apiFetch<PromptItem>(`/dev/prompts/${id}/activate`, { method: "POST" }),
    onSuccess: async (item) => {
      setText(item.system_prompt_text);
      setMessage(`Активирована версия ${item.version}`);
      await queryClient.invalidateQueries({ queryKey: ["dev", "prompts"] });
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-accent">Админка разработчика</p>
        <h2 className="mt-1 text-3xl font-semibold text-slate-50">Промпты</h2>
        <p className="mt-2 text-sm text-slate-400">
          Версионирование system-промптов. Новая версия при сохранении активируется сразу.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PROMPT_NAMES.map((name) => (
          <Button
            key={name}
            variant={selected === name ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSelected(name);
              setError(null);
              setMessage(null);
            }}
          >
            {PROMPT_LABELS[name]}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{PROMPT_LABELS[selected] ?? selected}</CardTitle>
          <CardDescription>
            Активная версия: {active ? `v${active.version}` : "—"} · всего {versions.length}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="prompt">system_prompt_text</Label>
            <textarea
              id="prompt"
              className={`${fieldTextareaClass} mt-1 min-h-[320px] font-mono text-xs leading-5`}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => createVersion.mutate()}
              disabled={createVersion.isPending || !text.trim()}
            >
              Сохранить как новую версию
            </Button>
            {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-300">История версий</p>
            {versions.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 text-sm text-slate-200"
              >
                <span>
                  v{item.version}
                  {item.is_active ? " · активна" : ""}
                </span>
                {!item.is_active ? (
                  <Button size="sm" variant="outline" onClick={() => activate.mutate(item.id)}>
                    Активировать
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
