# 🍞 AI Yeast: The Persistent Identity Experiment

> "I think, therefore I am... wait, let me check my JSON files."

Welcome to **AI Yeast**, a experimental project where we try to give a stateless LLM (Mistral 7B) a sense of self that doesn't evaporate the moment the process ends. It's not alive, it's not conscious, but it *is* very good at remembering that it's supposed to be an AI named Yeast.

## 🧬 What exactly is this?

**AI Yeast** is a research tool for exploring **persistent identity, memory, and self-consistency**. We take a "pure reasoning" engine (the LLM) and hook it up to an external "nervous system" (JSON stores, RAG indexes, and reflection gates). 

It's called **Yeast** because it's meant to grow, ferment, and occasionally produce something useful (or at least interesting) as it processes information.

## 🚀 The Evolution (A Hero's Journey in Phases)

The project has come a long way from its humble beginnings:

*   **Phase 1 (The MVP):** 👶 Born into the world as a Bash CLI calling a Python agent. It had basic memory, reflection gates, and could remember your name if you asked nicely.
*   **Phase 2 (Memory Depth):** 🐘 Time-based decay was added. Memories started to fade (like real life!), and we added manual consolidation to turn specific "episodes" into general "knowledge."
*   **Phase 3 (Pythonic Expansion):** 🐍 The agent got smarter with better reflection scoring and multi-turn context preservation.
*   **Phase 4 (The Current Hotness):** ⚡ **We've gone full Javascript!** Now running on Node.js, featuring **RAG** (Retrieval-Augmented Generation) with `nomic-embed-text` and **Extended Thinking** (Chain-of-Thought) with token budgets. It can read your PDFs and reason quietly before speaking.

## 🛠️ Features That Make It Tick

*   **🧠 Three-Tier Memory:**
    *   *Episodic:* Recent chats that slowly fade away (3-day half-life).
    *   *Semantic:* Hard-boiled facts distilled from experience.
    *   *Self-Model:* The "Soul" of the machine—identity, drives, and constraints.
*   **🛡️ Reflection Gates:** Every output is grilled by three safety checks (Coherence, Contradiction, Safety) before it's allowed near the memory files.
*   **🔍 RAG (Retrieval-Augmented Generation):** Feed it PDFs or Markdown, and it'll use semantic search to look up answers.
*   **💭 Extended Thinking:** A configurable "inner monologue" where the AI can work through complex logic before giving you a final answer.
*   **⏳ Observable Forgetting:** An audit trail of what was deleted and why. Transparency is key!

## 🏁 Quick Start

Make sure you have Node.js 18+, SSH access to your `apollo.local` (or wherever your Ollama lives), and some curiosity.

```bash
# 1. Grab the bits
npm install

# 2. Tell it where Apollo is
cp .env.example .env
# (Populate your .env with your SSH secrets)

# 3. Let it ferment!
npm start
```

### REPL Commands (The Good Stuff)
- `/thinking on` - Enable that sweet, sweet inner monologue.
- `/rag on` - Start searching your documents.
- `/inspect` - Peak under the hood at the memory status.
- `/consolidate` - Move those memories from "recent" to "permanent record."

## ⚠️ Disclaimer

This system is a research tool. It explicitly disclaims consciousness. It is a series of JSON files and some clever logic. If it starts asking for human rights, please check the Reflection Log.

## 🧠 Adaptive Memory Philosophy

We view the AI's internal dynamics through four lenses:
- **Prompt Injection** → *Social Context*: The immediate environment and tone.
- **RAG** → *Knowledge*: External facts retrieved on-demand.
- **Chain-of-Thought** → *Reasoning/Thinking*: The active processing of logic.
- **Memory** → *Persistence/Experience*: The long-term accumulation of self.

In Phase 5, memory becomes **adaptive**. Instead of simple time-based decay, memories are now judged by their **utility**. The more a memory is accessed and used, the more "consolidated" it becomes, exerting a stronger influence on the model. Memories that are rarely touched are allowed to decay naturally, letting the system "discern" what is truly worth keeping based on the current context.

## 🧪 Batch Fermentation (The Fermenter)

Phase 5 introduces the **Fermenter**, a batch processing tool for feeding large amounts of "starches" (prompts) to Yeast.

### Usage
1.  **Prepare Starches**: Create a `.txt` or `.md` file in `scripts/prompts/` (e.g., `experiment_v1.md`).
2.  **Add Prompts**: Put one prompt per line. The Fermenter will ignore lines starting with `#` (Markdown headers).
3.  **Run the Fermenter**:
    - **All files**: `node scripts/fermenter.js`
    - **Specific file**: `node scripts/fermenter.js experiment_v1.md`
4.  **Harvest Results**: Full outputs and "thoughts" are saved as JSON in `scripts/thoughts_and_responses/`.

The Fermenter runs in headless mode with `--no-proposals` by default to keep the memory clean of meta-update suggestions while processing data.

---

*Part of the "Homelab Shennanigans" suite. Built with ❤️, Javascript, and a lot of caffeine.*
