import sys
from pathlib import Path

# Ensure the project root is on the path for module resolution during testing.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
