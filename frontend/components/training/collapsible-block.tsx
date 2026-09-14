"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";

interface CollapsibleBlockProps {
  title: string;
  text: string;
  /** Start collapsed when text is long enough */
  defaultCollapsed?: boolean;
  /** When false, keep original casing (needed for person/company names). */
  uppercaseTitle?: boolean;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
  toggleClassName?: string;
  collapseAfterChars?: number;
}

export function CollapsibleBlock({
  title,
  text,
  defaultCollapsed,
  uppercaseTitle = true,
  className,
  titleClassName,
  bodyClassName,
  toggleClassName,
  collapseAfterChars = 160,
}: CollapsibleBlockProps): React.JSX.Element {
  const canCollapse = text.trim().length > collapseAfterChars;
  const [collapsed, setCollapsed] = useState(defaultCollapsed ?? canCollapse);

  useEffect(() => {
    if (!canCollapse) {
      setCollapsed(false);
      return;
    }
    if (defaultCollapsed !== undefined) {
      setCollapsed(defaultCollapsed);
    }
  }, [defaultCollapsed, canCollapse]);

  const showCollapsed = canCollapse && collapsed;
  const preview = text.trim().slice(0, collapseAfterChars).trimEnd();

  return (
    <div className={cn(className)}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <p
          className={cn(
            "text-[11px] font-medium tracking-wide opacity-70",
            uppercaseTitle && "uppercase",
            titleClassName,
          )}
        >
          {title}
        </p>
        {canCollapse ? (
          <button
            type="button"
            onClick={() => setCollapsed((value) => !value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium opacity-80 transition hover:opacity-100",
              toggleClassName ?? "hover:bg-white/5",
            )}
            title={collapsed ? "Развернуть" : "Свернуть"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Развернуть
              </>
            ) : (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Свернуть
              </>
            )}
          </button>
        ) : null}
      </div>
      <p className={cn("whitespace-pre-wrap text-slate-100", bodyClassName)}>
        {showCollapsed ? `${preview}…` : text}
      </p>
    </div>
  );
}
