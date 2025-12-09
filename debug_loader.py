import sys
import os
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)

# Modify path so we can import 'core'
sys.path.append(os.getcwd())

from core.plugin_loader import registry

print("Current workings directory:", os.getcwd())
print("Checking directory:", os.path.join(os.getcwd(), "admin/engineers"))

registry.discover_plugins(["admin/engineers"])
print("Loaded agents:", registry.list_agents())

agent = registry.get_agent("The Librarian")
if agent:
    print("Found Librarian!")
else:
    print("Librarian NOT found.")
