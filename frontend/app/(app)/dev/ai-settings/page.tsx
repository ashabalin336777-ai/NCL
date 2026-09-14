"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

import { RoleGate } from "@/components/auth/role-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";
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
              : ""
            : typeof raw === "string"
              ? raw
              : String(raw);
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
        <h2 className="mt-1 text-3xl font-semibold text-navy">AI-настройки и тарифы</h2>
        <p className="mt-2 text-sm text-slate-600">
          `model_tariffs` — себестоимость NeuralDEEP. Клиенту (менеджер/РОП) начисляется{" "}
          <strong>себестоимость × множитель</strong> за каждый вызов LLM.
        </p>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-slate-500">Загрузка настроек…</p>
      ) : null}
      {query.isError ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Не удалось загрузить настройки:{" "}
          {query.error instanceof ApiError ? query.error.message : "ошибка API"}
        </p>
      ) : null}

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
          {EDITABLE_SCALAR.filter((key) => key !== "billing_markup_multiplier").map((key) => (
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
              className="min-h-[220px] w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
              value={tariffsJson}
              onChange={(e) => setTariffsJson(e.target.value)}
            />
          </div>
          <div className="grid gap-1">
            <Label>Тариф для клиента (превью: база × {Number.isFinite(markup) ? markup : 15})</Label>
            <pre className="max-h-56 overflow-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700">
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
            {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
