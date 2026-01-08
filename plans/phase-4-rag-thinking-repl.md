# Phase 4: JavaScript Migration, RAG, Extended Thinking & REPL UI

**Status**: Planning phase (pending review)

**Theme**: "Knowledge, Thinking, Intuition—the trifecta for squeezed performance"

---

## Overview

Phase 4 transforms yeast! from a Python-based agent with static memory into a full-featured JS-based REPL with:

1. **RAG (Knowledge)**: Search external documents (PDFs, Markdown, text) for context
2. **Extended Thinking (Thinking)**: Chain-of-thought reasoning before responding (1500 token budget, configurable)
3. **Memory (Intuition)**: Phase 3 episodic/semantic stores + identity tracking
4. **REPL UI (Interface)**: Interactive terminal like Claude Code / Gemini CLI using Ink

These three modalities work together:
- **RAG** = knowledge we didn't build internally
- **Thinking** = reasoning before action (chain-of-thought on recent memories + relevant docs)
- **Memory** = intuition from past experiences

---

## Architecture

### Deployment

```
┌─────────────────────────────────────────┐
│  Workstation (orion)                    │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  yeast! CLI (Node.js)             │  │
│  │  - REPL UI (Ink)                  │  │
│  │  - Memory mgmt (local JSON)       │  │
│  │  - RAG pipeline                   │  │
│  │  - Thinking coordinator           │  │
│  └───────────────────────────────────┘  │
│           │                              │
│           └─ SSH ──────────────────┐     │
│                                    │     │
└────────────────────────────────────┼─────┘
                                     │
                          ┌──────────▼──────────┐
                          │  apollo.local       │
                          │                     │
                          │  Mistral 7B (LLM)   │
                          │  Ollama embeddings  │
                          └─────────────────────┘
```

**Key Decision**: Mistral + embeddings stay on apollo (hardware constraint on orion)
**Migration**: Phase 3 memory stores (episodic, semantic, self_model) → JavaScript/JSON format
**File Watching**: Node.js fs.watch for hot-reload of RAG documents

### SSH Protocol Specification

**Connection Model**: Single persistent SSH connection pool (maintained by `apolloClient.js`)
- Max 3 concurrent connections per pool
- Reuse connections across requests
- Auto-reconnect on drop (exponential backoff, max 5 retries)

**Message Format** (JSON over stdin to yeast-agent.js on apollo):
```json
{
  "command": "infer|thinking|consolidate|audit",
  "input": "user message here",
  "memory_context": {
    "episodic_count": 42,
    "semantic_count": 18
  },
  "thinking_enabled": true,
  "thinking_budget": 1500,
  "rag_docs": [
    {"id": "doc-1", "content": "excerpt...", "source": "file.md"}
  ]
}
```

**Response Format**:
```json
{
  "success": true,
  "response": "agent response text",
  "thinking": "<thinking>...</thinking>",
  "memory_updates": {
    "episodic_added": 1,
    "semantic_added": 0
  },
  "error": null,
  "timestamp": "2026-01-08T12:00:00Z"
}
```

**Error Response**:
```json
{
  "success": false,
  "response": null,
  "error": "error message",
  "error_code": "CONNECTION_TIMEOUT|LLM_UNAVAILABLE|PARSING_ERROR",
  "timestamp": "2026-01-08T12:00:00Z"
}
```

**Timeout**: 30s per request (configurable via `SSH_TIMEOUT_MS=30000` in .env)

---

## 1. JavaScript Migration

### From Python to Node.js

**What Moves**:
- `yeast-agent` (Python) → `yeast-agent.js` (Node.js, runs on apollo via SSH)
- `yeast` (bash wrapper) → `yeast.js` (Node.js CLI entry point)
- `test_decay.py`, `test_proposals.py` → `*.test.js` (Jest)

