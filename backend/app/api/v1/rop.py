import csv
import io
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from app.api.v1.deps import CurrentRop, DbSession
from app.models.enums import TrainingStatus, UserRole
from app.schemas.admin import (
    ManagerStats,
    StatsSeriesPoint,
    TeamStats,
    TrainingListItem,
    UserCreateRequest,
    UserUpdateRequest,
)
from app.schemas.user import UserPublic
from app.services import admin as admin_service
from app.services.analysis import (
    list_trainings,
    manager_stats,
    team_report_csv_rows,
    team_series,
    team_stats,
)

router = APIRouter(prefix="/rop", tags=["rop"])


@router.get("/stats/team", response_model=TeamStats)
async def get_team_stats(session: DbSession, _rop: CurrentRop) -> TeamStats:
    return await team_stats(session)


@router.get("/stats/series", response_model=list[StatsSeriesPoint])
async def get_team_series(
    session: DbSession,
    _rop: CurrentRop,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    granularity: str = Query(default="week", pattern="^(week|day)$"),
) -> list[StatsSeriesPoint]:
    return await team_series(
        session,
        date_from=date_from,
        date_to=date_to,
        granularity=granularity,
    )


@router.get("/stats/managers/{manager_id}", response_model=ManagerStats)
async def get_manager_stats(
    manager_id: UUID,
    session: DbSession,
    rop: CurrentRop,
) -> ManagerStats:
    stats = await manager_stats(session, rop, manager_id=manager_id)
    users = await admin_service.list_users(session)
    manager = next((item for item in users if item.id == manager_id), None)
    if manager is not None:
        stats.manager_id = manager.id
        stats.manager_name = manager.full_name
        stats.manager_email = manager.email
    return stats


@router.get("/trainings", response_model=list[TrainingListItem])
async def rop_list_trainings(
    session: DbSession,
    rop: CurrentRop,
    status: TrainingStatus | None = None,
    manager_id: UUID | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[TrainingListItem]:
    return await list_trainings(
        session,
        rop,
        status=status,
        manager_id=manager_id,
        limit=limit,
        offset=offset,
    )


@router.get("/reports/summary.csv")
async def report_summary_csv(
    session: DbSession,
    _rop: CurrentRop,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
) -> StreamingResponse:
    rows = await team_report_csv_rows(session, date_from=date_from, date_to=date_to)
    buffer = io.StringIO()
    fieldnames = [
        "training_id",
        "manager_name",
        "manager_email",
        "difficulty",
        "client_role",
        "status",
        "outcome",
        "overall_score",
        "total_cost_rub",
        "created_at",
        "ended_at",
    ]
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for row in rows:
        writer.writerow(row)
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=ncl-team-report.csv"},
    )


@router.get("/users", response_model=list[UserPublic])
async def list_team_users(session: DbSession, _rop: CurrentRop) -> list[UserPublic]:
    users = await admin_service.list_users(session)
    # РОП видит менеджеров и себя; developer через CurrentRop видит всех
    return [
        UserPublic.model_validate(item)
        for item in users
        if item.role == UserRole.MANAGER or item.role == UserRole.ADMIN
    ]


@router.post("/users", response_model=UserPublic)
async def create_manager(
    payload: UserCreateRequest,
    session: DbSession,
    rop: CurrentRop,
) -> UserPublic:
    payload = payload.model_copy(update={"role": UserRole.MANAGER})
    user = await admin_service.create_user(session, payload, actor=rop)
    return UserPublic.model_validate(user)


@router.patch("/users/{user_id}", response_model=UserPublic)
async def update_manager(
    user_id: UUID,
    payload: UserUpdateRequest,
    session: DbSession,
    rop: CurrentRop,
) -> UserPublic:
    user = await admin_service.update_user(session, user_id, payload, actor=rop)
    return UserPublic.model_validate(user)
