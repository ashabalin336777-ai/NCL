"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { RoleGate } from "@/components/auth/role-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";
import { DEFAULT_SOL_MODEL_ID, SOL_MODEL_OPTIONS } from "@/lib/sol-models";
import { cn, fieldSelectClass, fieldTextareaClass } from "@/lib/utils";
import type { AISetting } from "@/types/api";

const SETTING_LABELS: Record<string, string> = {
  llm_base_url: "URL NeuralDEEP",
  llm_api_key: "API-ключ",
  client_model_id: "Модель чата (клиент)",
  card_model_id: "Модель карточки",
  hint_model_id: "Модель Terra",
  analyst_model_id: "Модель Sol",
  radar_model_id: "Модель радара",
  cost_per_1k_input_tokens_rub: "Тариф вход / 1k (fallback)",
  cost_per_1k_output_tokens_rub: "Тариф выход / 1k (fallback)",
  llm_timeout_seconds: "Таймаут LLM, сек",
  billing_min_reserve_rub: "Мин. резерв баланса, ₽",
  billing_markup_multiplier: "Множитель наценки (×)",
};

const EDITABLE_SCALAR = [
  "llm_base_url",
  "llm_api_key",
  "client_model_id",
  "card_model_id",
  "hint_model_id",
  "analyst_model_id",
  "radar_model_id",
  "cost_per_1k_input_tokens_rub",
  "cost_per_1k_output_tokens_rub",
  "llm_timeout_seconds",
  "billing_min_reserve_rub",
  "billing_markup_multiplier",
];

/** Sol has a dedicated selector card — hide from the generic inputs list. */
const GENERIC_SCALAR = EDITABLE_SCALAR.filter(
  (key) => key !== "billing_markup_multiplier" && key !== "analyst_model_id",
);

function isNumericSetting(key: string): boolean {
  return (
    key.includes("cost") ||
    key.includes("timeout") ||
    key.includes("reserve") ||
    key.includes("markup")
  );
}

export default function DevAiSettingsPage(): React.JSX.Element {
  return (
    <RoleGate allow={["developer"]}>
      <SettingsInner />
    </RoleGate>
  );
}

