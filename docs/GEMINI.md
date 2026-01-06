# AI Yeast

## Project Overview

**AI Yeast** is an experimental framework for exploring **persistent identity, memory, and self-consistency** using a local LLM (Mistral 7B). It is part of the "Homelab Shennanigans" suite.

**Core Goal:** To understand how a **stateless** LLM can maintain a coherent identity over time through **external persistence** and **reflection mechanisms**. This system explicitly disclaims consciousness or sentience; it is a research tool for grounded AI identity.

**Architecture:**
The system uses a split architecture:
1.  **Local Client (`yeast`)**: A Bash-based CLI wrapper running on the user's machine (e.g., "orion"). It handles user input and display.
2.  **Remote Agent (`yeast-agent`)**: A Python script running on a dedicated host ("apollo.local"). It manages the memory lifecycle, interacts with the LLM (via Ollama), and enforces reflection gates.
3.  **Memory Stores**: JSON files on the remote host that persist the agent's state.

## Key Components

### 1. `yeast` (Local CLI)
The entry point for the user. It connects to the remote agent via SSH.
*   **Interactive Mode:** Provides a REPL-like experience or a menu system.
*   **Headless Mode:** Allows single commands via flags (e.g., `-p`, `--recent`).

### 2. `yeast-agent` (Remote Agent)
The core logic engine residing on `apollo.local`.
*   **Agent Loop:** Input -> Retrieve Memory -> Assemble Prompt -> LLM Inference -> Reflection -> Update Memory.
*   **Reflection Gates:** A 3-stage safety system (Coherence, Contradiction, Safety) that validates every LLM output before it is written to memory.
*   **Memory Management:** Handles retrieval, storage, decay, and consolidation of memories.

### 3. Memory System (JSON)
Stored on the remote host (`~/yeast-data/`):
*   **`episodic_memory.json` / `decayed.json`**: Recent interactions with time-based decay.
*   **`semantic_memory.json` / `distilled.json`**: Extracted facts and long-term knowledge.
*   **`self_model.json`**: Structured identity, drives, and constraints (immutable by the LLM without validation).
*   **`reflection_log.json`**: Audit trail of all decisions and gate results.
*   **`dialogue.json`**: Complete log of all conversation turns.

## Building and Running

### Prerequisites
*   **Local:** Bash, SSH client.
*   **Remote (`apollo.local`):**
    *   Python 3.8+
    *   Ollama running with `mistral:7b-instruct`.
    *   SSH access configured.

### Setup
Run the setup script to deploy the agent and configure the environment:
```bash
./setup-apollo.sh
```
This will:
1.  Copy `yeast-agent` to the remote host.
2.  Initialize the memory directory structure on the remote host.
3.  Create a local `.env` file for configuration.

### Common Commands
*   **Start Interactive Menu:**
    ```bash
    ./yeast
    ```
*   **Start Chat Directly:**
    ```bash
    ./yeast -i
    ```
*   **One-Shot Question:**
    ```bash
    ./yeast -p "What are your active drives?"
    ```
*   **Consolidate Memories (Manual):**
    ```bash
    ./yeast consolidate
    ```
*   **Audit Identity Drift:**
    ```bash
    ./yeast audit
    ```
*   **Download/Backup Memories:**
    ```bash
    ./yeast --download-memories
    ```

### Testing
Use the provided test scripts or manual verification steps (see `PHASE-2-TESTS.md` for full suite):
*   **Verify Connectivity:**
    ```bash
    ssh apollo.local "echo 'Connection OK'"
    ```
*   **Inspect Memory State:**
    ```bash
    ./yeast -p "/inspect"
    ```
*   **View Recent Interactions:**
    ```bash
    ./yeast --recent
    ```

## Development Conventions

*   **Statelessness:** The LLM is treated as a pure reasoning engine. It has no internal state between calls. All context is provided via the prompt from external files.
*   **No Anthropomorphism:** Code and comments must avoid treating the system as "alive" or "feeling." Use technical terms (e.g., "inference," "latency," "gate failure").
*   **Safety First:** The Reflection Gates are critical. **Never** bypass them. All memory updates must be approved by the system's explicit logic.
*   **Transparency:** All state is stored in plain JSON. The system must be fully inspectable and auditable at all times.
*   **Phase 2 Features:**
    *   **Memory Decay:** Memories lose relevance over time (14-day half-life).
    *   **Consolidation:** Episodic memories are compressed into semantic facts to manage context window and long-term retention.

## Key Files

*   `yeast`: Main local CLI script.
*   `yeast-agent`: Core remote agent logic (Python).
*   `setup-apollo.sh`: Deployment and configuration script.
*   `README.md`: User-facing documentation.
*   `PHASE-2.md`: Detailed documentation of the current phase's features.
*   `PHASE-2-TESTS.md`: Comprehensive testing guide.
*   `CLAUDE.md`: Developer context and implementation status.
