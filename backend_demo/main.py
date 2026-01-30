"""
Procurement AI - FastAPI Backend
Main Application Entry Point with rate limiting and security middleware
"""

import time
import logging
from collections import defaultdict
from typing import Callable

from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger
import uvicorn

from backend.api.routes import recommendation_router
from backend.config.settings import settings

# Configure standard logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL, logging.INFO),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)


class RateLimiter:
    """
    Simple in-memory rate limiter using sliding window algorithm.
    For production, consider using Redis-based rate limiting.
    """

    def __init__(self, requests_per_minute: int = 100):
        self.requests_per_minute = requests_per_minute
        self.requests: dict = defaultdict(list)

    def is_allowed(self, client_ip: str) -> bool:
        """
        Check if the client is allowed to make a request.

        Args:
            client_ip: Client's IP address

        Returns:
            True if allowed, False if rate limited
        """
        now = time.time()
        window_start = now - 60  # 1 minute window

        # Clean old requests
        self.requests[client_ip] = [
            ts for ts in self.requests[client_ip]
            if ts > window_start
        ]

        # Check limit
        if len(self.requests[client_ip]) >= self.requests_per_minute:
            return False

        # Record this request
        self.requests[client_ip].append(now)
        return True

    def get_remaining(self, client_ip: str) -> int:
        """Get remaining requests for this client"""
        now = time.time()
        window_start = now - 60

        current_requests = len([
            ts for ts in self.requests[client_ip]
            if ts > window_start
        ])

        return max(0, self.requests_per_minute - current_requests)


# Initialize rate limiter
rate_limiter = RateLimiter(requests_per_minute=settings.RATE_LIMIT_REQUESTS)


# Initialize FastAPI app
app = FastAPI(
    title="Procurement AI",
    description="AI-powered procurement recommendation system for multi-industry sourcing intelligence",
    version="2.0.0",
    docs_url="/docs" if not settings.is_production else None,  # Disable docs in production
    redoc_url="/redoc" if not settings.is_production else None,
)


# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next: Callable):
    """
    Rate limiting middleware.
    Limits requests per client IP based on settings.
    """
    # Get client IP (handle proxy scenarios)
    client_ip = request.headers.get("X-Forwarded-For", request.client.host)
    if client_ip and "," in client_ip:
        client_ip = client_ip.split(",")[0].strip()

    # Skip rate limiting for health checks
    if request.url.path in ["/", "/health"]:
        return await call_next(request)

    # Check rate limit
    if not rate_limiter.is_allowed(client_ip):
        logger.warning(f"Rate limit exceeded for IP: {client_ip}")
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "Rate limit exceeded",
                "message": f"Too many requests. Please try again later.",
                "retry_after_seconds": 60
            },
            headers={"Retry-After": "60"}
        )

    # Add rate limit headers to response
    response = await call_next(request)
    remaining = rate_limiter.get_remaining(client_ip)
    response.headers["X-RateLimit-Limit"] = str(settings.RATE_LIMIT_REQUESTS)
    response.headers["X-RateLimit-Remaining"] = str(remaining)

    return response


@app.middleware("http")
async def api_key_middleware(request: Request, call_next: Callable):
    """
    API key authentication middleware.
    Only active when API_KEY_REQUIRED is True.
    """
    # Skip auth check if not required
    if not settings.API_KEY_REQUIRED:
        return await call_next(request)

    # Skip for health endpoints and docs
    if request.url.path in ["/", "/health", "/docs", "/redoc", "/openapi.json"]:
        return await call_next(request)

    # Check API key
    api_key = request.headers.get("X-API-Key")
    if not api_key or api_key != settings.API_KEY:
        logger.warning(f"Invalid API key from: {request.client.host}")
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"error": "Invalid or missing API key"}
        )

    return await call_next(request)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next: Callable):
    """
    Log all incoming requests with timing information.
    """
    start_time = time.time()

    # Process request
    response = await call_next(request)

    # Calculate duration
    duration = time.time() - start_time

    # Log request (skip health checks for cleaner logs)
    if request.url.path not in ["/", "/health"]:
        logger.info(
            f"{request.method} {request.url.path} - "
            f"Status: {response.status_code} - "
            f"Duration: {duration:.3f}s"
        )

    # Add timing header
    response.headers["X-Process-Time"] = f"{duration:.3f}"

    return response


# Include routers
app.include_router(recommendation_router, prefix="/api/v1", tags=["recommendations"])


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "Procurement AI",
        "version": "2.0.0",
        "features": {
            "llm_enabled": settings.is_llm_enabled,
            "rag_enabled": True,
            "rate_limiting_enabled": True,
            "api_key_required": settings.API_KEY_REQUIRED
        }
    }


@app.get("/health")
async def health_check():
    """
    Detailed health check endpoint.
    Returns status of all system components.
    """
    llm_status = "operational" if settings.is_llm_enabled else "disabled"

    return {
        "status": "healthy",
        "environment": settings.APP_ENV,
        "components": {
            "api": "operational",
            "data_loader": "operational",
            "vector_db": "operational",
            "llm": llm_status,
            "rule_engine": "operational"
        },
        "rate_limiting": {
            "enabled": True,
            "requests_per_minute": settings.RATE_LIMIT_REQUESTS
        }
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Global exception handler for unhandled errors.
    """
    logger.error(f"Unhandled exception: {exc}", exc_info=True)

    # Don't expose internal errors in production
    if settings.is_production:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"error": "Internal server error"}
        )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "Internal server error",
            "detail": str(exc)
        }
    )


if __name__ == "__main__":
    logger.info(
        f"Starting Procurement AI on {settings.APP_HOST}:{settings.APP_PORT} "
        f"(Environment: {settings.APP_ENV})"
    )
    uvicorn.run(
        "backend.main:app",
        host=settings.APP_HOST,
        port=settings.APP_PORT,
        reload=settings.APP_ENV == "development"
    )
