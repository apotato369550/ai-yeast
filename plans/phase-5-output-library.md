# Phase 5 Strategic Plan: Structured Output with Constrained Decoding

**Document**: phase-5-output-library.md
**Phase**: 5 (Adaptive Memory Dynamics & Fermentation)
**Status**: Planning
**Created**: 2026-01-09
**Audience**: Technical review (Jay + contributors)

---

## Executive Summary

7B Mistral currently fails to reliably output `[COMPLEXITY]`, `[SALIENCY]`, and `<realizations>` tags despite explicit system prompt instructions. This causes blind spots in saliency scoring and realizations extraction during batch fermentation. We will implement constrained decoding (Outlines.dev) to guarantee structured output format, eliminating missing-tag fermenter runs and enabling deterministic memory consolidation scoring.

**Why now**: Phase 5's batch fermentation exposes the parsing fragility. Outlines.dev solves this permanently without external dependencies or major migrations.

---

## Current State Analysis

### Problem Description

The system prompt explicitly requires:
1. `[COMPLEXITY: X.XX]`
2. `<thinking depth="N">...</thinking>`
3. `<realizations>...</realizations>`
4. `[SALIENCY: X.XX]`

However, analysis of fermenter output shows frequent violations:
- **initialization_1.json**: `saliency_score: null`, `realizations_count: 0`
- Pattern: 7B models interpret open-ended instructions as suggestions, not requirements
- Fallback behavior: Mistral outputs conversational response without structured markers

### Impact on Phase 5

| Capability | Current | Impact |
|---|---|---|
| **Realizations Extraction** | Regex parser fails | No insights stored |
| **Saliency Scoring** | Parser returns `null` | Cannot weight consolidation |
| **Batch Quality** | Unknown consistency | Fermenter quality varies |
| **Memory Hygiene** | Missing saliency → defaults | Low-quality = high-value |

---

## Solution Options

### Option A: Outlines.dev (Recommended) ⭐

**Approach**: Constrained decoding to enforce JSON Schema or Grammar-based output.

**Pros**:
- ✅ Local execution (no API)
- ✅ Guaranteed format compliance
- ✅ Drop-in replacement for Ollama
- ✅ Battle-tested in production

**Cons**:
- Python dependency on apollo
- ~10-15% latency increase
- Schema maintenance needed

**Effort**: 2-3 hours

---

### Option B: Custom Validation + Retry Loop

**Approach**: Parse with regex; if missing, re-prompt.

**Pros**: No new dependencies, quick (1 hour)

**Cons**: Can loop infinitely, fragile, still relies on model compliance

**Recommendation**: Fallback only

---

### Option C: LiteLLM (API Wrapper)

**Pros**: Structured output built-in

**Cons**: Breaks local-only constraint, requires API key, external dependency

**Recommendation**: Not viable

---

### Option D: vLLM (Replace Ollama)

**Pros**: Full control, native guided generation

**Cons**: Major migration (full day), high risk

**Recommendation**: Defer to Phase 6

---

## Recommended Path: Outlines.dev

**Why chosen**: Balances reliability + local execution + minimal disruption

### Architecture Changes

```
Current:  yeast.js → SSH → Ollama → raw text → regex parsing (failures here)
New:      yeast.js → SSH → Outlines Wrapper → Ollama → constrained JSON → (guaranteed)
```

### Integration Points

1. **Remote Python Service** (apollo)
   - New: `scripts/outlines-server.py` (Flask/FastAPI wrapper)
   - Accepts: `{ prompt, schema, temperature }`
   - Returns: `{ output: {...structured...}, tokens: N }`

2. **yeast-agent.js Modification**
   - Replace `axios.post(MISTRAL_API)` with structured call
   - Pass JSON schema with request
   - Parse structured response directly (no regex)

3. **System Prompt Update**
   - Add schema example to prompt
   - Simplify language (trust schema enforcement)

4. **Configuration**
   - `.env`: `OUTLINES_API=http://localhost:6789/chat`

---

