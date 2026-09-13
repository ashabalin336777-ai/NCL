"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { RoleGate } from "@/components/auth/role-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, apiFetchBlob } from "@/lib/api";
import type { TeamStats } from "@/types/api";

export default function RopReportsPage(): React.JSX.Element {
  return (
    <RoleGate allow={["admin", "developer"]}>
      <ReportsInner />
    </RoleGate>
  );
}

function ReportsInner(): React.JSX.Element {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [downloading, setDownloading] = useState(false);

  const teamQuery = useQuery({
    queryKey: ["rop", "team", "report"],
    queryFn: () => apiFetch<TeamStats>("/rop/stats/team"),
  });

  async function downloadCsv(): Promise<void> {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("date_from", new Date(dateFrom).toISOString());
      if (dateTo) params.set("date_to", new Date(`${dateTo}T23:59:59`).toISOString());
      const qs = params.toString();
      const blob = await apiFetchBlob(`/rop/reports/summary.csv${qs ? `?${qs}` : ""}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ncl-team-report.csv";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  }

  const team = teamQuery.data;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-accent">Админка РОПа</p>
        <h2 className="mt-1 text-3xl font-semibold text-navy">Отчёты руководству</h2>
        <p className="mt-2 text-sm text-slate-600">
          Сводка за период и выгрузка CSV для презентации руководству.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Сводка сейчас</CardTitle>
          <CardDescription>Агрегаты по всей команде менеджеров</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <p>Тренировок: <strong>{team?.trainings_total ?? "—"}</strong></p>
          <p>Завершено: <strong>{team?.trainings_completed ?? "—"}</strong></p>
          <p>Завершение: <strong>{team ? `${team.completion_rate}%` : "—"}</strong></p>
          <p>
            Средний балл:{" "}
            <strong>
              {team?.average_overall_score != null ? team.average_overall_score : "—"}
            </strong>
          </p>
          <p>
            Расход AI:{" "}
            <strong>
              {team ? `${Number(team.total_cost_rub).toFixed(2)} ₽` : "—"}
            </strong>
          </p>
          <div className="md:col-span-2">
            <p className="mb-1 font-medium">Исходы:</p>
            <ul className="list-inside list-disc text-slate-600">
              {Object.entries(team?.outcomes ?? {}).map(([key, value]) => (
                <li key={key}>
                  {key}: {value}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Выгрузка CSV</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div>
            <Label htmlFor="from">С даты</Label>
            <Input
              id="from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="to">По дату</Label>
            <Input id="to" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="flex items-end">
            <Button onClick={() => void downloadCsv()} disabled={downloading}>
              {downloading ? "Готовим…" : "Скачать CSV"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
