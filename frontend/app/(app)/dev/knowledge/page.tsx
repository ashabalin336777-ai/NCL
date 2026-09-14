"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { RoleGate } from "@/components/auth/role-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiFetch } from "@/lib/api";
import { fieldTextareaClass } from "@/lib/utils";
import type { KnowledgeArticle } from "@/types/api";

export default function DevKnowledgePage(): React.JSX.Element {
  return (
    <RoleGate allow={["developer"]}>
      <KnowledgeInner />
    </RoleGate>
  );
}

function KnowledgeInner(): React.JSX.Element {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["dev", "knowledge"],
    queryFn: () => apiFetch<KnowledgeArticle[]>("/dev/knowledge"),
  });

  const resetForm = () => {
    setEditingId(null);
    setTitle("");
    setContent("");
    setError(null);
  };

  const save = useMutation({
    mutationFn: async () => {
      if (editingId) {
        return apiFetch<KnowledgeArticle>(`/dev/knowledge/${editingId}`, {
          method: "PATCH",
          body: JSON.stringify({ title, content }),
        });
      }
      return apiFetch<KnowledgeArticle>("/dev/knowledge", {
        method: "POST",
        body: JSON.stringify({ title, content }),
      });
    },
    onSuccess: async () => {
      resetForm();
      await queryClient.invalidateQueries({ queryKey: ["dev", "knowledge"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Ошибка сохранения");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/dev/knowledge/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["dev", "knowledge"] });
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-accent">Админка разработчика</p>
        <h2 className="mt-1 text-3xl font-semibold text-slate-50">База знаний</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Редактировать статью" : "Новая статья"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="title">Заголовок</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="content">Текст</Label>
            <textarea
              id="content"
              className={`${fieldTextareaClass} mt-1 min-h-[140px]`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => save.mutate()}
              disabled={!title.trim() || !content.trim() || save.isPending}
            >
              {editingId ? "Сохранить" : "Создать"}
            </Button>
            {editingId ? (
              <Button variant="outline" onClick={resetForm}>
                Отмена
              </Button>
            ) : null}
          </div>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {(query.data ?? []).map((article) => (
          <Card key={article.id}>
            <CardHeader>
              <CardTitle>{article.title}</CardTitle>
              <CardDescription>
                Обновлено {new Date(article.updated_at).toLocaleString("ru-RU")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                {article.content}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingId(article.id);
                    setTitle(article.title);
                    setContent(article.content);
                  }}
                >
                  Изменить
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    if (confirm("Удалить статью?")) remove.mutate(article.id);
                  }}
                >
                  Удалить
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
