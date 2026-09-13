"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { RoleGate } from "@/components/auth/role-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";
import type { BillingAccount, BillingLedgerEntry } from "@/types/api";

export default function DevBillingPage(): React.JSX.Element {
  return (
    <RoleGate allow={["developer"]}>
      <BillingInner />
    </RoleGate>
  );
}

function BillingInner(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("1000");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const billingQuery = useQuery({
    queryKey: ["dev", "billing"],
    queryFn: () => apiFetch<BillingAccount>("/dev/billing"),
  });
  const ledgerQuery = useQuery({
    queryKey: ["dev", "ledger"],
    queryFn: () => apiFetch<BillingLedgerEntry[]>("/dev/billing/ledger?limit=100"),
  });

  const topup = useMutation({
    mutationFn: () =>
      apiFetch<BillingLedgerEntry>("/dev/billing/topup", {
        method: "POST",
        body: JSON.stringify({
          amount_rub: Number(amount),
          note: note.trim() || null,
        }),
      }),
    onSuccess: async () => {
      setNote("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["dev", "billing"] });
      await queryClient.invalidateQueries({ queryKey: ["dev", "ledger"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Ошибка пополнения");
    },
  });

  const account = billingQuery.data;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-accent">Админка разработчика</p>
        <h2 className="mt-1 text-3xl font-semibold text-navy">Баланс проекта</h2>
        <p className="mt-2 text-sm text-slate-600">
          Ручное пополнение. ЮKassa — следующим этапом. Списания идут за карточку, диалог, Terra,
          радар и Sol.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Баланс</CardTitle>
            <CardDescription>Единый счёт инстанса</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold text-navy">
              {account ? `${Number(account.balance_rub).toFixed(2)} ₽` : "—"}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Мин. резерв:{" "}
              {account ? `${Number(account.min_reserve_rub).toFixed(2)} ₽` : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Пополнить</CardTitle>
            <CardDescription>После банковского перевода от заказчика</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <div>
              <Label htmlFor="amount">Сумма, ₽</Label>
              <Input
                id="amount"
                type="number"
                min={1}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="note">Комментарий</Label>
              <Input
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Платёж №…"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => topup.mutate()}
                disabled={topup.isPending || !amount || Number(amount) <= 0}
              >
                Зачислить
              </Button>
            </div>
            {error ? <p className="text-sm text-red-600 md:col-span-3">{error}</p> : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>История операций</CardTitle>
          <CardDescription>Пополнения и списания AI</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(ledgerQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">Пока нет операций.</p>
          ) : (
            (ledgerQuery.data ?? []).map((item) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {item.type} · {item.reason}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(item.created_at).toLocaleString("ru-RU")}
                    {item.note ? ` · ${item.note}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={
                      Number(item.amount_rub) >= 0
                        ? "font-semibold text-emerald-700"
                        : "font-semibold text-red-700"
                    }
                  >
                    {Number(item.amount_rub) >= 0 ? "+" : ""}
                    {Number(item.amount_rub).toFixed(4)} ₽
                  </p>
                  <p className="text-xs text-slate-500">
                    баланс {Number(item.balance_after).toFixed(2)} ₽
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
