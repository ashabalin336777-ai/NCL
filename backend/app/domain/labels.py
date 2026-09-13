from app.models.enums import ClientRole, Difficulty, TrainingOutcome

CLIENT_ROLE_LABELS: dict[ClientRole, str] = {
    ClientRole.PROCUREMENT_DIRECTOR: "Директор по закупкам (CPO)",
    ClientRole.CHIEF_ENGINEER: "Главный инженер / Конструктор",
    ClientRole.SUPPLY_OFFICER: "Снабженец / Операционист",
}

DIFFICULTY_LABELS: dict[Difficulty, str] = {
    Difficulty.EASY: "Лёгкий",
    Difficulty.MEDIUM: "Средний",
    Difficulty.HARD: "Сложный",
}

OUTCOME_LABELS: dict[TrainingOutcome, str] = {
    TrainingOutcome.NEXT_STEP_AGREED: "Согласован следующий шаг",
    TrainingOutcome.POLITE_REJECT: "Вежливый отказ",
    TrainingOutcome.HARD_REJECT: "Жёсткий отказ",
    TrainingOutcome.ABANDONED: "Сессия брошена",
}

INDUSTRIES: tuple[str, ...] = (
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
)
