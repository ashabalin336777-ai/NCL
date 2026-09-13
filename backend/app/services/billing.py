from decimal import Decimal
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import PaymentRequiredError
from app.models.ai_setting import AISetting
from app.models.billing import BillingAccount, BillingLedger
from app.models.enums import BillingLedgerType

DEFAULT_MIN_RESERVE = Decimal("5")


async def get_or_create_account(session: AsyncSession) -> BillingAccount:
    result = await session.execute(select(BillingAccount).limit(1))
    account = result.scalar_one_or_none()
    if account is not None:
        return account
    account = BillingAccount(id=uuid4(), balance_rub=Decimal("0"), currency="RUB")
    session.add(account)
    await session.flush()
    return account


async def get_balance(session: AsyncSession) -> Decimal:
    account = await get_or_create_account(session)
    return Decimal(account.balance_rub)


async def min_reserve_rub(session: AsyncSession) -> Decimal:
    result = await session.execute(
        select(AISetting).where(AISetting.key == "billing_min_reserve_rub")
    )
    setting = result.scalar_one_or_none()
    if setting is None:
        return DEFAULT_MIN_RESERVE
    try:
        return Decimal(str(setting.value))
    except Exception:  # noqa: BLE001
        return DEFAULT_MIN_RESERVE


async def ensure_balance(session: AsyncSession, *, minimum: Decimal | None = None) -> None:
    reserve = minimum if minimum is not None else await min_reserve_rub(session)
    balance = await get_balance(session)
    if balance < reserve:
        raise PaymentRequiredError(
            f"Недостаточно средств на балансе проекта "
            f"(сейчас {balance:.2f} ₽, нужно минимум {reserve:.2f} ₽). "
            "Попросите разработчика пополнить баланс."
        )


async def _apply_ledger(
    session: AsyncSession,
    *,
    ledger_type: BillingLedgerType,
    amount_rub: Decimal,
    reason: str,
    created_by: UUID | None = None,
    ref_type: str | None = None,
    ref_id: UUID | None = None,
    note: str | None = None,
    provider: str | None = None,
    external_payment_id: str | None = None,
    meta: dict[str, Any] | None = None,
) -> BillingLedger:
    account = await get_or_create_account(session)
    delta = Decimal(amount_rub)
    if ledger_type == BillingLedgerType.DEBIT:
        if delta < 0:
            delta = abs(delta)
        new_balance = Decimal(account.balance_rub) - delta
        if new_balance < 0:
            raise PaymentRequiredError(
                f"Недостаточно средств на балансе проекта "
                f"(сейчас {account.balance_rub:.2f} ₽, списание {delta:.4f} ₽)."
            )
        signed_amount = -delta
    else:
        if ledger_type == BillingLedgerType.TOPUP and delta <= 0:
            raise ValueError("Top-up amount must be positive")
        new_balance = Decimal(account.balance_rub) + delta
        signed_amount = delta

    account.balance_rub = new_balance
    entry = BillingLedger(
        id=uuid4(),
        type=ledger_type,
        amount_rub=signed_amount,
        balance_after=new_balance,
        reason=reason,
        ref_type=ref_type,
        ref_id=ref_id,
        created_by=created_by,
        provider=provider,
        external_payment_id=external_payment_id,
        meta_json=meta,
        note=note,
    )
    session.add(entry)
    await session.flush()
    return entry


async def topup(
    session: AsyncSession,
    *,
    amount_rub: Decimal,
    created_by: UUID,
    note: str | None = None,
) -> BillingLedger:
    if amount_rub <= 0:
        raise ValueError("Top-up amount must be positive")
    return await _apply_ledger(
        session,
        ledger_type=BillingLedgerType.TOPUP,
        amount_rub=amount_rub,
        reason="manual_topup",
        created_by=created_by,
        note=note,
        provider="manual",
    )


async def debit(
    session: AsyncSession,
    *,
    amount_rub: Decimal,
    reason: str,
    ref_type: str | None = None,
    ref_id: UUID | None = None,
    meta: dict[str, Any] | None = None,
) -> BillingLedger | None:
    amount = Decimal(amount_rub)
    if amount <= 0:
        return None
    return await _apply_ledger(
        session,
        ledger_type=BillingLedgerType.DEBIT,
        amount_rub=amount,
        reason=reason,
        ref_type=ref_type,
        ref_id=ref_id,
        meta=meta,
    )


async def list_ledger(
    session: AsyncSession,
    *,
    limit: int = 50,
    offset: int = 0,
) -> list[BillingLedger]:
    result = await session.execute(
        select(BillingLedger)
        .order_by(BillingLedger.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(result.scalars().all())
