from enum import StrEnum


class UserRole(StrEnum):
    MANAGER = "manager"
    ADMIN = "admin"


class Difficulty(StrEnum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class ClientRole(StrEnum):
    PROCUREMENT_DIRECTOR = "procurement_director"
    CHIEF_ENGINEER = "chief_engineer"
    SUPPLY_OFFICER = "supply_officer"


class TrainingStatus(StrEnum):
    CREATED = "created"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABORTED = "aborted"


class TrainingOutcome(StrEnum):
    NEXT_STEP_AGREED = "next_step_agreed"
    POLITE_REJECT = "polite_reject"
    HARD_REJECT = "hard_reject"
    ABANDONED = "abandoned"


class MessageRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"
