# Archive

This directory contains artifacts from earlier phases of yeast development that are no longer actively used in Phase 4.

## phase-3/

Phase 3 contained a Python-based implementation with:

- **yeast-agent** - Python script for running inference on apollo.local (replaced by Node.js version in `src/agent/yeast-agent.js`)
- **yeast** - Python CLI wrapper (replaced by `src/cli/yeast.js`)
- **setup-apollo.sh** - Bash setup script for Phase 3 deployment (may be useful as reference)
- **test_decay.py** - Memory decay testing utilities
- **test_proposals.py** - Self-modification proposal testing
- **__pycache__** - Python bytecode cache

## Phase 4 Changes

Phase 4 migrated to JavaScript/Node.js:

- CLI moved to `src/cli/yeast.js` (Commander.js-based)
- Agent moved to `src/agent/yeast-agent.js` (Node.js with axios)
- Memory system (episodic, semantic, self-model) in `src/memory/`
- RAG pipeline in `src/rag/`
- Extended thinking in `src/thinking/`
- SSH connection pooling in `src/ssh/apolloClient.js`

## Reference

These Phase 3 artifacts are kept for reference if needed to understand earlier design decisions or debug legacy issues.
