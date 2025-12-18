import json
import os
import time
from datetime import datetime

class RushedReleaseLoop:
    """
    Handles the 'Rushed Release' decision loop.
    Captures signals, stores them, and generates snapshots.
    """
    def __init__(self, storage_path="admin/brain/loops/data/rushed_release_entries.json"):
        self.storage_path = storage_path
        self.entries = []
        self.pattern_counts = {}
        self._load_data()

    def _load_data(self):
        """Loads entries from disk."""
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r") as f:
                    data = json.load(f)
                    self.entries = data.get("entries", [])
                    self.pattern_counts = data.get("pattern_counts", {})
            except Exception as e:
                print(f"Error loading rushed release data: {e}")
                self.entries = []
                self.pattern_counts = {}

    def _save_data(self):
        """Saves entries to disk."""
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        try:
            with open(self.storage_path, "w") as f:
                json.dump({
                    "entries": self.entries,
                    "pattern_counts": self.pattern_counts
                }, f, indent=2)
        except Exception as e:
            print(f"Error saving rushed release data: {e}")

    def process_ingest(self, data):
        """
        Ingests a new signal payload.
        """
        # Basic validation (could be stricter)
        required = ['user_id', 'event_type', 'context']
        if not all(k in data for k in required):
            raise ValueError(f"Missing required fields: {required}")

        if data['event_type'] == 'meta_update':
            context = data.get('context', {})
            if context.get('action') == 'update_focus':
                # Update Focus in studio-snapshot.md (Mocking for now, could use Librarian)
                # For this demo, we'll just log it and return
                return {'status': 'meta_updated', 'focus': context.get('value')}

        # --- Integration with Classifier Agent ---
        if data['event_type'] == 'optimization_suggested':
            classification = {
                'pattern': 'optimization',
                'confidence': 1.0,
                'reasoning': 'Automated browser optimization suggestion.'
            }
        else:
            from admin.engineers.classifier import classifier
            classification = classifier.classify_signal(data)
        
        # Override confidence if LLM failed or low
        if classification.get('pattern') == 'unknown':
             classification['pattern'] = data.get('pattern_hint', 'unknown')


        # Create Entry
        entry_id = f"entry_{int(time.time())}_{len(self.entries)}"
        entry = {
            'entry_id': entry_id,
            'user_id': data['user_id'],
            'type': data['event_type'],
            'classification': classification,
            'state': {'felt_right': None, 'overrides': 0, 'reviewed': False},
            'context': data['context'],
            'created_at': datetime.utcnow().isoformat()
        }

        self.entries.append(entry)
        
        # Update counts
        # Using the classified pattern, not just the hint
        pattern = classification['pattern']
        self.pattern_counts[pattern] = self.pattern_counts.get(pattern, 0) + 1
        
        self._save_data()
        
        return {'entry_id': entry_id, 'status': 'queued', 'classification': classification}

    def mark_review(self, entry_id, action):
        """
        Marks an entry as reviewed and updates its state.
        """
        for entry in self.entries:
            if entry['entry_id'] == entry_id:
                entry['state']['reviewed'] = True
                entry['state']['felt_right'] = (action == 'yes')
                entry['state']['reviewed_at'] = datetime.utcnow().isoformat()
                self._save_data()
                return {'status': 'success', 'entry_id': entry_id}
        
        raise ValueError(f"Entry {entry_id} not found")

    def get_snapshot(self, user_id):
        """
        Generates a snapshot for the user.
        """
        # Filter user's recent entries
        user_entries = [e for e in self.entries if e['user_id'] == user_id]

        # Build decisions list (unreviewed entries)
        decisions = []
        for e in user_entries:
             if e['state']['reviewed']:
                 continue
                 
             if e['type'] == 'optimization_suggested':
                  decisions.append({
                      'entry_id': e['entry_id'],
                      'pattern': 'optimization',
                      'question': f"Optimize Chrome: Redirect broken link to {os.path.basename(e['context']['suggested_url'])}?",
                      'actions': ['yes', 'no', 'defer'],
                      'meta': {
                          'action_type': 'redirect',
                          'url': e['context']['suggested_url']
                      }
                  })
             else:
                  decisions.append({
                      'entry_id': e['entry_id'],
                      'pattern': e['classification']['pattern'],
                      'question': f"Does this {e['classification']['pattern']} still feel right?",
                      'actions': ['yes', 'no', 'defer']
                  })

        # Compute misalignments (patterns seen > 2x)

        misalignments = [{
            'pattern': pattern,
            'count_this_week': count,
            'suggested_ritual': 'pre_deploy_checklist'
        } for pattern, count in self.pattern_counts.items() if count > 2]

        # Suggest rituals
        rituals = [{
            'name': 'pre_deploy_checklist',
            'prompt': 'Run checklist before next deploy?',
            'actions': ['start', 'skip']
        }]

        return {
            'user_id': user_id,
            'timestamp_ms': int(time.time() * 1000),
            'decisions': decisions,
            'misalignments': misalignments,
            'rituals': rituals
        }

# Singleton instance
rushed_release_loop = RushedReleaseLoop()
