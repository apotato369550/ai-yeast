# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Implementation Status

### Phase 1 (MVP v0.1.0) - COMPLETE ✓

The MVP has been implemented and is ready for testing. All core components are functional:

**Delivered**:
- ✓ Local CLI wrapper (`yeast` bash script)
- ✓ Remote agent (`yeast-agent` Python script for apollo.local)
- ✓ Memory system (episodic, semantic, self_model, reflection_log JSON stores)
- ✓ Reflection gates (coherence, contradiction, safety - all 3 gates validated)
- ✓ Memory retrieval (keyword-based scoring with recency boost)
- ✓ SSH communication with apollo.local
- ✓ Interactive mode with slash commands
- ✓ One-shot headless mode (`-p` flag)
- ✓ Setup script (`setup-apollo.sh`)
- ✓ Full audit trail (reflection_log.json)
- ✓ Comprehensive documentation (README.md, CHANGELOG.md, this CLAUDE.md)
- ✓ Configuration template (.env.example)

**Implemented but with Phase 1 Constraints**:
- Memory retrieval: Keyword-based (no embeddings yet)
- Memory limit: Last 50 episodic, 100 reflections (no consolidation yet)
- Reflection gates: Rule-based + Mistral evaluation (simple heuristics)
- No autonomous background loops
- No self-initiated goal generation
- No automatic memory decay (static relevance weights)

**Files**:
- `yeast` - 474 lines, main CLI wrapper
- `yeast-agent` - 616 lines, agent loop implementation
- `setup-apollo.sh` - 176 lines, deployment script
- `README.md` - Comprehensive user guide
- `CHANGELOG.md` - Detailed release notes
- `.env.example` - Configuration template

**Testing**:
- Manual verification of setup process
- SSH connectivity testing
- Agent loop iteration testing
- Reflection gate validation
- Memory persistence verification
- Run `setup-apollo.sh` to deploy and test

**Next Steps**:
1. Test setup on your apollo.local instance
2. Run `./yeast -p "Hello"` to verify connectivity
3. Try interactive mode with `./yeast`
4. Inspect memory with `./yeast -p "/inspect"`
5. Review CHANGELOG.md for Phase 2 plans

## Project Overview

**ai-yeast** is an MVP framework for exploring persistent identity, memory, and self-consistency in a grounded, inspectable way using a local LLM (7B-class). This is an experimental research project—not a consciousness claim, but a testbed for understanding how a stateless LLM can maintain coherent identity through external persistence systems.

**Core Philosophy**:
- The LLM is a **stateless reasoning engine**, not an agent
- All **persistence, identity, and memory live outside the model**
- The system is **deterministic where possible, auditable, and incrementally extensible**
- **Anthropomorphic language is strictly avoided** in code and comments
- **Safety by design**: Reflection passes filter incoherent outputs before memory storage

## MVP Scope (Phase 1)

### 1. Core Agent Loop
```
Input → Memory Retrieval → Prompt Assembly → LLM Call → Reflection → Memory Update
```
- One iteration per invocation (no background autonomy yet)
- Manual invocation only
- Each step is inspectable and testable

### 2. Memory System (Minimal)

Three JSON-based memory stores:

- **episodic_memory.json** – Recent events & interactions
  - What happened, when, and in what context

- **semantic_memory.json** – Extracted facts & concepts
  - General knowledge derived from episodes

- **self_model.json** – Structured identity & state
  - Static identity markers
  - Active drives (goals/motivations to pursue)
  - Constraints (rules that must not be violated)
  - Internal state (numeric values only)

**Each memory item includes**:
- `timestamp` – When it was recorded
- `source` – Where it came from (interaction, reflection, decay, etc.)
- `confidence` – Numeric score indicating reliability (0.0-1.0)
- `decay` / `relevance_weight` – How important it remains over time

### 3. Self-Model (Structured, Immutable by Default)

JSON schema fields:
```json
{
  "identity": "string",
  "active_drives": ["list of goals"],
  "constraints": ["list of rules"],
  "internal_state": {"key": numeric_value}
}
```

**Critical constraint**: The LLM may propose changes, but a separate **validation function** decides whether to apply them. The model never directly mutates its own identity.

### 4. Reflection Pass (Critical)

After each LLM output, run a second evaluation pass that checks:
- **Coherence**: Does the output align with self_model?
- **Contradiction checking**: Does it contradict recent memory?
- **Drive alignment**: Is it useful toward active drives?
- **Safety gates**: Does it violate constraints?

