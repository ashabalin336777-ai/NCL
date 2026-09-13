"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

interface AISetting {
  id: string;
  key: string;
  value: unknown;
  updated_at: string;
}

const SETTING_LABELS: Record<string, string> = {
  llm_base_url: "URL NeuralDEEP",
  llm_api_key: "API-ключ",
  client_model_id: "Модель чата (клиент)",
  card_model_id: "Модель карточки",
  hint_model_id: "Модель Terra",
  analyst_model_id: "Модель Sol",
  radar_model_id: "Модель радара реплики",
  cost_per_1k_input_tokens_rub: "Тариф вход / 1k",
  cost_per_1k_output_tokens_rub: "Тариф выход / 1k",
  llm_timeout_seconds: "Таймаут LLM, сек",
  model_tariffs: "Тарифы моделей",
};

export default function AdminSettingsPage(): React.JSX.Element {
  const query = useQuery({
    queryKey: ["admin", "settings"],
    queryFn: () => apiFetch<AISetting[]>("/admin/settings"),
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-accent">Админка</p>
        <h2 className="mt-1 text-3xl font-semibold text-navy">AI-настройки</h2>
        <p className="mt-2 text-sm text-slate-600">
          Модели NeuralDEEP и тарифы. Редактор — на Этапе 7.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Параметры runtime</CardTitle>
          <CardDescription>Ключ API скрыт в значении llm_api_key</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(query.data ?? []).map((item) => (
            <div
              key={item.id}
              className="grid gap-1 rounded-xl border border-slate-200 px-4 py-3 md:grid-cols-[220px_1fr]"
            >
              <div>
                <p className="text-sm font-medium text-navy">
                  {SETTING_LABELS[item.key] ?? item.key}
                </p>
                <p className="text-[11px] text-slate-400">{item.key}</p>
              </div>
              <pre className="overflow-auto text-xs text-slate-700">
                {item.key === "llm_api_key"
                  ? "••••••••"
                  : JSON.stringify(item.value, null, 2)}
              </pre>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
