# ai-yeast

**Experimental framework for exploring persistent identity, memory, and self-consistency in AI systems.**

A local CLI that communicates with Mistral 7B to explore how a stateless LLM can maintain coherent identity through external persistence systems.

## Quick Start

```bash
# Interactive menu mode
./yeast

# One-shot question (headless)
./yeast -p "What are your active drives?"

# Initial setup (deploy to apollo.local)
./yeast --setup

# Management commands
./yeast consolidate    # Compress episodic → semantic memory
./yeast audit          # Check for identity drift
```

## Documentation

- **[User Guide](docs/README.md)** - How to use yeast
- **[Developer Guide](docs/CLAUDE.md)** - Architecture and implementation
- **[Phase 2 Features](docs/PHASE-2/FEATURES.md)** - Memory decay, consolidation, forgetting
- **[Phase 2 Testing](docs/PHASE-2/TEST_GUIDE.md)** - Complete test suite
- **[Original Spec](docs/INSTRUCTIONS.md)** - Phase 1 requirements
- **[Changelog](CHANGELOG.md)** - Version history

## Project Structure

```
ai-yeast/
├── yeast                 (Root-level wrapper script)
├── .env                  (Configuration - keep private!)
├── .env.example          (Configuration template)
├── CHANGELOG.md          (Version history)
├── data/
│   └── downloads/        (Memory backups from apollo)
├── src/
│   ├── yeast            (Main CLI implementation)
│   ├── yeast-agent      (Python agent on apollo.local)
│   └── setup-apollo.sh  (Deployment script)
├── docs/
│   ├── README.md         (Documentation index)
│   ├── CLAUDE.md         (Developer guide)
│   ├── GEMINI.md         (Gemini layer)
│   ├── INSTRUCTIONS.md   (Original specification)
│   ├── TESTING.md        (Testing guide)
│   └── PHASE-2/
│       ├── FEATURES.md   (Phase 2 features & design)
│       └── TEST_GUIDE.md (Phase 2 comprehensive tests)
├── plans/
│   ├── phase-2-remaining-work.md
│   ├── phase-3-roadmap.md
│   └── README.md
└── .archives/
    └── yeast-backup-*   (Old backups)
```

## What is Yeast?

**yeast** is an exploration of:
- How a **stateless LLM** can maintain **coherent identity** across interactions
- **Time-asymmetric memory** with decay and consolidation
- **Observable forgetting** through explicit deletion logs
- **Safety gates** that filter incoherent outputs before storage

**NOT:**
- A consciousness claim
- An autonomous agent
- A goal-seeking system
- A magic solution to AI alignment

## Phase 2 Features (Current)

- ✅ **Time-based memory decay** (14-day exponential half-life)
- ✅ **Memory consolidation** (compress episodic facts into semantic knowledge)
- ✅ **Observable forgetting** (audit trail of what was deleted and why)
- ✅ **Identity drift detection** (version history + comparison)
- ✅ **Internal tension weights** (non-actionable evaluative metrics)
- ✅ **Complete dialogue logging** (independent from memory system)

## Status

- **Phase 1 (MVP)**: ✅ Complete - Basic identity and memory
- **Phase 2 (Memory Depth)**: ✅ Complete - Time, decay, consolidation
- **Phase 3 (Learning)**: 🚧 Planned - Scheduled reflection, cross-instance divergence

## For Developers

See [docs/CLAUDE.md](docs/CLAUDE.md) for:
- Architecture overview
- Memory system design
- Reflection gates and safety
- Development workflow
- Testing approach

## Getting Help

- `./yeast --help` - Show command help
- `/help` - In-app command reference
- [docs/PHASE-2/TEST_GUIDE.md](docs/PHASE-2/TEST_GUIDE.md) - Detailed testing walkthrough

---

**Remember**: This is an experiment, not a consciousness. All state lives in files. Everything is inspectable.