**Memory Store Format** (unchanged, but now accessed from JS):
```
~/yeast-data/
├── episodic/
│   ├── raw.json          (timestamp, content, source, confidence)
│   └── decayed.json      (same, with decay applied)
├── semantic/
│   └── distilled.json    (distilled facts)
├── self_model/
│   ├── current.json      (identity, drives, constraints, tension)
│   └── history.json      (version history)
├── reflection/
│   ├── audits.json       (reflection decisions)
│   ├── forgetting.json   (deletion log)
│   ├── proposals.json    (Phase 3: self-modification queue)
│   └── rag_queries.json  (NEW Phase 4: RAG access log)
├── rag/
│   ├── embeddings.json   (NEW: document embeddings index)
│   ├── documents.json    (NEW: document metadata & chunks)
│   └── access_log.json   (NEW: what docs were queried when)
├── dialogue.json         (all interactions)
└── config.json          (NEW Phase 4: thinking budget, RAG settings)
```

**Memory Migration Strategy**:
1. Load existing Phase 3 stores as-is (JSON format same everywhere)
2. Initialize new RAG/thinking stores on first startup
3. Keep version history for rollback

### Memory Access Patterns

**Config Loading** (on every agent invocation):
- Load `.env` at startup → config object
- Override defaults with env values (e.g., `MEMORY_DECAY_HALF_LIFE_DAYS`)
- No hot-reload; restart required for .env changes (except via `/config set` command)

**Memory File Locking**:
- Episodic/semantic/self_model: Read always OK, writes serialized (one at a time)
- Use async file writes with queuing to prevent concurrent corruption
- No explicit lock file; instead use atomic writes (write to temp, rename)

**Concurrent Access** (multiple queries):
- episodic reads: Allowed (multiple threads)
- episodic writes: Queued (FIFO order)
- semantic reads: Allowed
- semantic writes: Queued
- self_model reads: Allowed
- self_model writes: Exclusive (cannot overlap with episodic writes)

**Data Flush Pattern**:
```javascript
// For each memory store update:
1. Load current JSON from disk
2. Apply changes to in-memory object
3. Write to temp file (same directory)
4. fsync (ensure written to disk)
5. Atomic rename (temp → original)
6. Notify watchers (for UI updates)
```

**Memory State Consistency**:
- Each file is atomic (no partial writes)
- Dialogue log is append-only (no corruption risk)
- Rollback via `.archives/` backup if migration fails

---

## 2. RAG Implementation (Knowledge)

### Document Ingestion

**Supported Formats**: PDF, Markdown, Text files

**Pipeline**:
```
Folder Watch (fs.watch)
     ↓
Detect new/modified files
     ↓
Extract text (pdf-parse, front-matter, raw text)
     ↓
Chunk whole-file (no paragraph splitting for Phase 4)
     ↓
Generate embeddings via Ollama nomic-embed-text
     ↓
Store in ~/yeast-data/rag/documents.json + embeddings.json
     ↓
Index ready for retrieval
```

**Embedding Storage** (`embeddings.json`):
```json
{
  "documents": [
    {
      "id": "doc-uuid",
      "filename": "my-doc.md",
      "source": "file_path",
      "timestamp": "2026-01-08T12:00:00Z",
      "embedding": [0.1, -0.2, 0.3, ...],
      "metadata": {
        "hash": "sha256-hash",
        "size_bytes": 1024,
        "chunk_count": 1,
        "last_indexed": "2026-01-08T12:00:00Z"
      }
    }
  ],
  "indexed_at": "2026-01-08T12:00:00Z"
}
```

**Document Retrieval**:
1. User query → generate embedding via Ollama
2. Cosine similarity against document embeddings
3. Return top-K (default 3) most relevant documents
4. Log query + results in `rag_queries.json`

**Folder Watching**:
- Watch `~/yeast-documents/` (or configurable `RAG_DOCUMENTS_PATH`)
- On file change:
  - Extract text
  - Generate embedding
  - Update `documents.json` + `embeddings.json`
  - No restart required

### Ollama Embedding API Specification

**Endpoint**: `http://apollo.local:11434/api/embed`

**Request** (to generate embeddings for document text):
```json
{
  "model": "nomic-embed-text",
  "input": "Full document text here..."
}
```

**Response** (384-dimensional vector):
```json
{
  "embedding": [0.123, -0.456, 0.789, ...],
  "model": "nomic-embed-text"
}
```

**Query Embedding** (same endpoint, same request format):
```json
{
  "model": "nomic-embed-text",
  "input": "user query text"
}
```

