
import sys
from datetime import datetime, timedelta

# Copy of the function from yeast-agent
MEMORY_DECAY_HALF_LIFE_DAYS = 1
def calculate_decay(created_at: str, half_life_days: float = MEMORY_DECAY_HALF_LIFE_DAYS) -> float:
    """
    Calculate memory decay using exponential decay.
    Memory = 1.0 at creation, 0.5 at half_life, approaches 0 over time.
    """
    try:
        created = datetime.fromisoformat(created_at)
        # Use total_seconds for fractional day precision
        age_days = (datetime.now() - created).total_seconds() / 86400.0
        if age_days < 0:
            return 1.0
        decay_factor = 0.5 ** (age_days / half_life_days)
        return max(0.0, min(1.0, decay_factor))
    except:
        return 1.0

def test_decay():
    print("Testing decay function logic...")
    
    now = datetime.now()
    
    # Test 1: Immediate creation
    res = calculate_decay(now.isoformat())
    print(f"Age 0 days: {res}")
    assert abs(res - 1.0) < 0.0001, f"Expected ~1.0, got {res}"
    
    # Test 2: 2 days (half life)
    past_2_days = now - timedelta(days=2)
    res = calculate_decay(past_2_days.isoformat())
    print(f"Age 2 days: {res}")
    # Should be close to 0.5
    assert abs(res - 0.5) < 0.01, f"Expected ~0.5, got {res}"
    
    # Test 3: 4 days (2 half lives) -> 0.25
    past_4_days = now - timedelta(days=4)
    res = calculate_decay(past_4_days.isoformat())
    print(f"Age 4 days: {res}")
    assert abs(res - 0.25) < 0.01, f"Expected ~0.25, got {res}"

    # Test 4: Fractional day (1 day) -> 0.5^(0.5) = sqrt(0.5) = 0.707
    past_1_day = now - timedelta(days=1)
    res = calculate_decay(past_1_day.isoformat())
    print(f"Age 1 day: {res}")
    assert abs(res - 0.707) < 0.01, f"Expected ~0.707, got {res}"

    print("✓ All decay tests passed")

if __name__ == "__main__":
    test_decay()
