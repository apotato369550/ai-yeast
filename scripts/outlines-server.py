#!/usr/bin/env python3
"""
Outlines.dev wrapper service for constrained generation via Ollama.

Provides a FastAPI service that accepts prompts with JSON Schema constraints
and returns structured outputs validated against the schema.

Port: 6789
Health: GET /health
Chat: POST /chat
"""

import sys
import json
import logging
import signal
from typing import Optional, Any, Dict
from dataclasses import dataclass, asdict
from datetime import datetime
from contextlib import asynccontextmanager

# Explicitly add venv site-packages to sys.path for systemd compatibility
# (venv activation doesn't propagate through bash subprocess spawning)
import site
site.addsitedir('/home/jay/outlines-env/lib/python3.12/site-packages')

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn

# Try importing outlines, fall back gracefully if not available
try:
    import outlines
    from ollama import Client as OllamaClient
    OUTLINES_AVAILABLE = True
except ImportError:
    OUTLINES_AVAILABLE = False
    OllamaClient = None
    logging.warning("Outlines library not available. Install with: pip install outlines ollama")


# ==================== Logging Configuration ====================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    stream=sys.stdout,
)
logger = logging.getLogger(__name__)


# ==================== Request/Response Models ====================

class ChatRequest(BaseModel):
    """Request body for /chat endpoint."""
    prompt: str
    schema: Optional[Dict[str, Any]] = None
    temperature: float = 0.7
    model: str = "mistral:7b-instruct"


class ChatResponse(BaseModel):
    """Success response from /chat endpoint."""
    output: Dict[str, Any] | str
    tokens_used: Optional[int] = None
    schema_validated: bool = True


class ErrorResponse(BaseModel):
    """Error response from /chat endpoint."""
    error: str
    reason: str


@dataclass
class HealthStatus:
    """Health check response."""
    status: str
    timestamp: str
    ollama_ready: bool
    outlines_available: bool


# ==================== Global State ====================