**Cosine Similarity Formula**:
```
score = dot_product(query_vec, doc_vec) / (norm(query_vec) * norm(doc_vec))
// Returns value in [-1, 1]; higher = more similar
// Typically only retrieve docs with score > 0.5
```

**Timeout**: 10s per embedding call (configurable via `OLLAMA_TIMEOUT_MS=10000`)

### Configuration (.env)

```bash
# RAG Configuration
RAG_DOCUMENTS_PATH="~/yeast-documents"
RAG_TOP_K=3                              # Top-K docs to retrieve
RAG_EMBEDDINGS_MODEL="nomic-embed-text"  # Ollama embedding model
RAG_EMBEDDING_DIMS=384                   # Vector dimensionality
RAG_ENABLED=true                         # Toggle on/off
```

---

## 3. Extended Thinking Implementation (Thinking)

### Chain-of-Thought with Memory Context

**When User Sends Query**:
1. Retrieve recent memories (episodic + semantic)
2. Retrieve top-K RAG documents (cosine similarity)
3. **Thinking Phase** (if enabled):
   - Generate thinking prompt
   - Send to Mistral with thinking budget
   - Stream thinking output to user (indented, greyed)
   - Collect full thinking response
4. **Response Phase**:
   - Mistral generates response (using thinking context)
   - Run reflection gates (coherence, contradiction, safety)
   - Store interaction in dialogue + memory

### Thinking Prompt Template

```
<thinking_context>
RECENT MEMORIES (last 5 interactions):
- Episodic: [facts with decay scores]
- Semantic: [consolidated knowledge]
- Self Model: [identity traits, active goals]

RELEVANT DOCUMENTS (top-3 by relevance):
- Document A: [excerpt]
- Document B: [excerpt]
- Document C: [excerpt]

YOUR ACTIVE DRIVES:
- [drive 1]
- [drive 2]

YOUR CONSTRAINTS:
- [constraint 1]
- [constraint 2]
</thinking_context>

USER QUESTION:
{user_input}

Before answering, think through:
1. What context from memory is relevant?
2. What insights do the documents provide?
3. How does this align with my drives/constraints?
4. What's the best response?

Use <thinking>...</thinking> tags. Budget: {THINKING_BUDGET} tokens.
```

### Configuration (.env)

```bash
# Extended Thinking Configuration
THINKING_ENABLED=true                  # Toggle on/off
THINKING_BUDGET=1500                   # Max tokens for thinking
THINKING_MEMORY_DEPTH=5                # Recent memories to include
THINKING_RAG_CONTEXT=true              # Include RAG docs in thinking
```

### Thinking Output in REPL

```
User: What's photosynthesis?

[yeast! thinking...]
> <thinking>
>   Recent memory: User asked about biology yesterday
>   Relevant docs: "photosynthesis.md", "plant_biology.pdf"
>   Self model: I'm knowledge-oriented, prefer detailed answers
>   Let me synthesize from docs + memory...
> </thinking>

> Photosynthesis is the process where plants convert light energy...
```

### Mistral API Specification (Extended Thinking)

**Endpoint**: `http://apollo.local:11434/api/chat` (Ollama API compatible)

**Request** (with thinking budget):
```json
{
  "model": "mistral",
  "messages": [
    {
      "role": "system",
      "content": "<thinking_context>...recent memories, RAG docs, self_model..."
    },
    {
      "role": "user",
      "content": "User question here"
    }
  ],
  "stream": false,
  "temperature": 0.7
}
```

**Response** (streaming or buffered):
```json
{
  "model": "mistral",
  "created_at": "2026-01-08T12:00:00Z",
  "message": {
    "role": "assistant",
    "content": "<thinking>...reasoning...</thinking>\n\nActual response here..."
  },
  "done": true,
  "total_duration": 5000000000,
  "load_duration": 500000000,
  "prompt_eval_count": 150,
  "eval_count": 180,
  "eval_duration": 4000000000
}
```

**Thinking Budget Enforcement** (client-side):
- Count tokens in thinking block: `<thinking>` ... `</thinking>`
- If tokens >= `THINKING_BUDGET`, truncate with `[thinking truncated]`
- Token counting: estimate ~1.3 tokens per word (conservative)

