# Phase 2 Remaining Work & Improvements

**Status**: Phase 2 MVP complete. This plan documents incomplete features, bugs, and enhancements.

**Current Branch**: `phase-2-memory-depth`

---

## 1. Bugs & Issues to Fix

### 1.1 Reflection Gate Bug (CRITICAL)
**File**: `yeast-agent`, line 603
**Issue**: References non-existent `gates["consistency"]` instead of `gates["contradiction"]`

```python
# Current (wrong)
gates["consistency"]["score"] = tension.get("consistency", 0.85)

# Should be
gates["contradiction"]["score"] = tension.get("consistency", 0.85)
```

**Fix**: Update line 603 to reference the correct gate. The contradiction gate should be weighted by consistency tension.

---

## 2. Incomplete Features (Partial Implementation)

### 2.1 Memory Consolidation Pattern Extraction
**Status**: Implemented but simplistic

**Current Behavior**:
- Queries Mistral for patterns
- Falls back to simple text truncation if JSON parsing fails
- Doesn't extract multiple patterns effectively

**What's Missing**:
- [ ] Robust pattern extraction from Mistral response
- [ ] Multi-pattern consolidation (extract 3-5 patterns per consolidation)
- [ ] Confidence scoring for patterns based on memory agreement
- [ ] Revision tracking (what did the system believe before vs. now)

**Implementation Path**:
```python
def parse_consolidation_response(response: str) -> Dict:
    """
    Parse Mistral consolidation response more robustly.

    Should extract:
    1. Recurring patterns (what stayed the same?)
    2. Failed predictions (what assumptions broke?)
    3. Evolved beliefs (how did understanding change?)
    4. Confidence per pattern
    """
```

---

### 2.2 Identity Drift Detection Sophistication
**Status**: Implemented but basic

**Current Behavior**:
- Compares current vs. previous snapshot
- Reports severity as single score

**What's Missing**:
- [ ] Multi-snapshot analysis (trend detection)
- [ ] Magnitude vs. direction (is identity drifting or stabilizing?)
- [ ] Constraint-specific drift (which constraints are eroding?)
- [ ] Drive evolution (are drives becoming less coherent?)
- [ ] Confidence metric (how confident are we in the drift assessment?)

**Implementation Path**:
```python
def analyze_identity_trajectory(history: List[Dict]) -> Dict:
    """
    Analyze identity changes across multiple snapshots.

    Returns:
    - drift_trend: increasing, stable, or decreasing
    - volatility: how unstable is the identity?
    - constraint_health: per-constraint stability
    - drive_coherence: how well-aligned are drives?
    - confidence: are we sure about these assessments?
    """
```

---

### 2.3 Internal Tension as Reflection Weights
**Status**: Implemented but not validated

**Current Behavior**:
- Tension values defined in self_model
- Used to score reflection gates

**What's Missing**:
- [ ] Verify tension actually affects gate scoring (test)
- [ ] Tune tension values for meaningful effect (0.4 vs 0.9 should differ)
- [ ] Dynamic tension adjustment (should tension change based on performance?)
- [ ] Tension interpretation guide (what does each tension value mean?)

**Testing Path**:
```bash
# Compare gate scores with different tension values
# Modify self_model/current.json coherence from 0.9 to 0.1
./yeast -p "Question 1"
# Review reflection audits - gate["coherence"]["score"] should differ
```

---

## 3. Missing Automation & Testing

### 3.1 Automated Consolidation Test Suite
**Status**: Not implemented

**What's Needed**:
- [ ] Test framework for consolidation behavior
- [ ] Fixtures: pre-populated episodic memories with varied ages/confidences
- [ ] Consolidation correctness: verify patterns extracted are sensible
- [ ] Forgetting log verification: entries match deleted memories
- [ ] Memory inventory: before/after counts make sense

**Files to Create**:
```
test/
  test_consolidation.py
  fixtures/
    aged_memories.json      # 50 pre-aged memories for testing
    expected_patterns.json   # What we expect consolidation to find
```

