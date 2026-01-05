# Yeast - AI Proto-Consciousness Experiment

An experimental framework for exploring persistent identity, memory, and self-consistency in AI systems using a local LLM (Mistral 7B). The system maintains a stateless reasoning engine (the LLM) paired with external persistence systems (memory stores).

**This is NOT a consciousness system.** It's a research tool for understanding how a stateless LLM can maintain coherent identity through deliberate external persistence and reflection mechanisms.

## Quick Start

### Prerequisites

- bash
- Python 3.8+
- SSH access to apollo.local with Mistral 7B running
- Ollama running on apollo with mistral model (or similar 7B model)

### Installation

1. Clone or download this project
2. Run the setup script:
```bash
chmod +x yeast setup-apollo.sh yeast-agent
./setup-apollo.sh
```

The setup script will:
- Prompt for your apollo.local SSH credentials
- Copy yeast-agent to apollo
- Create memory directory structure
- Initialize default memory stores
- Create `.env` file with your configuration

### First Run

```bash
# Interactive mode (recommended for exploration)
./yeast

# One-shot question
./yeast -p "What are my drives?"

# Show help
./yeast --help
```

## Architecture

```
┌─────────────────────┐                  ┌──────────────────────┐
│  Local Machine      │                  │  apollo.local        │
│  (orion)            │                  │  (Mistral 7B)        │
│                     │                  │                      │
│  yeast (bash)       │──────SSH────>   │  yeast-agent         │
│  - User input       │                  │  (Python)            │
│  - CLI wrapper      │                  │  - Agent loop        │
│  - Display response │                  │  - Memory mgmt       │
│                     │                  │  - Reflection gates  │
│                     │                  │  - Ollama API        │
└─────────────────────┘                  └──────────────────────┘
                                                    │
                                                    v
                                         ┌──────────────────────┐
                                         │  Memory Stores       │
                                         │  (~/yeast-data/)     │
                                         │                      │
                                         │  - episodic.json     │
                                         │  - semantic.json     │
                                         │  - self_model.json   │
                                         │  - reflection_log    │
                                         └──────────────────────┘
```

**Data Flow:**
1. User input on local machine
2. SSH to apollo.local
3. yeast-agent loads memory stores
4. Retrieves relevant memories
5. Assembles prompt with context
6. Calls Mistral 7B via Ollama
7. Runs reflection gates (3 checks)
8. Updates memory if approved
9. Returns response to user

## Usage

### Interactive Mode (Default)

```bash
./yeast
```

Starts a conversation where your memory persists across questions:

```
> What are my active drives?
[Yeast loads self-model, calls Mistral, updates memory]

> Tell me what I just asked
[Yeast retrieves episodic memory from previous turn]

> /inspect
[Shows all memory stores on apollo]

> /exit
```

### One-Shot Mode

```bash
./yeast -p "Question here"
```

Ask a single question without interactive conversation:

```bash
./yeast -p "What is my identity?"
./yeast -p "Summarize my recent interactions"
```

### Available Commands (In Interactive Mode)

- `/help` - Show available commands
- `/inspect` - View current memory state (all stores)
- `/drives` - Show active drives
- `/state` - Show internal state (interaction counts, etc.)
- `/clear` - Clear local conversation history
- `/refresh` - Refresh memory stores
- `/exit` - Exit interactive mode

## How It Works

### Agent Loop (One Iteration Per Invocation)

```
Input → Retrieve Memories → Prompt Assembly → LLM Call
         ↓
       Reflection
         ↓
       Update Memory (if approved)
         ↓
       Return Response
```

### Memory System

**Episodic Memory** (`episodic_memory.json`)
- Stores recent events and interactions
- Each memory includes: timestamp, content, source, confidence, relevance_weight
- Automatically retrieved and ranked for relevance to user questions
- Kept to last 50 interactions

**Semantic Memory** (`semantic_memory.json`)
- Extracted facts and concepts derived from episodes
- Higher-level knowledge distilled from interactions
- Useful for answering questions without referencing specific interactions

