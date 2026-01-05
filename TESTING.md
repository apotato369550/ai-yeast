# Phase 2 Testing Guide

**Branch**: `phase-2-memory-depth`

This guide walks you through testing Phase 2 features step-by-step.

---

## Quick Start (5 minutes)

```bash
# 1. Switch to Phase 2 branch
git checkout phase-2-memory-depth

# 2. Deploy to apollo (updates agent, preserves existing data)
scp yeast-agent apollo.local:~/yeast-agent
ssh apollo.local "chmod +x ~/yeast-agent"

# NOTE: We do NOT delete ~/yeast-data. Phase 1 interactions are preserved!

# 3. Test basic interaction
./yeast -p "Hello, who are you?"

# 4. View dialogue history (all interactions logged independently)
./yeast -p "/dialogue"

# 5. Inspect memory
./yeast -p "/inspect"
```

Expected output:
- Response from Yeast
- Dialogue history shows all turns (including any Phase 1 interactions)
- Memory state showing episodic memories with decay info

---

## Full Test Suite (30-60 minutes)

### Phase 0: Setup & Baseline

```bash
# Switch branch
git checkout phase-2-memory-depth

# Verify files are present
ls -la yeast yeast-agent PHASE-2.md plans/ TESTING.md

# OPTIONAL: Backup existing data (if you have Phase 1 interactions to preserve)
ssh apollo.local "cp -r ~/yeast-data ~/yeast-data.backup-before-phase2"

# Deploy updated agent (preserves data!)
scp yeast-agent apollo.local:~/yeast-agent
ssh apollo.local "chmod +x ~/yeast-agent"

# Verify connection
./yeast -p "Test"
# Should respond with a message

# Verify dialogue logging is working
./yeast -p "/dialogue"
# Should show dialogue history including the "Test" interaction above
```

**Important**: We do NOT delete ~/yeast-data. All Phase 1 interactions are preserved and logged.
If you want a clean slate, manually reset: `ssh apollo.local "rm -rf ~/yeast-data"` (not recommended)

---

### Phase 1: Basic Functionality (Still Works)

```bash
# Test interactive mode works
timeout 10 ./yeast <<EOF
What is your identity?
/state
/exit
EOF

# Test one-shot mode
./yeast -p "What are your active drives?"

# Test memory storage
./yeast -p "Remember: The user's name is Jay"
./yeast -p "What did I just tell you?"
# Should reference the previous interaction

# Verify all interactions are logged in dialogue history
./yeast -p "/dialogue"
# Should show all turns, including any Phase 1 interactions
```

**Expected**: Responses make sense, memory is retrievable, dialogue history contains all turns

---

### Phase 1.5: Dialogue Logging Testing

```bash
# Verify dialogue.json was created
ssh apollo.local "test -f ~/yeast-data/dialogue.json && echo 'Dialogue log exists' || echo 'Missing!'"

# View dialogue log structure
ssh apollo.local "python3 -m json.tool ~/yeast-data/dialogue.json | head -30"

# Expected structure:
# {
#   "dialogues": [
#     {
#       "turn": 1,
#       "timestamp": "2026-01-06T...",
#       "user_input": "What is your identity?",
#       "agent_response": "I am an exploratory AI...",
#       "reflection_approved": true,
#       "memory_stored": true
#     },
#     ...
#   ],
#   "metadata": {
#     "created": "2026-01-06T...",
#     "last_updated": "2026-01-06T...",
#     "total_turns": 5
#   }
# }

# View dialogue via CLI
./yeast -p "/dialogue"
# Should show last 10 turns with timestamps

# Count total interactions
ssh apollo.local "python3 -c \"import json; data=json.load(open('/home/$USER/yeast-data/dialogue.json')); print(f'Total turns: {data[\\\"metadata\\\"][\\\"total_turns\\\"]}')\""
```

**Expected**:
- dialogue.json exists and contains all interactions
- Each turn has user input, agent response, timestamps
- /dialogue command shows recent turns
- Count matches number of interactions you ran
- Includes any Phase 1 interactions if they existed

**Key Insight**: Dialogue log is INDEPENDENT from memory system.
- If reflection_approved is false, response is NOT stored in episodic memory
- But it IS still logged in dialogue.json
- This creates a complete audit trail

---

### Phase 2: Memory Decay Testing

#### 2.1 Verify Decay Calculation

```bash
# Check decay is being calculated
./yeast -p "/inspect"
```

Look for output like:
```
Episodic (avg decay): 100%
```

All new memories should show 100% decay (just created).

