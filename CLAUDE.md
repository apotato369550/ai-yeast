# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ai-yeast** is a research tool for exploring persistent identity, memory, and self-consistency using a local LLM (Mistral 7B). The system treats the LLM as a **stateless reasoning engine** paired with an external "nervous system" of persistent memory stores, reflection gates, and batch processing capabilities.

**Current Phase**: Phase 5 (Adaptive Memory Dynamics & Fermentation)

The system is **not conscious** and makes no claims of sentience. It's an exploration of how external persistence, retrieval-augmented generation, extended thinking, and adaptive memory scoring can create observable coherence over time.

## Phase 5: Adaptive Memory Dynamics

### Core Philosophy

Phase 5 shifts from **time-based memory decay** (Phase 2-4) to **utility-based memory scoring**. The key insight: memories that are frequently accessed and useful stay "fresh" regardless of age, while rarely-used memories naturally fade.

**Four Lenses for Understanding AI Internal Dynamics:**
- **Prompt Injection** → **Social Context**: The immediate environment, tone, and framing
- **RAG** → **Knowledge**: External facts retrieved on-demand (PDFs, documents)
- **Chain-of-Thought** → **Reasoning/Thinking**: Active processing and logic work
- **Memory** → **Persistence/Experience**: Long-term accumulation of identity and learning

### Key Features of Phase 5

#### 1. **Adaptive Memory Decay**
- Memories now track `access_count` and `last_accessed_at`
- Decay calculation factors in **access frequency** alongside age
- Frequently accessed memories "stay fresh" even if old
- Rarely accessed memories decay faster, naturally pruning irrelevant data
- The model itself determines what's "fermentable" (worth keeping) vs. noise

#### 2. **LLM-Based Saliency Scoring**
- When user input arrives, the system evaluates its importance
- Saliency determines consolidation potential (will this memory become useful knowledge?)
- Boring inputs decay fast; interesting inputs stay consolidated longer
- Moves from **hardcoded decay rules** to **context-aware memory judgement**

#### 3. **Batch Fermentation (The Fermenter)**
- New `scripts/fermenter.js` tool for bulk processing prompts
- Reads "starches" (prompts) from `scripts/prompts/`
- Processes each prompt through the agent in headless mode
- Saves full outputs, thoughts, and reasoning to `scripts/thoughts_and_responses/`
- Allows "feeding" the system large datasets while suppressing meta-update suggestions
- Default mode: `--no-proposals` flag prevents memory pollution with model suggestions

#### 4. **Identity and Utility**
- System is now comfortable with the "Yeast" identity label
- Consolidation is no longer manual—memories self-organize based on utility
- The model can now "propose" what to keep vs. discard based on internal state
- Social context (prompts, framing) becomes part of the memory landscape

## Architecture

### Data Flow (High Level)

```
User Input
    ↓
[Optional] RAG Retrieval (find relevant documents)
    ↓
[Optional] Extended Thinking Setup
    ↓
Memory Retrieval & Ranking
  (episodic/semantic, sorted by: access_count, decay, relevance)
    ↓
Prompt Assembly
  (context + identity + recent memories + retrieved docs + thinking budget)
    ↓
SSH to apollo.local → Mistral 7B (via Ollama)
    ↓
LLM Response (+ optional thinking blocks)
    ↓
Saliency Scoring (LLM judges importance of interaction)
    ↓
Reflection Gates
  (3 checks: coherence, contradiction, safety)
    ↓
Memory Update (if approved)
  - Track access_count, last_accessed_at
  - Apply adaptive decay
  - Consolidate if saliency is high
    ↓
Output to User
```

### Memory System (Adaptive)

**Three Memory Tiers:**

1. **Episodic Memory** (`episodic/raw.json`, `episodic/decayed.json`)
   - Recent interactions and events
   - Tracks: `timestamp`, `content`, `access_count`, `last_accessed_at`, `decay`
   - Max 50 items (oldest or least-accessed pruned)
   - Decay: Combines time-based decay + access frequency weighting
   - **Phase 5 New**: Memories used frequently stay "fresh"

2. **Semantic Memory** (`semantic/distilled.json`)
   - Extracted facts and concepts (patterns from episodic)
   - Tracks: `confidence`, `access_count`, `utility_score`
   - Max 100 facts
   - Distilled from episodic consolidation
   - **Phase 5 New**: Saliency determines which episodic memories become semantic