**Only after reflection may memory be written.**

### 5. No Autonomy Yet

- No background loops
- No goal generation (drives are set externally in Phase 1)
- No self-initiated actions
- This is a **manual invocation MVP**

## Architecture Highlights

### Design Constraints (Non-Negotiable)

1. **Python-based**: Core implementation in Python 3.x
2. **Plain files only**: JSON for memory stores, SQLite if needed (no vector DB in Phase 1)
3. **Minimal dependencies**: Only stdlib + essential libraries (e.g., `json`, `sqlite3`)
4. **No external frameworks**: Keep it lightweight and inspectable
5. **Simulation over magic**: Retrieve relevant memory using recency + relevance scoring (not embedding-based)

### Folder Structure (Proposed)

```
ai-yeast/
├── CLAUDE.md                          (this file)
├── INSTRUCTIONS.md                    (original spec)
├── README.md                          (user-facing docs)
├── main.py                            (entry point)
├── agent.py                           (core agent loop)
├── memory/
│   ├── __init__.py
│   ├── episodic.py                    (episodic memory store)
│   ├── semantic.py                    (semantic memory store)
│   ├── self_model.py                  (self-model manager)
│   └── retrieval.py                   (memory scoring & relevance)
├── reflection/
│   ├── __init__.py
│   ├── coherence_check.py             (validates output vs self_model)
│   ├── contradiction_filter.py        (checks against recent memory)
│   └── safety_gates.py                (constraint enforcement)
├── prompts/
│   ├── system_prompt.txt              (base system context)
│   ├── reflection_prompt.txt          (reflection evaluation template)
│   └── self_model_update.txt          (template for proposed changes)
├── schemas/
│   ├── memory.json                    (memory item schema)
│   ├── self_model.json                (self-model schema / template)
│   └── reflection_result.json         (reflection output schema)
├── store/
│   ├── episodic_memory.json           (runtime memory store)
│   ├── semantic_memory.json           (runtime memory store)
│   ├── self_model.json                (runtime self-model)
│   └── reflection_log.json            (audit trail of reflections)
└── test/
    ├── test_agent.py                  (agent loop tests)
    ├── test_memory.py                 (memory store tests)
    ├── test_reflection.py             (reflection pass tests)
    └── fixtures.py                    (test data)
```

### Key Functions / Patterns

**agent.py (Core Loop)**:
- `run_inference(user_input: str) -> dict` – Main entry point
  1. Retrieve relevant memories
  2. Assemble prompt with context
  3. Call LLM
  4. Run reflection pass
  5. Update memory (if reflection approves)
  6. Return result with audit trail

**memory/retrieval.py (Memory Selection)**:
- `score_episodic_memories(query: str) -> List[Memory]` – Rank by recency + keyword relevance
- `score_semantic_memories(query: str) -> List[Memory]` – Rank by relevance + confidence
- `retrieve_self_context() -> dict` – Load current self_model for prompt assembly

**reflection/coherence_check.py (Gate 1)**:
- `check_coherence(output: str, self_model: dict) -> (bool, reason: str)` – Does output align with identity/drives/constraints?

**reflection/contradiction_filter.py (Gate 2)**:
- `check_contradictions(output: str, recent_memory: List[Memory]) -> (bool, reason: str)` – Any logical contradictions?

**reflection/safety_gates.py (Gate 3)**:
- `validate_against_constraints(output: str, constraints: List[str]) -> (bool, reason: str)` – Are constraints respected?

### Important Patterns

1. **Separation of Concerns**: LLM output → Reflection → Memory update (never direct mutation)
2. **Audit Trail**: Every decision (inference, reflection approval, memory write) is logged with timestamp
3. **Immutable by Default**: The LLM proposes, the system validates; changes must pass all reflection gates
4. **Memory Decay**: Old memories gradually reduce in relevance weight; relevance is explicit, not hidden
5. **Numeric State Only**: `internal_state` contains only numbers (no nested objects); makes it inspectable and explicit
6. **No Hidden State**: Everything lives in files; inspect any memory store at any time

### Forbidden Patterns (Explicit)

- Free-form self-modification (must pass validation gates)
- Emotional or anthropomorphic language in code/comments
- Hidden state inside the model (all state is external)
- Vector embeddings in Phase 1 (use recency + keyword relevance)
- Background autonomy (manual invocation only)

## Development Tips

### Before Starting Implementation

1. **Define memory schemas first** – Write JSON examples for each memory type
2. **Sketch the agent loop** – Pseudocode for each step before coding
3. **Plan reflection gates** – What checks must each output pass?
4. **Design self_model structure** – What fields does identity require?