## Output Schema Example

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "complexity_score": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0
    },
    "thinking_blocks": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "depth": {"type": "integer", "minimum": 1, "maximum": 3},
          "content": {"type": "string", "minLength": 10}
        },
        "required": ["depth", "content"]
      },
      "maxItems": 3
    },
    "realizations": {
      "type": "array",
      "items": {"type": "string", "minLength": 5}
    },
    "response": {
      "type": "string",
      "minLength": 10
    },
    "saliency_score": {
      "type": "number",
      "minimum": 0.0,
      "maximum": 1.0
    }
  },
  "required": ["complexity_score", "thinking_blocks", "realizations", "response", "saliency_score"]
}
```

---

## Implementation Steps

### Step 1: Python Environment Setup (apollo)
- Install: `pip install outlines-core`
- Verify Ollama connection
- Test Outlines with schema

### Step 2: Define Output Schema
- Create `plans/schemas/yeast-output.json`
- Document each field
- Add examples to CLAUDE.md

### Step 3: Build Outlines Wrapper Service
- New file: `scripts/outlines-server.py`
- Endpoint: `POST /chat`
- Error handling: 400 if schema violation

### Step 4: Update yeast-agent.js
- Replace `callMistral()` with `callMistralStructured()`
- Remove regex parsing
- Update system prompt
- Add fallback retry (max 1)

### Step 5: Test Integration
- Local: 10 diverse prompts
- Latency: Benchmark overhead
- Edge cases: Extreme inputs

### Step 6: Deploy to apollo
- Copy `outlines-server.py`
- Add systemd service
- Update `.env`
- Run fermenter batch
- Monitor for consistent output

---

## Timeline & Dependencies

| Phase | Duration | Dependency |
|---|---|---|
| Setup | 30 min | None |
| Schema Definition | 30 min | None |
| Wrapper Service | 60 min | Outlines installed |
| Agent Integration | 60 min | Wrapper working |
| Testing | 60 min | All above |
| Deploy | 30 min | apollo access |

**Total**: 4-5 hours (spread over 2-3 days)

**Parallel**: Can run with fermenter prompt collection, saliency algorithm refinement, gate tuning

---

## Risk Assessment

| Risk | Severity | Mitigation |
|---|---|---|
| Outlines complexity | Low | Well-documented, stable |
| Latency increase | Medium | Benchmark < 15% acceptable |
| Schema misalignment | Low | Test before deploy |
| Ollama issues | Medium | Verify running before startup |
| Fallback failure | Low | Retry logic + clear errors |

**Data Safety**: ✅ No loss risk, no writes, easy rollback

---

## Success Criteria

**Quantitative**:
1. 100% format compliance (all 5 fields present)
   - Before: ~70%
   - After: 100% (schema enforced)

2. Zero parsing failures
   - Before: 20-30% missing realizations
   - After: 0%

3. Performance: < 15% latency increase
   - Baseline: ~2s
   - Acceptable: < 2.3s

4. Batch consistency (100+ prompts)
   - All scores in [0.0, 1.0]
   - All thinking valid (depth 1-3)
   - All realizations non-empty

**Qualitative**:
5. Debuggability: Predictable JSON output
6. Memory: Gates receive consistent format
7. UX: Schema is self-documenting

---

## Open Questions

### 1. **Latency Tolerance**
Is a ~10-15% latency increase (2.0s → 2.2s) acceptable?
**Assumption**: Yes

### 2. **Deployment Location**
Run Outlines on apollo.local or orion?
**Assumption**: apollo.local (keeps inference local)

### 3. **Fallback Strategy**
If Outlines fails, should system:
- Return error?
- Fall back to validation + retry?
- Fall back to unstructured text?
**Assumption**: Return error (fail-safe)

### 4. **Schema Versioning**
How to handle schema changes?
- Backward-compatible additions?
- Version schema (v1, v2)?
- Support multiple dynamically?
**Assumption**: Single schema, backward-compatible additions

### 5. **Testing Environment**
Test Outlines locally first, or only on apollo?
**Assumption**: Local test first (fast), then apollo validation

---

## Next Steps

1. Review this plan with Jay (async, < 30 min)
2. Decide on open questions
3. Create schema file
4. Spike Outlines locally (30 min POC)
5. Proceed to implementation

---

## References

- Outlines.dev: https://outlines-ai.github.io/
- Current failure: `scripts/thoughts_and_responses/initialization/initialization_1.json`
- Affected modules:
  - `src/agent/yeast-agent.js` (callMistral function)
  - `src/thinking/realizationExtractor.js` (parsing)
  - `src/cli/repl.js` (output formatting)
  - `scripts/fermenter.js` (batch processor)

---

**Status**: Ready for Technical Review
**Created**: 2026-01-09
