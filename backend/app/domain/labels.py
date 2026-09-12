from app.models.enums import ClientRole, Difficulty

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

INDUSTRIES: tuple[str, ...] = (
    "Медицина",
    "IoT",
    "Промышленная автоматизация",
    "ВПК",
    "Бытовая электроника",
)