---

### 3.2 Automated Drift Detection Test Suite
**Status**: Not implemented

**What's Needed**:
- [ ] Test framework for drift detection
- [ ] Fixtures: identity snapshots with known drift
- [ ] Drift correctness: verify drift detection catches changes
- [ ] False positives: verify stable identity shows 0% drift
- [ ] Severity scoring: verify scale (0.0-1.0) makes sense

**Files to Create**:
```
test/
  test_drift_detection.py
  fixtures/
    identity_stable.json    # No drift expected
    identity_shifted.json   # Clear drift expected
```

---

### 3.3 Decay Function Validation
**Status**: Implemented but not verified

**What's Missing**:
- [ ] Unit test for `calculate_decay()` function
- [ ] Verify formula is mathematically correct
- [ ] Edge cases: negative age, future dates
- [ ] Boundary conditions: age=0 should be 1.0, age=14*days should be ~0.5

**Test Cases**:
```python
assert calculate_decay("2026-01-06T12:00:00", ref_time="2026-01-06T12:00:00") == 1.0  # Now
assert calculate_decay("2025-12-23T12:00:00", ref_time="2026-01-06T12:00:00") ≈ 0.5   # 14 days ago
assert calculate_decay("2025-11-23T12:00:00", ref_time="2026-01-06T12:00:00") ≈ 0.25  # 44 days ago
```

---

## 4. Enhancements (Not MVP Requirements)

### 4.1 Vector Embeddings for Memory Retrieval
**Status**: Not implemented (Phase 1 keyword-based)

**Why Phase 2 Deferred This**:
- Adds complexity without testing consolidation first
- Keyword matching sufficient for MVP validation

**When to Implement**:
- After Phase 2 consolidation is proven stable
- Could be Phase 2.5 or Phase 3

**Implementation Strategy**:
```python
def get_embeddings(text: str) -> List[float]:
    """
    Get embeddings for memory text using local model.
    Options:
    1. Use llama.cpp embedding endpoint
    2. Use sentence-transformers (local)
    3. Use Ollama embedding API (if available in mistral)
    """

def score_memories_semantic(query: str) -> List[Tuple[Memory, float]]:
    """Score memories using cosine similarity on embeddings."""
```

---

### 4.2 Semantic Memory Organization
**Status**: Flat list (not hierarchical)

**Current Limitation**:
- All semantic facts in one list
- No categorization or hierarchy
- Retrieval is keyword-based (same as episodic)

**Possible Improvements**:
- [ ] Categorize semantic facts (factual, procedural, conceptual)
- [ ] Create fact graph/relationships
- [ ] Implement semantic search on categories
- [ ] Summarize similar facts

**When to Implement**: Phase 3 (after consolidation is stable)

---

### 4.3 Automatic Tension Adjustment
**Status**: Static weights (0.9, 0.85, 0.4, 0.5)

**Current Limitation**:
- Tension values hard-coded in self_model
- No mechanism to adjust based on system performance

**Possible Enhancement**:
- [ ] Track reflection gate pass rate
- [ ] If coherence gate fails frequently, increase coherence tension
- [ ] If contradiction gate catches errors, adjust consistency tension
- [ ] Self-calibrating safety system

**When to Implement**: Phase 3+ (after Phase 2 is stable)

---

## 5. Documentation Gaps

### 5.1 Testing Guide
**Status**: PHASE-2.md has manual tests, no automation

**What's Needed**:
- [ ] Pytest/unittest setup for automated tests
- [ ] Instructions for running test suite
- [ ] Coverage report instructions
- [ ] How to add new tests

**File to Create**: `test/README.md`

---

### 5.2 Memory Store Inspection Guide
**Status**: Mentioned but not detailed

**What's Needed**:
- [ ] Commands to inspect each memory tier on apollo
- [ ] How to interpret decay values
- [ ] How to read forgetting log
- [ ] How to inspect identity snapshots
- [ ] Troubleshooting: what to check if behavior is wrong