**Token Budget Configuration**:
```bash
THINKING_BUDGET=1500              # Max tokens in thinking block
THINKING_AUTO_TRUNCATE=true       # Auto-truncate if exceeded
```

**Timeout**: 45s per request (configurable via `MISTRAL_TIMEOUT_MS=45000`)

---

## 4. REPL UI Implementation (Interface)

### Technology Stack

- **Framework**: Ink (React-like terminal components)
- **State Management**: Zustand (lightweight, performant)
- **CLI Parsing**: Commander.js (for slash commands)
- **Dev**: Webpack or esbuild (bundle + minify)

### REPL Features

```
┌────────────────────────────────────────┐
│  yeast! v0.4.0 (Phase 4)               │
│  Type /help for commands               │
├────────────────────────────────────────┤
│  > What's your current mood?           │
│                                        │
│  [yeast! thinking...]                  │
│  > <thinking>                          │
│  >   Recent memory: User asked about   │
│  >   goals. I'm optimistic about       │
│  >   memory consolidation...           │
│  > </thinking>                         │
│                                        │
│  I'm in an analytical frame of mind... │
│                                        │
│  Memory updated: episodic (+1)         │
│  ────────────────────────────────────  │
│  > /inspect                            │
│  > Episodic: 42 items (avg decay 0.6) │
│  > Semantic: 18 facts                  │
│  > RAG docs: 5 indexed                 │
│  >                                     │
│  > _                                   │
└────────────────────────────────────────┘
```

### Slash Commands (New)

```bash
/help                  # Show all commands
/inspect               # View memory stats + RAG status
/consolidate           # Manual consolidation
/audit                 # Check identity drift
/thinking [on|off]     # Toggle thinking mode
/rag [on|off]          # Toggle RAG retrieval
/documents list        # Show indexed RAG documents
/documents reload      # Force re-index
/config show           # Show current config
/config set KEY VALUE  # Update config (writes to .env)
/proposal list         # Show pending proposals
/proposal approve ID   # Approve proposal
```

### UI Components (Ink & State Management)

**State Schema** (Zustand):
```javascript
{
  messages: [
    { id, role, content, timestamp, thinking? }
  ],
  inputBuffer: "current text being typed",
  inputCursorPos: 0,
  isThinking: false,
  isFetching: false,
  config: { thinkingEnabled, ragEnabled, ... },
  memory: { episodicCount, semanticCount, ragDocCount }
}
```

**Component Tree & Props**:

```
<App>
  ├── <Header
  │     config={{ thinkingEnabled, ragEnabled }}
  │     memory={{ episodicCount, semanticCount, ragDocCount }}
  │     version="0.4.0"
  │   />
  │
  ├── <ChatWindow
  │     messages={messages}
  │     isLoading={isFetching || isThinking}
  │   >
  │     {messages.map(msg => (
  │       msg.role === 'user' ?
  │         <UserMessage key={msg.id} content={msg.content} /> :
  │         <>
  │           {msg.thinking && <ThinkingBlock content={msg.thinking} />}
  │           <AssistantMessage content={msg.content} />
  │         </>
  │     ))}
  │   </ChatWindow>
  │
  ├── <InputLine
  │     buffer={inputBuffer}
  │     cursorPos={inputCursorPos}
  │     onInput={handleInput}
  │     onSubmit={handleSubmit}
  │     disabled={isThinking || isFetching}
  │   />
  │
  └── <Footer
        hint="/help for commands | Type to chat"
        status={`Memory: ${episodicCount} episodic | ${semanticCount} semantic`}
      />
</App>
```

**Component Implementations**:

