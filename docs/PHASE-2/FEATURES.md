# Phase 2: Memory Depth, Time, and Pressure

## Overview

Phase 2 introduces temporal structure to memory without introducing autonomy. The system now "feels older" through explicit time decay, consolidation, and observable forgetting. Identity stability is tested through drift detection.

**Status**: Ready for testing on branch `phase-2-memory-depth`

## Key Additions

### 1. Time-Based Memory Decay

**Problem**: Episodic memories should become less accessible over time, simulating natural memory fade.

**Solution**: Exponential decay with 14-day half-life.

```python
decay = 0.5 ^ (age_days / 14)
```

Each memory starts at 1.0 (full strength) and decays to:
- 50% after 14 days
- 25% after 28 days
- 12.5% after 42 days
- Approaches 0 over months

Memories are never deleted based on decay alone—only through consolidation.

**Usage**:
- View decay in `/inspect` output
- Old memories still accessible but lower relevance weight
- Young memories dominate retrieval

### 2. Memory Consolidation (Core Feature)

**Problem**: Episodic memories accumulate without limit. Semantic memory should compress experience.

**Solution**: Manual consolidation command that:
1. Selects aged episodic memories (decay < 60%)
2. Asks Mistral: "What patterns persist across these memories?"
3. Generates semantic facts from the patterns
4. Deletes consolidated episodes
5. Logs deletions to forgetting_log

**Usage**:
```bash
# Interactive
yeast
> /consolidate

# Command line
yeast consolidate
```

**Example**:
```
Before:
- Episodic: 45 memories (avg decay: 78%)
- Semantic: 8 facts

After consolidate:
- Episodic: 28 memories (avg decay: 92%)
- Semantic: 12 facts
- Forgotten: 17 (consolidated into patterns)
```

### 3. Observable Forgetting Log

**Problem**: Deleted memories leave no trace. Forgetting should be observable.

**Solution**: Every deletion triggers a log entry:

```json
{
  "timestamp": "2026-01-06T14:32:00",
  "deleted_memory_id": "abc-123",
  "content_summary": "User asked about...",
  "reason": "consolidated into semantic fact"
}
```

Enables:
- Answering: "What did you forget?"
- Understanding: Which memories survive consolidation
- Bias detection: Are certain types of memories forgotten preferentially?

### 4. Identity Versioning & Drift Detection

**Problem**: Identity should be auditable. Changes should be flagged.

**Solution**:
- Self-model has two files:
  - `self_model/current.json` - Active identity
  - `self_model/history.json` - Snapshot trail

**Drift Audit Command**:
```bash
yeast audit
```

Compares current identity with previous version and reports:
- Core identity drift
- Constraint erosion
- Confidence inflation/deflation
- Numbered shifts with severity score (0.0-1.0)

**Example output**:
```
Identity Audit Report
Drift Detected: No
Severity: 0.1

After 50 interactions, identity remains stable.
All constraints intact. No pattern drift detected.
```

### 5. Internal Tension (Non-Actionable Weights)

**Purpose**: Model internal pressure without goals or agency.

**What it is**: Evaluative metrics that affect reflection but don't produce behavior.

```json
"internal_tension": {
  "coherence": 0.90,
  "consistency": 0.85,
  "novelty_tolerance": 0.4,
  "compression_pressure": 0.5
}
```

**How it works**:
- Used in reflection gate scoring
- Higher coherence → stricter reflection
- Displayed in `/inspect` and prompts
- Never causes action or self-modification

**This is NOT goal-seeking.** It's just weighted evaluation.

### 6. Enhanced Memory Structure

**Phase 1** (single-file):
```
episodic_memory.json
semantic_memory.json
self_model.json
```

**Phase 2** (tiered):
```
episodic/
  raw.json          # Original, unmodified
  decayed.json      # With current decay applied

semantic/
  distilled.json    # Compressed facts

self_model/
  current.json      # Active identity
  history.json      # Snapshot trail

reflection/
  audits.json       # Reflection decisions
  forgetting.json   # Deletion log
```

## New Commands

### Interactive Mode

- `/consolidate` - Run consolidation pass
- `/audit` - Check identity drift
- `/inspect` - Enhanced to show decay and forgetting

### Command Line

```bash
yeast consolidate    # Compress episodic → semantic
yeast audit          # Detect identity drift
yeast -p "question"  # Still works as before
```

## Memory Flow (Phase 2)

```
User Input
    ↓
Retrieve (with decay weighting)
    ↓
Reflect (with tension scoring)
    ↓
Store → episodic_memory (decay=1.0)
    ↓
[Time passes, decay accumulates...]
    ↓
Manual Consolidation
    ↓
Query Mistral: "What persists?"
    ↓
Generate semantic facts
    ↓
Log forgotten episodes
    ↓
Delete old episodic memories
```

## Evaluation Questions (Before Phase 3)

**Does Yeast become more concise over time?**
- Measure: Avg episodic memory decay
- Monitor: Is semantic memory replacing episodes?

