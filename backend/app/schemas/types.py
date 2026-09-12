from typing import Annotated

from pydantic import AfterValidator


def _normalize_email(value: str) -> str:
    email = value.strip().lower()
    if email.count("@") != 1:
        raise ValueError("Invalid email")
    local, domain = email.split("@")
    if not local or not domain or "." not in domain:
        raise ValueError("Invalid email")
    if any(part == "" for part in domain.split(".")):
        raise ValueError("Invalid email")
    return email


AppEmail = Annotated[str, AfterValidator(_normalize_email)]
