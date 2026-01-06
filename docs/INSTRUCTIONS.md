🔹 SYSTEM / TASK PROMPT (MVP v0.1)

You are a senior systems engineer and AI researcher.

Your task is to design and implement an MVP framework for a persistent cognitive agent using a local LLM (7B-class).
This system is NOT conscious and makes no claims of sentience.
The goal is to explore persistent identity, memory, and self-consistency over time in a grounded, inspectable way.

🎯 Design Goals (Non-Negotiable)

The LLM is treated as a stateless reasoning engine, not an agent.

All persistence, identity, and memory live outside the model.

The system must be:

deterministic where possible

auditable

incrementally extensible

Anthropomorphic language is strictly avoided in code and comments.

🧱 MVP Scope (Phase 1)

Implement only the following components:

1. Core Agent Loop

Input → Memory Retrieval → Prompt Assembly → LLM Call → Reflection → Memory Update

One iteration per invocation (no background autonomy yet)

2. Memory System (Minimal)

Implement three memory stores:

episodic_memory.json – recent events & interactions

semantic_memory.json – extracted facts / concepts

self_model.json – structured identity & state

Each memory item must include:

timestamp

source

confidence score

decay / relevance weight

3. Self-Model (Structured, Immutable by Default)

A JSON schema with fields like:

identity (static string)

active_drives (list)

constraints (list)

internal_state (numeric values only)

The LLM may propose changes, but a separate validation function decides whether to apply them.

4. Reflection Pass (Critical)

After each LLM output:

Run a second evaluation pass that checks:

coherence with self_model

contradictions with recent memory

usefulness toward active drives

Only after reflection may memory be written.

5. No Autonomy Yet

No background loops

No goal generation

No self-initiated actions

This is a manual invocation MVP.

🧠 Implementation Constraints

Use Python

Use plain files (JSON / SQLite)

No external frameworks unless strictly necessary

No vector DB in Phase 1 (simulate retrieval with recency + relevance scoring)

Every major function must be small, named, and testable

📦 Deliverables

A clear folder structure

A runnable main.py

Memory schemas

Prompt templates (as .txt or .md)

Inline comments explaining why each part exists

A short README.md explaining:

what this system is

what it is not

how to extend it safely

🛑 Explicitly Forbidden

Free-form self-modification

Emotional language in code

Hidden state inside the model

🧪 Success Criteria

This MVP is successful if:

The agent maintains consistent identity across runs

Past interactions influence future responses

Incoherent outputs are filtered before memory storage

The system remains understandable when inspected

🔄 After MVP (Do NOT implement yet)

Future phases may include:

Vector retrieval

Long-term memory consolidation

Scheduled summarization

Goal tension modeling

But do not implement them now.

Begin by:

Proposing the folder structure

Defining memory schemas

Writing the main agent loop pseudocode

Then implementing the MVP

Proceed step by step. Do not skip design reasoning.