**File to Create**: `docs/MEMORY-INSPECTION.md`

---

## 6. Known Limitations (By Design)

### 6.1 Consolidation Threshold
**Current**: Decay < 60%

**Trade-off**:
- Too low (e.g., 20%): Consolidates very rarely, episodic memory grows
- Too high (e.g., 80%): Consolidates too aggressively, loses recent detail
- 60% chosen as middle ground

**Could Tune Based On**:
- episodic memory inventory size
- consolidation frequency
- user feedback on memory quality

---

### 6.2 Reflection Gate Weighting
**Current**: Additive (all 3 gates must pass)

**Possible Improvements**:
- [ ] Weighted gates (coherence=50%, contradiction=30%, safety=20%)
- [ ] Context-dependent weighting (some queries need stricter gates)
- [ ] Tension-based weighting (use internal_tension for weights)

---

## 7. Implementation Priority (If Continuing Phase 2)

**HIGH** (fix before shipping):
1. [ ] Bug fix: Reflection gate reference (line 603)
2. [ ] Test decay function mathematically
3. [ ] Test consolidation pattern extraction
4. [ ] Verify tension affects gate scoring

**MEDIUM** (nice to have):
5. [ ] Drift detection multi-snapshot analysis
6. [ ] Consolidation pattern robustness
7. [ ] Automated test suite

**LOW** (Phase 3):
8. [ ] Vector embeddings
9. [ ] Semantic memory hierarchy
10. [ ] Automatic tension adjustment

---

## 8. Recommended Testing Workflow

**Before shipping Phase 2**:

```bash
# 1. Fix the bug
# Edit yeast-agent line 603

# 2. Test decay function
python3 -c "
from yeast_agent import calculate_decay
from datetime import datetime, timedelta

now = datetime.now()
assert calculate_decay(now.isoformat()) == 1.0
assert abs(calculate_decay((now - timedelta(days=14)).isoformat()) - 0.5) < 0.01
print('✓ Decay function validated')
"

# 3. Manual consolidation test
./setup-apollo.sh  # Reset memory
./yeast -p "Topic A discussion"
./yeast -p "Topic A question"
./yeast -p "Topic A observation"
# Manually age memories (or wait 14 days)
# Then consolidate and verify semantic facts created

# 4. Drift detection test
./yeast -p "Who are you?"
# Inspect identity snapshot 1
./yeast audit  # Should show "not enough snapshots"
# Consolidate once
./yeast consolidate
./yeast audit  # Should compare 2 snapshots

# 5. Reflection gate scoring
grep '"coherence"' ~/yeast-data/reflection/audits.json
# Verify scores are populated from tension weights
```

---

## 9. Future Phase References

### Phase 2.5 (Hypothetical)
- Vector embeddings for memory
- Consolidation pattern ML extraction
- Semantic memory graphs

### Phase 3
- Scheduled consolidation (still no autonomy)
- Multi-instance comparison
- Learning from user feedback
- Bounded self-modification proposals

---

## Summary Table

| Item | Status | Priority | Effort | Phase |
|------|--------|----------|--------|-------|
| Fix reflection gate bug | ❌ | HIGH | 5min | 2 |
| Decay function test | ❌ | HIGH | 30min | 2 |
| Consolidation tests | ❌ | MEDIUM | 2hrs | 2 |
| Drift multi-snapshot | ❌ | MEDIUM | 1hr | 2 |
| Tension verification | ❌ | HIGH | 1hr | 2 |
| Vector embeddings | ❌ | LOW | 3hrs | 3 |
| Auto tension adjust | ❌ | LOW | 2hrs | 3 |
| Memory graphs | ❌ | LOW | 4hrs | 3 |

---

**Total Phase 2 remaining**: ~6-7 hours of work
**Critical path**: Bug fix + decay test + tension verification
**Ready to test after**: Decay function validation + bug fix

