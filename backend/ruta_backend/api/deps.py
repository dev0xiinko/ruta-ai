from __future__ import annotations

from functools import lru_cache

from ..core.config import Settings
from ..core.db import DatabaseClient
from ..repositories import LogRepository, RouteRepository
from ..service import RutaResponseService
from ..services import ChatService, QueryLogger, RouteQueryService


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings.from_env()


@lru_cache(maxsize=1)
def get_db_client() -> DatabaseClient:
    return DatabaseClient(get_settings())


@lru_cache(maxsize=1)
def get_route_repository() -> RouteRepository:
    return RouteRepository(get_db_client())


@lru_cache(maxsize=1)
def get_log_repository() -> LogRepository:
    return LogRepository(get_db_client())


@lru_cache(maxsize=1)
def get_query_logger() -> QueryLogger:
    return QueryLogger(get_log_repository())


@lru_cache(maxsize=1)
def get_response_service() -> RutaResponseService:
    return RutaResponseService.from_settings(get_settings())


@lru_cache(maxsize=1)
def get_chat_service() -> ChatService:
    route_repository = get_route_repository()
    return ChatService(
        snapshot_loader=route_repository.get_snapshot,
        query_logger=get_query_logger(),
        legacy_service=get_response_service(),
    )


@lru_cache(maxsize=1)
def get_route_query_service() -> RouteQueryService:
    route_repository = get_route_repository()
    return RouteQueryService(
        snapshot_loader=route_repository.get_snapshot,
        query_logger=get_query_logger(),
        legacy_service=get_response_service(),
    )
