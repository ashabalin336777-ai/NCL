from fastapi import HTTPException, status


class AppError(HTTPException):
    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(status_code=status_code, detail=detail)


class UnauthorizedError(AppError):
    def __init__(self, detail: str = "Could not validate credentials") -> None:
        super().__init__(status.HTTP_401_UNAUTHORIZED, detail)


class ForbiddenError(AppError):
    def __init__(self, detail: str = "Insufficient permissions") -> None:
        super().__init__(status.HTTP_403_FORBIDDEN, detail)


class NotFoundError(AppError):
    def __init__(self, detail: str = "Resource not found") -> None:
        super().__init__(status.HTTP_404_NOT_FOUND, detail)


class ConflictError(AppError):
    def __init__(self, detail: str = "Conflict") -> None:
        super().__init__(status.HTTP_409_CONFLICT, detail)


class RateLimitError(AppError):
    def __init__(self, detail: str = "Too many attempts, try again later") -> None:
        super().__init__(status.HTTP_429_TOO_MANY_REQUESTS, detail)


class LLMUnavailableError(AppError):
    def __init__(self, detail: str = "LLM endpoint is not configured") -> None:
        super().__init__(status.HTTP_503_SERVICE_UNAVAILABLE, detail)


class LLMTimeoutError(AppError):
    def __init__(self, detail: str = "LLM request timed out") -> None:
        super().__init__(status.HTTP_504_GATEWAY_TIMEOUT, detail)


class LLMResponseError(AppError):
    def __init__(self, detail: str = "LLM returned an invalid response") -> None:
        super().__init__(status.HTTP_502_BAD_GATEWAY, detail)
