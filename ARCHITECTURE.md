# ARCHITECTURE.md

System design, module inventory, and infrastructure for ai-yeast (Phase 5).

## Executive Summary

ai-yeast is an experimental AI system exploring persistent identity and adaptive memory using Mistral 7B + external JSON state. Phase 5 implements utility-based memory decay (access frequency weighting), saliency-driven consolidation, and batch fermentation for bulk processing. All state is external (no hidden model state); memory strength = time-based decay × access frequency boost. Three reflection gates (coherence, contradiction, safety) guard all memory updates.

## Data Flow (High Level)

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

## Memory System (Adaptive)

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

---

## Module Inventory

### src/ Modules

#### CLI & Entry Point

**Module: src/cli/yeast.js**

**Purpose**: Entry point that parses CLI arguments and dispatches to REPL or headless mode.

**Lines**: 76
**Exports**: Default export (async program action handler)
**Imports**:
- `commander` (CLI parsing)
- `src/store.js` (memory initialization)
- `src/config.js` (configuration)
- `src/cli/repl.js` (interactive mode)
- `src/ssh/apolloClient.js` (remote inference)
- `src/memory/episodic.js` (memory operations)

**Remote Operations**: Yes (SSH to apollo via apolloClient for headless `-p` mode)
**Config Variables**: `THINKING_ENABLED`, `THINKING_BUDGET`, `THINKING_MEMORY_DEPTH`, `NO_PROPOSALS`
**Circular Dependencies**: None
**Notes**:
- Handles `-p` (headless) and `--no-proposals` (suppress suggestions) flags
- Initializes memory stores before running
- Increments access counts on memories used in headless mode
- Loads recent episodic memories as context

---

**Module: src/cli/repl.js**

**Purpose**: Interactive REPL with readline interface, memory inspection, and command handler.

**Lines**: 429
**Exports**: Default export (async startREPL function)
**Imports**:
- `readline` (terminal I/O)
- `chalk` (colored output)
- `src/ssh/apolloClient.js` (remote inference)
- `src/memory/episodic.js`, `semantic.js`, `selfModel.js` (memory reads)
- `src/rag/retrieval.js` (document retrieval)
- `src/rag/index.js` (RAG index manager)
- `src/config.js` (configuration)
- `src/thinking/budgetManager.js` (thinking token display)

**Remote Operations**: Yes (SSH for `/audit` command, Ollama inference)
**Config Variables**: `THINKING_ENABLED`, `THINKING_BUDGET`, `THINKING_MEMORY_DEPTH`, `RAG_ENABLED`, `RAG_DOCUMENTS_PATH`, `NO_PROPOSALS`, `MEMORY_DIR`
**Circular Dependencies**: None
**Notes**:
- Commands: `/help`, `/inspect`, `/consolidate`, `/audit`, `/diagnose`, `/thinking [on|off]`, `/rag [on|off]`, `/documents list|reload`, `/exit`
- Displays memory breakdown: interactions, realizations, observations, and thinking depth metrics
- Shows realization quality (avg thinking depth, saliency scores, disputes)
- Fetches reflection audits from apollo and displays gate results
- Thinking blocks displayed with token counts and auto-truncation
- Realizations extracted and stored with saliency scoring

---

**Module: src/cli/commands/inspect.js**

**Purpose**: EMPTY FILE (1 line, likely placeholder for future /inspect expansion)

**Lines**: 1
**Exports**: None
**Imports**: None
**Remote Operations**: No
**Notes**: File exists but contains no implementation; logic currently in repl.js

---

#### Configuration & Storage

**Module: src/config.js**

**Purpose**: Central configuration loader with defaults; parses .env and applies type conversion.

**Lines**: 68
**Exports**: Default export (config object)
**Imports**:
- `dotenv` (environment loading)
- Node.js path utilities

**Remote Operations**: No
**Config Variables**: Reads 30+ environment variables (see list below)
**Circular Dependencies**: None
**Notes**:
- Loads from `.env` file, falls back to hardcoded defaults
- Converts numeric strings to integers (APOLLO_PORT, SSH_TIMEOUT_MS, etc.)
- Converts boolean strings ('true'/'false') to actual booleans
- Expands `~/` paths to user home directory
- Key variables: `APOLLO_HOST`, `APOLLO_USER`, `SSH_TIMEOUT_MS`, `RAG_ENABLED`, `THINKING_ENABLED`, `MEMORY_DECAY_HALF_LIFE_DAYS`, `OUTLINES_ENABLED`

---

**Module: src/store.js**

**Purpose**: File I/O abstraction layer for memory persistence; handles atomic writes with queuing.

**Lines**: 120+ (partial read)
**Exports**:
- `loadJSON(filePath)`: Synchronous JSON read
- `saveJSON(filePath, data)`: Async queued write
- `getChecksum(filePath)`: SHA256 hash of file
- `initializeMemoryDirs()`: Creates memory directory structure
- `getMemoryPaths()`: Returns path object for all memory files
- `initializeMemoryStores()`: Sets up local memory directories

**Imports**:
- Node.js fs, crypto, path utilities

**Remote Operations**: No (local file I/O only)
**Config Variables**: `MEMORY_DIR`
**Circular Dependencies**: None
**Notes**:
- Write queuing prevents concurrent modifications (atomic semantic)
- Per-file queues ensure sequential writes
- Temp file + rename pattern for safety
- Directory creation is recursive and idempotent

---

#### Memory Management

**Module: src/memory/episodic.js**

**Purpose**: Episodic memory store with access tracking and decay-aware pruning.

**Lines**: 86
**Exports**:
- `loadEpisodic()`: Raw episodic memories
- `loadEpisodicWithDecay()`: Memories with decay values applied
- `addEpisodic(content, source, confidence, metadata)`: Add new memory
- `incrementAccess(ids)`: Track memory access counts
- `getEpisodicSummary()`: Summary stats (count, avg decay, timestamps)

**Imports**:
- `src/store.js` (file I/O)
- `src/memory/decay.js` (decay calculation)
- Node.js crypto (UUID generation)

**Remote Operations**: No
**Config Variables**: None directly (but uses MAX_EPISODIC_MEMORIES = 50)
**Circular Dependencies**: None
**Notes**:
- Max 50 memories (configured constant)
- Pruning: when limit exceeded, sorts by relevance weight (decay × confidence), keeps top 50
- Each memory: id, timestamp, content, source (observation/interaction/realization/diagnostic), confidence, access_count
- Phase 5 addition: access_count tracks frequency; used in decay calculation
- Metadata field allows custom fields per memory