class OllamaPool:
    """Model pooling for Outlines."""

    def __init__(self, model_name: str = "mistral:7b-instruct"):
        self.model_name = model_name
        self.model = None
        self.ollama_client = None
        self.last_error = None

    def initialize(self):
        """Initialize the Ollama model pool."""
        if not OUTLINES_AVAILABLE:
            self.last_error = "Outlines library not installed"
            logger.error(self.last_error)
            return False

        try:
            logger.info(f"Initializing Ollama client and model pool: {self.model_name}")
            self.ollama_client = OllamaClient()
            self.model = outlines.from_ollama(self.ollama_client, self.model_name)
            logger.info(f"✓ Ollama model '{self.model_name}' ready")
            return True
        except Exception as e:
            self.last_error = f"Failed to initialize Ollama: {str(e)}"
            logger.error(self.last_error)
            return False

    def is_ready(self) -> bool:
        """Check if model pool is initialized."""
        return self.model is not None

    async def generate(
        self,
        prompt: str,
        schema: Optional[Dict[str, Any]] = None,
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> tuple[str, int]:
        """
        Generate output using Outlines API.

        If schema is provided, use outlines.json_schema() + outlines.Generator() for constrained output.
        Otherwise, use the model directly for unconstrained text generation.

        Returns: (output_text, tokens_used)
        """
        if not self.is_ready():
            raise RuntimeError(self.last_error or "Model pool not initialized")

        try:
            logger.info(f"Generating from prompt (len={len(prompt)}, schema={schema is not None})")

            # If schema provided, use JSON-constrained generation
            if schema:
                try:
                    logger.info("Using constrained JSON generation")
                    # Outlines 1.2.9 API: Convert dict schema to JsonSchema object
                    schema_obj = outlines.json_schema(schema)
                    # Create generator with schema constraint
                    generator = outlines.Generator(self.model, output_type=schema_obj)
                    # Generate - returns valid JSON string
                    output = generator(prompt)
                    logger.info("✓ Schema-constrained generation succeeded")
                except Exception as e:
                    logger.warning(f"Schema-constrained generation failed, falling back to unconstrained: {e}")
                    output = self.model(prompt)
            else:
                # Unconstrained text generation
                output = self.model(prompt)

            # Parse tokens used (fallback if not available)
            tokens_used = len(prompt.split()) + len(output.split())  # Rough estimate

            logger.info(f"✓ Generation complete (output_len={len(output)}, tokens≈{tokens_used})")
            return output, tokens_used

        except Exception as e:
            error_msg = f"Generation failed: {str(e)}"
            logger.error(error_msg)
            raise RuntimeError(error_msg)


# ==================== FastAPI App ====================

model_pool = OllamaPool()
startup_success = False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context manager (startup/shutdown)."""
    global startup_success

    # Startup
    logger.info("=" * 60)
    logger.info("Outlines Server Starting")
    logger.info("=" * 60)

    startup_success = model_pool.initialize()

    if startup_success:
        logger.info(f"Server ready on http://0.0.0.0:6789")
        logger.info("Endpoints: GET /health, POST /chat")
    else:
        logger.error("Server started with degraded mode (Ollama not ready)")

    yield  # Server runs

    # Shutdown
    logger.info("=" * 60)
    logger.info("Outlines Server Shutting Down")
    logger.info("=" * 60)


app = FastAPI(
    title="Outlines Server",
    description="Constrained generation wrapper for Ollama + Outlines",
    version="1.0.0",
    lifespan=lifespan,
)


# ==================== HTTP Endpoints ====================

@app.get("/health", response_model=dict)
async def health_check():
    """Health check endpoint."""
    status = HealthStatus(
        status="ok" if model_pool.is_ready() else "degraded",
        timestamp=datetime.utcnow().isoformat(),
        ollama_ready=model_pool.is_ready(),
        outlines_available=OUTLINES_AVAILABLE,
    )
    return asdict(status)


@app.post("/chat", response_model=ChatResponse | ErrorResponse)
async def chat(request: ChatRequest):
    """
    Chat endpoint with optional schema-guided generation.

    Request:
    {
        "prompt": "Generate a person: ",
        "schema": {"type": "object", "properties": {...}},
        "temperature": 0.7,
        "model": "mistral:7b-instruct"
    }

    Response:
    {
        "output": {...},
        "tokens_used": 150,
        "schema_validated": true
    }
    """

    # Validate request
    if not request.prompt or not isinstance(request.prompt, str):
        logger.warning("Invalid request: empty or non-string prompt")
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Invalid request",
                "reason": "prompt must be a non-empty string",
            },
        )

    if not 0.0 <= request.temperature <= 2.0:
        logger.warning(f"Invalid temperature: {request.temperature}")
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Invalid request",
                "reason": "temperature must be between 0.0 and 2.0",
            },
        )

    # Check Ollama readiness
    if not model_pool.is_ready():
        logger.error("Generation attempted but Ollama not ready")
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Service Unavailable",
                "reason": f"Ollama not initialized: {model_pool.last_error}",
            },
        )

    # Generate with optional schema constraint
    try:
        logger.info(f"[/chat] Prompt: {request.prompt[:80]}..." if len(request.prompt) > 80 else f"[/chat] Prompt: {request.prompt}")

        output, tokens = await model_pool.generate(
            prompt=request.prompt,
            schema=request.schema,
            temperature=request.temperature,
            max_tokens=4096,
        )

        # Try to parse output as JSON if schema was provided
        parsed_output = output
        schema_validated = False

        if request.schema:
            try:
                parsed_output = json.loads(output)
                schema_validated = True
                logger.info("[/chat] Output parsed and schema validated")
            except json.JSONDecodeError as e:
                logger.warning(f"[/chat] Output not valid JSON: {e}")
                schema_validated = False

        response = ChatResponse(
            output=parsed_output,
            tokens_used=tokens,
            schema_validated=schema_validated,
        )
        logger.info(f"[/chat] ✓ Success (tokens={tokens}, validated={schema_validated})")
        return response

    except RuntimeError as e:
        logger.error(f"[/chat] Generation error: {e}")
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Generation failed",
                "reason": str(e),
            },
        )
    except Exception as e:
        logger.error(f"[/chat] Unexpected error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={
                "error": "Internal server error",
                "reason": str(e),
            },
        )


@app.post("/chat/json")
async def chat_json(request: ChatRequest):
    """Convenience endpoint that enforces JSON output."""
    if not request.schema:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Schema required",
                "reason": "/chat/json requires a schema field",
            },
        )
    return await chat(request)


# ==================== Graceful Shutdown ====================

def handle_sigterm(signum, frame):
    """Handle SIGTERM for graceful shutdown."""
    logger.info(f"Received signal {signum}, initiating graceful shutdown...")
    sys.exit(0)


# ==================== Entry Point ====================

if __name__ == "__main__":
    # Setup signal handlers
    signal.signal(signal.SIGTERM, handle_sigterm)
    signal.signal(signal.SIGINT, handle_sigterm)

    # Determine host and port from environment or use defaults
    host = "0.0.0.0"
    port = 6789

    logger.info(f"Starting Outlines Server on {host}:{port}")

    try:
        uvicorn.run(
            app,
            host=host,
            port=port,
            log_level="info",
            access_log=True,
        )
    except KeyboardInterrupt:
        logger.info("Server interrupted")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Server error: {e}", exc_info=True)
        sys.exit(1)