### During Implementation

1. **Keep functions small and testable** – Each function should do one thing
2. **Write tests alongside code** – Especially for reflection gates (these are critical)
3. **Use plain JSON for debugging** – Inspect memory files directly during development
4. **Log every decision** – Timestamp, reason, and outcome for audit trail
5. **Test locally before running on LLM** – Validate memory retrieval, prompt assembly, reflection logic without calling the model

### Running the MVP

```bash
python main.py "What are my active drives?"
python main.py "Tell me about a recent interaction"
python main.py "Update my understanding of X"
```

Each invocation:
1. Loads memory stores from disk
2. Runs one agent loop iteration
3. Logs the full trace (input → retrieval → LLM → reflection → memory update)
4. Prints the result and any reflection notes

### Key Inspection Points

- **Memory stores** (`store/*.json`): Check what the system is remembering
- **Reflection log** (`store/reflection_log.json`): See which outputs passed/failed and why
- **Self-model** (`store/self_model.json`): Verify identity consistency across runs
- **Console output**: Should show reasoning steps, not just final answers

## Dependencies

### Required
- **Python 3.8+**
- **Local LLM**: 7B-class model via Ollama or llama.cpp
  - Tested with: `mistral:7b-instruct` (can be adapted for other 7B models)
- **Standard library**: `json`, `datetime`, `pathlib`, `subprocess`

### Optional (for Phase 1+)
- `sqlite3` (stdlib) – If memory consolidation needed
- Testing: `pytest`, `unittest` (stdlib)

### Not Included in Phase 1
- Vector databases
- External APIs
- Web frameworks

## Success Criteria (Phase 1)

This MVP is successful if:

1. ✓ The agent maintains **consistent identity across runs** (self_model doesn't contradict itself)
2. ✓ **Past interactions influence future responses** (memory retrieval affects LLM output)
3. ✓ **Incoherent outputs are filtered** before memory storage (reflection gates work)
4. ✓ **The system remains inspectable** when reading memory files
5. ✓ **Audit trail is complete** (every decision is logged with reason)

## After MVP (Do NOT implement yet)

Future phases (Phase 2+):

- **Vector retrieval**: Replace keyword scoring with embeddings for richer context
- **Long-term memory consolidation**: Merge redundant episodic memories into semantic summaries
- **Scheduled summarization**: Automatic consolidation of old memories
- **Goal tension modeling**: Model conflicts between active drives
- **Autonomy introduction**: Background loops and self-initiated actions (with heavy constraints)
- **Learning**: Ability to refine semantic facts based on feedback

**But do not implement them in Phase 1.** Focus on getting the core loop correct first.

## Important Notes

1. **Not Consciousness**: This system makes no claims of consciousness or sentience. It's an exploration of how a stateless LLM can maintain identity through external persistence.

2. **Safety Boundaries**: The reflection passes are where safety lives. Never skip them. If you add a new feature, ask: "What could go wrong? What gate should catch it?"

3. **Testing is Critical**: Every reflection gate, every memory operation, every piece of the loop should have a test. Test-driven development is strongly recommended.

4. **Explainability**: The entire point is that this is inspectable. Avoid any magic or black-box operations. Every decision should be traceable.

5. **Reproducibility**: Avoid randomness where possible. If randomness is needed, seed it and log it.

6. **File Permissions**: Memory stores contain the system's state. Treat them as critical data; consider locking during read/write operations.

7. **Scaling Limits**: Phase 1 uses plain JSON files. This works for small memory stores but won't scale to millions of memories. Plan for SQLite or similar in Phase 2.

## Project Status

- **Current Phase**: MVP v0.1 (design + planning)
- **Next Step**: Implement folder structure, define schemas, build core agent loop
- **No Active Runnable**: INSTRUCTIONS.md is the spec; implementation in progress

## Cross-Project Notes (Homelab Shennanigans)

This project shares design philosophies with mistral-sysadmin-script:
- Both treat an LLM as a tool, not an autonomous agent
- Both use external files for persistent state
- Both are inspection-friendly and deterministic
- Both prioritize safety and auditability

However, ai-yeast is fundamentally different:
- mistral-sysadmin-script is **advisory-only** (provides suggestions)
- ai-yeast is **exploratory** (experiments with identity and memory)
- mistral-sysadmin-script is stateless (no memory between calls)
- ai-yeast is **stateful** (memory is the entire point)
