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
        if inspect.iscoroutinefunction(func):
            @functools.wraps(func)
            async def wrapper(*args, **kwargs):
                start_time = time.time()
                result = None
                error = None
                ci = get_collective_intelligence()
                inputs = _extract_inputs(func, *args, **kwargs)

                # 1. Proactive Check
                try:
                    warnings = ci.consult_collective(action_name, str(inputs))
                    if warnings:
                        logger.warning(f"[{action_name}] ⚠️ Collective Advice: {warnings}")
                except Exception:
                    pass

                # Execute the action
                try:
                    result = await func(*args, **kwargs)
                    return result
                except Exception as e:
                    error = e
                    # 2. Reflexive Learning (Failure)
                    try:
                        ci.learn_from_failure(
                            agent_name="Agent",
                            action=action_name,
                            error=str(e),
                            context=inputs
                        )
                    except:
                        pass
                    raise
                finally:
                    # 3. Success Critique (if no error)
                    if not error:
                        _trigger_critique(ci, action_name, inputs, result, start_time)
            return wrapper
        else:
            @functools.wraps(func)
            def wrapper(*args, **kwargs):
                start_time = time.time()
                result = None
                error = None
                ci = get_collective_intelligence()
                inputs = _extract_inputs(func, *args, **kwargs)

                # 1. Proactive Check
                try:
                    warnings = ci.consult_collective(action_name, str(inputs))
                    if warnings:
                        logger.warning(f"[{action_name}] ⚠️ Collective Advice: {warnings}")
                except Exception:
                    pass

                # Execute the action
                try:
                    result = func(*args, **kwargs)
                    return result
                except Exception as e:
                    error = e
                    # 2. Reflexive Learning (Failure)
                    try:
                        ci.learn_from_failure(
                            agent_name="Agent",
                            action=action_name,
                            error=str(e),
                            context=inputs
                        )
                    except:
                        pass
                    raise
                finally:
                    # 3. Success Critique (if no error)
                    if not error:
                        _trigger_critique(ci, action_name, inputs, result, start_time)
            return wrapper
    return decorator

def _extract_inputs(func, *args, **kwargs):
    inputs = {}
    try:
        sig = inspect.signature(func)
        bound_args = sig.bind_partial(*args, **kwargs)
        bound_args.apply_defaults()
        
        for k, v in bound_args.arguments.items():
            if k != 'self' and isinstance(v, (str, int, float, bool, list)):
                if isinstance(v, str) and len(v) > 500:
                    inputs[k] = v[:500] + "..."
                elif isinstance(v, list) and len(v) > 5:
                    inputs[k] = str(v[:5]) + f" and {len(v)-5} more..."
                else:
                    inputs[k] = v
    except:
        pass
    return inputs

def _trigger_critique(ci, action_name, inputs, result, start_time):
    duration = time.time() - start_time
    try:
        ci.critique_action(
            action_name=action_name,
            inputs=inputs,
            result=str(result)[:1000] if result else "None",
            duration=duration,
            error=None
        )
    except Exception as critique_err:
        logger.error(f"Critique mechanism failed: {critique_err}")
