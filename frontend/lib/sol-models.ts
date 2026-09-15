/** Curated Sol models — developer admin only. */

export interface SolModelOption {
  id: string;
  title: string;
  comment: string;
  recommended?: boolean;
}

export const SOL_MODEL_OPTIONS: SolModelOption[] = [
  {
    id: "qwen3.8-27b-noreason",
    title: "Qwen3.8-27B-noreason",
    comment:
      "Эталонное качество. Максимальная точность понимания контекста и строгого JSON.",
  },
  {
    id: "qwen3.8-27b-fp8-noreason",
    title: "Qwen3.8-27B-FP8-noreason",
    comment: "Оптимальный баланс. Минимальная потеря качества при более высокой скорости.",
  },
  {
    id: "qwen3.6-35b-a3b-noreason",
    title: "Qwen3.6-35B-A3B-noreason (MoE)",
    comment:
      "Рекомендуемый вариант для Sol. 35B общих параметров (высокая эрудиция), но только 3B активных на токен — высокая скорость.",
    recommended: true,
  },
  {
    id: "qwen3.8-27b-int4-noreason",
    title: "Qwen3.8-27B-Int4-noreason",
    comment: "Бюджетный вариант. Приемлемое качество для анализа при меньшей стоимости.",
  },
];

export const DEFAULT_SOL_MODEL_ID = "qwen3.6-35b-a3b-noreason";