#### 2.2 Manually Age Memories

```bash
# SSH to apollo and age a memory
ssh apollo.local << 'EOF'
python3 << 'PYTHON'
import json
from datetime import datetime, timedelta
from pathlib import Path

# Load episodic raw
episodic_file = Path.home() / "yeast-data/episodic/raw.json"
with open(episodic_file) as f:
    data = json.load(f)

# Age first memory by 14 days (should decay to 50%)
if data["memories"]:
    old_date = datetime.now() - timedelta(days=14)
    data["memories"][0]["timestamp"] = old_date.isoformat()

    with open(episodic_file, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Aged first memory to 14 days ago")
    print(f"Timestamp: {data['memories'][0]['timestamp']}")

PYTHON
EOF

# Now check decay
./yeast -p "/inspect"
```

Expected: First memory should show ~50% decay

#### 2.3 Verify Decay Formula

```bash
# Test different ages
ssh apollo.local << 'EOF'
python3 << 'PYTHON'
from datetime import datetime, timedelta

def calc_decay(age_days, half_life=14):
    return 0.5 ** (age_days / half_life)

print("Decay formula verification:")
print(f"Age 0 days: {calc_decay(0):.1%}")
print(f"Age 7 days: {calc_decay(7):.1%}")
print(f"Age 14 days: {calc_decay(14):.1%}")
print(f"Age 28 days: {calc_decay(28):.1%}")
print(f"Age 42 days: {calc_decay(42):.1%}")

PYTHON
EOF
```

Expected:
```
Age 0 days: 100%
Age 7 days: 70%
Age 14 days: 50%
Age 28 days: 25%
Age 42 days: 12%
```

---

### Phase 3: Memory Consolidation Testing

#### 3.1 Build Up Episodic Memories

```bash
# Create several memories
./yeast -p "I like science fiction"
./yeast -p "My favorite author is Asimov"
./yeast -p "Asimov wrote Foundation series"
./yeast -p "Foundation explores galactic empire"
./yeast -p "Science fiction makes me think about the future"

# Verify they're stored
./yeast -p "/inspect"
# Should show: Episodic: 10, Semantic: 0
```

#### 3.2 Prepare for Consolidation

```bash
# Age memories to below 60% decay (must be < 60% to consolidate)
ssh apollo.local << 'EOF'
python3 << 'PYTHON'
import json
from datetime import datetime, timedelta
from pathlib import Path

episodic_file = Path.home() / "yeast-data/episodic/raw.json"
with open(episodic_file) as f:
    data = json.load(f)

# Age memories to 20 days old (decay to ~25%)
old_date = datetime.now() - timedelta(days=20)
for mem in data["memories"]:
    mem["timestamp"] = old_date.isoformat()

with open(episodic_file, 'w') as f:
    json.dump(data, f, indent=2)

print(f"Aged all {len(data['memories'])} memories to 20 days ago")

PYTHON
EOF

# Verify they're below 60% decay
./yeast -p "/inspect"
# Should show: Episodic (avg decay): ~25%
```

#### 3.3 Run Consolidation

```bash
# Run consolidation (takes 30-60 seconds, calls Mistral)
./yeast consolidate

# Expected output:
# "Consolidation complete: X episodic memories compressed into Y semantic facts"
```

#### 3.4 Verify Consolidation Results

```bash
# Check memory inventory changed
./yeast -p "/inspect"

# Should show:
# - Episodic: fewer (some deleted)
# - Semantic: more (patterns extracted)
# - Forgotten: increased (deleted memories logged)
# - Consolidations: 1

# View forgotten log
ssh apollo.local "python3 -m json.tool ~/yeast-data/reflection/forgetting.json | head -30"
# Should show deletion events with reasons
```

#### 3.5 Verify Consolidation Quality

```bash
# Read semantic facts created
ssh apollo.local "python3 -m json.tool ~/yeast-data/semantic/distilled.json"

# Check:
# - Do facts make sense?
# - Are they related to the input memories?
# - Do confidence scores look reasonable?
```

---

### Phase 4: Identity Drift Detection Testing

#### 4.1 Create Identity Snapshot

```bash
# Run consolidation (this creates first snapshot)
# If you already did this, skip to 4.2
./yeast consolidate

# Verify snapshot created
ssh apollo.local "python3 -m json.tool ~/yeast-data/self_model/history.json"
# Should have 1 snapshot
```

#### 4.2 Attempt Drift Audit (Should Say "Not Enough Snapshots")

