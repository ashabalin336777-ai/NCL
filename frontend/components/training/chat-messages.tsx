"use client";

import { useEffect, useRef } from "react";

import { CollapsibleBlock } from "@/components/training/collapsible-block";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/training";

interface ChatMessagesProps {
  messages: Message[];
  pendingAssistant?: string;
  sending?: boolean;
}

export function ChatMessages({
  messages,
  pendingAssistant,
  sending,
}: ChatMessagesProps): React.JSX.Element {
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastId = messages.at(-1)?.id;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, pendingAssistant, sending]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
      {messages.map((message) => {
        const isLatest = message.id === lastId && !pendingAssistant;
        return (
          <div
            key={message.id}
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6",
              message.role === "user"
                ? "ml-auto bg-navy text-white"
                : "mr-auto border border-slate-200 bg-slate-50 text-slate-800",
            )}
          >
            <CollapsibleBlock
              title={message.role === "user" ? "Вы" : "Клиент"}
              text={message.content}
              defaultCollapsed={!isLatest}
              titleClassName={message.role === "user" ? "text-white/80" : undefined}
              bodyClassName={message.role === "user" ? "text-white" : undefined}
              toggleClassName={
                message.role === "user" ? "text-white/90 hover:bg-white/10" : "hover:bg-black/5"
              }
            />
          </div>
        );
      })}

      {pendingAssistant ? (
        <div className="mr-auto max-w-[85%] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800">
          <CollapsibleBlock title="Клиент" text={pendingAssistant} defaultCollapsed={false} />
        </div>
      ) : null}

      {sending && !pendingAssistant ? (
        <div className="mr-auto rounded-2xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-500">
          Клиент печатает…
        </div>
      ) : null}

      <div ref={endRef} />
    </div>
  );
}
