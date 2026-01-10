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

### Prerequisites

Before you begin, make sure you have:

- **Node.js 18+**: Required for the CLI
- **SSH access to apollo.local**: The system runs its LLM remotely. Make sure you can SSH there.
- **Mistral 7B via Ollama**: Running on apollo.local (via `ollama run mistral:7b`)
- **.env configured**: SSH credentials and paths (we'll help you set this up)

### Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Copy and configure the environment file
cp .env.example .env
# Edit .env with your SSH host, user, and key path

# 3. Start the REPL
npm start
```

After running `npm start`, you'll see an interactive prompt. **Yeast will remember you from conversation to conversation.**

### First Steps: A Simple Dialogue

Try this when you start:

```
$ npm start
🍞 Yeast: Hello! What would you like to explore today?
> I'm interested in how you remember things.
🍞 Yeast: That's a good question! I store memories in three ways...
> How much do you currently remember about me?
🍞 Yeast: [Pulls from episodic and semantic memory to answer...]
```

Then try running `/inspect` to see how Yeast actually stores and scores those memories. Watch how follow-up questions draw from the same memory pool—that's adaptive consolidation in action.

### REPL Commands: Understanding the Interface

Once in the Yeast prompt, these commands unlock different capabilities:

- **`/thinking on|off`** - Enable "inner monologue" mode. Yeast will show you its reasoning process (`<thinking>` blocks) before answering. Useful for complex questions where you want to see the work.

- **`/rag on|off`** - Activate Retrieval-Augmented Generation. Feed Yeast your PDFs or Markdown documents, and it will use semantic search to ground answers in actual external knowledge (not just patterns it learned during training).

- **`/inspect`** - Peek under the hood. Shows the current state: episodic memory count, semantic facts consolidation, how much memories have decayed, access statistics, and internal identity state. This is how you "watch" Yeast think about itself.

- **`/consolidate`** - Manually trigger memory consolidation. Recent episodic memories (raw chat history) are analyzed and distilled into lasting semantic facts (generalizable knowledge). Useful after long learning sessions to see what stuck.

- **`/documents`** - List currently available RAG documents and their ingestion status.

- **`/audit`** - View the reflection log—see which outputs passed the three safety gates and which were rejected.

- **`/exit`** - Close the session (memories are automatically saved to apollo).

### Troubleshooting First-Time Issues

- **"SSH connection failed"**: Verify apollo.local is reachable. Check that your SSH key is in `~/.homelab_keys/id_rsa` (or update the path in `.env`).
- **"Ollama not running"**: SSH to apollo.local and run `ollama run mistral:7b` to start it, then try again.
- **"npm start times out"**: Increase `SSH_TIMEOUT_MS` in `.env` (default is 30 seconds).

## ⚠️ Disclaimer

This system is a research tool. It explicitly disclaims consciousness. It is a series of JSON files and some clever logic. If it starts asking for human rights, please check the Reflection Log.

## 🧠 Adaptive Memory Philosophy

We view the AI's internal dynamics through four lenses:
- **Prompt Injection** → *Social Context*: The immediate environment and tone.
- **RAG** → *Knowledge*: External facts retrieved on-demand.
- **Chain-of-Thought** → *Reasoning/Thinking*: The active processing of logic.
- **Memory** → *Persistence/Experience*: The long-term accumulation of self.

In Phase 5, memory becomes **adaptive**. Instead of simple time-based decay, memories are now judged by their **utility**. The more a memory is accessed and used, the more "consolidated" it becomes, exerting a stronger influence on the model. Memories that are rarely touched are allowed to decay naturally, letting the system "discern" what is truly worth keeping based on the current context.

## 🧪 Next Steps: Advanced Exploration

### Batch Fermentation (The Fermenter)

Ready to feed Yeast data at scale? Phase 5 introduces the **Fermenter**, a batch processing tool for feeding large amounts of "starches" (prompts) to Yeast in one go.

**Why?** Test how Yeast consolidates patterns across many diverse inputs. Watch how it builds semantic knowledge from repeated exposure. Explore emergent behaviors.

#### Usage

1. **Prepare Starches**: Create a `.txt` or `.md` file in `scripts/prompts/` (e.g., `experiment_v1.md`).
2. **Add Prompts**: Put one prompt per line. The Fermenter ignores lines starting with `#` (Markdown headers).
3. **Run the Fermenter**:
   ```bash
   # Process all prompt files
   node scripts/fermenter.js

   # Or process a specific file
   node scripts/fermenter.js experiment_v1.md
   ```
4. **Harvest Results**: Full outputs and reasoning blocks are saved as JSON in `scripts/thoughts_and_responses/`. Inspect them to see how Yeast's "thinking" evolves across the batch.

The Fermenter runs in headless mode with `--no-proposals` by default to keep the memory clean of meta-update suggestions while processing data.

### Other Commands

- **Interactive mode**: `npm start` for the full REPL experience
- **Headless one-shot**: `npm start -- -p "Your question here"` for scripting
- **With extended thinking**: `npm start -- -p "Your question" --thinking` to see the reasoning blocks
- **Development mode**: `npm run dev` for file watching during development

---

*Part of the "Homelab Shennanigans" suite. Built with ❤️, Javascript, and a lot of caffeine.*