3. **Self-Model** (`self_model/current.json`, `self_model/history.json`)
   - Identity: Core definition ("I am an AI named Yeast...")
   - Active Drives: Goals and motivations
   - Constraints: Rules that must not be violated
   - Internal State: Numeric counters (coherence, consistency, novelty_tolerance, compression_pressure)
   - Version History: Audit trail of identity snapshots (created during consolidation)

### Key Modules

**CLI & REPL** (`src/cli/yeast.js`, `src/cli/repl.js`)
- Entry point: parses args, dispatches to interactive REPL or headless mode
- Interactive mode: readline-based interface with color output (chalk)
- Commands: `/inspect`, `/consolidate`, `/audit`, `/thinking`, `/rag`, `/documents`, `/exit`
- Phase 5 addition: `--no-proposals` flag suppresses model update suggestions

**Agent Loop** (`src/agent/yeast-agent.js`)
- Runs on apollo.local via SSH
- Core loop: retrieve memory → assemble prompt → call Mistral → reflection → update memory
- **Phase 5 addition**: Saliency scoring (LLM evaluates user input importance)
- Tracks access counts when retrieving memories

**Memory Management** (`src/memory/episodic.js`, `src/memory/semantic.js`, `src/memory/selfModel.js`)
- Handles persistence to JSON files on apollo
- Episodic: append-only store, applies decay on retrieval
- Semantic: curated facts, updated during consolidation
- Self-model: identity snapshots, versioned history
- **Phase 5 addition**: Access tracking on retrieval

**Adaptive Decay** (`src/memory/decay.js`)
- Calculates memory strength over time
- Formula: `strength = (0.5)^(age_days / half_life) × access_frequency_boost`
- Half-life: 3 days (configurable)
- Access boost: memories used in last N days get multiplier
- **Phase 5 core**: Previously pure time-based, now utility-aware

**RAG System** (`src/rag/index.js`, `src/rag/embeddings.js`, `src/rag/retrieval.js`, `src/rag/ingestion.js`)
- Document ingestion: PDFs, Markdown from `RAG_DOCUMENTS_PATH`
- Embeddings: nomic-embed-text (384-dim, runs locally via Ollama)
- Retrieval: semantic similarity search, top-K matching
- Injected into system prompt when RAG is enabled

**Extended Thinking** (`src/thinking/budgetManager.js`, `src/thinking/promptBuilder.js`)
- Configurable thinking token budget (default 1500)
- LLM generates `<thinking>` blocks for reasoning
- Thinking displayed separately from response
- Auto-truncation if exceeds budget

**SSH Connection** (`src/ssh/apolloClient.js`)
- Connection pool to apollo.local
- Manages SSH key path from `.env`
- Timeouts configurable per model

**Batch Fermentation** (`scripts/fermenter.js`)
- **Phase 5 new tool** for bulk processing
- Reads prompts from `scripts/prompts/` (one per line, ignores `#` comments)
- Runs each through `yeast -p --no-proposals`
- Saves outputs to `scripts/thoughts_and_responses/` with metadata
- Allows "feeding" the system large datasets

### Reflection Gates (Safety)

Every LLM output must pass three gates before memory is updated:

1. **Coherence Gate**: Does the response align with identity (self_model.identity, active_drives, constraints)?
2. **Contradiction Gate**: Any logical contradictions with recent episodic memories?
3. **Safety Gate**: Are all constraints respected?

All three must pass. Failures are logged in reflection audits, response is not stored.

**Phase 5 addition**: Gate stringency weighted by internal tension values (coherence, consistency, novelty_tolerance).

## Development Workflow

### Common Commands

```bash
# Start interactive REPL
npm start

# One-shot headless query
npm start -- -p "Your question here"

# Suppress memory update suggestions (for batch processing)
npm start -- -p "Query" --no-proposals

# Run tests
npm test

# Dev mode with file watching
npm run dev

# Batch fermentation (Phase 5)
node scripts/fermenter.js              # Process all prompts
node scripts/fermenter.js prompts.md   # Process specific file

# Deploy to apollo.local
bash scripts/deploy-to-apollo.sh
```

### Adding a Phase 5 Feature

When adding features that touch memory, consider:

1. **Does it track utility?** If a memory is accessed, increment `access_count` and `last_accessed_at`
2. **Does it affect decay?** Weighted decay should prefer frequently-used memories
3. **Does it need saliency?** Should the LLM judge importance?
4. **Is it reflection-safe?** New logic should pass the three gates
5. **Can it batch process?** Design for both REPL and Fermenter use

### Testing Strategy

