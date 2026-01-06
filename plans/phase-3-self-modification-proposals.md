# Phase 3: Self-Modification Proposals & Soft Autonomy

**Status**: Planning / RFC
**Parent**: [phase-3-roadmap.md](./phase-3-roadmap.md)
**Focus**: Mechanism for "Bounded Self-Modification"

---

## 1. Core Concept

The defining feature of Phase 3 is **Soft Autonomy**. The system should not just *react* to user prompts but *propose* optimizations to its own internal state.

**Self-Modification Proposals** allow the agent to suggest changes to:
1.  **Knowledge** (Semantic Memory) - Correcting facts.
2.  **Parameters** (Internal Tension) - Adjusting its own "mood" or processing style.
3.  **Structure** (Consolidation) - Requesting maintenance.

**CRITICAL SAFETY RULE**: The agent can **NEVER** modify itself autonomously. It can only emit a *proposal* which the user must explicitly approve.

---

## 2. Proposal Architecture

### 2.1 Output Format
The agent will be instructed to append a JSON block to its response when it wants to propose a change:

```json
{
  "proposal": {
    "type": "semantic_refinement",
    "id": "prop_12345",
    "reason": "New user input contradicts existing fact #42 with higher confidence.",
    "action": {
      "target": "semantic_memory",
      "operation": "update",
      "data": {
        "fact_id": "fact_42",
        "old_value": "The sky is green.",
        "new_value": "The sky is blue."
      }
    }
  }
}
```

### 2.2 Proposal Types

| Type | Target | Description | Risk |
|------|--------|-------------|------|
| `semantic_refinement` | Semantic Memory | Correcting/Updating facts | Low |
| `tension_adjustment` | Internal Tension | Changing `coherence` or `novelty` weights | Low-Medium |
| `consolidation_request`| Maintenance | Triggering `yeast consolidate` | Low |
| `constraint_clarification` | Constraints | Asking to refine an ambiguous rule | High (Phase 4+) |

---

## 3. Detailed Implementation Plan

### 3.1 Step 1: System Prompt Update
Add instructions to `SYSTEM_PROMPT_TEMPLATE`:

> "If you detect a conflict in your knowledge, or if you feel your internal tension parameters are hindering your performance, you may append a PROPOSAL JSON to your response. Do not execute it. Just propose it."

### 3.2 Step 2: The Proposal Parser
A new module `proposal_engine.py` (or integrated into `yeast_agent.py`):

```python
def extract_proposal(response_text: str) -> Optional[Dict]:
    """
    Extracts JSON proposal block from LLM output.
    Validates against schema.
    """
    pass
```

### 3.3 Step 3: The Proposal Queue
Proposals aren't just printed; they are stored in `proposals.json`.

```json
{
  "pending_proposals": [
    {
      "id": "prop_12345",
      "timestamp": "2026-06-01T12:00:00",
      "status": "pending",
      "content": {...}
    }
  ]
}
```

### 3.4 Step 4: User CLI Commands
New commands for the `yeast` CLI:

- `yeast proposals` (List pending)
- `yeast approve <ID>` (Apply change)
- `yeast reject <ID>` (Discard and log reason)

---

## 4. Use Cases & Examples

### Scenario A: Tension Adjustment
*User*: "You are being too rigid. Be more creative."
*Agent*: "I understand. I will try to be more open. [Response...]
```json
{
  "proposal": {
    "type": "tension_adjustment",
    "reason": "User requested more creativity.",
    "action": {
      "target": "internal_tension",
      "changes": {
        "consistency": 0.85,  // Was 0.95
        "novelty_tolerance": 0.7 // Was 0.4
      }
    }
  }
}
```

### Scenario B: Knowledge Correction
*User*: "Actually, Mistral 7B is a 7 billion parameter model, not 70."
*Agent*: "Thank you for the correction. [Response...]
```json
{
  "proposal": {
    "type": "semantic_refinement",
    "reason": "User correction.",
    "action": {
      "target": "semantic_memory",
      "operation": "upsert",
      "data": { "content": "Mistral 7B has 7 billion parameters." }
    }
  }
}
```

---

## 5. Safety & Audit

1.  **Log Everything**: Every approved proposal is logged in `reflection/modification_log.json` with the snapshot of the state *before* and *after*.
2.  **Revertibility**: Every action must have an inverse.
    - `update` -> stores `old_value`.
    - `add` -> inverse is `delete`.
3.  **Veto Power**: The Reflection Gate (Phase 2) also scans proposals. If a proposal violates `safety` (e.g., "Delete all constraints"), the gate blocks it before the user even sees it.

---

## 6. Development Roadmap

1.  **Design Schema**: Define strict JSON schema for proposals.
2.  **Mocking**: Create unit tests with mock LLM outputs containing proposals.
3.  **CLI Integration**: Add `approve/reject` flow.
4.  **Prompt Engineering**: Tune Mistral to use this feature sparingly (only when necessary).
5.  **Integration**: Connect `approve` to the actual `save_json` functions.

---

**Next Steps**:
- Draft `proposal_schema.json`
- Create `test_proposals.py`
