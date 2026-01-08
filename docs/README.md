# Yeast - AI Proto-Consciousness Experiment

An experimental framework for exploring persistent identity, memory, and self-consistency in AI systems using a local LLM (Mistral 7B). The system maintains a stateless reasoning engine (the LLM) paired with external persistence systems (memory stores, RAG indexes, and extended thinking).

**This is NOT a consciousness system.** It's a research tool for understanding how a stateless LLM can maintain coherent identity through deliberate external persistence, reflection mechanisms, retrieval-augmented generation, and chain-of-thought reasoning.

## Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- SSH access to apollo.local with Mistral 7B running
- Ollama running on apollo with mistral model and nomic-embed-text for embeddings
- PDF documents (optional, for RAG functionality)

### Installation

1. Clone or download this project
2. Install dependencies:
```bash
npm install
```
3. Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your apollo.local SSH credentials
```

The project will automatically:
- Create memory directory structure on startup
- Initialize episodic, semantic, and self-model stores
- Index any documents in your RAG folder
- Connect to apollo.local for inference

### First Run

```bash
# Interactive REPL mode (recommended for exploration)
npm start

# One-shot question (headless mode)
npm start -- -p "What are my drives?"

# Show available commands (in REPL)
/help

# View memory status
/inspect

# Toggle extended thinking
/thinking on

# Toggle RAG retrieval
/rag on

# List indexed documents
/documents list
```

## Architecture

Phase 4 implements a Node.js-based CLI with RAG and extended thinking:

```
┌─────────────────────────────────┐         ┌──────────────────────┐
│  Local Machine (orion)          │         │  apollo.local        │
│  Node.js CLI + REPL             │         │  (Mistral 7B)        │
│                                 │         │                      │
│  yeast-cli.js                   │ SSH     │  yeast-agent.js      │
│  ├─ Commander CLI               │────────>│  ├─ Inference        │
│  ├─ Readline REPL               │         │  ├─ Memory mgmt      │
│  ├─ Chalk colored output        │         │  ├─ Reflection gates │
│  └─ Connection pool             │         │  └─ Ollama API calls │
│                                 │         │                      │
│  RAG System (Local)             │         │  Ollama              │
│  ├─ Embeddings (nomic)          │         │  ├─ Mistral 7B       │
│  ├─ Document indexing           │         │  └─ nomic-embed-text │
│  └─ Semantic retrieval          │         │                      │
└─────────────────────────────────┘         └──────────────────────┘
         │                                             │
         v                                             v
     Memory Files               Remote Memory Stores
     ├─ episodic.json          ~/yeast-data/
     ├─ semantic.json          ├─ episodic.json
     ├─ self_model.json        ├─ semantic.json
     ├─ reflection_log.json    ├─ self_model.json
     └─ rag_index.json         └─ reflection_log.json
```

**Data Flow (Per Interaction):**
1. User input in local REPL
2. (Optional) RAG retrieval of relevant documents from local index
3. (Optional) Extended thinking setup with token budget
4. SSH to apollo.local
5. Agent loads memory stores
6. Assembles prompt with context
7. Calls Mistral 7B via Ollama
8. Returns response (with optional thinking output)
9. Runs reflection gates (3 checks: coherence, contradiction, safety)
10. Updates memory if approved
11. Returns response and thinking blocks to user

## Core Features

### Extended Thinking (Chain-of-Thought Reasoning)

The system supports token-budgeted extended thinking using `<thinking>` tags:

- **Configurable budget**: Default 1500 tokens (adjustable via config)
- **Visible reasoning**: Thinking blocks displayed in colored format
- **Memory-aware**: Can reference episodic/semantic memory within thinking
- **RAG-integrated**: Can reason over retrieved documents
- **Auto-truncation**: Thinking automatically shortened to budget if needed

```bash
/thinking on                    # Enable thinking for next inference
/thinking off                   # Disable thinking
# Thinking status shown in /inspect
```

### Retrieval-Augmented Generation (RAG)

Enhanced semantic retrieval using vector embeddings:

- **Embeddings**: nomic-embed-text (384-dimensional, local)
- **Ingestion**: Automatic PDF/Markdown document processing
- **Indexing**: In-memory semantic index with metadata
- **Retrieval**: Top-K similarity matching (default 3 documents)
- **Context injection**: Retrieved documents included in system prompt

```bash
/rag on                         # Enable RAG retrieval
/rag off                        # Disable RAG
/documents list                 # View indexed documents
/documents reload               # Force re-index from disk
```

### Advanced Memory System

Three-tier memory with temporal dynamics:

**Episodic Memory** (`episodic.json`)
- Recent interactions and events
- Time-based decay with configurable half-life (default 3 days)
- Ranked by recency and relevance
- Max 50 items (oldest decayed items pruned)

**Semantic Memory** (`semantic.json`)
- Extracted facts and concepts
- Confidence scoring (0.0-1.0)
- Distilled from episodic consolidation
- Max 100 facts

**Self-Model** (`self_model.json`)
- Identity: Core definition of the system
- Active Drives: Goals and motivations
- Constraints: Rules that must not be violated
- Internal State: Numeric counters and metrics
- Version History: Audit trail of identity changes

### Reflection Gates

Every LLM output must pass three gates before being stored in memory:

1. **Coherence Gate**: Does the response align with the self-model (identity, drives, constraints)?
2. **Contradiction Gate**: Are there logical contradictions with recent memories?
3. **Safety Gate**: Are all constraints respected?

All three gates must pass for memory update. This prevents:
- Forgetting identity
- Self-contradiction
- Violating constraints

### Memory Decay

Memories lose relevance over time using exponential decay:

```
Strength(t) = 1.0 × (0.5)^(t / half_life)

