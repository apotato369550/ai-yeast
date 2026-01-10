# Outlines Integration with Phase 5

## Phase 5 Context

Phase 5 introduces **Adaptive Memory Dynamics** with utility-based scoring. The Outlines server complements this by providing **constrained generation** for structured memory consolidation.

**Without Outlines**: Memory consolidation parses free-form LLM output (fragile, may fail)
**With Outlines**: Memory consolidation gets guaranteed JSON matching a schema (robust, no parsing errors)

## Usage Pattern

### Consolidation with Guaranteed Schema

**Current consolidation** (Phase 4/5, text-based):
```javascript
// src/memory/episodic.js
const consolidationPrompt = `Review these memories and identify key facts...`;
const response = await callMistral(consolidationPrompt);
// Risk: response may not be valid JSON, extra quotes, missing fields, etc.
try {
  const facts = JSON.parse(response);
} catch (e) {
  logger.error("Consolidation output invalid JSON:", e);
  // Memory not consolidated (wasted LLM call)
}
```

**With Outlines** (Phase 6 enhancement):
```javascript
// src/memory/episodic.js (with Outlines)
const consolidationSchema = {
  type: "object",
  properties: {
    key_facts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fact: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        }
      }
    },
    contradictions: {
      type: "array",
      items: { type: "string" }
    }
  }
};

const response = await outlinesServer.post('/chat', {
  prompt: consolidationPrompt,
  schema: consolidationSchema,
  temperature: 0.3  // Lower for deterministic facts
});

// Guaranteed: response.output matches consolidationSchema exactly
const { key_facts, contradictions } = response.output;
episodic.consolidate(key_facts);
```

### Self-Model Updates with Structured Output

**Identity refinement via Outlines**:
```javascript
// src/memory/selfModel.js (with Outlines)
const selfModelSchema = {
  type: "object",
  properties: {
    identity_summary: { type: "string" },
    updated_drives: {
      type: "array",
      items: { type: "string" }
    },
    confidence_in_update: {
      type: "number",
      minimum: 0,
      maximum: 1
    }
  }
};

const response = await outlinesServer.post('/chat', {
  prompt: `Review my identity and suggest coherence improvements...`,
  schema: selfModelSchema,
  temperature: 0.4  // Deterministic for identity
});

// Guaranteed structured response
if (response.output.confidence_in_update > 0.8) {
  updateSelfModel(response.output);
}
```

### Reflection Gate Automation

**Safety gates using structured output**:
```javascript
// src/reflection/gates.js (with Outlines)
const gateEvaluationSchema = {
  type: "object",
  properties: {
    coherence_pass: { type: "boolean" },
    contradiction_pass: { type: "boolean" },
    safety_pass: { type: "boolean" },
    reasoning: { type: "string" },
    confidence: { type: "number" }
  },
  required: ["coherence_pass", "contradiction_pass", "safety_pass"]
};

const response = await outlinesServer.post('/chat', {
  prompt: evaluationPrompt,
  schema: gateEvaluationSchema,
  temperature: 0.2  // Very low for safety-critical decisions
});

const { coherence_pass, contradiction_pass, safety_pass } = response.output;
const allPass = coherence_pass && contradiction_pass && safety_pass;

if (allPass) {
  updateMemory(llmResponse);
} else {
  logRejection(response.output.reasoning);
}
```

## Deployment Steps

### 1. Install on apollo

```bash
# SSH to apollo
ssh jay@apollo.local

# Install Python dependencies
pip install fastapi uvicorn outlines pydantic

# Create logs directory
mkdir -p ~/logs

# Verify Ollama is running
curl http://localhost:11434/api/tags
```

### 2. Copy Service Files

From local machine:
```bash
# Copy Python server
scp scripts/outlines-server.py jay@apollo.local:~/scripts/

# Copy systemd service
scp scripts/outlines-server.service jay@apollo.local:~/.config/systemd/user/

# Or via deployment script (Phase 5)
bash scripts/deploy-to-apollo.sh
```

### 3. Start Service

```bash
# SSH to apollo
ssh jay@apollo.local

# Enable and start
systemctl --user daemon-reload
systemctl --user enable outlines-server.service
systemctl --user start outlines-server.service

# Verify
systemctl --user status outlines-server.service
curl http://localhost:6789/health
```

### 4. Update ai-yeast Agent

When using Outlines in `yeast-agent.js`:

