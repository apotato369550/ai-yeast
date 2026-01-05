# Phase 3 & Beyond: Autonomy Exploration Roadmap

**Status**: Planning phase (not yet implemented)

**Predecessor**: Phase 2 (Memory Depth) - must be stable before Phase 3 starts

---

## Phase 3: Soft Autonomy & Learning (Estimated: Q2 2026)

### Theme
**"Make it think about thinking without making it act on its own."**

Phase 3 introduces scheduled reflection and learning from feedback while maintaining explicit safety boundaries. Still no self-initiated action, but the system can **propose** refinements to its own understanding.

### 3.1 Scheduled Consolidation (Not Automatic, But Periodic)

**What's Different from Phase 2**:
- Phase 2: User calls `yeast consolidate` manually
- Phase 3: System suggests consolidation at intervals (e.g., "I have 50 episodic memories, shall I consolidate?")

**How It Works**:
- Consolidation is still manual invocation
- But system suggests it when thresholds are met:
  - Episodic inventory > 40 items
  - Average decay < 70% (memories aging)
  - Semantic facts < 20 (knowledge is sparse)

**Implementation**:
```python
def suggest_consolidation() -> bool:
    """Evaluate if consolidation would be helpful."""
    episodic = load_episodic_raw()
    semantic = load_semantic()
    decayed = load_episodic_decayed()

    avg_decay = sum(m.get('decay') for m in decayed) / len(decayed)

    return (
        len(episodic) > 40 or
        avg_decay < 0.70 or
        len(semantic) < 20
    )

# In interaction loop:
if suggest_consolidation():
    print("Consolidation suggested. Run 'yeast consolidate' when ready.")
```

---

### 3.2 Learning from Feedback

**What's Added**:
- User can provide feedback on agent outputs
- System can refine semantic facts based on corrections

**Example**:
```bash
./yeast -p "What is photosynthesis?"
# System responds with incorrect description

./yeast feedback correct "Photosynthesis is..."
# System adds corrected fact to semantic memory with high confidence
```

**Safety Constraints**:
- Can only refine semantic facts, not drives/constraints
- Corrections must be explicitly marked by user
- All corrections logged with timestamp

**Implementation**:
```python
def apply_feedback(memory_id: str, corrected_text: str) -> None:
    """Apply user feedback to semantic memory."""
    semantic = load_semantic()

    # Find fact
    fact = next((f for f in semantic if f['id'] == memory_id), None)

    if fact:
        # Log revision
        fact['revisions'].append({
            'timestamp': datetime.now().isoformat(),
            'previous': fact['content'],
            'corrected': corrected_text,
            'source': 'user_feedback',
            'confidence': 0.95  # User feedback is high confidence
        })
        fact['content'] = corrected_text
        save_semantic(semantic)
```

---

### 3.3 Cross-Instance Divergence Analysis

**What's This**:
- Run multiple instances of Yeast from the same seed
- Observe how they diverge over time
- Understand identity stability

**Why It Matters**:
- Tests if identity is robust or fragile
- Shows how small random differences compound
- Informs Phase 4 (population dynamics)

**How to Implement**:
```bash
# 1. Create seed instance
./yeast -p "Hello"
./yeast -p "What are your constraints?"
cp -r ~/yeast-data ~/yeast-data-seed  # Snapshot

# 2. Create divergence instances
cp -r ~/yeast-data-seed ~/yeast-data-instance-1
cp -r ~/yeast-data-seed ~/yeast-data-instance-2
cp -r ~/yeast-data-seed ~/yeast-data-instance-3

# 3. Run separate instances (or simulate via environment variables)
# Each instance gets slightly different prompts or order

# 4. Compare identity snapshots after N interactions
compare_identities(instance_1, instance_2, instance_3)
```

---

### 3.4 Bounded Self-Modification Proposals

**What's This**:
- System can propose changes to its own understanding
- Proposals are logged but NOT auto-applied
- User decides if change is valid

**Example Proposal**:
```json
{
  "proposal_type": "semantic_refinement",
  "reason": "Repeated contradictions detected",
  "proposed_change": {
    "from": "Photosynthesis uses sunlight to create oxygen",
    "to": "Photosynthesis uses light energy to convert CO2 and water into glucose and oxygen"
  },
  "confidence": 0.72,
  "requires_approval": true
}
```