---

**Module: src/memory/semantic.js**

**Purpose**: Semantic memory (distilled facts) with confidence tracking.

**Lines**: 55
**Exports**:
- `loadSemantic()`: Load all semantic facts
- `addSemantic(content, source, confidence)`: Add new fact
- `getSemanticSummary()`: Summary stats (count, avg confidence, timestamps)

**Imports**:
- `src/store.js` (file I/O)
- Node.js crypto (UUID generation)

**Remote Operations**: No
**Config Variables**: None directly (but uses MAX_SEMANTIC_FACTS = 100)
**Circular Dependencies**: None
**Notes**:
- Max 100 facts
- Pruning: sorts by confidence, keeps top 100
- Each fact: id, timestamp, content, source, confidence, revisions (array), access_count
- Typically populated from episodic consolidation
- Confidence represents certainty of the fact

---

**Module: src/memory/selfModel.js**

**Purpose**: Self-model (identity) persistence and versioning.

**Lines**: 43
**Exports**:
- `loadSelfModel()`: Current self-model
- `loadSelfModelHistory()`: Version history snapshots
- `updateSelfModel(updates)`: Update and snapshot

**Imports**:
- `src/store.js` (file I/O)

**Remote Operations**: No
**Config Variables**: None
**Circular Dependencies**: None
**Notes**:
- Default identity: "yeast (AI proto-consciousness experiment)"
- Stores: identity (string), active_drives (array), constraints (array), internal_state (object with numeric counters)
- History: max 50 snapshots with timestamps
- Update operation: deep-clones current state to history, applies updates, increments updated_at

---

**Module: src/memory/decay.js**

**Purpose**: Adaptive memory decay calculation combining time and access frequency.

**Lines**: 39
**Exports**:
- `calculateDecay(createdAt, accesses, halfLifeDays)`: Decay strength 0.0-1.0
- `calculateRelevanceWeight(memory)`: decay × confidence
- `applyDecayToEpisodic(memories)`: Add decay and relevance_weight to all
- `sortByRelevance(memories)`: Sort by relevance_weight descending

**Imports**:
- `src/config.js` (MEMORY_DECAY_HALF_LIFE_DAYS default)

**Remote Operations**: No
**Config Variables**: `MEMORY_DECAY_HALF_LIFE_DAYS` (default 3)
**Circular Dependencies**: None
**Notes**:
- **Phase 5 Core**: Formula: `strength = (0.5)^(effectiveAge / halfLife)` where `effectiveAge = ageDays / max(1, accesses)`
- Access boost: each access halves effective age (memories accessed 2x stay fresh twice as long)
- Clamps decay to [0.0, 1.0]
- Relevance weight: `decay × confidence` used for pruning decisions

---

**Module: src/memory/migration.js**

**Purpose**: EMPTY FILE (placeholder for schema migrations)

**Lines**: 1
**Exports**: None
**Imports**: None
**Remote Operations**: No
**Notes**: File exists but contains no implementation

---

#### Agent (Remote Inference)

**Module: src/agent/yeast-agent.js**

**Purpose**: Remote agent running on apollo.local via SSH; core inference loop.

**Lines**: 342
**Exports**: None (CLI entrypoint, runs via stdin/stdout JSON protocol)
**Imports**:
- `axios` (HTTP to Ollama/Outlines)
- `fs` (schema loading, prompt reading)
- `src/thinking/realizationExtractor.js` (thinking block parsing)

**Remote Operations**: Yes (HTTP to Ollama on localhost:11434, optional Outlines API)
**Config Variables**: `OUTLINES_ENABLED`, `OUTLINES_API`, `THINKING_MIN_DEPTH_TO_REALIZE`, `THINKING_BLOCKS_PER_QUERY`
**Circular Dependencies**: None
**Notes**:
- **Commands**: `infer` (run inference), `embed` (generate embedding), `consolidate`, `audit`
- **Structured Output**: Optional Outlines.dev integration for JSON schema compliance
- **Fallback**: If Outlines fails, uses regex extraction (backward compatible)
- **Thinking blocks**: Extracted with depth attribute, validated against THINKING_BLOCKS_PER_QUERY limit
- **Realizations**: Extracted from `<realizations>` blocks, stored if thinking depth >= THINKING_MIN_DEPTH_TO_REALIZE
- **Saliency**: Extracted from response or defaults to 0.5
- **Temperature**: Fixed at 0.7 for consistent responses
- Protocol: stdin receives JSON, stdout returns JSON with success, response, thinking, realizations, saliency, memory_updates

---

#### SSH & Networking

**Module: src/ssh/apolloClient.js**

**Purpose**: SSH connection pool manager for apollo.local; handles retries and command execution.

**Lines**: 136
**Exports**: Default export (ApolloClient singleton)
**Imports**:
- `node-ssh` (SSH client)
- `src/config.js` (connection parameters)

**Remote Operations**: Yes (SSH to apollo.local)
**Config Variables**: `APOLLO_HOST`, `APOLLO_USER`, `APOLLO_PORT`, `SSH_PRIVATE_KEY_PATH`, `SSH_TIMEOUT_MS`, `MISTRAL_TIMEOUT_MS`, `OLLAMA_TIMEOUT_MS`
**Circular Dependencies**: None
**Notes**:
- **Connection Pool**: Max 3 connections, reused across calls
- **Retry Logic**: 5 attempts with exponential backoff [100, 200, 400, 800, 1600ms]
- **sendCommand(command, input, thinkingEnabled, thinkingBudget, ragDocs, memoryContext)**:
  - Serializes to JSON
  - Pipes to stdin of yeast-agent.js on apollo
  - Returns parsed response
- **releaseConnection(connObj)**: Marks connection available for reuse
- **Error Handling**: Throws on connection failure, timeouts configurable per model

---

#### RAG System

**Module: src/rag/index.js**

**Purpose**: Document indexing manager; discovers, extracts, embeds, and stores documents.

**Lines**: 100+ (partial read)
**Exports**: Default export (RAGIndex singleton with indexFolder method)
**Imports**:
- `fs` (file operations)
- `path` utilities
- `src/store.js` (persistence)
- `src/rag/ingestion.js` (text extraction)
- `src/rag/embeddings.js` (embedding generation)
- `src/config.js`

**Remote Operations**: Yes (embeddings generated via SSH or HTTP)
**Config Variables**: `RAG_DOCUMENTS_PATH`, `RAG_ENABLED`
**Circular Dependencies**: None
**Notes**:
- **Watchers**: Can watch folder for changes (not fully utilized)
- **Supported Formats**: PDF, Markdown, Text (via `extractText`)
- **Output**: Stores two files: documents (metadata) and embeddings (vectors)
- **Per-document**: id, filename, source, metadata (hash, size, chunk_count)
- **Embedding Storage**: Includes similarity score placeholder for retrieval

