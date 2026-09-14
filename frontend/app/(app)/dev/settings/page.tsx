"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Старый путь /dev/settings → канонический /dev/ai-settings */
export default function DevSettingsRedirect(): React.JSX.Element {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dev/ai-settings");
  }, [router]);
  return <div className="p-8 text-sm text-slate-500">Перенаправление в AI-настройки…</div>;
}
