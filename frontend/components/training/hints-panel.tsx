"use client";

import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Hint } from "@/types/training";

interface HintsPanelProps {
  hints: Hint[];
  loading?: boolean;
  disabled?: boolean;
  onRequestHint: () => Promise<void> | void;
}

export function HintsPanel({
  hints,
  loading,
  disabled,
  onRequestHint,
}: HintsPanelProps): React.JSX.Element {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-accent" />
          Terra — подсказки
        </CardTitle>
        <CardDescription>
          Совет по следующему шагу: боль, презентация, закрытие. Не скрипт слово в слово.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-3">
        <Button
          variant="accent"
          disabled={disabled || loading}
          onClick={() => void onRequestHint()}
          className="w-full"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Получить совет
        </Button>

        <div className="flex-1 space-y-3 overflow-y-auto">
          {hints.length === 0 ? (
            <p className="text-sm text-slate-500">
              Нажмите кнопку, когда застряли: после возражения, перед презентацией или перед
              предложением BOM.
            </p>
          ) : (
            [...hints].reverse().map((hint) => (
              <div
                key={hint.id}
                className="rounded-xl border border-orange-100 bg-accent-50 px-3 py-3 text-sm leading-6 text-slate-800"
              >
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-accent">
                  Terra · {new Date(hint.created_at).toLocaleTimeString("ru-RU")}
                </p>
                <p className="whitespace-pre-wrap">{hint.response_text}</p>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