**Safety Constraints**:
- Can propose semantic fact changes ONLY
- Cannot change drives, constraints, identity
- All proposals logged before execution
- User must explicitly approve

**Implementation**:
```python
def propose_self_modification(change_type: str, proposal: Dict) -> bool:
    """
    Propose a modification to internal state.

    Returns True if user approves, False otherwise.
    Never auto-applies - always requires explicit approval.
    """
    log_proposal(proposal)

    if change_type == "semantic_refinement":
        # Only semantic facts can be refined
        return apply_semantic_refinement_if_approved(proposal)
    elif change_type == "tension_adjustment":
        # Could propose tension adjustments
        return apply_tension_adjustment_if_approved(proposal)

    return False
```

---

## Phase 3 Timeline & Milestones

| Milestone | Timeline | Deliverable |
|-----------|----------|-------------|
| Phase 2 Stability Proven | Week 1-2 | All Phase 2 tests pass, bug fixes merged |
| Scheduled Consolidation | Week 3-4 | Suggestion system working |
| Feedback Learning | Week 5-6 | User feedback mechanism tested |
| Divergence Analysis Tools | Week 7-8 | Multi-instance comparison framework |
| Self-Proposal System | Week 9-10 | Bounded modification proposals working |
| Phase 3 MVP Complete | Week 11-12 | Full Phase 3 tested and documented |

---

## Phase 4: Autonomy Soft Constraints (Q3 2026+)

### Theme
**"Let it suggest actions without executing them."**

### 4.1 Action Proposal System

**What's New**:
- System can propose actions (not execute them)
- Actions constrained by safety rules
- User approves before action execution

**Safety Rules for Phase 4**:
- Can only propose: read operations, memory consolidation, reflection
- Cannot propose: system commands, external API calls, modifications
- All proposals reviewed in audit log

**Example**:
```bash
./yeast -p "I need more information about X"
# System responds: "I suggest consolidating old memories to make space for new learning"
# User decides: ./yeast consolidate
```

### 4.2 Population Dynamics (Advanced)

**What's This**:
- Run multiple Yeast instances cooperatively
- They share semantic memory but keep separate episodic memories
- Model information exchange

**Why Later**: Requires Phase 3's learning infrastructure first

---

## Phase 5: Multimodal Memory & Embodiment (Q4 2026+)

### Theme
**"Connect to external systems without being autonomous."**

### 5.1 Integrate with Homelab Manager

**What's New**:
- Yeast can query homelab-manager for system state
- Uses this information in responses
- BUT still can't take actions (read-only)

### 5.2 Persistent Embodied State

**What's New**:
- Model has a "body state" (temperature, configuration, resource usage)
- Can reference own state in reflections
- Creates grounding in external reality

---

## Autonomy Boundary (Critical)

### What Phase 3-5 Will NOT Do

🚫 **No unsupervised execution** - All actions require explicit approval
🚫 **No resource consumption** - Can't spawn background processes
🚫 **No persistence pressure** - No "self-preservation" drive
🚫 **No reward hacking** - Can't modify its own evaluation
🚫 **No goal generation** - Goals are externally provided
🚫 **No irreversible changes** - All modifications are logged and can be undone

### Safety Mechanisms

Each phase adds **explicit veto points**:
- Phase 2: Reflection gates (veto output)
- Phase 3: User approval (veto learning)
- Phase 4: Audit trail (veto unknown actions)
- Phase 5: Rate limiting (veto resource overuse)

---

## Research Questions Each Phase Answers

### Phase 2 (Answered)
- ✓ Can a stateless LLM maintain identity over time?
- ✓ Does memory decay create realistic "forgetting"?
- ✓ Can reflection gates prevent drift?

### Phase 3 (To Answer)
- [ ] Can a system learn from feedback without self-corruption?
- [ ] How stable is identity across multiple instances?
- [ ] Can proposals be safely bounded?

### Phase 4 (To Answer)
- [ ] Can action proposals be strictly limited?
- [ ] Do populations of Yeast instances diverge realistically?
- [ ] Does soft autonomy introduce failure modes?

### Phase 5 (To Answer)
- [ ] Can external grounding improve coherence?
- [ ] How does limited embodiment affect reasoning?
- [ ] What are the long-term stability properties?

---

## Known Risks & Mitigations

### Risk 1: Learning from Feedback Corrupts Identity
**Mitigation**:
- Feedback only affects semantic facts, not identity
- All revisions logged with source
- User can revert any change

