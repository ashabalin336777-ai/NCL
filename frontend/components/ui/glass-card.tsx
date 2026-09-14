import * as React from "react";

import { cn } from "@/lib/utils";

export function GlassCard({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/5 bg-slate-900/60 backdrop-blur-xl",
        "transition-colors hover:border-accent/40",
        className,
      )}
      {...props}
    />
  );
}

export function GlassCardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn("flex flex-col gap-1.5 p-6 pb-3", className)} {...props} />;
}

export function GlassCardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return (
    <h3 className={cn("text-lg font-semibold tracking-tight text-slate-100", className)} {...props} />
  );
}

export function GlassCardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return <p className={cn("text-sm text-slate-400", className)} {...props} />;
}

export function GlassCardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn("p-6 pt-3", className)} {...props} />;
}