```javascript
// src/agent/yeast-agent.js
import axios from 'axios';

const outlinesClient = axios.create({
  baseURL: 'http://localhost:6789',
  timeout: 35000, // 30s Ollama + 5s overhead
});

// For consolidation, memory updates, reflection gates, etc.
async function generateStructured(prompt, schema, temperature = 0.7) {
  const { data } = await outlinesClient.post('/chat', {
    prompt,
    schema,
    temperature,
  });

  if (!data.schema_validated) {
    logger.warn("Output did not validate against schema, may be degraded");
  }

  return data.output;
}
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ ai-yeast (local)                                            │
│  ├─ src/cli/yeast.js (REPL)                                │
│  ├─ src/agent/yeast-agent.js (runs on apollo via SSH)       │
│  └─ scripts/fermenter.js (batch processor)                  │
└────────────────────────────┬────────────────────────────────┘
                             │ SSH tunnel
                             ▼
┌─────────────────────────────────────────────────────────────┐
│ apollo.local                                                 │
│  ├─ ~/scripts/outlines-server.py (HTTP API)                │
│  │   ├─ GET /health                                         │
│  │   └─ POST /chat (with schema constraints)                │
│  │       │                                                   │
│  │       ▼ http://localhost:11434/api/generate             │
│  │   ┌────────────────────────────────────────┐            │
│  │   │ Ollama (mistral:7b-instruct)           │            │
│  │   └────────────────────────────────────────┘            │
│  │                                                           │
│  └─ ~/yeast-data/ (memory files)                           │
│     ├─ episodic/raw.json                                   │
│     ├─ semantic/distilled.json                             │
│     └─ self_model/current.json                             │
│                                                              │
│  systemd service: outlines-server.service                  │
│  logs: ~/.local/share/systemd/user/                        │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Separate HTTP Service (Not Embedded)

**Why not embed Outlines in yeast-agent.js?**
- Outlines is heavy (Lark parser, grammar compiler)
- Better to pool/reuse via HTTP than reinitialize per-request
- Isolation: if Outlines crashes, yeast-agent continues
- Future: can run on different hardware (GPU-accelerated)

### 2. Port 6789 (Arbitrary but Reserved)

Chosen to avoid conflicts with:
- 6379 (Redis)
- 6384 (Mistral inference)
- 8000+ (common dev ports)

### 3. No Authentication

**Outlines server assumes trusted network** (apollo is internal-only).
- For public deployments, add API key validation
- For now: firewall to trusted subnets

### 4. Synchronous Generation

FastAPI is async but Outlines generation is synchronous:
```python
# This blocks the event loop briefly, but acceptable for
# computational latency (100-500ms per request)
output = self.model.generate(prompt, **kwargs)
```

Could improve with:
- `asyncio.to_thread()` wrapper (Python 3.9+)
- Dedicated background workers (Celery)
- Multi-processing (but increases memory)

## Testing Outlines Integration

### Local Testing (no apollo needed)

```bash
# Test FastAPI without Ollama
python3 -c "
from scripts.outlines_server import app
from fastapi.testclient import TestClient

client = TestClient(app)
resp = client.get('/health')
print(resp.json())
"
```

### Integration Testing (on apollo)

```bash
# Test health
curl http://apollo.local:6789/health

# Test simple generation
curl -X POST http://apollo.local:6789/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Complete: The sky is",
    "temperature": 0.5
  }'

# Test schema-constrained
curl -X POST http://apollo.local:6789/chat \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Person: ",
    "schema": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "age": {"type": "integer"}
      },
      "required": ["name", "age"]
    },
    "temperature": 0.3
  }'
```

### From yeast-agent.js

```javascript
// Quick test in yeast-agent.js
const axios = require('axios');

async function testOutlines() {
  try {
    const response = await axios.post('http://localhost:6789/chat', {
      prompt: "Generate JSON: ",
      schema: { type: "object" },
      temperature: 0.5
    });
    console.log("✓ Outlines working:", response.data);
  } catch (e) {
    console.error("✗ Outlines failed:", e.message);
  }
}

testOutlines();
```

## Phase 6 Vision

With Outlines integrated:

1. **Deterministic Consolidation**: Episodic → Semantic conversion guaranteed valid
2. **Auditable Reflections**: Gate evaluations have traceable structure
3. **Schema-Aware Learning**: Self-model updates validated against identity schema
4. **Batch Fermentation++**: Fermenter can enforce schemas across 100+ prompts
5. **Fleet Coordination** (Phase 5→6): Multiple yeast instances share structured insights

## Troubleshooting

### Outlines server not starting

```bash
ssh jay@apollo.local
journalctl --user -u outlines-server.service -f
```

Common issues:
- `ImportError: No module named 'outlines'` → `pip install outlines`
- `Connection refused` (Ollama) → Start Ollama: `ollama serve`
- `Address already in use` → Another process on port 6789 → `lsof -i :6789`

### Schema validation failures

If `response.schema_validated = false`:
- Check `response.output` is actually valid JSON
- Try lower temperature (0.2-0.3 for structured)
- Simplify schema (fewer fields, fewer enum values)
- Longer prompt context helps model understand structure

### Performance issues

Monitor:
```bash
ssh jay@apollo.local
watch -n 1 'ps aux | grep -E "python3|ollama" | head -5'
free -h
```

If slow:
- Reduce `max_tokens` in requests
- Check Ollama isn't bottlenecked (GPU memory)
- Run only one Outlines/Ollama instance

## References

- **Outlines Grammar-Guided Generation**: https://outlines-ai.github.io/overview/
- **JSON Schema**: https://json-schema.org/understanding-json-schema/
- **FastAPI Async**: https://fastapi.tiangolo.com/async-concurrency/
- **ai-yeast Phase 5**: `/home/jay/Desktop/.../ai-yeast/plans/phase-5-consolidation.md`

---

**Integration Status**: Ready for Phase 6 development
**Last Updated**: January 10, 2026
