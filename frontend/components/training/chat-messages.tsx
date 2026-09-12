"use client";

import { useEffect, useRef } from "react";

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

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingAssistant, sending]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6",
            message.role === "user"
              ? "ml-auto bg-navy text-white"
              : "mr-auto border border-slate-200 bg-slate-50 text-slate-800",
          )}
        >
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide opacity-70">
            {message.role === "user" ? "Вы" : "Клиент"}
          </p>
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      ))}

      {pendingAssistant ? (
        <div className="mr-auto max-w-[85%] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide opacity-70">Клиент</p>
          <p className="whitespace-pre-wrap">{pendingAssistant}</p>
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
