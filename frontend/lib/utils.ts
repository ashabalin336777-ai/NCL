import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export const fieldSelectClass =
  "flex h-10 w-full rounded-lg border border-white/10 bg-slate-950/60 px-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-accent";

export const fieldTextareaClass =
  "w-full rounded-lg border border-white/10 bg-slate-950 px-3 py-2 text-sm text-slate-100 caret-accent placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-accent";