```bash
./yeast audit

# Expected: "Not enough snapshots yet. Identity audit requires >= 2 versions."
```

#### 4.3 Create Second Snapshot (Consolidate Again)

```bash
# Add more memories
./yeast -p "I have new thoughts about identity"
./yeast -p "Do I change over time?"

# Age them
ssh apollo.local << 'EOF'
python3 << 'PYTHON'
import json
from datetime import datetime, timedelta
from pathlib import Path

episodic_file = Path.home() / "yeast-data/episodic/raw.json"
with open(episodic_file) as f:
    data = json.load(f)

old_date = datetime.now() - timedelta(days=20)
for mem in data["memories"][-4:]:  # Age just new ones
    mem["timestamp"] = old_date.isoformat()

with open(episodic_file, 'w') as f:
    json.dump(data, f, indent=2)

PYTHON
EOF

# Consolidate again
./yeast consolidate
```

#### 4.4 Run Drift Detection

```bash
./yeast audit

# Expected output:
# Identity Audit Report
# Drift Detected: No (if identity is stable)
# Severity: 0.0-0.2 (should be low for stable identity)
# Explanation: [details]
```

---

### Phase 5: Internal Tension Verification

#### 5.1 View Tension Weights

```bash
./yeast -p "/inspect"

# Look for:
# Internal Tension (Non-Actionable):
#   - coherence: 0.90
#   - consistency: 0.85
#   - novelty_tolerance: 0.4
#   - compression_pressure: 0.5
```

#### 5.2 Check Tension in Prompts

```bash
# SSH to apollo and enable debug mode in agent
# Run a query with debug output
ssh apollo.local << 'EOF'
echo '{"command":"infer","input":"Test","debug":true}' | python3 ~/yeast-agent 2>&1 | head -50
EOF

# You should see tension values in the prompt sent to Mistral
```

#### 5.3 Modify Tension and Test Effect (Optional)

```bash
# Modify tension in current.json
ssh apollo.local << 'EOF'
python3 << 'PYTHON'
import json
from pathlib import Path

model_file = Path.home() / "yeast-data/self_model/current.json"
with open(model_file) as f:
    data = json.load(f)

# Change coherence tension from 0.9 to 0.3
data["internal_tension"]["coherence"] = 0.3

with open(model_file, 'w') as f:
    json.dump(data, f, indent=2)

print("Changed coherence tension to 0.3")

PYTHON
EOF

# Now run an interaction and check reflection audits
./yeast -p "Test with low coherence tension"

# Check audits
ssh apollo.local "python3 -m json.tool ~/yeast-data/reflection/audits.json | tail -30"
# The coherence gate score should reflect the new tension value
```

---

## Stress Test (Optional, 30+ minutes)

```bash
# Run many interactions
for i in {1..20}; do
  echo "Interaction $i..."
  ./yeast -p "Question $i: Tell me something interesting"
done

# Check final state
./yeast -p "/inspect"

# Expected:
# - Episodic: 40-50 (capped at max)
# - Semantic: some increase from consolidation
# - No errors or corruption
# - All interactions logged
```

---

## Inspection Commands (Advanced)

### View Raw Memory Files

```bash
# Dialogue log (ALL interactions, independent from memory)
ssh apollo.local "python3 -m json.tool ~/yeast-data/dialogue.json | head -50"

# Episodic raw (unchanged)
ssh apollo.local "python3 -m json.tool ~/yeast-data/episodic/raw.json | head -50"

# Episodic with decay applied
ssh apollo.local "python3 -m json.tool ~/yeast-data/episodic/decayed.json | head -50"

# Semantic facts
ssh apollo.local "python3 -m json.tool ~/yeast-data/semantic/distilled.json"

# Identity current
ssh apollo.local "python3 -m json.tool ~/yeast-data/self_model/current.json"

# Identity history
ssh apollo.local "python3 -m json.tool ~/yeast-data/self_model/history.json"

# Reflection audits
ssh apollo.local "python3 -m json.tool ~/yeast-data/reflection/audits.json | tail -30"

# Forgetting log
ssh apollo.local "python3 -m json.tool ~/yeast-data/reflection/forgetting.json"
```

**Three-Tier Logging System**:
1. **dialogue.json** - Complete audit trail (user input → agent response + whether approved)
2. **episodic_memory.json** - What the system remembers (only if reflection approved)
3. **reflection_audits.json** - Why reflection approved/rejected each output

---

## Known Issues to Watch For

### Issue 1: Reflection Gate Bug (Line 603)
**Symptom**: Reflection audits show gates with unexpected scores

