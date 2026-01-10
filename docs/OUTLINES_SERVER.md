# Outlines Server: Constrained Generation Service

## Overview

`outlines-server.py` is a FastAPI wrapper around [Outlines.dev](https://outlines-ai.github.io/) that enables **schema-constrained generation** using Mistral 7B via Ollama.

Instead of post-hoc validation, Outlines enforces structural constraints **during token generation**, guaranteeing output conforms to a JSON Schema without truncation or retry loops.

## Features

- **FastAPI + Uvicorn**: Lightweight async HTTP server
- **Model Pooling**: Single initialized Ollama connection reused across requests
- **Schema-Guided Generation**: JSON Schema constraints enforced during token generation
- **Graceful Degradation**: Operates in "degraded mode" if Ollama unavailable
- **Health Checks**: Real-time service and dependency status
- **Structured Logging**: All requests/responses logged to stdout with timestamps
- **Graceful Shutdown**: SIGTERM handling with cleanup

## Installation

### 1. Install Dependencies

```bash
pip install fastapi uvicorn outlines
```

**Required packages**:
- `fastapi>=0.100.0` — Web framework
- `uvicorn>=0.24.0` — ASGI server
- `outlines>=0.0.18` — Constrained generation (requires lark, pydantic, cloudpickle)
- `pydantic>=2.0.0` — Request validation

**Optional** (for development):
- `python-dotenv` — Environment variable management
- `pytest` — Testing

### 2. Ensure Ollama is Running

The server connects to Ollama on `localhost:11434` (default). Verify:

```bash
curl http://localhost:11434/api/tags
```

Expected response: list of available models including `mistral:7b-instruct`.

### 3. Copy to apollo

```bash
scp scripts/outlines-server.py jay@apollo.local:~/scripts/
scp scripts/outlines-server.service jay@apollo.local:~/.config/systemd/user/
```

Or via deployment script (Phase 5):
```bash
bash scripts/deploy-to-apollo.sh
```

## Running

### Standalone (Development)

```bash
python3 scripts/outlines-server.py
```

Output:
```
2026-01-10 14:23:45 [INFO] outlines-server: ============================================================
2026-01-10 14:23:45 [INFO] outlines-server: Outlines Server Starting
2026-01-10 14:23:45 [INFO] outlines-server: ============================================================
2026-01-10 14:23:45 [INFO] outlines-server: Initializing Ollama model pool: mistral:7b-instruct
2026-01-10 14:23:47 [INFO] outlines-server: ✓ Ollama model 'mistral:7b-instruct' ready
2026-01-10 14:23:47 [INFO] outlines-server: Server ready on http://0.0.0.0:6789
2026-01-10 14:23:47 [INFO] outlines-server: Endpoints: GET /health, POST /chat
```

Server listens on **0.0.0.0:6789** (all interfaces, port 6789).

### Systemd (Production on apollo)

```bash
# Install service
systemctl --user enable outlines-server.service
systemctl --user start outlines-server.service

# Tail logs
journalctl --user -u outlines-server -f

# Check status
systemctl --user status outlines-server.service
```

Logs also written to `/home/jay/logs/outlines-server.log`.

## API Endpoints

### Health Check

```bash
curl http://localhost:6789/health
```

**Response** (200 OK):
```json
{
  "status": "ok",
  "timestamp": "2026-01-10T14:23:50.123456",
  "ollama_ready": true,
  "outlines_available": true
}
```

### Chat with Schema Constraints

```bash
curl -X POST http://localhost:6789/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Generate a JSON object representing a person with name and age: ",
    "schema": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "age": {"type": "integer"}
      },
      "required": ["name", "age"]
    },
    "temperature": 0.7,
    "model": "mistral:7b-instruct"
  }'
```

**Request Fields**:
- `prompt` (string, required): The text to generate from
- `schema` (object, optional): JSON Schema defining output structure
- `temperature` (float, default 0.7): Sampling temperature (0.0-2.0)
- `model` (string, default "mistral:7b-instruct"): Ollama model name

**Response** (200 OK):
```json
{
  "output": {
    "name": "Alice",
    "age": 30
  },
  "tokens_used": 45,
  "schema_validated": true
}
```

**Error Response** (400/500):
```json
{
  "error": "Invalid request",
  "reason": "temperature must be between 0.0 and 2.0"
}
```

### Chat (Free Generation, No Schema)

```bash
curl -X POST http://localhost:6789/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Complete this sentence: The future of AI is",
    "temperature": 0.9
  }'
```

**Response**:
```json
{
  "output": "bright and full of possibilities, driven by collaborative human-AI partnerships.",
  "tokens_used": 35,
  "schema_validated": false
}
```

### Chat/JSON Convenience Endpoint

Shorthand for enforcing JSON output:

```bash
curl -X POST http://localhost:6789/chat/json \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "As JSON: ",
    "schema": {"type": "object"}
  }'
```

Returns 400 if `schema` field missing.

## JSON Schema Support

Outlines uses **Lark grammar-based generation** to enforce schemas. Common patterns:

### Simple Object
```json
{
  "type": "object",
  "properties": {
    "field_name": {"type": "string"},
    "field_value": {"type": "integer"}
  },
  "required": ["field_name"]
}
```

### Array
```json
{
  "type": "array",
  "items": {
    "type": "object",
    "properties": {
      "id": {"type": "integer"},
      "label": {"type": "string"}
    }
  }
}
```

### Enum
```json
{
  "type": "object",
  "properties": {
    "status": {
      "enum": ["pending", "active", "completed"]
    }
  }
}
```

### Nested
```json
{
  "type": "object",
  "properties": {
    "user": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "email": {"type": "string"}
      }
    }
  }
}
```

## Configuration

### Environment Variables

All optional; defaults shown:

```bash
# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=6789

# Ollama connection
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=mistral:7b-instruct
OLLAMA_TIMEOUT_MS=30000

# Generation defaults
GENERATION_MAX_TOKENS=4096
GENERATION_DEFAULT_TEMPERATURE=0.7

# Logging
LOG_LEVEL=info
```

Set in shell before running:
```bash
export OLLAMA_TIMEOUT_MS=60000
python3 scripts/outlines-server.py
```

Or in `.env` file (requires dotenv):
```bash
OLLAMA_TIMEOUT_MS=60000
LOG_LEVEL=debug
```

### Systemd Service Configuration

Edit `outlines-server.service` to customize:

```ini
# Memory limit (default 2G)
MemoryMax=4G

# Restart behavior (default always, 5s)
RestartSec=10s

# Log file location (default /home/jay/logs/outlines-server.log)
StandardOutput=append:/var/log/outlines-server.log

# After which services (default network-online.target)
After=network-online.target ollama.service
```

Then reload and restart:
```bash
systemctl --user daemon-reload
systemctl --user restart outlines-server
```

## Logging

### Console Output (Development)

All logs sent to stdout with timestamps:
```
2026-01-10 14:23:50,123 [INFO] outlines-server: [/chat] Prompt: Generate...
2026-01-10 14:23:52,456 [INFO] outlines-server: [/chat] ✓ Success (tokens=150, validated=true)
```

### Systemd Journal

```bash
journalctl --user -u outlines-server.service -f
journalctl --user -u outlines-server.service --since "10 minutes ago"
```

### Log File

```bash
tail -f /home/jay/logs/outlines-server.log
```

Ensure `/home/jay/logs/` directory exists:
```bash
mkdir -p ~/logs
```

## Error Handling

### Ollama Connection Failure

**Startup**:
```
[ERROR] outlines-server: Failed to initialize Ollama: Connection refused
```

Server starts in **degraded mode**. Health check returns `"status": "degraded"`.

API requests fail with 503:
```json
{
  "error": "Service Unavailable",
  "reason": "Ollama not initialized: Connection refused"
}
```

**Fix**: Start Ollama, then restart service:
```bash
ollama serve
# (in another terminal)
systemctl --user restart outlines-server
```

### Schema Validation Failure

If generated output doesn't match schema, response includes:
```json
{
  "output": "...malformed output...",
  "tokens_used": 45,
  "schema_validated": false
}
```

Outlines attempts to enforce schema during generation, but edge cases may occur. Retry with:
- Lower temperature (more deterministic)
- Simpler schema
- Longer prompt context

### Timeout

Generation exceeds 30s → 500 error:
```json
{
  "error": "Generation failed",
  "reason": "Request timeout after 30000ms"
}
```

Increase `OLLAMA_TIMEOUT_MS` if needed.

## Performance Notes

### Model Pooling

The model is initialized **once at startup** and reused for all requests. This avoids expensive model loading on every query.

- **Startup**: ~3-5s (model load)
- **Per-request**: ~100-500ms (depends on prompt length, max_tokens, temperature)
- **Memory**: ~4-6GB for Mistral 7B

### Concurrency

FastAPI/Uvicorn handles multiple concurrent requests. If Ollama becomes a bottleneck:

1. Use a more efficient model (Mistral 3B instead of 7B)
2. Reduce `max_tokens` limit
3. Run multiple Ollama instances on different GPUs

### Schema Overhead

Grammar-guided generation adds ~10-20% latency vs. free generation, due to token filtering.

## Integration with ai-yeast

Future Phase 6 usage:

```javascript
// src/agent/yeast-agent.js or similar
import axios from 'axios';

async function generateStructured(prompt, schema) {
  const response = await axios.post('http://apollo.local:6789/chat', {
    prompt,
    schema,
    temperature: 0.7,
  });
  return response.data.output;
}

// Usage
const personSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    age: { type: "integer" }
  }
};

const person = await generateStructured("Invent a person: ", personSchema);
console.log(person); // { name: "Bob", age: 42 }
```

## Troubleshooting

### Port Already in Use

```bash
lsof -i :6789
kill -9 <PID>
```

Or change port in code and systemd service.

### OutlineImportError

```
ImportError: No module named 'outlines'
```

Install:
```bash
pip install outlines
```

### Ollama Not Available

Check Ollama is running:
```bash
curl http://localhost:11434/api/tags
```

Or on apollo:
```bash
ssh jay@apollo.local 'curl http://localhost:11434/api/tags'
```

### High Memory Usage

Monitor:
```bash
watch -n 1 'ps aux | grep outlines-server'
```

Reduce `MemoryMax` in systemd service or decrease max_tokens in requests.

### Slow Responses

Enable debug logging:
```bash
LOG_LEVEL=debug python3 scripts/outlines-server.py
```

Check if Ollama GPU is saturated (too many concurrent requests).

## Testing

### Unit Tests (Local, no Ollama needed)

```bash
pytest scripts/test_outlines_server.py -v
```

### Integration Tests (requires Ollama)

```bash
python3 -m pytest scripts/test_outlines_server.py::test_chat_with_schema -v --tb=short
```

### Manual Testing

```bash
# Health
curl http://localhost:6789/health | jq .

# Simple chat
curl -X POST http://localhost:6789/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello", "temperature": 0.5}'

# Schema-guided
curl -X POST http://localhost:6789/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Person: ",
    "schema": {"type": "object", "properties": {"name": {"type": "string"}}}
  }' | jq .
```

## References

- **Outlines Docs**: https://outlines-ai.github.io/
- **FastAPI**: https://fastapi.tiangolo.com/
- **Ollama**: https://ollama.ai/
- **JSON Schema**: https://json-schema.org/
- **Uvicorn**: https://www.uvicorn.org/

## License

MIT (same as ai-yeast project)