function SettingsInner(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [tariffsJson, setTariffsJson] = useState("{}");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["dev", "settings"],
    queryFn: () => apiFetch<AISetting[]>("/dev/settings"),
  });

  useEffect(() => {
    if (!query.data) return;
    const map: Record<string, unknown> = {};
    for (const item of query.data) {
      map[item.key] = item.value;
    }
    const next: Record<string, string> = {};
    for (const key of EDITABLE_SCALAR) {
      const raw = map[key];
      next[key] =
        key === "llm_api_key"
          ? ""
          : raw == null
            ? key === "billing_markup_multiplier"
              ? "15"
              : key === "analyst_model_id"
                ? DEFAULT_SOL_MODEL_ID
                : ""
            : typeof raw === "string"
              ? raw
              : String(raw);
    }
    if (!SOL_MODEL_OPTIONS.some((item) => item.id === next.analyst_model_id)) {
      next.analyst_model_id = DEFAULT_SOL_MODEL_ID;
    }
    setDraft(next);
    const tariffs = map.model_tariffs;
    try {
      setTariffsJson(tariffs ? JSON.stringify(tariffs, null, 2) : "{}");
    } catch {
      setTariffsJson("{}");
    }
  }, [query.dataUpdatedAt]);

  const markup = Number(draft.billing_markup_multiplier || 15);
  const selectedSol = SOL_MODEL_OPTIONS.find((item) => item.id === draft.analyst_model_id);
  const customerPreview = useMemo(() => {
    try {
      const base = JSON.parse(tariffsJson) as Record<
        string,
        { input?: number; output?: number }
      >;
      const mult = Number.isFinite(markup) && markup > 0 ? markup : 15;
      const priced: Record<string, { input: number; output: number }> = {};
      for (const [model, rates] of Object.entries(base)) {
        priced[model] = {
          input: Number(((rates.input ?? 0) * mult).toFixed(6)),
          output: Number(((rates.output ?? 0) * mult).toFixed(6)),
        };
      }
      return JSON.stringify(priced, null, 2);
    } catch {
      return "—";
    }
  }, [tariffsJson, markup]);

  const save = useMutation({
    mutationFn: async () => {
      const settings: Record<string, unknown> = {};
      for (const key of EDITABLE_SCALAR) {
        const value = draft[key] ?? "";
        if (key === "llm_api_key" && !value.trim()) continue;
        if (isNumericSetting(key)) {
          const num = Number(value);
          if (Number.isNaN(num)) {
            throw new ApiError(400, `Некорректное число в поле ${key}`);
          }
          settings[key] = num;
        } else {
          settings[key] = value;
        }
      }
      try {
        settings.model_tariffs = JSON.parse(tariffsJson) as Record<string, unknown>;
      } catch {
        throw new ApiError(400, "model_tariffs: невалидный JSON");
      }
      return apiFetch<AISetting[]>("/dev/settings", {
        method: "PUT",
        body: JSON.stringify({ settings }),
      });
    },
    onSuccess: async () => {
      setMessage("Сохранено");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["dev", "settings"] });
    },
    onError: (err: unknown) => {
      setMessage(null);
      setError(err instanceof ApiError ? err.message : "Ошибка сохранения");
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-accent">Админка разработчика</p>
        <h2 className="mt-1 text-3xl font-semibold text-slate-50">AI-настройки и тарифы</h2>
        <p className="mt-2 text-sm text-slate-400">
          `model_tariffs` — себестоимость NeuralDEEP. Клиенту (менеджер/РОП) начисляется{" "}
          <strong>себестоимость × множитель</strong> за каждый вызов LLM.
        </p>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-slate-500">Загрузка настроек…</p>
      ) : null}
      {query.isError ? (
        <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          Не удалось загрузить настройки:{" "}
          {query.error instanceof ApiError ? query.error.message : "ошибка API"}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Модель Sol (аналитик)</CardTitle>
          <CardDescription>
            Короткий список NeuralDEEP для разбора сессий: качество JSON и скорость. Сейчас в API
            гарантированно доступны 27B-noreason и 35B-A3B-noreason; FP8/Int4 — на будущее, как только
            вендор опубликует их в каталоге. Сохранение — кнопкой внизу страницы.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-[220px_1fr] md:items-center">
            <Label htmlFor="analyst_model_id">Выбранная модель</Label>
            <select
              id="analyst_model_id"
              className={fieldSelectClass}
              value={draft.analyst_model_id ?? DEFAULT_SOL_MODEL_ID}
              onChange={(e) =>
                setDraft((prev) => ({ ...prev, analyst_model_id: e.target.value }))
              }
            >
              {SOL_MODEL_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                  {item.recommended ? " · рекомендуется" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3">
            {SOL_MODEL_OPTIONS.map((item) => {
              const active = (draft.analyst_model_id ?? DEFAULT_SOL_MODEL_ID) === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, analyst_model_id: item.id }))}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-left transition",
                    active
                      ? "border-accent/50 bg-accent/10"
                      : "border-white/5 bg-white/[0.02] hover:border-accent/30",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-100">{item.title}</p>
                    {item.recommended ? (
                      <span className="rounded-md bg-accent/20 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-accent">
                        Рекомендуется
                      </span>
                    ) : null}
                    {active ? (
                      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        выбрано
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-xs text-slate-500">{item.id}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{item.comment}</p>
                </button>
              );
            })}
          </div>

          {selectedSol ? (
            <p className="text-sm text-slate-400">
              Сейчас для Sol: <span className="text-slate-200">{selectedSol.title}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Наценка на токены</CardTitle>
          <CardDescription>
            Множитель применяется ко всем списаниям: карточка, диалог, Terra, радар, Sol
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[220px_1fr]">
          <Label htmlFor="billing_markup_multiplier">
            {SETTING_LABELS.billing_markup_multiplier}
          </Label>
          <Input
            id="billing_markup_multiplier"
            type="number"
            min={0.01}
            step="0.1"
            value={draft.billing_markup_multiplier ?? "15"}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, billing_markup_multiplier: e.target.value }))
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Параметры runtime</CardTitle>
          <CardDescription>
            Пустой API-ключ при сохранении оставляет текущее значение
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {GENERIC_SCALAR.map((key) => (
            <div key={key} className="grid gap-1 md:grid-cols-[220px_1fr]">
              <Label htmlFor={key}>{SETTING_LABELS[key] ?? key}</Label>
              <Input
                id={key}
                type={key === "llm_api_key" ? "password" : "text"}
                value={draft[key] ?? ""}
                placeholder={key === "llm_api_key" ? "••••••••" : undefined}
                onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="grid gap-1">
            <Label htmlFor="tariffs">model_tariffs — себестоимость NeuralDEEP (JSON)</Label>
            <textarea
              id="tariffs"
              className={`${fieldTextareaClass} min-h-[220px] font-mono text-xs`}
              value={tariffsJson}
              onChange={(e) => setTariffsJson(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label>Тариф для клиента (превью: база × {Number.isFinite(markup) ? markup : 15})</Label>
            <pre className="max-h-56 overflow-auto rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-300">
              {customerPreview}
            </pre>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || query.isLoading || query.isError}
            >
              Сохранить
            </Button>
            {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
            {error ? <p className="text-sm text-red-300">{error}</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