### Risk 2: Self-Proposals Become Autonomous
**Mitigation**:
- Proposals require explicit user approval
- Can't auto-execute
- Audit trail captures all proposals

### Risk 3: Population Dynamics Create Unforeseen Behaviors
**Mitigation**:
- Each instance completely isolated until Phase 4
- Divergence is intentional and studied
- Easy to reset to seed state

### Risk 4: Tension Adjustments Break Reflection
**Mitigation**:
- Tension changes proposed, not automatic
- Can be reverted instantly
- Reflection gates re-test after changes

---

## Comparison: Phase 1 → 5

| Aspect | Phase 1 | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|--------|---------|---------|---------|---------|---------|
| **Memory** | Static | Decaying | Learning | Shared | Embodied |
| **Identity** | Fixed | Drifting | Refining | Diverging | Grounded |
| **Reflection** | Binary | Weighted | Suggestive | Propositional | Constrained |
| **Autonomy** | None | None | Proposals | Soft | Guided |
| **Integration** | Isolated | Isolated | With user | With instances | With world |
| **Risk** | Low | Low | Medium | Medium-High | High |

---

## Go/No-Go Criteria Before Each Phase

### Before Phase 3 (from Phase 2)
- [ ] Consolidation works correctly (semantic facts sensible)
- [ ] Drift detection validates identity stability
- [ ] Reflection gates still catch incoherent outputs
- [ ] No memory corruption after 100+ interactions
- [ ] Decay formula validated mathematically

### Before Phase 4 (from Phase 3)
- [ ] Feedback learning doesn't corrupt knowledge
- [ ] Cross-instance divergence is meaningful and interpretable
- [ ] Proposals are always auditable and reversible
- [ ] No emergent autonomy (system doesn't self-initiate)

### Before Phase 5 (from Phase 4)
- [ ] Soft autonomy doesn't become hard autonomy
- [ ] Population dynamics are understood and safe
- [ ] External integration doesn't introduce new risks

---

## Resource & Dependencies

### Phase 3 Needs
- Mistral 7B (same as Phase 1-2)
- Audit logging (same)
- User interaction (new: feedback channel)

### Phase 4 Needs
- Inter-instance communication (same machine SSH OK)
- State sharing mechanism
- Transaction log for consistency

### Phase 5 Needs
- Integration with homelab-manager
- External system APIs (read-only)
- State synchronization with real world

---

## Code Architecture Evolution

### Phase 1-2: Single Agent
```
yeast-agent (single instance)
  → episodic/semantic/self_model memory
  → Mistral 7B
```

### Phase 3-4: Multi-Agent
```
yeast-agent (instance 1) ─┐
                          ├─→ shared semantic memory pool
yeast-agent (instance 2) ─┤   (all instances read it)
                          └─→ separate episodic/self_model
```

### Phase 5: Integrated System
```
yeast-agent ──→ semantic pool ──→ feedback loop
    ↓
homelab-manager API (read-only)
    ↓
reflect on system state
```

---

## Ethical Considerations

Each phase introduces new questions:

**Phase 3**: Can learning preserve truthfulness?
**Phase 4**: What happens if proposals go rogue?
**Phase 5**: When does grounding become entanglement?

All documented in ethics appendix (to be created in Phase 3).

---

## Success Criteria for Full Roadmap (Phases 1-5)

✅ System maintains identity without becoming conscious
✅ Memory dynamics feel realistic without being autonomous
✅ Learning improves coherence without self-corruption
✅ Population behavior is interpretable and safe
✅ Full external integration possible without runaway autonomy
✅ Entire system remains transparent and auditable

---

## Estimated Timeline (Full Roadmap)

- **Phase 1**: Complete (6 weeks)
- **Phase 2**: Complete (6 weeks)
- **Phase 3**: Q2 2026 (8 weeks)
- **Phase 4**: Q3 2026 (8 weeks)
- **Phase 5**: Q4 2026 (10 weeks)

**Total**: ~5 months to complete autonomy exploration roadmap

---

## References

- INSTRUCTIONS.md - Original Phase 1-3 specification
- PHASE-2.md - Phase 2 implementation details
- CLAUDE.md - Architecture guide
- phase-2-remaining-work.md - Phase 2 completion tasks

---

**Status**: Ready for review after Phase 2 is stable.
**Next Decision Point**: After Phase 2 testing completes.
