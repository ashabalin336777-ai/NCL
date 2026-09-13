"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LegacyAdminKnowledgeRedirect(): React.JSX.Element {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dev/knowledge");
  }, [router]);
  return <div className="p-8 text-sm text-slate-500">Перенаправление…</div>;
}
