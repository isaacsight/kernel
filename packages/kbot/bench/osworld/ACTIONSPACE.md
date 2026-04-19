# OSWorld ActionSpace

Source: xlang-ai/OSWorld `mm_agents/prompts.py` + benchmark docs.

## Action formats (agents emit one of two)

### 1. PyAutoGUI Python (text emission)

```python
pyautogui.click(x, y, button='left', clicks=1)
pyautogui.doubleClick(x, y)
pyautogui.rightClick(x, y)
pyautogui.moveTo(x, y)
pyautogui.drag(x, y, duration=1)
pyautogui.dragTo(x, y, button='left')
pyautogui.typewrite(text)            # or pyautogui.write(text)
pyautogui.press(key)                 # single key
pyautogui.hotkey(k1, k2, ...)        # modifier combos: hotkey('ctrl', 's')
pyautogui.scroll(clicks)             # positive = up
```

Agent outputs a code block; harness `exec`s it.

### 2. Structured JSON (computer_13 / computer_15 variants)

```json
{ "action_type": "CLICK", "x": 512.3, "y": 384.1, "button": "left" }
{ "action_type": "TYPING", "text": "hello world" }
{ "action_type": "HOTKEY", "keys": ["ctrl", "s"] }
{ "action_type": "SCROLL", "x": 500, "y": 500, "dx": 0, "dy": -3 }
{ "action_type": "DRAG", "from": [100,100], "to": [200,200] }
{ "action_type": "SCREENSHOT" }
{ "action_type": "WAIT", "duration": 1000 }
```

`driver.ts` in this repo implements the JSON format — it's easier to validate and we already match it.

## Termination

| Signal | Meaning |
|---|---|
| `DONE` / `agent.done()` | Agent believes task succeeded — harness grades |
| `FAIL` / `agent.fail()` | Agent gives up — counts as fail |
| `WAIT` / `pyautogui.sleep(n)` | Pause before next action |

## Constraints

- `pyautogui.locateCenterOnScreen()` is **banned** — reference images not provided.
- Max steps per task: 15 (configurable, default in `run_multienv.py`).
- Screenshot cadence: one per step, captured by harness after each action.
- Resolution: tasks assume 1280×720 or 1920×1080 depending on VM profile.

## VM environment

- Base: Ubuntu 22.04 VM (VMware or Docker)
- Apps preinstalled: Chrome, LibreOffice (Writer/Calc/Impress), VS Code, GIMP, VLC, Files, Terminal
- 361 runnable tasks + 8 Google Drive tasks that need manual OAuth
- Scoring: each task has `getter`/`evaluator` Python scripts that inspect final state
- Entrypoint: `python run_multienv.py --agent <module> --provider vmware|docker`

## What this means for kbot

1. **We already match format 2** — our `OSWorldAction` interface in `driver.ts` is directly compatible with the JSON variant.
2. **No mac VM** — OSWorld runs only Linux (VMware/Docker). Our driver has to route actions into a headless Ubuntu VM, not the host macOS. That changes the integration point: we call the VM's GUI from outside via SSH + xdotool or noVNC + pyautogui. **Biggest architectural decision**: do we (a) run kbot inside the VM, or (b) run kbot on host and drive VM via SSH?
3. **15-step budget** — kbot's verify-after-action loop must fit inside 15 total actions per task. Budget is tight. Need to count screenshots as steps (or not — need to verify).
4. **Ban on image templating** — kbot's SoM overlay approach is clean (VLM-detected boxes, not pixel templates). No conflict.

## TODO

- [ ] Decide: kbot-in-VM vs kbot-on-host (recommend in-VM — simpler ActionSpace mapping, no SSH latency)
- [ ] Vendor OSWorld's Docker image build scripts
- [ ] Write `run.ts` that loads a task, runs kbot agent with driver, captures trace
- [ ] Measure baseline on first 10 tasks before scaling to 361
