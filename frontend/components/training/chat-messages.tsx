"use client";

import { useEffect, useRef } from "react";

import { CollapsibleBlock } from "@/components/training/collapsible-block";
import { cn } from "@/lib/utils";
import type { Message } from "@/types/training";

interface ChatMessagesProps {
  messages: Message[];
  pendingAssistant?: string;
  sending?: boolean;
  managerName?: string | null;
  /** Full label from card, e.g. "Виктор Сергеевич Волков, АО «ТехноДрайв»" */
  clientLabel?: string | null;
  clientName?: string | null;
  clientCompany?: string | null;
}

function buildClientLabel(
  clientLabel?: string | null,
  clientName?: string | null,
  clientCompany?: string | null,
): string {
  const ready = clientLabel?.trim();
  if (ready) {
    return ready;
  }
  const name = clientName?.trim();
  const company = clientCompany?.trim();
  if (name && company) {
    return `${name}, ${company}`;
  }
  if (name) {
    return name;
  }
  if (company) {
    return company;
  }
  return "Клиент";
}

export function ChatMessages({
  messages,
  pendingAssistant,
  sending,
  managerName,
  clientLabel,
  clientName,
  clientCompany,
}: ChatMessagesProps): React.JSX.Element {
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastId = messages.at(-1)?.id;
  const managerLabel = managerName?.trim() || "Вы";
  const assistantLabel = buildClientLabel(clientLabel, clientName, clientCompany);
  const firstName = clientName?.trim() || assistantLabel.split(",")[0]?.trim() || "Клиент";
  const typingLabel = `${firstName} печатает…`;

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
              title={message.role === "user" ? managerLabel : assistantLabel}
              text={message.content}
              defaultCollapsed={!isLatest}
              uppercaseTitle={false}
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
          <CollapsibleBlock
            title={assistantLabel}
            text={pendingAssistant}
            defaultCollapsed={false}
            uppercaseTitle={false}
          />
        </div>
      ) : null}

      {sending && !pendingAssistant ? (
        <div
          className="mr-auto max-w-[85%] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 shadow-sm"
          aria-live="polite"
          aria-label={typingLabel}
        >
          <p className="mb-2 text-[11px] font-medium tracking-wide text-slate-500">
            {assistantLabel}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 ring-1 ring-slate-200">
              <span className="ncl-typing-dot" />
              <span className="ncl-typing-dot" />
              <span className="ncl-typing-dot" />
            </div>
            <p className="text-sm font-medium text-slate-600">{firstName} печатает</p>
          </div>
        </div>
      ) : null}

      <div ref={endRef} />
    </div>
  );
}