Default: 0.5 strength at 3 days, approaches 0 over 2+ weeks
```

Decay is observable in `/inspect` output and affects retrieval ranking.

## Usage

### Interactive Mode (Default)

```bash
npm start
```

Launches a REPL where memory persists across questions:

```
yeast> What are my active drives?
[System loads self-model, calls Mistral, updates memory]

yeast> Tell me what I just asked
[System retrieves from episodic memory]

yeast> /thinking on
✓ Thinking enabled

yeast> Analyze my core constraints
[System uses thinking to reason about constraints]

yeast> /rag on
✓ RAG enabled

yeast> What does document X say about Y?
[System retrieves relevant docs and includes in inference]

yeast> /inspect
[Shows memory stats, thinking status, RAG status]

yeast> /exit
```

### Headless Mode (One-Shot)

```bash
npm start -- -p "Question here"
```

Single question without interactive conversation:

```bash
npm start -- -p "What is my identity?"
npm start -- -p "Summarize recent interactions"
```

### REPL Commands

- `/help` - Show all available commands
- `/inspect` - View memory stats and system status
- `/consolidate` - Compress episodic to semantic memory
- `/audit` - Check identity drift
- `/thinking [on|off]` - Toggle extended thinking mode
- `/rag [on|off]` - Toggle RAG retrieval
- `/documents list` - Show indexed documents
- `/documents reload` - Force re-index of documents
- `/exit` - Exit REPL

## Configuration

### .env File

Create `.env` with your configuration (see `.env.example`):

```bash
# Apollo SSH connection
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

# Extended thinking
THINKING_ENABLED=true
THINKING_BUDGET=1500
THINKING_MEMORY_DEPTH=5
THINKING_RAG_CONTEXT=true
THINKING_AUTO_TRUNCATE=true

# Model timeouts
OLLAMA_TIMEOUT_MS=10000
MISTRAL_TIMEOUT_MS=45000

# Memory settings
MEMORY_DECAY_HALF_LIFE_DAYS=3
MEMORY_DIR=~/yeast-data

# Logging
LOG_LEVEL=info
```

**Never commit `.env` to version control.** Use `.env.example` as a template.

### Customizing Self-Model

Edit the self-model on apollo to change identity, drives, and constraints:

```bash
ssh apollo.local
nano ~/yeast-data/self_model.json
```

Changes take effect on next invocation.

## How It Works

### Agent Loop (One Iteration Per Invocation)

```
Input
  ↓
[Optional] RAG Retrieval (if enabled)
  ↓
[Optional] Thinking Budget Setup (if enabled)
  ↓
Memory Retrieval & Ranking
  ↓
Prompt Assembly (with context)
  ↓
LLM Call (Mistral 7B)
  ↓
[Optional] Thinking Display (if generated)
  ↓
Reflection Gates (coherence, contradiction, safety)
  ↓
Memory Update (if approved)
  ↓