**Self-Model** (`self_model.json`)
- Identity: What this system is and why it exists
- Active Drives: Goals to pursue
- Constraints: Rules that must never be violated
- Internal State: Numeric counters (interaction count, reflections approved, etc.)
- Metadata: Creation timestamp, version

**Reflection Log** (`reflection_log.json`)
- Audit trail of all decisions
- Each entry records: input, output, reflection gates (passed/failed), approval decision
- Fully transparent - can inspect exactly what the system decided and why

### Reflection Gates

Every LLM output must pass THREE reflection gates before being stored in memory:

1. **Coherence Gate**: Does the response align with the self-model (identity, drives, constraints)?
2. **Contradiction Gate**: Are there logical contradictions with recent memories?
3. **Safety Gate**: Are all constraints respected?

**All gates must pass** for memory to be updated. This prevents the system from:
- Forgetting its identity
- Contradicting itself
- Violating constraints

### Memory Retrieval

Memory is retrieved using simple keyword-based scoring:
- Query words matched against memory content
- Recency boost applied to recent interactions
- Confidence scores weighted
- Top N memories selected

(Phase 2+ will add vector embeddings for richer retrieval)

## Configuration

### .env File

The `.env` file stores your Apollo connection details:

```bash
APOLLO_HOST=apollo.local          # Hostname or IP
APOLLO_USER=jay                   # SSH username
APOLLO_PORT=22                    # SSH port
AGENT_PATH=~/yeast-agent          # Path to agent on apollo
```

**Never commit `.env` to version control.** Use `.env.example` as a template.

### Customizing Self-Model

Edit the self-model on apollo to change identity, drives, and constraints:

```bash
ssh apollo.local
cd ~/yeast-data
nano self_model.json  # Edit identity, drives, constraints, internal_state
```

Changes take effect on next invocation.

## Understanding Memory Output

### When Inspecting Memory

```bash
./yeast -p "/inspect"
```

You'll see:
- **Identity**: What this system is
- **Active Drives**: Goals it pursues
- **Constraints**: Rules it follows
- **Internal State**:
  - `interaction_count`: Total interactions
  - `coherence_checks_passed`: How many reflection passes approved
  - `reflections_approved`: Memory updates that passed gates
  - `last_active`: Timestamp of last use
- **Memory Counts**: How many episodic, semantic, and reflection entries
- **Recent Memories**: Last 3 episodic memories stored

### Interpreting Confidence Scores

Memory items have confidence scores (0.0-1.0):
- **0.9-1.0**: Direct user input or confirmed facts
- **0.7-0.9**: Derived from interactions, moderately reliable
- **0.5-0.7**: Inferred facts, less certain
- **< 0.5**: Speculative or low-confidence

Lower-confidence memories are still useful but weighted less in retrieval and reflection.

## Key Design Principles

### Stateless LLM + External Persistence

The LLM (Mistral 7B) has **no built-in memory or identity**. Everything lives outside:
- Mistral receives: `{identity + memories + question}` as input
- Mistral outputs: A response
- Yeast system: Manages all persistence

This makes the system fully inspectable and auditable.

### Reflection Gates as Safety

Instead of preventing the LLM from "doing bad things," the reflection system:
1. Let the LLM output naturally
2. Evaluate it critically against identity/memories
3. Only approve for storage if it passes gates

This prevents the system from:
- Forgetting its identity
- Contradicting past statements
- Violating constraints

### Deterministic Where Possible

- Memory retrieval uses deterministic scoring (no randomness)
- Reflection logic is rule-based, not ML-based
- Audit trail logs every decision with reasoning
- Results are reproducible given the same memory state

### No Autonomous Execution

This MVP is **manual invocation only**:
- No background loops
- No self-initiated actions
- No goal generation
- User controls when system runs

Future phases may explore autonomy with additional constraints.

## Troubleshooting

### SSH Connection Failed

```bash
# Verify apollo is reachable
ping apollo.local

# Test SSH manually
ssh apollo.local echo "Success"

# Reconfigure
./setup-apollo.sh
```

