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
              <p className="text-sm font-medium text-navy">{item.key}</p>
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
