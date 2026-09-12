"use client";

import { useQuery } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/api";

interface KnowledgeArticle {
  id: string;
  title: string;
  content: string;
  updated_at: string;
}

export default function AdminKnowledgePage(): React.JSX.Element {
  const query = useQuery({
    queryKey: ["admin", "knowledge"],
    queryFn: () => apiFetch<KnowledgeArticle[]>("/admin/knowledge"),
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-accent">Админка</p>
        <h2 className="mt-1 text-3xl font-semibold text-navy">База знаний</h2>
      </div>
      <div className="grid gap-4">
        {(query.data ?? []).map((article) => (
          <Card key={article.id}>
            <CardHeader>
              <CardTitle>{article.title}</CardTitle>
              <CardDescription>
                Обновлено {new Date(article.updated_at).toLocaleString("ru-RU")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{article.content}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