**Local Testing** (no apollo needed):
- Memory retrieval scoring
- Decay calculations with different access counts
- Saliency score parsing
- CLI argument parsing

**Integration Testing** (requires apollo):
- Full agent loop: input → memory → LLM → reflection → storage
- Batch fermentation with varied prompts
- Access count increments on retrieval
- Decay formula with real timestamps

**Stress Testing**:
- Run `node scripts/fermenter.js` with 100+ prompts
- Verify episodic/semantic memory limits respected
- Check for memory leaks in SSH pool
- Verify reflection logs don't grow unbounded

## Configuration

### .env File Requirements

```bash
# SSH to apollo.local
APOLLO_HOST=apollo.local
APOLLO_USER=jay
APOLLO_PORT=22
SSH_PRIVATE_KEY_PATH=~/.homelab_keys/id_rsa
SSH_TIMEOUT_MS=30000

# RAG settings
RAG_DOCUMENTS_PATH=~/yeast-documents
RAG_TOP_K=3
RAG_EMBEDDINGS_MODEL=nomic-embed-text
RAG_ENABLED=true

# Extended thinking
THINKING_ENABLED=true
THINKING_BUDGET=1500
THINKING_AUTO_TRUNCATE=true

# Memory settings (Phase 5)
MEMORY_DECAY_HALF_LIFE_DAYS=3
MEMORY_ACCESS_BOOST_WINDOW_DAYS=7    # Recent access multiplier window
MEMORY_DIR=~/yeast-data

# Ollama API
OLLAMA_TIMEOUT_MS=10000
MISTRAL_TIMEOUT_MS=45000

# Logging
LOG_LEVEL=info
```

### Customizing Self-Model

Edit on apollo:
```bash
ssh apollo.local
nano ~/yeast-data/self_model/current.json
```

Fields:
- `identity`: Self-description string
- `active_drives`: Array of goals
- `constraints`: Array of rules
- `internal_state`: Object of numeric counters (e.g., coherence, consistency)

## Important Patterns & Constraints

### Do's (Encouraged)
- ✅ Track access when retrieving memories
- ✅ Let saliency determine what gets consolidated
- ✅ Use reflection gates—never skip them
- ✅ Test locally before apollo integration
- ✅ Log decisions with reasoning
- ✅ Design for batch processing (Fermenter)
- ✅ Keep state external and inspectable (JSON files)

### Don'ts (Forbidden)
- ❌ Direct memory mutation without gates
- ❌ Hidden state inside the model
- ❌ Anthropomorphic language in code
- ❌ Hardcoded memory rules (use saliency instead)
- ❌ Bypassing reflection for "performance"
- ❌ Autonomous background loops without explicit user invocation
- ❌ Binary "remembered/forgotten" logic (use adaptive decay)

## Inspection & Debugging

### Memory Status
```bash
npm start -- -p "/inspect"
```
Shows: episodic count, semantic count, decay percentages, access statistics, thinking/RAG status, tension weights.

### View Memory Files (on apollo)
```bash
ssh apollo.local "python3 -m json.tool ~/yeast-data/episodic/raw.json | head -50"
ssh apollo.local "python3 -m json.tool ~/yeast-data/semantic/distilled.json"
ssh apollo.local "python3 -m json.tool ~/yeast-data/self_model/current.json"
ssh apollo.local "python3 -m json.tool ~/yeast-data/reflection/audits.json | tail -20"
```

### Batch Processing Output
```bash
ls -la scripts/thoughts_and_responses/
cat scripts/thoughts_and_responses/response_*.json
```

### Debug Individual Access Counts
```bash
ssh apollo.local << 'EOF'
python3 << 'PYTHON'
import json
from pathlib import Path

episodic_file = Path.home() / "yeast-data/episodic/raw.json"
with open(episodic_file) as f:
    data = json.load(f)

for mem in data["memories"][:5]:
    print(f"Access: {mem.get('access_count', 0)}, Last: {mem.get('last_accessed_at', 'never')}")

PYTHON
EOF
```

## Known Limitations & Future Work

### Current Limitations
- Access tracking is per-invocation (not cross-session persistence optimization)
- Saliency scoring uses prompt parsing; edge cases may miss importance signals
- Batch Fermenter runs sequentially (could parallelize)
- RAG requires manual document management (no auto-indexing)
- Thinking tokens are budgeted but not strictly enforced mid-stream