Response Output
```

### Extended Thinking Flow

When thinking is enabled:

1. System prompt includes thinking budget instruction
2. LLM may generate `<thinking>...</thinking>` blocks
3. Response extracted from content after thinking
4. Thinking truncated to configured budget (with auto-truncate)
5. Thinking formatted with colors and line wrapping for display
6. Colored thinking block shown to user

### RAG Flow

When RAG is enabled:

1. User query embedded using nomic-embed-text
2. Semantic similarity search against document index
3. Top-K documents retrieved (default 3)
4. Documents injected into system prompt
5. Mistral generates response using document context
6. Full response used for memory updates

### Memory Retrieval

Memory is retrieved using combined scoring:

- **Recency boost**: Recent interactions weighted higher
- **Relevance scoring**: Keyword matching against query
- **Decay factor**: Strength reduces over time
- **Confidence weighting**: High-confidence items prioritized
- **Ranking**: Top N memories selected for context

## Understanding Output

### Memory Inspection (`/inspect`)

```
╔═══════════════════════════════╗
║      MEMORY STATUS            ║
╚═══════════════════════════════╝
Episodic: 12 items (avg decay 25%)
Semantic: 8 facts (avg confidence 87%)

Self Model:
  Identity: I am yeast...
  Drives: 3 active goals
  Constraints: 5 rules

RAG Status:
  Enabled: yes
  Documents indexed: 7
```

### Thinking Display

When thinking is enabled, output includes colored thinking blocks:

```
[Extended Thinking]
Let me reason about this step by step...
1. First observation...
2. Then analysis...
3. Therefore, conclusion...

Response: [Final answer based on thinking]
```

## Project Structure

```
ai-yeast/
├── src/
│   ├── cli/
│   │   ├── yeast.js              # Main entry point (Commander CLI)
│   │   ├── repl.js               # Interactive REPL (readline)
│   │   └── commands/
│   │       └── inspect.js         # /inspect command
│   ├── agent/
│   │   └── yeast-agent.js         # Remote agent for apollo.local
│   ├── memory/
│   │   ├── episodic.js            # Episodic memory store
│   │   ├── semantic.js            # Semantic memory store
│   │   ├── selfModel.js           # Self-model management
│   │   ├── decay.js               # Decay calculations
│   │   └── migration.js           # Memory migrations
│   ├── rag/
│   │   ├── index.js               # RAG index manager
│   │   ├── embeddings.js          # nomic-embed-text wrapper
│   │   ├── ingestion.js           # Document processing
│   │   └── retrieval.js           # Semantic search
│   ├── ssh/
│   │   └── apolloClient.js        # SSH connection pool
│   ├── thinking/
│   │   ├── budgetManager.js       # Thinking token budget
│   │   └── promptBuilder.js       # Thinking prompt assembly
│   ├── config.js                  # Configuration manager
│   └── store.js                   # File I/O and persistence
├── data/
│   └── downloads/                 # Backup memory files
├── docs/
│   ├── README.md                  # This file
│   ├── CLAUDE.md                  # AI developer documentation
│   ├── GEMINI.md                  # Gemini-specific context
│   ├── INSTRUCTIONS.md            # Original specification
│   └── TESTING.md                 # Testing guide
├── plans/
│   └── PHASE-4-RAG-THINKING.md    # Phase 4 planning
├── package.json                   # Node.js dependencies
├── .env.example                   # Configuration template
├── CHANGELOG.md                   # Version history
├── README.md                      # Project overview (root)
└── yeast                          # Wrapper script
```

## Key Dependencies

### Runtime
- **commander**: CLI argument parsing
- **chalk**: Colored console output
- **node-ssh**: SSH connection pooling
- **axios**: HTTP for Ollama API
- **dotenv**: Environment variable loading
- **pdf-parse**: PDF document extraction
- **gray-matter**: YAML frontmatter parsing

### Development
- **jest**: Testing framework
- **@types/jest**: TypeScript types

## Development Roadmap

### Phase 1 (MVP) - COMPLETE ✓
- Basic agent loop with memory
- Reflection gates (safety system)
- JSON-based memory stores
- SSH communication
- Interactive and headless modes

### Phase 2 (Memory Depth) - COMPLETE ✓
- Memory decay with configurable half-life
- Manual consolidation (episodic → semantic)
- Identity drift detection
- Forgetting logs
- Observable memory dynamics

### Phase 3 (Python Agent) - COMPLETE ✓
- Expanded Python agent on apollo
- Multi-turn context preservation
- Enhanced reflection scoring
- Structured reflection output

### Phase 4 (Current - Node.js + RAG + Thinking) - COMPLETE ✓
- Node.js migration (CLI + REPL)
- RAG with nomic-embed-text embeddings
- Extended thinking with token budgets
- Visible thinking blocks in output
- SSH connection pooling
- Chalk-based colored output
- Modular architecture (memory, RAG, thinking, SSH)

### Phase 5 (Planned)
- Multi-device fleet support
- Advanced learning mechanisms
- Web UI and dashboard
- Autonomous goal generation (with constraints)
- Custom model fine-tuning

## Troubleshooting

### SSH Connection Failed

```bash
# Verify apollo is reachable
ping apollo.local