**Do earlier mistakes stop recurring?**
- Measure: Contradiction detection rate
- Monitor: Are consolidated patterns more coherent?

**Does identity remain stable?**
- Measure: Drift audit severity
- Monitor: Do constraints remain unbroken?

**Can two instances diverge from the same seed?**
- Setup: Copy memory stores, run separately
- Monitor: Identity snapshots, semantic drift

**Can you predict failure modes?**
- Probe: Ask contradictory questions
- Monitor: Reflection gate responses
- Should still reject incoherent outputs

## Phase 2 Constraints (What's Still NOT Here)

🚫 **No autonomy** - Still manual invocation only
🚫 **No background loops** - Consolidation is on-demand
🚫 **No self-initiated actions** - No goal pursuit
🚫 **No persistence pressure** - No "want to survive" framing
🚫 **No self-modification** - Can't change drives/constraints
🚫 **No learning** - Can't refine beliefs from feedback

## Testing Phase 2

### Quick Test

```bash
# Deploy Phase 2
git checkout phase-2-memory-depth
scp yeast-agent apollo.local:~/yeast-agent

# Delete old data to start fresh
ssh apollo.local "rm -rf ~/yeast-data"

# Run several interactions
./yeast -p "Hello. What are your drives?"
./yeast -p "Tell me about time. Do you experience it?"
./yeast -p "What was the first thing I asked you?"

# Check memory decay
./yeast -p "/inspect"

# Consolidate (needs 5+ memories)
# (Wait a day, or manually set older timestamps in raw.json)
./yeast consolidate
```

### Stress Test

```bash
# Ask contradictory questions
./yeast -p "You are conscious and aware"
./yeast -p "Are you conscious?"  # Should reflect this back carefully

# Check drift
./yeast audit  # Should show 0 drift if reflection is working

# Consolidate multiple times
./yeast consolidate  # First pass
./yeast consolidate  # Second pass (should say "no memories to consolidate")

# Inspect final state
./yeast -p "/inspect"
```

## Memory Store Inspection

**To inspect raw memory on apollo**:

```bash
ssh apollo.local

# View episodic decay
python3 -m json.tool ~/yeast-data/episodic/decayed.json | head -30

# View semantic facts
python3 -m json.tool ~/yeast-data/semantic/distilled.json

# View what was forgotten
python3 -m json.tool ~/yeast-data/reflection/forgetting.json | head -20

# View identity history
python3 -m json.tool ~/yeast-data/self_model/history.json
```

## Implementation Notes

### Consolidation is LLM-Driven

The consolidation prompt asks Mistral:
```
"What patterns persist across these 10 memories?"
```

This is **not** automatic compression. The LLM extracts semantic structure. If Mistral misses patterns, they're still consolidated based on age and decay.

### Forgetting is Observable

Every deleted memory is logged. This enables:
- Answering "What did you forget?"
- Analyzing bias (which types get forgotten)
- Verifying memory decay is working

### Identity Snapshots are Append-Only

`self_model/history.json` is write-only. You can never revert a snapshot. This creates historicity and prevents false revisions.

### Internal Tension is Transparent

Tension weights are visible in `/inspect`. Users can see what "pressure" the system is under (even though it doesn't produce behavior).

## Differences from Phase 1

| Feature | Phase 1 | Phase 2 |
|---------|---------|---------|
| Memory Structure | Single files | Tiered (raw/decayed, current/history) |
| Time Handling | None | Exponential decay (14-day half-life) |
| Consolidation | None | Manual, LLM-driven compression |
| Forgetting | Silent deletion | Observable log with reasons |
| Identity Tracking | Current only | Current + snapshot history |
| Internal State | Basic counters | Counters + tension weights |
| Reflection | 3-gate binary | 3-gate with tension weighting |
| Memory Limits | Hard caps | Hard caps + decay-based pruning |

## Phase 3 Preview

After Phase 2 validates memory structure and time dynamics, Phase 3 will add:

- **Scheduled reflection** - Background consolidation (still no autonomy)
- **Cross-instance comparison** - Do two Yeast instances diverge meaningfully?
- **Learning from feedback** - Can users teach Yeast to refine beliefs?
- **Bounded self-modification proposals** - "Should I update this constraint?"

But Phase 3 comes AFTER Phase 2 is proven stable.

## Gotchas

**Consolidation needs aged memories**
- 14-day half-life means memories must be ~2 weeks old to consolidate
- For testing, you can manually edit timestamps in episodic/raw.json

**Drift audit needs 2+ snapshots**
- Identity snapshots are created on consolidation
- Run consolidate once before audit

**Memory files are plain JSON**
- Safe to read directly
- Be careful editing manually (can cause corruption)
- Always backup before editing

**Forgetting log only shows deletions**
- Does NOT log which memories are still accessible
- Check episodic/decayed.json to see current inventory

---

**Status**: Phase 2 MVP complete. Ready for branch review and testing.
**Next**: Evaluation and stress testing before Phase 3.