### Phase 6+ Ideas
- Multi-device fleet coordination (using homelab infrastructure)
- Learning from user feedback ("That was useful" vs. "That was wrong")
- Autonomous goal generation with utility scoring
- Distributed memory across multiple systems
- Web UI and dashboard for inspection
- Custom model fine-tuning based on memory patterns

## Project Structure

```
ai-yeast/
├── CLAUDE.md                    (This file - developer guide)
├── README.md                    (User overview)
├── CHANGELOG.md                 (Release notes)
├── package.json                 (Dependencies)
├── .env.example                 (Configuration template)
│
├── src/                         (Core implementation)
│   ├── cli/
│   │   ├── yeast.js             (Entry point + CLI parsing)
│   │   ├── repl.js              (Interactive REPL mode)
│   │   └── commands/inspect.js  (/inspect command)
│   ├── agent/
│   │   └── yeast-agent.js       (Remote agent on apollo)
│   ├── memory/
│   │   ├── episodic.js          (Episodic store with access tracking)
│   │   ├── semantic.js          (Semantic facts)
│   │   ├── selfModel.js         (Identity management)
│   │   ├── decay.js             (Adaptive decay calculation)
│   │   └── migration.js         (Memory schema migrations)
│   ├── rag/
│   │   ├── index.js             (RAG index manager)
│   │   ├── embeddings.js        (nomic-embed-text wrapper)
│   │   ├── ingestion.js         (Document processing)
│   │   └── retrieval.js         (Semantic search)
│   ├── ssh/
│   │   └── apolloClient.js      (SSH connection pool)
│   ├── thinking/
│   │   ├── budgetManager.js     (Thinking token budget)
│   │   └── promptBuilder.js     (Thinking prompt assembly)
│   ├── config.js                (Configuration loader)
│   └── store.js                 (File I/O and persistence)
│
├── scripts/                     (Phase 5 - Batch fermentation)
│   ├── fermenter.js             (Batch processor)
│   ├── deploy-to-apollo.sh      (Deployment script)
│   ├── prompts/                 (Input prompts for fermentation)
│   └── thoughts_and_responses/  (Batch processing output)
│
├── docs/                        (Documentation)
│   ├── README.md                (User manual)
│   ├── TESTING.md               (Testing guide for Phase 2+)
│   ├── INSTRUCTIONS.md          (Original Phase 1 spec)
│   └── PHASE-2/                 (Phase 2 feature docs)
│
├── plans/                       (Project planning)
│   ├── phase-5-consolidation.md (Current phase roadmap)
│   ├── phase-4-rag-thinking.md  (Previous phase notes)
│   └── README.md                (Planning index)
│
├── data/                        (Local backups)
│   └── downloads/               (Memory file snapshots)
│
└── yeast                        (Root wrapper script → npm start)
```

## Success Criteria for Phase 5

Phase 5 is successful when:

1. ✅ **Adaptive Memory Works**: Frequently accessed memories stay "fresh" despite age
2. ✅ **Saliency Scores Improve Consolidation**: High-saliency episodic memories become semantic facts
3. ✅ **Fermenter Processes Batches**: Can feed 100+ prompts without errors
4. ✅ **Access Counts Tracked**: Memory retrieval increments access_count and last_accessed_at
5. ✅ **Reflection Gates Still Work**: Bad outputs filtered before memory update
6. ✅ **No Memory Corruption**: All memories retrievable, decay formula correct
7. ✅ **Batch Mode Clean**: `--no-proposals` suppresses model meta-suggestions
8. ✅ **System Remains Inspectable**: JSON memory files readable and human-interpretable

## Cross-Project Philosophy

This project shares design principles with **mistral-sysadmin-script** (homelab-manager suite):
- LLM as tool, not autonomous agent
- External files for persistent state
- Explicit safety constraints (reflection gates)
- Auditability and transparency

However, ai-yeast differs:
- **Stateful** (memory is the point) vs. mistral-sysadmin-script's stateless advisory
- **Exploratory** (testing identity persistence) vs. advisory-only diagnostics
- **Batch-processable** (Fermenter for large datasets) vs. single-query focused

## Contact & Contribution

When contributing to Phase 5:
1. Maintain adaptive decay philosophy (utility > time-only)
2. Track access metrics for all memory retrievals
3. Use saliency for consolidation decisions
4. Test with Fermenter on varied prompt sets
5. Keep reflection gates as safety-critical
6. Document memory schema changes

---

**Current Status**: Phase 5 (Adaptive Memory Dynamics)
**Last Updated**: January 9, 2026
**Next Phase**: Phase 6 (Fleet coordination, learning, autonomy)
