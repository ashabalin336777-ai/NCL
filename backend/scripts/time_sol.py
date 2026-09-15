import asyncio
import time

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import SessionLocal
from app.models.training import Training
from app.services.ai_settings import load_ai_settings
from app.services.analysis import run_sol_analysis, get_training_with_analysis
from app.models.user import User
from app.services.prompts import load_active_prompt
from app.services.analysis import assemble_analyst_user_prompt, _card_from_training


async def main() -> None:
    tid = "0eb30233-a631-494c-a981-f3c61b69f275"
    async with SessionLocal() as session:
        runtime = await load_ai_settings(session)
        print("analyst_model", runtime.analyst_model_id)
        print("timeout", runtime.timeout_seconds)
        prompt = await load_active_prompt(session, "sol_analyst")
        print("system_prompt_chars", len(prompt.system_prompt_text))

        result = await session.execute(
            select(Training)
            .where(Training.id == tid)
            .options(
                selectinload(Training.messages),
                selectinload(Training.analysis),
                selectinload(Training.client_profile),
                selectinload(Training.hints),
            )
        )
        training = result.scalar_one()
        card = _card_from_training(training)
        user_prompt = assemble_analyst_user_prompt(training, card)
        print("user_prompt_chars", len(user_prompt))
        print("has_analysis_before", training.analysis is not None)

        t0 = time.perf_counter()
        try:
            analysis, usage = await run_sol_analysis(session, training)
            print(
                "OK",
                f"{time.perf_counter()-t0:.1f}s",
                "overall",
                analysis.overall_score,
                "model",
                usage.model,
                "tokens",
                usage.total_tokens,
                "cost",
                usage.cost_rub,
            )
        except Exception as exc:
            print("FAIL", f"{time.perf_counter()-t0:.1f}s", type(exc).__name__, exc)


if __name__ == "__main__":
    asyncio.run(main())
