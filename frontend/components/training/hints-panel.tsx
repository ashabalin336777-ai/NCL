"use client";

import { Loader2, Sparkles } from "lucide-react";

import { CollapsibleBlock } from "@/components/training/collapsible-block";
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
  const ordered = [...hints].reverse();
  const latestId = ordered[0]?.id;

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
          {ordered.length === 0 ? (
            <p className="text-sm text-slate-500">
              Нажмите кнопку, когда застряли: после возражения, перед презентацией или перед
              предложением BOM.
            </p>
          ) : (
            ordered.map((hint) => (
              <div
                key={hint.id}
                className="rounded-xl border border-orange-100 bg-accent-50 px-3 py-3 text-sm leading-6 text-slate-800"
              >
                <CollapsibleBlock
                  title={`Terra · ${new Date(hint.created_at).toLocaleTimeString("ru-RU")}`}
                  text={hint.response_text}
                  defaultCollapsed={hint.id !== latestId}
                  titleClassName="font-semibold text-accent opacity-100"
                  collapseAfterChars={120}
                />
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