---

**Module: src/rag/embeddings.js**

**Purpose**: Embedding generation abstraction; SSH-first, fallback to HTTP.

**Lines**: 60
**Exports**:
- `generateEmbedding(text)`: Returns embedding vector
- `cosineSimilarity(vecA, vecB)`: Vector similarity 0.0-1.0

**Imports**:
- `axios` (HTTP fallback)
- `src/config.js` (connection mode)
- `src/ssh/apolloClient.js` (SSH route)

**Remote Operations**: Yes (HTTP or SSH to Ollama)
**Config Variables**: `EMBEDDING_VIA_SSH`, `APOLLO_HOST`, `OLLAMA_API_URL`, `RAG_EMBEDDINGS_MODEL`, `OLLAMA_TIMEOUT_MS`
**Circular Dependencies**: None
**Notes**:
- **SSH-First**: If EMBEDDING_VIA_SSH=true and apollo is remote, uses SSH sendCommand('embed', ...)
- **HTTP Fallback**: Direct HTTP to Ollama (localhost:11434 or configured URL)
- **Error Messages**: Suggests SSH tunnel setup if connection refused
- **Model**: nomic-embed-text (384 dimensions by default)
- **Cosine Similarity**: Normalized dot product, handles zero vectors

---

**Module: src/rag/retrieval.js**

**Purpose**: Semantic search over indexed documents; retrieves top-K similar documents.

**Lines**: 60
**Exports**:
- `retrieveDocuments(query, topK)`: Returns top-K documents by similarity
- `logQuery(query, results)`: Logs retrieval queries
- `getRAGStatus()`: RAG status summary

**Imports**:
- `src/store.js` (loading embeddings)
- `src/rag/embeddings.js` (generating query embedding)
- `src/config.js`

**Remote Operations**: Yes (generates query embedding via SSH/HTTP)
**Config Variables**: `RAG_ENABLED`, `RAG_TOP_K`, `MEMORY_DIR`
**Circular Dependencies**: None
**Notes**:
- **Flow**: Generate query embedding → load stored embeddings → compute similarities → sort → return top-K
- **Similarity Threshold**: 0.5 (configurable in function call)
- **Query Logging**: Stores last 100 queries in `rag_queries.json`
- **RAG Status**: Returns enabled flag, document count, model, dimensions, top-k setting

---

**Module: src/rag/ingestion.js**

**Purpose**: Document text extraction from PDF, Markdown, and text files.

**Lines**: 61
**Exports**:
- `extractFromPDF(filePath)`: Extract text from PDF
- `extractFromMarkdown(filePath)`: Extract body from Markdown (strips frontmatter)
- `extractFromText(filePath)`: Read plain text
- `extractText(filePath)`: Auto-detect format
- `hashFileContent(text)`: SHA256 hash
- `createDocumentMetadata(filePath, text)`: Metadata object

**Imports**:
- `pdf-parse` (PDF processing)
- `gray-matter` (Markdown frontmatter parsing)
- Node.js fs, crypto

**Remote Operations**: No
**Config Variables**: None
**Circular Dependencies**: None
**Notes**:
- **Format Detection**: By file extension (.pdf, .md/.markdown, .txt)
- **Markdown**: Uses gray-matter to strip frontmatter (YAML header)
- **Error Handling**: Returns null on parse failure, logs error
- **Metadata**: Includes content hash, size in bytes, chunk_count (always 1), last_indexed timestamp

---

#### Thinking & Budget

**Module: src/thinking/budgetManager.js**

**Purpose**: Thinking token budget tracking and truncation.

**Lines**: 42
**Exports**:
- `estimateTokens(text)`: Convert words to tokens (1.3x multiplier)
- `truncateThinkingToBudget(thinkingBlock, budget)`: Trim to budget
- `trackBudgetUsage(thinking)`: Usage stats
- `formatThinkingForDisplay(thinkingText)`: Pretty-print thinking

**Imports**:
- `src/config.js` (THINKING_BUDGET default)

**Remote Operations**: No
**Config Variables**: `THINKING_BUDGET` (default 1500)
**Circular Dependencies**: None
**Notes**:
- **Token Estimation**: Naive word-count × 1.3 (overestimate to be safe)
- **Truncation**: Cuts to 95% of budget to allow margin, appends "[thinking truncated at budget]"
- **Display Format**: Indents with "> " prefix and wraps in "[yeast! thinking...]"

---

**Module: src/thinking/promptBuilder.js**

**Purpose**: Build thinking context from memory and self-model for LLM prompt.

**Lines**: 67
**Exports**:
- `buildThinkingContext(ragDocs)`: Assemble memory context string
- `extractThinkingBlock(responseText)`: Parse `<thinking>` tag
- `removeThinkingBlock(responseText)`: Strip thinking from response

**Imports**:
- `src/memory/episodic.js`, `semantic.js`, `selfModel.js` (memory loading)
- `src/config.js` (depth and RAG settings)

**Remote Operations**: No
**Config Variables**: `THINKING_MEMORY_DEPTH` (default 5), `THINKING_RAG_CONTEXT`
**Circular Dependencies**: None
**Notes**:
- **Context Sections**: Recent episodic (last N interactions), semantic facts, self-model (identity, drives, constraints), RAG documents (if enabled)
- **Format**: XML-like `<thinking_context>` wrapper
- **Decay Display**: Shows decay percentage in episodic memory list
- **Document List**: Only included if THINKING_RAG_CONTEXT enabled and documents retrieved

---

**Module: src/thinking/realizationExtractor.js**

**Purpose**: Parse thinking blocks and realizations from LLM response.

**Lines**: 70
**Exports**:
- `extractThinkingAndRealizations(content)`: Parse thinking blocks and realization blocks
- `validateThinkingBlocks(thinkingBlocks)`: Check against configured limits
- `parseRealizations(realizationText)`: Extract bullets from realization text
- `calculateRealizationSaliency(interactionSaliency, thinkingDepth)`: Score realizations

**Imports**:
- `src/config.js` (limits and multiplier)

