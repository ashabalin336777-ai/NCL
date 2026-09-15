import asyncio
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import SessionLocal
from app.models.training import Training
from app.models.message import Message
from app.models.analysis import Analysis


async def main() -> None:
    tid = "0eb30233-a631-494c-a981-f3c61b69f275"
    async with SessionLocal() as session:
        result = await session.execute(
            select(Training)
            .where(Training.id == tid)
            .options(
                selectinload(Training.messages),
                selectinload(Training.analysis),
                selectinload(Training.hints),
            )
        )
        training = result.scalar_one_or_none()
        if not training:
            print("training not found")
            return
        print("status", training.status)
        print("messages", len(training.messages or []))
        print("hints", len(training.hints or []))
        total_chars = sum(len(m.content or "") for m in (training.messages or []))
        print("dialog_chars", total_chars)
        print("total_cost", training.total_cost_rub)
        print("created", training.created_at)
        print("updated", training.updated_at)
        if training.analysis:
            a = training.analysis
            print("analysis_id", a.id)
            print("overall", a.overall_score)
            print("created_analysis", a.created_at)
            print("summary_len", len(str(a.summary_json)))
        else:
            print("analysis: NONE")
        for m in (training.messages or [])[-5:]:
            print(f"msg {m.role} {len(m.content or '')}c @ {m.created_at}")


if __name__ == "__main__":
    asyncio.run(main())