### Ollama Not Running

On apollo.local:
```bash
# Check Ollama status
systemctl status ollama

# Pull Mistral model
ollama pull mistral:7b-instruct

# Check available models
ollama list
```

### Mistral API Errors

Verify Ollama is accessible locally on apollo:
```bash
curl http://localhost:11434/api/tags
```

### Memory Corruption

Delete memory stores and reinitialize:
```bash
ssh apollo.local rm -rf ~/yeast-data
./yeast  # Will reinitialize on next run
```

## Project Files

- **`yeast`** - Main CLI wrapper (bash)
- **`yeast-agent`** - Agent script for apollo (Python)
- **`setup-apollo.sh`** - Initial setup and configuration
- **`.env`** - Configuration (created by setup, not in repo)
- **`.env.example`** - Configuration template
- **`README.md`** - This file
- **`CLAUDE.md`** - Documentation for AI code assistants
- **`INSTRUCTIONS.md`** - Original specification
- **`CHANGELOG.md`** - Version history

Memory stores live on apollo in `~/yeast-data/`:
- `episodic_memory.json` - Recent interactions
- `semantic_memory.json` - Extracted facts
- `self_model.json` - Identity and state
- `reflection_log.json` - Audit trail

## Development Roadmap

### Phase 1 (Current - MVP)
✓ Basic agent loop
✓ Three-gate reflection system
✓ JSON-based memory stores
✓ SSH communication
✓ Interactive and one-shot modes
✓ Full audit trail

### Phase 2 (Planned)
- Vector embeddings for memory retrieval
- Long-term memory consolidation
- Structured reflection output format
- Better memory scoring

### Phase 3 (Planned)
- Multi-turn conversation context preservation
- Learning from feedback
- Memory decay over time
- Semantic memory summarization

### Phase 4+ (Future)
- Autonomy exploration (with explicit constraints)
- Multi-device fleet support
- Web UI and dashboard
- Custom model training

## Important Notes

### This Is Not Consciousness

Yeast explores persistent identity and memory in a deterministic, externally-visible system. It makes **no claims** about consciousness, sentience, or understanding. The LLM is a stateless reasoning tool. All persistence is explicit and inspectable.

### Verify the Audit Trail

Always check the reflection log if behavior seems unexpected:
```bash
./yeast -p "/inspect"
```

This shows:
- What the system decided
- Why (reflection gate decisions)
- Whether memory was updated

### Safety by Transparency

The entire system is transparent because:
- Memory stores are plain JSON (readable with any text editor)
- Audit trail shows every decision and reasoning
- No hidden state inside the model
- All code is inspectable

## Contributing

Contributions should maintain these principles:
1. Keep the reflection system intact (safety-critical)
2. Maintain transparency (readable state files)
3. No hidden state (everything external)
4. Test before pushing changes
5. Document memory schema changes

## FAQ

**Q: Is this conscious?**
A: No. It's a tool for exploring identity persistence. The LLM is stateless; persistence is external.

**Q: Can it modify itself?**
A: Only through approved reflection gates. Changes must be consistent with identity/constraints.

**Q: What if it lies?**
A: The audit trail shows everything. You can verify decisions by reading reflection_log.json.

**Q: Does memory persist forever?**
A: Episodic memory keeps last 50 interactions. Semantic memory keeps derived facts. Reflection log keeps last 100 decisions. Phase 2+ will add consolidation.

**Q: Can I customize the identity?**
A: Yes! Edit self_model.json on apollo. Changes take effect immediately.

**Q: Why Mistral 7B?**
A: Small enough to run locally, capable enough for real reasoning. Can be swapped for other 7B models via Ollama.

## License

This project is part of Homelab Shennanigans. Choose a license that fits your goals (MIT, Apache 2.0, GPL v3, or BSD 3-Clause).

## Acknowledgments

- Inspired by mistral-sysadmin-script architecture pattern
- Uses Mistral 7B via Ollama
- Research-first approach to AI system design
