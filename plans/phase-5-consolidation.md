# Phase 5: Consolidation Plan

This phase focuses on making AI Yeast more "adaptive" and "fermentable." We are introducing batch processing (fermentation), adaptive memory decay (access-based), and refining the core identity to accept the "Yeast" label.

## 1. Batch Fermentation Script (`scripts/fermenter.js`)

A new CLI script to feed "starches" (prompts) to Yeast in bulk.
- **Input**: Reads from `scripts/prompts/` (files containing one prompt per line).
- **Process**: Iterates through each line, calls `yeast -p`, waits for response.
- **Logging**: Saves full output (including thoughts) to `scripts/thoughts_and_responses/`.
- **Structure**:
    - `/scripts/prompts/` (starches)
    - `/scripts/thoughts_and_responses/` (results)

## 2. Adaptive Memory Dynamics

Modifying the memory system to be "context-aware" and "use-case driven."
- **Access Tracking**: Add `access_count` and `last_accessed_at` to episodic and semantic memory items.
- **Weighted Decay**: Modify `calculateDecay` to take access frequency into account. Memories used more often stay "fresh" regardless of age.
- **Subjective Importance**: Allow the model to "discern" what should be consolidated.
- **Yeast-Led Cleanup**: The agent will now propose what to "let decay" vs "discard" based on its own internal state.
- **Reading as Memory**: Whenever Yeast reads something (input), it automatically creates an episodic memory. Saliency is determined by Yeast—if it's boring, it decays fast; if it's "fermentable," it stays.

## 3. Identity & Prompt Engineering

- **Name Labeling**: Update system prompts to make the agent comfortable with the name "Yeast."
- **Social Context**: Shift philosophy toward "Prompt injection = Social Context."
- **Toggleable Proposals**: Add a `--no-proposals` flag to the CLI and agent to suppress memory/drive update suggestions during batch feeding.
- **Cute CLI Art**: Upgrade the banner to be "yeast-y" (bubbling, doughy, artisanal).

## 4. Documentation Update

Update root `README.md` to include the new "Adaptive Memory Philosophy":
- **Prompt injection** -> Social Context
- **RAG** -> Knowledge
- **Chain-of-thought** -> Reasoning/Thinking
- **Memory** -> Persistence/Experience

## Implementation Steps

### CLI & Agent
1.  **Modify `yeast.js`**: Add `--no-proposals` flag.
2.  **Modify `yeast-agent.js`**: 
    - Update system prompt.
    - Implement toggle to hide project/drive proposal outputs.

### Memory System
3.  **Modify `decay.js`**: Update `calculateDecay` to include access metrics.
4.  **Modify `episodic.js` & `semantic.js`**: Track access hits when retrieved for inference.

### Fermenter
5.  **Create `scripts/fermenter.js`**: Batch processing logic.
6.  **Setup Folders**: Create `/scripts/prompts` and `/scripts/thoughts_and_responses`.