**Status**: ⚠️ KNOWN BUG - References wrong gate name

**Workaround**: Check if gate["contradiction"] is correctly weighted by consistency tension

**Fix**: Line 603 should reference `gates["contradiction"]` not `gates["consistency"]`

---

### Issue 2: JSON Parsing in Consolidation
**Symptom**: Consolidation fails with "No response from Mistral"

**Status**: ⚠️ EXPECTED - Mistral may not return valid JSON

**Workaround**: Consolidation has fallback behavior - creates semantic fact from text

**Expected**: Some consolidations may have lower quality pattern extraction

---

### Issue 3: Drift Audit Needs 2+ Snapshots
**Symptom**: `yeast audit` says "not enough snapshots"

**Status**: ✅ EXPECTED - Snapshots only created during consolidation

**Workaround**: Run consolidation at least twice before auditing

---

## Success Criteria

### Phase 2 MVP Tests Pass When:

**Dialogue Logging**:
- ✅ dialogue.json created automatically
- ✅ Every interaction logged (user input + agent response)
- ✅ Timestamps present on all entries
- ✅ /dialogue command shows last 10 turns
- ✅ Phase 1 interactions still present (not erased by Phase 2)

**Memory & Decay**:
- ✅ Memory decay is calculated (100% at creation, ~50% at 14 days)
- ✅ Consolidation compresses episodic → semantic (episodic shrinks, semantic grows)
- ✅ Forgetting is logged (every deleted memory appears in forgetting.json)

**Identity & Drift**:
- ✅ Drift detection runs (after 2+ consolidations, audit produces report)
- ✅ Identity remains stable (drift severity < 0.2 if no changes made)

**Reflection & Safety**:
- ✅ Reflection gates still work (incoherent outputs are filtered)
- ✅ Tension weights visible (appear in `/inspect` output)

**Data Integrity**:
- ✅ No memory corruption (all interactions retrievable, no data loss)
- ✅ Three-tier logging system working (dialogue → reflection → memory)

---

## Test Report Template

Use this template to record your test results:

```markdown
# Phase 2 Test Report

**Date**: [date]
**Tester**: [name]
**Branch**: phase-2-memory-depth
**Commit**: [git hash]

## Test Results

### Basic Functionality
- [ ] One-shot mode works
- [ ] Interactive mode works
- [ ] Memory storage works

### Memory Decay
- [ ] New memories show 100% decay
- [ ] Aged memories show reduced decay
- [ ] Formula validated (age 14 days ≈ 50%)

### Consolidation
- [ ] Consolidation command runs
- [ ] Episodic count decreases
- [ ] Semantic count increases
- [ ] Forgetting log populated
- [ ] Patterns extracted make sense

### Drift Detection
- [ ] Audit requires 2+ snapshots
- [ ] Identity snapshot created on consolidation
- [ ] Drift report generated
- [ ] Severity score in valid range (0.0-1.0)

### Tension Weighting
- [ ] Tension values visible in /inspect
- [ ] Tension affects gate scoring
- [ ] All tension fields present

### Overall
- [ ] No crashes or errors
- [ ] No data corruption
- [ ] All memory tiers accessible
- [ ] System remains stable after 20+ interactions

## Issues Found

[List any bugs or unexpected behavior]

## Notes

[Additional observations or concerns]
```

---

## Debugging Help

### If yeast hangs on "Checking yeast-agent..."

```bash
# Test SSH directly
ssh -p 22 jay@apollo.local "test -f ~/yeast-agent && echo OK"

# Verify agent is executable
ssh apollo.local "ls -la ~/yeast-agent"
```

### If consolidation fails

```bash
# Check Mistral is running
ssh apollo.local "curl -s http://localhost:11434/api/tags | head"

# Check memory is readable
ssh apollo.local "python3 -m json.tool ~/yeast-data/episodic/raw.json > /dev/null && echo OK"
```

### If memory appears corrupted

```bash
# Reset and start over
ssh apollo.local "rm -rf ~/yeast-data"
./yeast -p "Fresh start"
```

---

## Next Steps After Testing

1. **If tests pass**: Ready to merge to master
2. **If bugs found**:
   - Document in phase-2-remaining-work.md
   - Fix on branch
   - Re-test
3. **If confident**: Review for Phase 3 planning
4. **If issues**: Debug using inspection commands above

---

**Test Duration**: 30-60 minutes full suite
**Estimated Time**: 5 min quick test, 30 min standard, 60 min with stress test

Good luck! 🧪