- **Header**: Single-line status bar, cyan background, right-aligned
- **ChatWindow**: Scrollable, max 30 visible lines, wraps at terminal width
- **UserMessage**: Indented, bold, no styling
- **AssistantMessage**: Regular, wrapped at terminal width
- **ThinkingBlock**: Dim/grey, indented 2 spaces, bordered with `[thinking]`
- **InputLine**: `> ` prompt, real cursor visible (using Ink's `<TextInput>`)
- **Footer**: Dim, bottom-right corner, truncated if too long

---

## 5. Implementation Roadmap

### Phase 4.1: JavaScript Scaffolding & Memory Migration (Week 1)
- [ ] Set up Node.js project (package.json, tsconfig)
- [ ] Migrate memory stores (load/save JSON)
  - Phase 3 → Phase 4 migration script:
    1. Copy `~/yeast-data/` to `.archives/yeast-data-phase3-backup-TIMESTAMP`
    2. Load all Phase 3 JSON files (episodic, semantic, self_model, reflection)
    3. Validate schema (all required fields present)
    4. Create checksum (SHA256 of all files combined)
    5. Write new Phase 4 schema files (same data, extended with phase4 fields)
    6. Compare checksums (Phase 3 data preserved)
    7. Test rollback (can restore from archive)
- [ ] SSH wrapper for apollo.local communication
  - Implement `apolloClient.js` with connection pooling
  - Test request/response JSON serialization
  - Test error handling (CONNECTION_TIMEOUT, LLM_UNAVAILABLE)
- [ ] Basic REPL scaffold with Ink
  - Bootstrap App component (Header + ChatWindow + InputLine + Footer)
  - Zustand store initialization
  - Keyboard event handling (Enter to submit, Ctrl+C to exit)

### Phase 4.2: RAG Implementation (Week 2)
- [ ] Document extraction (pdf-parse, markdown, text)
- [ ] Ollama embedding integration
- [ ] Embeddings storage + indexing
- [ ] File watcher + hot reload
- [ ] Cosine similarity retrieval

### Phase 4.3: Extended Thinking (Week 2-3)
- [ ] Thinking prompt template + context assembly
- [ ] Mistral integration with thinking budget
- [ ] Streaming thinking output to REPL
- [ ] Budget configuration (.env)

### Phase 4.4: REPL UI & Polish (Week 3)
- [ ] Ink-based REPL with message history
- [ ] Slash commands (/inspect, /rag, /thinking, etc.)
- [ ] Status indicators (thinking, RAG, memory stats)
- [ ] Memory updates display

### Phase 4.5: Testing & Stabilization (Week 4)
- [ ] Jest test suite (memory, RAG, thinking)
- [ ] Integration tests (full conversation flow)
- [ ] Performance benchmarking
- [ ] Documentation (CLAUDE.md, user guide)

---

## 6. File Structure (Phase 4)

```
ai-yeast/
├── src/
│   ├── cli/
│   │   ├── yeast.js              (main entry point)
│   │   ├── repl.js               (Ink REPL app)
│   │   └── commands/
│   │       ├── chat.js
│   │       ├── inspect.js
│   │       ├── consolidate.js
│   │       ├── audit.js
│   │       ├── thinking.js
│   │       ├── rag.js
│   │       └── config.js
│   │
│   ├── agent/
│   │   ├── yeast-agent.js        (runs on apollo via SSH)
│   │   ├── inference.js          (LLM interaction)
│   │   ├── reflection.js         (gates + validation)
│   │   └── proposals.js          (Phase 3 proposals)
│   │
│   ├── memory/
│   │   ├── store.js              (load/save JSON)
│   │   ├── episodic.js           (episodic memory ops)
│   │   ├── semantic.js           (semantic memory ops)
│   │   ├── selfModel.js          (identity management)
│   │   ├── decay.js              (decay calculation)
│   │   └── migration.js          (Phase 3 → Phase 4)
│   │
│   ├── rag/
│   │   ├── ingestion.js          (PDF, MD, text extraction)
│   │   ├── embeddings.js         (Ollama integration)
│   │   ├── retrieval.js          (cosine similarity)
│   │   ├── watcher.js            (fs.watch + hot reload)
│   │   └── index.js              (RAG store management)
│   │
│   ├── thinking/
│   │   ├── promptBuilder.js      (thinking context assembly)
│   │   ├── budgetManager.js      (token budget tracking)
│   │   └── outputFormatter.js    (thinking block rendering)
│   │
│   ├── ssh/
│   │   └── apolloClient.js       (SSH to apollo.local)
│   │
│   └── config.js                 (load .env, defaults)
│
├── tests/
│   ├── memory.test.js
│   ├── rag.test.js
│   ├── thinking.test.js
│   ├── decay.test.js
│   └── integration.test.js
│
├── package.json
├── tsconfig.json                 (optional, TypeScript)
├── .env                          (runtime config)
├── .env.example
│
└── docs/
    ├── PHASE-4.md                (this file's final version)
    ├── RAG-GUIDE.md              (how to use RAG)
    └── THINKING-GUIDE.md         (how thinking works)
```

---

## 7. Key Design Decisions

### Why Whole-File Embeddings (Phase 4)?
- **Simpler**: No chunking logic, one embedding per doc
- **Adequate**: Works well for small-medium docs (< 10KB)
- **Phase 5**: Can upgrade to paragraph-level chunks if needed

### Why Ollama Embeddings?
- **Local**: No external API calls
- **Performant**: nomic-embed-text is small + fast
- **Integrated**: Runs on apollo alongside Mistral

### Why 1500 Token Budget?
- **Balanced**: Enough for multi-step reasoning, not excessive
- **Configurable**: Can tweak via .env for different scenarios
- **Observable**: Token usage logged for analysis

### Why Recent Memories + Top-K RAG?
- **Focused Context**: Avoids token bloat, emphasizes relevance
- **Hybrid Knowledge**: Combines learned experience (memory) + external facts (RAG)
- **Manageable Prompt**: Stays within Mistral's context window

---

## 8. Error Handling Strategy

### SSH Connection Errors

**Scenario**: SSH to apollo.local fails
```
1. Catch: "ECONNREFUSED" / "ETIMEDOUT"
2. Retry logic: exponential backoff (100ms, 200ms, 400ms, 800ms, max 5 retries)
3. User feedback: "[yeast! waiting for apollo.local...]"
4. After 5 retries: Return error response
   {
     "success": false,
     "error": "Cannot connect to apollo.local. Check network/SSH config.",
     "error_code": "CONNECTION_TIMEOUT",
     "recovery": "Try /config show to verify SSH settings"
   }
5. CLI shows: "✗ Connection failed. Re-run to retry."
```

### Ollama Unavailable

**Scenario**: Embedding endpoint or Mistral model not responding
```
1. Catch: 30s timeout on HTTP requests
2. Fallback (for embeddings): Disable RAG gracefully
   - Log: "RAG temporarily unavailable; continuing without docs"
   - RAG_ENABLED = false (in-memory override)
3. Fallback (for thinking): Mistral timeout
   - Cancel thinking, respond without chain-of-thought
   - Message: "[thinking skipped - LLM timeout]"
4. User notification: "⚠ apollo.local unreachable. Check Ollama service."
```

### Memory Corruption

**Scenario**: File write interrupted (power loss, disk full, etc.)
```
1. Atomic writes (temp → rename) prevent partial corruption
2. If rename fails:
   - Detected by file validation on next load
   - Load from backup (if recent enough)
   - Warn user: "Memory recovered from backup. Some recent interactions may be lost."
3. Fallback:
   - Restore from `.archives/` backup
   - Require explicit `/restore backup-name` command
4. Log all recovery attempts with timestamps
```

### RAG Indexing Errors

**Scenario**: PDF parsing fails, embedding generation OOM, etc.
```
1. Per-document error handling:
   - Skip file, log error, continue with others
   - Message: "✗ Skipped file.pdf: PDF parse error"
2. Watcher errors don't crash process:
   - Catch fs.watch errors, restart watcher
   - Exponential backoff for restart (1s, 2s, 4s, then stable)
3. Manual recovery: `/documents reload` re-indexes all files
```

### Thinking Budget Exceeded

**Scenario**: Model generates > 1500 tokens in thinking block
```
1. Client-side truncation:
   - Count tokens as they stream
   - At 1500 tokens, append "[thinking truncated at budget]"
   - Continue to response generation
2. Log: "Thinking budget exceeded: requested 1750, allowed 1500"
3. User sees: Full response, truncated thinking block
4. No error state; graceful degradation
```

### Concurrent Write Collision

**Scenario**: Two queries try to write episodic memory simultaneously
```
1. Memory write queue (FIFO):
   - Query 1 acquires episodic write lock
   - Query 2 waits in queue (non-blocking)
   - Query 1 completes, Query 2 acquires lock
2. Timeout: 5s max wait in queue
   - If timeout exceeded, log warning and skip memory update
   - Response still delivered to user
   - Message in footer: "⚠ Memory update skipped (busy)"
3. No corruption; just potential data loss on very rare concurrent edge case
```

### Config File Corruption

**Scenario**: .env file is malformed
```
1. Load with try/catch on each line parse
2. Skip malformed lines, keep defaults for those keys
3. Log: "Config warning: line 7 skipped (invalid format)"
4. Fallback: all hardcoded defaults activate
5. User can fix manually or use `/config set KEY VALUE`
```

---

## 9. Success Criteria (Phase 4)

- ✅ JavaScript codebase runs on orion (with SSH to apollo)
- ✅ Phase 3 memory fully migrated + accessible
- ✅ RAG documents indexed + searchable (cosine similarity works)
- ✅ File watcher detects new documents, auto-indexes
- ✅ Extended thinking produces coherent chain-of-thought
- ✅ Thinking budget respected (1500 tokens max, configurable)
- ✅ REPL UI responsive + intuitive
- ✅ Slash commands functional (/inspect, /rag, /thinking, etc.)
- ✅ Performance acceptable (< 5s per interaction on orion)
- ✅ Test coverage > 80% (memory, RAG, thinking, reflection)

---

## 10. Known Risks & Mitigations

### Risk 1: Memory Migration Data Loss
**Mitigation**:
- Keep Phase 3 stores as backup in `.archives/`
- Validate data after migration with checksums
- Test migration on copy first

### Risk 2: Embedding Quality (Nomic)
**Mitigation**:
- Nomic is lightweight but decent for retrieval
- Can swap model in Ollama if needed later
- Monitor retrieval quality (log irrelevant results)

### Risk 3: Thinking Output Verbosity
**Mitigation**:
- Configurable budget keeps it bounded
- Thinking block rendered separately (not in response)
- User can toggle thinking on/off per session

### Risk 4: SSH Overhead in REPL
**Mitigation**:
- Connection pooling (keep SSH alive)
- Local caching of recent results
- Async I/O to avoid blocking

### Risk 5: File Watcher Stalls
**Mitigation**:
- Manual `/documents reload` as fallback
- File hash verification (don't re-index unchanged docs)
- Separate watcher process (can be restarted independently)

---

## 11. Phase 4 vs Phase 5+

### Phase 4 (This Plan)
- RAG: whole-file embeddings, simple retrieval
- Thinking: chain-of-thought with memory + top-K docs
- REPL: Ink-based interactive terminal
- Memory: Phase 3 stores migrated, no new features

### Phase 5 (Future)
- RAG: paragraph-level chunking + sliding window
- Thinking: multi-stage reasoning with planning
- Integration: homelab-manager API calls (read-only)
- Population: multi-instance Yeast with shared semantic pool

### Beyond Phase 5
- Autonomous action proposals (soft autonomy)
- External embodiment (system state awareness)
- Population dynamics + learning

---

## 12. Dependencies

### Node.js Packages
- `ink` - Terminal UI
- `commander` - CLI argument parsing
- `zustand` - State management
- `pdf-parse` - PDF extraction
- `gray-matter` - Markdown frontmatter
- `dotenv` - .env loading
- `axios` - HTTP (SSH + Ollama calls)
- `node-ssh` - SSH connection pooling
- `cosine-similarity` - Vector similarity
- `jest` - Testing
- `typescript` (optional) - Type safety

### External (on apollo.local)
- `mistral:7b-instruct` (Ollama)
- `nomic-embed-text` (Ollama)

---

## 13. Next Steps

1. **Review this plan** - Feedback on scope, architecture, timeline?
2. **Lock dependencies** - Finalize package.json
3. **Create scaffolding branch** - `git checkout -b phase-4-javascript-migration`
4. **Start Phase 4.1** - Begin JavaScript migration with existing memory stores

---

**Status**: Awaiting review and approval before implementation begins.
