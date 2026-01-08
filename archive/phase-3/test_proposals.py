import sys
import os
import json
import uuid
from pathlib import Path
from types import SimpleNamespace

# Load the agent script into a namespace
agent_path = Path(__file__).parent / "yeast-agent"
print(f"Loading agent from: {agent_path}")

with open(agent_path, 'r') as f:
    code = f.read()

# Create a module-like object
yeast_agent = SimpleNamespace()
# Execute the code in a dictionary
agent_globals = {}
exec(code, agent_globals)
# Populate namespace
for k, v in agent_globals.items():
    setattr(yeast_agent, k, v)


def test_extract_proposal():
    print("Testing extract_proposal()...")
    
    # Case 1: Standard markdown block
    response_1 = """
    I understand. I will adjust my tone.
    ```json
    {
      "proposal": {
        "type": "tension_adjustment",
        "reason": "User requested flexibility.",
        "action": {"foo": "bar"}
      }
    }
    ```
    """
    clean_1, prop_1 = yeast_agent.extract_proposal(response_1)
    
    print(f"Clean text: '{clean_1.strip()}'")
    assert "I will adjust my tone" in clean_1
    assert "```json" not in clean_1
    assert prop_1 is not None
    assert prop_1["type"] == "tension_adjustment"
    print("✓ Case 1 passed")

    # Case 2: No proposal
    response_2 = "Just a normal response."
    clean_2, prop_2 = yeast_agent.extract_proposal(response_2)
    assert prop_2 is None
    assert clean_2 == response_2
    print("✓ Case 2 passed")

def test_save_proposal():
    print("Testing save_proposal()...")
    
    # Setup temp file for testing
    test_proposals_file = Path("/tmp/test_yeast_proposals.json")
    if test_proposals_file.exists():
        os.remove(test_proposals_file)
    
    # Monkey patch the file path in the global dict we executed
    agent_globals["PROPOSALS_FILE"] = test_proposals_file
    
    # Initialize file via the module's helper if needed.
    # The agent's save_proposal calls load_json(PROPOSALS_FILE).
    # load_json returns {} if file missing.
    # save_proposal loads, appends, saves.
    
    proposal = {
        "type": "semantic_refinement",
        "reason": "Test",
        "action": {}
    }
    
    # Call the function from the globals dict
    agent_globals["save_proposal"](proposal)
    
    # Verify write
    with open(test_proposals_file, 'r') as f:
        data = json.load(f)
    
    saved = data["pending_proposals"][0]
    print(f"Saved proposal: {saved}")
    
    assert saved["type"] == "semantic_refinement"
    assert saved["status"] == "pending"
    assert "id" in saved
    assert "timestamp" in saved
    
    print("✓ Save passed")
    
    # Cleanup
    if test_proposals_file.exists():
        os.remove(test_proposals_file)

if __name__ == "__main__":
    test_extract_proposal()
    test_save_proposal()