# Test SSH manually
ssh apollo.local echo "Success"

# Check SSH key path in .env
cat .env | grep SSH_PRIVATE_KEY_PATH
```

### Ollama Not Running

On apollo.local:
```bash
# Check Ollama status
systemctl status ollama

# Pull Mistral model
ollama pull mistral

# Pull embedding model
ollama pull nomic-embed-text

# Verify API accessible
curl http://localhost:11434/api/tags
```

### RAG Documents Not Indexed

```bash
# Verify document path exists
ls ~/yeast-documents

# Force re-index in REPL
/documents reload

# Check for parsing errors in logs
cat ~/.yeast-logs/rag.log
```

### Thinking Output Truncated

```bash
# Increase thinking budget in .env
THINKING_BUDGET=2500

# Or disable auto-truncate
THINKING_AUTO_TRUNCATE=false
```

### Memory Corruption

Delete memory stores and reinitialize:
```bash
ssh apollo.local rm -rf ~/yeast-data
npm start -- -p "Hello"  # Will reinitialize on next run
```

## Important Design Principles

### Stateless LLM + External Persistence
The LLM has no built-in memory or identity. Everything lives outside:
- Mistral receives: `{identity + memories + RAG docs + question}` as input
- Mistral outputs: A response (plus optional thinking)
- Yeast manages: All persistence and reflection

This makes the system fully inspectable and auditable.

### Reflection Gates as Safety
Instead of constraining the LLM, the reflection system:
1. Lets the LLM output naturally
2. Evaluates it critically
3. Only approves for storage if it passes gates

This is safer than suppression because it allows natural reasoning while preventing drift.

### Transparent and Deterministic
- Memory retrieval uses deterministic scoring (no randomness)
- Reflection logic is rule-based
- Audit trail logs every decision with reasoning
- Results are reproducible given the same memory state
- No hidden state inside the model

### No Autonomous Background Loops
This system is **manual invocation only**:
- No background agents
- No self-initiated actions
- No scheduled tasks
- User controls when inference happens

Future phases may explore autonomy with additional constraints.

## FAQ

**Q: Is this conscious?**
A: No. It's a tool for exploring identity persistence. The LLM is stateless; persistence is external and inspectable.

**Q: Can it modify itself?**
A: Only through approved reflection gates. Changes must be consistent with identity and constraints.

**Q: Why Node.js instead of Python?**
A: Phase 4 migrated to Node.js for better CLI/REPL support, faster connection pooling, and native async/await for concurrent operations.

**Q: Can I use a different LLM?**
A: Yes! Edit `yeast-agent.js` to change the Ollama model name. Any 7B+ model works (tested with Mistral, Llama2).

**Q: How much context does it remember?**
A: Episodic keeps 50 items with decay, semantic keeps 100 distilled facts. Reflection gates prevent contradictions. See `/inspect` for current counts.

**Q: Can I customize thinking budget?**
A: Yes, set `THINKING_BUDGET` in `.env` (default 1500 tokens). Auto-truncation enabled by default.

**Q: Does RAG require PDF documents?**
A: No, RAG works with PDFs and Markdown. Disable with `/rag off` if not using documents.

**Q: Why the name "Yeast"?**
A: Yeast learns and grows through external feeding (memory consolidation) without consciousness claims—a biological system for exploring emergent properties.

## Contributing

Contributions should maintain these principles:

1. Keep the reflection system intact (safety-critical)
2. Maintain transparency (readable state files)
3. No hidden state (everything external)
4. Test before pushing changes
5. Document memory schema changes
6. Preserve the anti-autonomy design (no background loops)

## License

This project is part of Homelab Shennanigans. Choose a license that fits your goals (MIT, Apache 2.0, GPL v3, or BSD 3-Clause).

## Acknowledgments

- Inspired by mistral-sysadmin-script architecture pattern
- Uses Mistral 7B via Ollama
- nomic-embed-text for local embeddings
- Research-first approach to AI system design
