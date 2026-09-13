export const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Лёгкая",
  medium: "Средняя",
  hard: "Сложная",
};

export const CLIENT_ROLE_LABELS: Record<string, string> = {
  procurement_director: "Директор по закупкам",
  chief_engineer: "Главный инженер",
  supply_officer: "Снабженец",
};

export const STATUS_LABELS: Record<string, string> = {
  created: "Создана",
  in_progress: "В процессе",
  completed: "Завершена",
  aborted: "Прервана",
};

export const OUTCOME_LABELS: Record<string, string> = {
  next_step_agreed: "Согласован следующий шаг",
  polite_reject: "Вежливый отказ",
  hard_reject: "Жёсткий отказ",
  abandoned: "Сессия брошена",
};

export const RADAR_COMPETENCY_LABELS: Record<string, string> = {
  needs_discovery: "Выявление боли",
  solution_presentation: "Презентация",
  objection_handling: "Возражения",
  closing_persistence: "Закрытие",
  technical_expertise: "Техника",
  risk_management: "Риски",
};

export const INDUSTRIES = [
  "Медицина",
  "IoT",
  "Промышленная автоматизация",
  "ВПК",
  "Бытовая электроника",
  "Телеком и 5G",
  "Автоэлектроника",
  "Авиация и космос",
  "Энергетика и силовая электроника",
  "Железнодорожный транспорт",
  "Светотехника и LED",
  "Вычислительная техника и серверы",
  "Робототехника",
  "Безопасность и видеонаблюдение",
  "Контрактное производство электроники (EMS)",
] as const;
