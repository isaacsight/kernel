import sys
import os
import importlib

# Add current dir to path
sys.path.append(os.getcwd())

agents_dir = "admin/engineers"
print(f"Checking agents in {agents_dir}...")

files = [f[:-3] for f in os.listdir(agents_dir) if f.endswith(".py") and f != "__init__.py"]

for module_name in files:
    try:
        module = importlib.import_module(f"admin.engineers.{module_name}")
        print(f"PASS: admin.engineers.{module_name}")
    except Exception as e:
        print(f"FAIL: admin.engineers.{module_name} -> {e}")
