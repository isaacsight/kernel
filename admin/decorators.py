import functools
import time
import logging
import inspect
from typing import Any, Callable, Optional

from admin.brain.collective_intelligence import get_collective_intelligence

logger = logging.getLogger("CritiqueSystem")

def critique_action(action_name: str, context_provider: Optional[Callable] = None):
    """
    Decorator to automatically self-critique an action after it runs.
    
    Args:
        action_name: Human-readable name of the action (e.g. "Generate Blog Post")
        context_provider: Optional function that extracts extra context from args/kwargs
    """
    def decorator(func: Callable):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            result = None
            error = None
            
            # Execute the action
            try:
                result = func(*args, **kwargs)
                return result
            except Exception as e:
                error = e
                raise
            finally:
                # Always critique, even on failure
                duration = time.time() - start_time
                
                try:
                    # Extract inputs for context
                    inputs = {}
                    # Simple extraction of key args
                    sig = inspect.signature(func)
                    bound_args = sig.bind_partial(*args, **kwargs)
                    bound_args.apply_defaults()
                    
                    for k, v in bound_args.arguments.items():
                        if k != 'self' and isinstance(v, (str, int, float, bool, list)):
                            # Limit size
                            if isinstance(v, str) and len(v) > 500:
                                inputs[k] = v[:500] + "..."
                            elif isinstance(v, list) and len(v) > 5:
                                inputs[k] = str(v[:5]) + f" and {len(v)-5} more..."
                            else:
                                inputs[k] = v
                                
                    # Get CI
                    ci = get_collective_intelligence()
                    
                    # Schedule critique (fire and forget pattern ideally, but we'll do sync for now to ensure learning)
                    # In a high-perf system, this should be a background task
                    ci.critique_action(
                        action_name=action_name,
                        inputs=inputs,
                        result=str(result)[:1000] if result else "None", # Truncate large results
                        duration=duration,
                        error=str(error) if error else None
                    )
                except Exception as critique_err:
                    logger.error(f"Critique mechanism failed: {critique_err}")
                    
        return wrapper
    return decorator
