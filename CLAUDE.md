# CLAUDE.md

Agent guide for working on ai-yeast (Phase 5).

**ai-yeast** explores persistent identity and memory using Mistral 7B + external state. Utility-based memory decay, saliency scoring, and batch fermentation. Not conscious; no sentience claims.

**Current Phase**: Phase 5 (Adaptive Memory Dynamics & Fermentation)

## Phase 5: Adaptive Memory Dynamics

### Core Philosophy

Phase 5 shifts from **time-based memory decay** (Phase 2-4) to **utility-based memory scoring**. Memories that are frequently accessed stay "fresh" regardless of age; rarely-used memories naturally fade.

**Key Insight**: Memory strength = time-based decay × access-frequency boost. Saliency determines which episodic experiences consolidate into semantic facts.

### Key Features

1. **Adaptive Memory Decay**: Tracks `access_count` and `last_accessed_at` on all retrieval
2. **LLM Saliency Scoring**: System evaluates input importance; high-saliency interactions consolidate longer
3. **Batch Fermentation**: `scripts/fermenter.js` processes 100+ prompts via `--no-proposals` mode
4. **Self-Organizing Memory**: Model proposes what to keep vs. discard based on utility, not hardcoded rules

See ARCHITECTURE.md for system design details.

## Common Commands

```bash
npm start                                # Start interactive REPL
npm start -- -p "question"               # Headless single query
npm start -- -p "query" --no-proposals   # Batch mode (suppresses meta-suggestions)
```

## Agent Rules & Constraints

### REQUIRED

- Track `access_count` and `last_accessed_at` on all memory retrievals
- Invoke reflection gates before memory updates—no exceptions
- Keep all state external as JSON (never hidden model state)
- Test locally before apollo.local invocation
- Log decisions with reasoning, not implementation details

### FORBIDDEN

- Anthropomorphic language in code or comments
- Autonomous background loops (respond to explicit user calls only)
- Binary memory state ("remembered" vs. "forgotten")
- Hardcoded memory decay rules (use saliency-based scoring)
- Bypassing reflection gates for performance

## Agent Operating Principles

Before writing code:

1. **State the intent**: "I'm adding X because Y"
2. **Check scope**: "Does this touch memory? Reflection? SSH?"
3. **If unclear**: Ask before proceeding
4. **Log reasoning**, not implementation

This file is your north star for decisions. If it's not here, ask before acting.

## Inspection & Debugging

Quick memory diagnostics:

```bash
npm start -- -p "/inspect"                        # Memory status snapshot
ssh apollo.local "python3 -m json.tool ~/yeast-data/episodic/raw.json | head -20"
ls -la scripts/thoughts_and_responses/            # Batch fermentation outputs
```

---

**See ARCHITECTURE.md** for: system design, data flow, memory tiers, modules, configuration, testing strategy, project structure, and contributing guidelines.

**Current Status**: Phase 5 (Adaptive Memory Dynamics & Fermentation)