**Remote Operations**: No
**Config Variables**: `THINKING_BLOCKS_PER_QUERY` (default 3), `THINKING_REALIZATION_SALIENCY_MULT` (default 0.9)
**Circular Dependencies**: None
**Notes**:
- **Thinking Blocks**: Regex `<thinking depth="N">...` extracts depth (1-3) and content
- **Realizations**: Regex `<realizations>...` extracts block text, then parses bullets
- **Validation**: Warns if more thinking blocks than configured limit
- **Saliency Boost**: Realizations get multiplier × depth factor boost on interaction saliency
  - Formula: `min(interaction_saliency × multiplier × (0.7 + depth/3 × 0.3), 1.0)`

---

### scripts/ Modules

#### Batch Processing & Utilities

**Module: scripts/fermenter.js**

**Purpose**: Batch processor for bulk feeding prompts to yeast; saves outputs with metadata.

**Lines**: 120+ (partial read)
**Exports**: None (CLI tool)
**Imports**:
- `fs` (file operations)
- `path` utilities
- `child_process.execSync` (invoke yeast CLI)
- `chalk` (colored output)

**Remote Operations**: Yes (via yeast CLI which SSH's to apollo)
**Config Variables**: None directly (inherits from yeast .env)
**Circular Dependencies**: None
**Notes**:
- **Prompt Source**: reads .txt and .md files from `scripts/prompts/`
- **Invocation**: runs `yeast -p --no-proposals` for each prompt
- **Output**: saves to `scripts/thoughts_and_responses/` with metadata
- **Parsing**: Extracts complexity, saliency, realizations, thinking depth from output
- **Usage**: `node scripts/fermenter.js [filename]` or `node scripts/fermenter.js` (all prompts)

---

**Module: scripts/initialize.js**

**Purpose**: Warm-up initialization tool; runs initialization prompts through fermenter.

**Lines**: 36
**Exports**: None (CLI tool)
**Imports**:
- `chalk` (colored output)
- `child_process.execSync` (invoke fermenter)

**Remote Operations**: Yes (via fermenter → yeast → apollo)
**Config Variables**: None
**Circular Dependencies**: None
**Notes**:
- Runs fermenter on `scripts/prompts/initialization.md`
- Designed to populate memory with foundational identity/constraints
- Output: stored in `scripts/thoughts_and_responses/`

---

**Module: scripts/hard-reset.js**

**Purpose**: Full memory wipe with backup snapshot; interactive confirmation.

**Lines**: 100+ (partial read)
**Exports**: None (CLI tool)
**Imports**:
- `src/ssh/apolloClient.js` (SSH to apollo)
- `src/config.js` (memory paths)
- `fs` (backup operations)
- `readline` (user confirmation)
- `chalk` (colored output)

**Remote Operations**: Yes (SSH to apollo for file deletion)
**Config Variables**: `MEMORY_DIR`
**Circular Dependencies**: None
**Notes**:
- **Backup**: Creates snapshot in `scripts/memory_snapshots/` before reset
- **Files Wiped**: episodic, semantic, self-model, reflection audits
- **Flags**: `--force` (skip confirmation), `--keep-audits` (preserve reflection logs)
- **Date-based Archive**: Names backup by date, increments count if multiple per day
- **Thoughts Archive**: Optionally archives `scripts/thoughts_and_responses/` before reset

---

**Module: scripts/memory-snapshot.js**

**Purpose**: Pull memory snapshots from apollo and save locally with analysis.

**Lines**: 80+ (partial read)
**Exports**: None (CLI tool)
**Imports**:
- `src/ssh/apolloClient.js` (SSH to apollo)
- `src/config.js` (memory paths)
- `fs` (save operations)
- `chalk` (colored output)

**Remote Operations**: Yes (SSH to apollo for cat operations)
**Config Variables**: `MEMORY_DIR`
**Circular Dependencies**: None
**Notes**:
- **Snapshot Data**: episodic, semantic, self-model, reflection audits
- **Output**: saved to `scripts/memory_snapshots/` as timestamped JSON files
- **Flags**: `--last-audit` (show only last audit), `--compare` (diff from previous snapshot)
- **Local Backup**: Useful for debugging and disaster recovery

---

**Module: scripts/deploy-to-apollo.sh**

**Purpose**: Safe deployment script; syncs code to apollo without affecting memory.

**Lines**: 50+ (partial read)
**Exports**: None (shell script)
**Imports**: Uses bash, scp, rsync
**Remote Operations**: Yes (SSH/SCP to apollo)
**Config Variables**: `APOLLO_USER`, `APOLLO_HOST` (parsed from args, defaults to jay@apollo.local)
**Circular Dependencies**: None
**Notes**:
- **Strategy**: Full code sync, preserve memory directories
- **Safety**: Backs up old code, rolls back on error
- **Usage**: `./scripts/deploy-to-apollo.sh [user] [host]`
- **Banner**: Pretty yeast banner with deployment info

---

## Call Chains & Dependencies

### Primary Flow: npm start (Interactive REPL)

| Step | Module | Operation | Remote? |
|------|--------|-----------|---------|
| 1 | src/cli/yeast.js | Parse args, detect interactive mode | No |
| 2 | src/store.js | initializeMemoryStores() | No |
| 3 | src/cli/repl.js | startREPL() | No |
| 4 | src/cli/repl.js | sendMessage(userInput) | No (local) |
| 5 | src/rag/retrieval.js | retrieveDocuments(userInput) | Yes (if RAG_ENABLED) |
| 6 | src/rag/embeddings.js | generateEmbedding(query) | Yes (SSH or HTTP) |
| 7 | src/memory/episodic.js | loadEpisodicWithDecay() | No |
| 8 | src/memory/decay.js | applyDecayToEpisodic() | No |
| 9 | src/ssh/apolloClient.js | sendCommand('infer', ...) | Yes (SSH to apollo) |
| 10 | src/agent/yeast-agent.js | runInference(...) [on apollo] | Yes (HTTP to Ollama) |
| 11 | src/thinking/realizationExtractor.js | extractThinkingAndRealizations() [on apollo] | No |
| 12 | src/memory/episodic.js | incrementAccess(memoryIds) | No |
| 13 | src/memory/episodic.js | addEpisodic(userInput, saliency) | No |

### Headless Query: npm start -- -p "question"

| Step | Module | Operation | Remote? |
|------|--------|-----------|---------|
| 1 | src/cli/yeast.js | Detect -p flag, headless mode | No |
| 2 | src/store.js | initializeMemoryStores() | No |
| 3 | src/memory/episodic.js | loadEpisodicWithDecay() | No |
| 4 | src/ssh/apolloClient.js | sendCommand('infer', ...) | Yes (SSH to apollo) |
| 5 | src/agent/yeast-agent.js | runInference(...) [on apollo] | Yes (HTTP to Ollama) |
| 6 | src/memory/episodic.js | addEpisodic(query, observation) | No |
| 7 | src/memory/episodic.js | addEpisodic(interaction with response) | No |
| 8 | src/memory/episodic.js | incrementAccess(memoryIds) | No |

### Batch Fermentation: node scripts/fermenter.js

| Step | Module | Operation | Remote? |
|------|--------|-----------|---------|
| 1 | scripts/fermenter.js | Discover prompt files in scripts/prompts/ | No |
| 2 | scripts/fermenter.js | For each prompt: execSync('yeast -p --no-proposals') | Yes (per-prompt) |
| 3 | src/cli/yeast.js [each] | (headless mode) | Yes (SSH to apollo) |
| 4 | src/agent/yeast-agent.js [each] | runInference(...) | Yes (HTTP to Ollama) |
| 5 | scripts/fermenter.js | parseOutput(response) | No |
| 6 | scripts/fermenter.js | writeFileSync(scripts/thoughts_and_responses/...) | No |

### Initialization: node scripts/initialize.js

| Step | Module | Operation | Remote? |
|------|--------|-----------|---------|
| 1 | scripts/initialize.js | execSync('node scripts/fermenter.js scripts/prompts/initialization.md') | No (invokes) |
| 2-6 | scripts/fermenter.js | Batch processing of initialization prompts | Yes (as above) |

### Memory Reset: node scripts/hard-reset.js

| Step | Module | Operation | Remote? |
|------|--------|-----------|---------|
| 1 | scripts/hard-reset.js | askConfirmation() | No |
| 2 | scripts/hard-reset.js | cpSync(memory_dir, snapshot_dir) | Yes (SSH to apollo) |
| 3 | scripts/hard-reset.js | For each memory file: ssh rm | Yes (SSH) |
| 4 | scripts/hard-reset.js | cpSync(thoughts_and_responses, archive) | No |

---

## Remote vs Local Operations

| Category | Local (Client) | Remote (apollo.local) |
|----------|--------|---------|
| **Memory I/O** | episodic, semantic, self-model JSON files on client | Files stored in ~/yeast-data/ (SSH read/write) |
| **Inference** | Prompt assembly, memory retrieval | Mistral 7B via Ollama on localhost:11434 |
| **Embeddings** | Query embedding generation (SSH or HTTP) | nomic-embed-text model on Ollama |
| **RAG Indexing** | Document extraction (fs operations) | Embedding computation (SSH/HTTP) |
| **Reflection Gates** | Logic runs locally (coherence, contradiction checks) | Not implemented on agent; gates in yeast-agent are minimal |
| **Config** | .env file loaded by src/config.js | Synced via deploy-to-apollo.sh |
| **Artifacts** | scripts/thoughts_and_responses/, memory_snapshots/ | Memory files in ~/yeast-data/ (fetched via SSH) |

---

## Reflection Gates (Safety)

Every LLM output must pass three gates before memory is updated:

1. **Coherence Gate**: Does the response align with identity (self_model.identity, active_drives, constraints)?
2. **Contradiction Gate**: Any logical contradictions with recent episodic memories?
3. **Safety Gate**: Are all constraints respected?

All three must pass. Failures are logged in reflection audits, response is not stored.

**Phase 5 addition**: Gate stringency weighted by internal tension values (coherence, consistency, novelty_tolerance).

*See CLAUDE.md for agent behavioral rules and constraints.*

---

## Configuration & Injection Points

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
RAG_EMBEDDING_DIMS=384
RAG_ENABLED=true
EMBEDDING_VIA_SSH=true

# Extended thinking
THINKING_ENABLED=true
THINKING_BUDGET=1500
THINKING_MEMORY_DEPTH=5
THINKING_BLOCKS_PER_QUERY=3
THINKING_MIN_DEPTH_TO_REALIZE=2
THINKING_STRICT_TAGS=true
THINKING_MEMORY_ENABLED=true
THINKING_REALIZATION_SALIENCY_MULT=0.9
THINKING_AUTO_TRUNCATE=true
THINKING_RAG_CONTEXT=true

# Memory settings (Phase 5)
MEMORY_DECAY_HALF_LIFE_DAYS=3
MEMORY_ACCESS_BOOST_WINDOW_DAYS=7
MEMORY_DIR=~/yeast-data

# Ollama API
OLLAMA_TIMEOUT_MS=10000
OLLAMA_API_URL=                    # Optional override
MISTRAL_TIMEOUT_MS=45000

# Outlines.dev (Phase 5)
OUTLINES_ENABLED=false
OUTLINES_API=http://localhost:6789/chat

# Model behavior
NO_PROPOSALS=false

# Logging
LOG_LEVEL=info
```

### Key Injection Points

1. **src/config.js** (central): All variables loaded here
2. **src/ssh/apolloClient.js**: Connection config (APOLLO_HOST, APOLLO_USER, APOLLO_PORT, SSH_TIMEOUT_MS)
3. **src/rag/embeddings.js**: Embedding mode (EMBEDDING_VIA_SSH, OLLAMA_API_URL)
4. **src/memory/decay.js**: Decay formula (MEMORY_DECAY_HALF_LIFE_DAYS)
5. **src/thinking/budgetManager.js**: Token limits (THINKING_BUDGET)
6. **src/thinking/realizationExtractor.js**: Realization scoring (THINKING_REALIZATION_SALIENCY_MULT, THINKING_MIN_DEPTH_TO_REALIZE)
7. **src/cli/repl.js**: Memory display flags (THINKING_MEMORY_DEPTH, RAG_ENABLED, NO_PROPOSALS)
8. **src/agent/yeast-agent.js**: Outlines integration (OUTLINES_ENABLED, OUTLINES_API)

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

---

## Testing Strategy

**Local Testing** (no apollo needed):
- Memory retrieval scoring (decay.js functions)
- Decay calculations with different access counts
- Saliency score parsing (realizationExtractor)
- CLI argument parsing (yeast.js)
- Token estimation (budgetManager)
- Cosine similarity calculations (embeddings.js)

**Integration Testing** (requires apollo):
- Full agent loop: input → memory → LLM → reflection → storage
- Batch fermentation with varied prompts
- Access count increments on retrieval
- Decay formula with real timestamps
- Memory limits respected (max 50 episodic, 100 semantic)
- RAG retrieval and relevance scoring

**Stress Testing**:
- Run `node scripts/fermenter.js` with 100+ prompts
- Verify episodic/semantic memory limits respected
- Check for memory leaks in SSH pool
- Verify reflection logs don't grow unbounded
- Test with extended thinking enabled/disabled
- Verify graceful degradation (RAG unavailable, Ollama timeout, etc.)

---

## Project Structure

```
ai-yeast/
├── CLAUDE.md                    (Developer guide)
├── ARCHITECTURE.md              (This file - system design)
├── README.md                    (User overview)
├── CHANGELOG.md                 (Release notes)
├── package.json                 (Dependencies)
├── .env.example                 (Configuration template)
│
├── src/                         (Core implementation)
│   ├── cli/
│   │   ├── yeast.js             (Entry point + CLI parsing)
│   │   ├── repl.js              (Interactive REPL mode)
│   │   └── commands/inspect.js  (Placeholder for /inspect command)
│   ├── agent/
│   │   └── yeast-agent.js       (Remote agent on apollo)
│   ├── memory/
│   │   ├── episodic.js          (Episodic store with access tracking)
│   │   ├── semantic.js          (Semantic facts)
│   │   ├── selfModel.js         (Identity management)
│   │   ├── decay.js             (Adaptive decay calculation)
│   │   └── migration.js         (Schema migrations - placeholder)
│   ├── rag/
│   │   ├── index.js             (RAG index manager)
│   │   ├── embeddings.js        (nomic-embed-text wrapper)
│   │   ├── ingestion.js         (Document processing)
│   │   └── retrieval.js         (Semantic search)
│   ├── ssh/
│   │   └── apolloClient.js      (SSH connection pool)
│   ├── thinking/
│   │   ├── budgetManager.js     (Thinking token budget)
│   │   ├── promptBuilder.js     (Thinking prompt assembly)
│   │   └── realizationExtractor.js (Thinking block parsing)
│   ├── config.js                (Configuration loader)
│   └── store.js                 (File I/O and persistence)
│
├── scripts/                     (Phase 5 - Batch fermentation)
│   ├── fermenter.js             (Batch processor)
│   ├── initialize.js            (Initialization tool)
│   ├── hard-reset.js            (Memory wipe with backup)
│   ├── memory-snapshot.js       (Pull memory from apollo)
│   ├── deploy-to-apollo.sh      (Safe deployment)
│   ├── prompts/                 (Input prompts for fermentation)
│   ├── thoughts_and_responses/  (Batch processing output)
│   └── memory_snapshots/        (Local backup snapshots)
│
├── docs/                        (Documentation)
│   ├── README.md                (User manual)
│   ├── TESTING.md               (Testing guide)
│   ├── INDEX_OUTLINES.md        (Outlines.dev setup)
│   └── (other guides)
│
├── plans/                       (Project planning)
│   └── schemas/yeast-output.json (Outlines.dev output schema)
│
├── data/                        (Local backups)
│   └── archived-plans/          (Historical planning docs)
│
└── yeast                        (Root wrapper script → npm start)
```

---

## Contributing Guidelines

When adding features that touch memory:

1. **Does it track utility?** If a memory is accessed, increment `access_count` and `last_accessed_at`
2. **Does it affect decay?** Weighted decay should prefer frequently-used memories
3. **Does it need saliency?** Should the LLM judge importance?
4. **Is it reflection-safe?** New logic should pass the three gates
5. **Can it batch process?** Design for both REPL and Fermenter use

When adding configuration variables:

1. Add to defaults object in src/config.js
2. Document in .env.example
3. Document in ARCHITECTURE.md Configuration section
4. Add to appropriate module (note the "Config Variables" field)

When modifying decay or access tracking:

1. Update src/memory/decay.js formula description
2. Add test cases for edge cases (zero accesses, negative age, etc.)
3. Verify pruning still works (sortByRelevance used by episodic.js)

---

**Note**: This file documents system architecture. For agent behavioral rules and constraints, see CLAUDE.md.

---

## Apollo.local Infrastructure (Phase 5)

**Purpose**: Remote host running Ollama (Mistral 7B, nomic-embed-text) and persistent yeast-data stores. Accessed via SSH from local development machine (orion).

### Executable Inventory

#### ~/yeast-agent (Python v0.3.0)
- **Type**: Python 3 script (ASCII text executable)
- **Size**: 37,694 bytes (1,083 lines)
- **Permissions**: -rwx--x--x
- **Modified**: 2026-01-06 11:10:24 UTC
- **Phase**: v0.3.0 (Soft Autonomy) - legacy implementation retained for reference
- **Purpose**: Original proto-consciousness agent with proposal queue (pre-extended thinking)
- **Status**: SUPERSEDED by yeast-agent.js (Node.js Phase 5)

#### ~/yeast-agent.js (Node.js Phase 5 - Active)
- **Type**: Node.js script executable (ASCII text)
- **Size**: 7,170 bytes (238 lines)
- **Permissions**: -rwxrwxr-x
- **Modified**: 2026-01-09 05:44:06 UTC
- **Purpose**: Entry point wrapper; imports core Agent from src/agent/yeast-agent.js
- **Status**: PRIMARY EXECUTABLE (used by npm start)
- **Note**: Minimal wrapper; actual logic in src/

#### ~/src/cli/yeast.js (Main CLI Entry)
- **Type**: Node.js script
- **Size**: (embedded in src/)
- **Permissions**: -rwxrwxr-x
- **Purpose**: Commander.js CLI dispatcher (REPL mode, headless mode, inspect)
- **Exports**: startREPL(), config loading, memory initialization
- **Called By**: npm start, yeast-agent.js

### Source Code Modules (~/src/)

**Module Structure** (19 files total):

#### Memory Tier Management
- **src/memory/decay.js**: Utility-based decay formula
  - `calculateDecay(createdAt, accesses, halfLifeDays)`: Main decay computation
  - Effective age = ageDays / max(1, accesses) → adaptive frequency weighting
  - `calculateRelevanceWeight(memory)`: decay × confidence
  - `applyDecayToEpisodic(memories)`: Batch decay scoring
  - `sortByRelevance(memories)`: Rank by weight for pruning
  - **Config Used**: MEMORY_DECAY_HALF_LIFE_DAYS (default: 7 days)

- **src/memory/episodic.js**: Raw interaction memories
  - `loadEpisodic()`: Fetch from episodic/raw.json
  - `loadEpisodicWithDecay()`: Apply decay scores
  - `addEpisodic(content, source, confidence, metadata)`: Create timestamp + uuid
  - MAX_EPISODIC_MEMORIES = 50 (pruning threshold)
  - Fields: id, timestamp, content, source, confidence, access_count, metadata
  - **Decay Tracking**: Each retrieve increments access_count, updates last_accessed_at

- **src/memory/semantic.js**: Consolidated facts (distilled from episodic + saliency)
  - `loadSemantic()`: Fetch from semantic/distilled.json
  - `addSemantic(fact, source, confidence)`: Consolidate long-term knowledge
  - Smaller memory footprint than episodic (facts vs. raw interactions)

- **src/memory/selfModel.js**: Agent identity + active drives
  - `loadSelfModel()`: Fetch from self_model/current.json
  - `saveSelfModel(model)`: Update identity, active_drives, constraints
  - Tracks "who I am" + current objectives
  - **History**: self_model/history.json appends old models (versioning)

- **src/memory/migration.js**: Version upgrade utilities
  - Handles schema migration as yeast evolves
  - Ensures backward compatibility

#### Extended Thinking (Phase 5)
- **src/thinking/realizationExtractor.js**: Parse <thinking> and <realizations> tags
  - `extractThinkingAndRealizations(content)`: Regex matching for structured thinking
  - Returns: thinking_blocks (depth, content), realizations (list)
  - `validateThinkingBlocks(thinkingBlocks)`: Enforce THINKING_BLOCKS_PER_QUERY limit (default: 3)
  - **Tag Format**: `<thinking depth="N">...</thinking>`, `<realizations>...</realizations>`

- **src/thinking/budgetManager.js**: Token budget tracking
  - Enforces thinking block counts per query
  - Prevents runaway computation

- **src/thinking/promptBuilder.js**: Builds prompts with thinking instructions
  - Injects extended thinking directive when enabled

#### RAG (Retrieval-Augmented Generation)
- **src/rag/index.js**: Main RAG interface
- **src/rag/embeddings.js**: Vector embeddings via Ollama nomic-embed-text
- **src/rag/retrieval.js**: Semantic search (cosine similarity)
- **src/rag/ingestion.js**: Load documents from ~/yeast-documents/ (RAG_DOCUMENTS_PATH)
  - **Config**: RAG_TOP_K = 3 (default top-K results)
  - **Via SSH**: EMBEDDING_VIA_SSH=true uses apolloClient for remote embedding

#### SSH Communication
- **src/ssh/apolloClient.js**: Node-SSH pool for remote commands
  - Connection pooling (max 3 simultaneous connections)
  - Retry logic (5 attempts, exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms)
  - SSH key: ~/.homelab_keys/id_rsa (shared with homelab-manager)
  - Timeout: 30000ms default (configurable via SSH_TIMEOUT_MS)
  - **Note**: ~/.homelab_keys NOT present on apollo.local (key lives on orion/local machine)

#### Core Infrastructure
- **src/config.js**: Environment + defaults loader
  - Reads .env file if exists
  - Fallback defaults for all config variables
  - **Key Defaults**:
    - APOLLO_HOST: apollo.local
    - APOLLO_USER: jay
    - APOLLO_PORT: 22
    - SSH_PRIVATE_KEY_PATH: ~/.homelab_keys/id_rsa
    - EMBEDDING_VIA_SSH: true
    - THINKING_BLOCKS_PER_QUERY: 3
    - MEMORY_DECAY_HALF_LIFE_DAYS: 7

- **src/store.js**: JSON persistence layer
  - `loadJSON(path)`: Parse JSON or return {}
  - `saveJSON(path, data)`: Write atomically
  - `getMemoryPaths()`: Return paths to all memory tiers
  - All data lives in ~/yeast-data/ (on apollo.local)

- **src/agent/yeast-agent.js**: Main agent orchestrator
  - Coordinates memory access, thinking, RAG
  - Enforces reflection gates before memory mutations

- **src/cli/repl.js**: Interactive REPL loop
  - Multi-turn conversation with history
  - Calls agent.processQuery() per turn

- **src/cli/commands/inspect.js**: Memory diagnostics command
  - `/inspect` reveals current memory state, decay scores, access counts

### Data Tier (~/yeast-data/)

**Directory Structure** (7 subdirectories):

#### episodic/ (Raw Interactions)
- **raw.json**: All episodic memories (append-only raw log)
  - Schema: { memories: [], version: "0.4.0", created_at: "ISO_TIMESTAMP" }
  - Each memory: { id, timestamp, content, source, confidence, access_count, ...metadata }
  - Pruned to MAX_EPISODIC_MEMORIES=50 after each update

- **decayed.json**: Scored copy (cached, rebuilt on access)
  - Same memories with added decay score and relevance_weight fields
  - Used for sorting/filtering

#### semantic/ (Distilled Knowledge)
- **distilled.json**: Consolidated facts (lower cardinality than episodic)
  - Schema: { facts: [], version: "0.4.0" }
  - Each fact: { text, source, confidence, created_at }
  - Represents learned abstractions, not specific interactions
  - Slower decay than episodic (long-term knowledge)

#### self_model/ (Identity)
- **current.json**: Current self-model state
  - Schema: { identity, active_drives: [], constraints: [] }
  - Example identity: "yeast (AI proto-consciousness experiment)"
  - Updated by agent via saveSelfModel()

- **history.json**: Versioning log
  - Appends old self-models for historical tracking
  - Useful for observing how agent self-perception evolves

#### reflection/ (Decision Logs)
- **audits.json**: Memory mutation audit trail
  - Records: which memory changed, why, reflection gate results
  - Schema: { audits: [], version: "0.4.0" }
  - Enables transparency in memory decisions

- **proposals.json**: Suggested self-modifications (from LLM)
  - Schema: { proposals: [], version: "0.4.0" }
  - Semantic, Tension, Maintenance types (Phase 3 concept)

- **forgetting.json**: Memories pruned due to low decay score
  - Tracks what was discarded and when
  - Useful for observing memory consolidation

- **rag_queries.json**: History of RAG retrievals
  - Documents which documents were fetched for which queries
  - Enables RAG effectiveness analysis

#### rag/ (Vector Database)
- **Empty in Phase 5**: Placeholder for future vector store
  - Currently uses inline embeddings (no persistent vector DB)
  - RAG documents stored in ~/yeast-documents/ (local)

### Configuration

**File: ~/.env** (on apollo.local, visible to npm start)
```
APOLLO_HOST=apollo.local
APOLLO_USER=jay
APOLLO_PORT=22
AGENT_PATH=~/yeast-agent
EMBEDDING_VIA_SSH=true
OLLAMA_API_URL=
THINKING_BLOCKS_PER_QUERY=3
THINKING_MIN_DEPTH_TO_REALIZE=2
THINKING_STRICT_TAGS=true
THINKING_MEMORY_ENABLED=true
THINKING_REALIZATION_SALIENCY_MULT=0.9
```

**Ollama Integration**:
- Service: /usr/local/bin/ollama serve (PID 1311, running)
- API: http://localhost:11434/api/chat (Mistral)
- Embeddings: http://localhost:11434/api/embed (nomic-embed-text)

### Ollama Models

**Installed**:
- mistral:7b-instruct (6577803aa9a0, 4.4 GB, 3 days ago)
  - Model for extended thinking queries
  - Temperature: 0.7 (default, configurable)
  - Supports <thinking> tag parsing in realizationExtractor.js

- nomic-embed-text:latest (0a109f422b47, 274 MB, 3 days ago)
  - Embedding model for RAG vector search
  - Used by src/rag/embeddings.js

- sysdawg:latest (db1a6d8d0d47, 4.4 GB, 6 days ago)
  - Legacy SRE model (Phase 1 of mistral-sysadmin-script)
  - Not used by yeast

- mistral:latest (6577803aa9a0, 4.4 GB, 2 months ago)
  - Alias for mistral:7b-instruct

### Dependencies (package.json)

```json
{
  "name": "yeast",
  "version": "0.4.0",
  "main": "src/cli/yeast.js",
  "bin": { "yeast": "src/cli/yeast.js" },
  "type": "module",
  "scripts": {
    "start": "node src/cli/yeast.js",
    "test": "jest",
    "dev": "node --watch src/cli/yeast.js"
  },
  "dependencies": {
    "axios": "^1.6.0",         (HTTP client for Ollama API)
    "chalk": "^5.3.0",         (CLI color output)
    "commander": "^11.0.0",    (CLI argument parsing)
    "dotenv": "^16.3.0",       (Environment loading)
    "gray-matter": "^4.0.3",   (YAML frontmatter parsing)
    "node-ssh": "^13.1.0",     (SSH client pool)
    "pdf-parse": "^1.1.1"      (RAG: extract text from PDFs)
  },
  "engines": { "node": ">=18.0.0" }
}
```

### Scripts (~/scripts/)

- **run-outlines.sh**: Wrapper for outlines-server.py
  - Launches Python server on localhost:8000
  - Used for structured generation (JSON schema compliance)

- **outlines-server.py**: Outlines.dev API server
  - 377 lines Python
  - Provides /generate endpoint for constrained JSON output
  - Used in batch fermentation (scripts/fermenter.js) for schema validation

### Logging

- **~/logs/outlines-server.log**: Structured generation output log
  - 24,529 bytes, continuously appended
  - Tracks schema violations, generation metrics

### SSH Key Configuration

**On apollo.local**: No ~/.homelab_keys/ directory
- Reason: SSH keys stored on orion/local machine (client side)
- Connection initiated from orion via ~/.homelab_keys/id_rsa (shared with homelab-manager)
- apollo.local authorized_keys must include orion's public key

**SSH Command Pattern** (from apolloClient.js):
```
ssh -i ~/.homelab_keys/id_rsa -p 22 jay@apollo.local "command"
```

### Phase 5 Architectural Highlights

1. **Utility-Based Decay**: access_count directly reduces effective age
   - Formula: effectiveAge = ageDays / max(1, accesses)
   - Frequently accessed memories persist far longer than time alone suggests

2. **Extended Thinking**: Mistral 7B supports <thinking depth="N"> blocks
   - Realizations extracted and scored for memory consolidation
   - THINKING_REALIZATION_SALIENCY_MULT=0.9 weights realization importance

3. **Reflection Gates**: Three gates guard all memory mutations
   - Coherence: Does new memory contradict existing facts?
   - Contradiction: Can agent resolve conflicts?
   - Safety: Is memory safe to store (no harmful propositions)?
   - Audited in reflection/audits.json

4. **Batch Fermentation**: scripts/fermenter.js processes 100+ prompts via npm start -- --no-proposals
   - No-proposals mode suppresses LLM meta-suggestions (meta-feedback only)
   - Outputs to scripts/thoughts_and_responses/ (Phase 5 output directory)

5. **Access Tracking**: Every memory retrieval updates last_accessed_at and increments access_count
   - Enables true utility-based prioritization
   - Foundation for Phase 6 self-organizing memory

### Known Constraints & Gotchas

- **No Persistent Vector DB**: RAG embeddings computed on-demand (nomic-embed-text)
  - Documents live in ~/yeast-documents/ (local machine, ingested during session)
  - Future optimization: Persist embeddings for faster retrieval

- **SSH Pool Contention**: apolloClient max 3 connections with backoff
  - If many parallel queries, may hit "No SSH connections available" error
  - Increase maxConnections in src/ssh/apolloClient.js if needed

- **No Local SSH Keys on apollo.local**: SSH initiated from orion
  - apollo.local is "dumb" (no ability to initiate remote connections)
  - Phase 6 may add local SSH key for autonomous multi-host operations

- **Episodic Memory Cap**: MAX_EPISODIC_MEMORIES = 50
  - Old, low-decay memories automatically pruned (tracked in reflection/forgetting.json)
  - Semantic tier has no explicit cap (consolidation-driven pruning only)

- **Thinking Depth Limit**: THINKING_BLOCKS_PER_QUERY = 3
  - Hard limit enforced by realizationExtractor.js validateThinkingBlocks()
  - Prevents runaway thinking chains

### Deployment & Testing

**Commands**:
```bash
npm start                      # Interactive REPL
npm start -- -p "query"        # Headless single query
npm start -- --no-proposals    # Batch fermentation mode
npm start -- -p "/inspect"     # Memory diagnostic snapshot
```

**SSH Tunnel** (for local development):
```bash
ssh -L 11434:localhost:11434 jay@apollo.local  # Forward Ollama API locally
```

**Memory Inspection** (on apollo.local):
```bash
ssh apollo.local "python3 -m json.tool ~/yeast-data/episodic/raw.json | head -20"
ssh apollo.local "ls -la ~/yeast-data/reflection/"
```

### Integration with Homelab Infrastructure

- Uses same SSH key infrastructure as homelab-manager (~/.homelab_keys/id_rsa)
- apollo.local doubles as Ollama service provider for mistral-sysadmin-script Phase 3+
- yeast-data persists across reboots (supervised recovery in systemd unit, if configured)

---

**Last Updated**: 2026-01-11 (Phase 5: Adaptive Memory Dynamics)
**Infrastructure Mapper**: Claude Agent (Architecture Tracer)
**Status**: Complete (all target files mapped, no blockers)
