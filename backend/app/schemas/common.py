from pydantic import BaseModel, ConfigDict


class APIMessage(BaseModel):
    detail: str


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)
