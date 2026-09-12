"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";
import { CLIENT_ROLE_LABELS, DIFFICULTY_LABELS, INDUSTRIES } from "@/lib/labels";
import type { ClientRole, Difficulty, TrainingCreateResponse } from "@/types/training";

export function NewTrainingForm(): React.JSX.Element {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [clientRole, setClientRole] = useState<ClientRole>("chief_engineer");
  const [industry, setIndustry] = useState<string>("IoT");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const training = await apiFetch<TrainingCreateResponse>("/trainings", {
        method: "POST",
        body: JSON.stringify({
          difficulty,
          client_role: clientRole,
          industry,
        }),
      });
      router.push(`/trainings/${training.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось создать тренировку");
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новая тренировка</CardTitle>
        <CardDescription>
          AI сгенерирует скрытую карточку клиента и начнёт диалог. Цель — договориться о следующем
          шаге, а не «продать сразу».
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4 md:grid-cols-3" onSubmit={(event) => void onSubmit(event)}>
          <div className="space-y-2">
            <Label htmlFor="difficulty">Сложность</Label>
            <select
              id="difficulty"
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={difficulty}
              onChange={(event) => setDifficulty(event.target.value as Difficulty)}
            >
              {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="role">Роль клиента</Label>
            <select
              id="role"
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={clientRole}
              onChange={(event) => setClientRole(event.target.value as ClientRole)}
            >
              {Object.entries(CLIENT_ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Отрасль</Label>
            <select
              id="industry"
              className="flex h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              value={industry}
              onChange={(event) => setIndustry(event.target.value)}
            >
              {INDUSTRIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          {error ? (
            <p className="md:col-span-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="md:col-span-3">
            <Button type="submit" disabled={loading} className="min-w-48">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Генерируем карточку…
                </>
              ) : (
                "Начать переговоры"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
