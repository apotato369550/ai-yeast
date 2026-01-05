# Changelog

All notable changes to the Yeast AI Proto-Consciousness Framework are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-01-06

### Added (Initial MVP Release)

**Core Agent System**
- Main agent loop: Input → Retrieve → Prompt → LLM → Reflect → Update
- One-iteration-per-invocation design (no autonomy yet)
- SSH-based communication with apollo.local (Mistral 7B)

**Memory System**
- Episodic memory store (recent interactions, last 50 kept)
- Semantic memory store (derived facts and concepts)
- Self-model store (identity, drives, constraints, internal_state)
- Reflection log audit trail (last 100 reflections logged)
- JSON-based persistence for full transparency

**Reflection Gates (Safety System)**
- Coherence gate: Validates alignment with self-model
- Contradiction gate: Detects logical conflicts with recent memories
- Safety gate: Ensures constraints are respected
- All three gates must pass for memory update (no partial updates)

**Memory Retrieval**
- Keyword-based relevance scoring (Phase 1 - no embeddings)
- Recency boost for recent interactions
- Confidence weighting for memory reliability
- Deterministic ranking (no randomness)

**CLI Tools**
- `yeast` - Local bash wrapper for CLI interactions
- `yeast-agent` - Python agent script for apollo.local
- `setup-apollo.sh` - Initial setup and configuration script

**CLI Modes**
- **Interactive mode**: Full conversation with local history, slash commands
- **One-shot mode** (`-p`): Single question for scripting/automation
- **Slash commands**: `/help`, `/inspect`, `/drives`, `/state`, `/clear`, `/exit`

**Configuration**
- `.env` file for apollo connection details
- `.env.example` as template
- Default self-model with sensible constraints

**Documentation**
- `README.md` - Comprehensive user guide
- `CLAUDE.md` - AI developer documentation
- `INSTRUCTIONS.md` - Original technical specification
- This `CHANGELOG.md`

**Features**
- Full audit trail of all decisions
- Transparent memory stores (readable JSON)
- Deterministic behavior (reproducible results)
- SSH-based security (no exposed APIs)
- Error handling and validation

### Known Limitations

**Phase 1 MVP Constraints**
- Memory retrieval uses keyword matching (no embeddings)
- No automatic memory consolidation
- No vector database (plain JSON files)
- No scheduled summarization
- No background autonomy (manual invocation only)
- No goal generation (drives are static)
- No self-learning (can't refine beliefs from feedback)
- Memory kept to last 50 episodes and 100 reflections

**System Requirements**
- Ollama must be running on apollo.local
- Mistral 7B model must be available
- SSH key-based auth required
- Python 3.8+ on apollo
- Bash on local machine

**Reflection Gates**
- Reflection uses simple keyword matching for gate evaluation
- May miss subtle contradictions or coherence issues
- Mistral itself used to evaluate Mistral output (meta-evaluation)

**Testing**
- No automated test suite (Phase 2+)
- Manual verification required
- No continuous integration

### Future Directions (Not Implemented)

**Phase 2**
- Vector embeddings for memory retrieval
- Structured reflection output format (JSON with confidence)
- Long-term memory consolidation
- Memory decay/relevance weighting improvements

**Phase 3**
- Multi-turn conversation context preservation
- Learning from user feedback
- Automatic semantic memory generation
- Better contradiction detection

**Phase 4**
- Autonomy with explicit constraints
- Multi-device fleet management
- Web UI and dashboard
- Custom Ollama model tuning

**Phase 5+**
- Advanced learning mechanisms
- Real-time fleet monitoring
- Automation of low-risk operations
- Integration with system management tools

### Technical Details

**Architecture**
- Local/remote split: Local CLI (bash) + remote agent (Python)
- Communication: SSH + JSON stdin/stdout
- Execution: One-shot per invocation (no daemons)
- Persistence: File-based JSON stores on apollo

**Dependencies**
- Local: bash, ssh, curl
- Apollo: Python 3.8+, Ollama, Mistral 7B

**Performance**
- First run: ~30-60 seconds (includes Mistral inference)
- Subsequent runs: ~20-40 seconds (depends on Mistral)
- Memory operations: < 1 second (JSON parsing/writing)
- Reflection gates: ~15-30 seconds per gate (Mistral inference)

**Security Model**
- SSH-based authentication
- No exposed HTTP APIs
- All state stored locally on apollo
- Reflection gates prevent harmful outputs
- No command execution capability

### Version Information

- **MVP Version**: 0.1.0
- **Release Date**: 2026-01-06
- **Status**: Experimental / Research
- **Python**: 3.8+
- **Bash**: 4.0+
- **LLM**: Mistral 7B (via Ollama)

### Breaking Changes

N/A (First release)

### Bug Fixes

N/A (First release)

### Security

- All network communication via SSH (encrypted)
- No sensitive data in logs
- Reflection gates as safety boundaries
- Audit trail for transparency

### Migration Guide

N/A (First release)

---

## Planned Releases

### 0.2.0 (Q1 2026)
- Vector embeddings for memory
- Structured reflection output
- Automated test suite
- Performance improvements

### 0.3.0 (Q2 2026)
- Multi-turn conversation persistence
- Semantic memory auto-generation
- Advanced reflection gates
- Web UI prototype

### 1.0.0 (Q3 2026+)
- Production-ready stability
- Fleet management support
- Custom model training
- Full test coverage

---

## How to Report Issues

Since this is a research project, issues and improvements can be tracked in:
- Local notes and test results
- Memory audit trails (`reflection_log.json`)
- Console output from debug runs

For systematic issues, please document:
1. Steps to reproduce
2. Expected vs actual behavior
3. Relevant entries from reflection log
4. Memory state (self_model.json, recent episodic_memory.json)

---

## Contributors

- Initial implementation: AI-assisted MVP (2026-01-06)
- Design based on INSTRUCTIONS.md specification
- Architecture inspired by mistral-sysadmin-script patterns
