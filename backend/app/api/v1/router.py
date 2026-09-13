from fastapi import APIRouter

from app.api.v1 import auth, health, speech
from app.api.v1.admin import admin_router, stats_router
from app.api.v1.dev import router as dev_router
from app.api.v1.rop import router as rop_router
from app.api.v1.trainings import ai_router, router as trainings_router

api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(trainings_router)
api_router.include_router(ai_router)
api_router.include_router(speech.router)
api_router.include_router(admin_router)
api_router.include_router(stats_router)
api_router.include_router(dev_router)
api_router.include_router(rop_router)
