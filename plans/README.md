# Yeast Development Plans

This directory contains detailed development and roadmap plans for the ai-yeast project.

## Current Plans

### [phase-2-remaining-work.md](./phase-2-remaining-work.md)
**Status**: Active (Phase 2 MVP complete, refinements pending)

Covers incomplete features and improvements for Phase 2:
- **Bugs**: Reflection gate reference issue (CRITICAL)
- **Incomplete Features**: Pattern extraction, drift analysis, tension weighting
- **Missing Tests**: Consolidation, decay, drift detection test suites
- **Enhancements**: Vector embeddings, semantic hierarchy, auto-tension
- **Priority Matrix**: What to fix first vs. what can wait

**Time Estimate**: 6-7 hours remaining work
**Critical Path**: Bug fix + decay validation + tension verification

---

### [phase-3-roadmap.md](./phase-3-roadmap.md)
**Status**: Planning (not yet implemented)

Detailed roadmap for Phase 3 and beyond:
- **Phase 3**: Soft autonomy exploration (Q2 2026)
  - Scheduled consolidation suggestions
  - Learning from user feedback
  - Cross-instance divergence analysis
  - Bounded self-modification proposals

- **Phase 4**: Autonomy soft constraints (Q3 2026+)
  - Action proposal system
  - Population dynamics

- **Phase 5**: Multimodal memory & embodiment (Q4 2026+)
  - Homelab integration
  - Embodied state tracking

Also includes:
- Research questions each phase answers
- Safety mechanisms at each level
- Go/no-go criteria before advancing
- Risk analysis and mitigations

**Timeline**: 5 months to complete (Phases 1-5)

---

## Quick Navigation

### For Phase 2 Completion
1. Start with: [phase-2-remaining-work.md](./phase-2-remaining-work.md)
2. Fix: Critical bug (line 603)
3. Test: Decay function, consolidation
4. Validate: Tension weighting
5. Then review [phase-3-roadmap.md](./phase-3-roadmap.md) before deciding on Phase 3

### For Phase 3 Planning
1. Review: [phase-3-roadmap.md](./phase-3-roadmap.md)
2. Understand: What "soft autonomy" means without agency
3. Check: Go/no-go criteria from Phase 2
4. Plan: Implementation timeline

### For Long-Term Vision
1. Read: [phase-3-roadmap.md](./phase-3-roadmap.md) "Phase 4 & 5" sections
2. Understand: Full roadmap through embodiment
3. Reference: Autonomy boundary (what will NEVER be implemented)

---

## Key Decisions & Trade-offs

### Phase 2 Consolidation Threshold
- **Setting**: Decay < 60%
- **Rationale**: Balance between too-frequent and too-rare consolidation
- **Tunable**: Can adjust based on testing results

### Phase 2 Decay Half-Life
- **Setting**: 14 days
- **Rationale**: Creates observable memory fade without being too aggressive
- **Tunable**: Could be 7-21 days depending on use patterns

### Autonomy Boundary
- **Hard limit**: No background execution, no self-initiation
- **Rationale**: Maintains explicit control and safety
- **Enforced**: At every phase level with veto points

---

## Development Status Summary

| Phase | Status | Key Files | Priority |
|-------|--------|-----------|----------|
| **Phase 1** | ✅ Complete | master branch | Done |
| **Phase 2** | 95% Complete | phase-2-memory-depth branch | Fix bugs, test |
| **Phase 3** | 📋 Planned | phase-3-roadmap.md | After Phase 2 stable |
| **Phase 4** | 📋 Outlined | phase-3-roadmap.md | Q3 2026 |
| **Phase 5** | 📋 Outlined | phase-3-roadmap.md | Q4 2026 |

---

## How to Use This Directory

### For Developers
- **Before starting work**: Check relevant plan file for scope
- **During implementation**: Reference plan for success criteria
- **After completion**: Update plan with lessons learned

### For Reviewers
- **Before code review**: Read relevant plan section
- **During review**: Verify implementation matches plan
- **In feedback**: Reference specific plan sections

### For Decision-Making
- **Before approval**: Check go/no-go criteria
- **For prioritization**: See priority matrices in plans
- **For risk assessment**: Review risk mitigation sections

---

## Maintenance

Plans are living documents. Update when:
- [ ] Bugs are found (update phase-2-remaining-work.md)
- [ ] Test results arrive (update success criteria)
- [ ] Timeline changes (update roadmap dates)
- [ ] New insights emerge (add to research questions)

---

## References

- **CLAUDE.md** - Architecture overview
- **PHASE-2.md** - Phase 2 feature documentation
- **CHANGELOG.md** - Release history
- **README.md** - User guide
- **INSTRUCTIONS.md** - Original specification

---

**Last Updated**: 2026-01-06
**Next Review**: After Phase 2 testing completes
