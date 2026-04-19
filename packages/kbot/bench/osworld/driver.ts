// OSWorld ActionSpace → kbot bridge
//
// OSWorld agents output pyautogui-style actions. This driver maps them
// to kbot's computer_* tools so we can run the 369-task benchmark.
//
// Status: STUB — signatures locked, implementation pending ACTIONSPACE.md research.

import { executeTool } from '../../src/tools/index.js'

export interface OSWorldAction {
  action_type:
    | 'CLICK'
    | 'DOUBLE_CLICK'
    | 'RIGHT_CLICK'
    | 'TYPING'
    | 'KEY'
    | 'HOTKEY'
    | 'SCROLL'
    | 'DRAG'
    | 'MOVE_TO'
    | 'WAIT'
    | 'SCREENSHOT'
    | 'DONE'
    | 'FAIL'
  x?: number
  y?: number
  text?: string
  key?: string
  keys?: string[]
  dx?: number
  dy?: number
  from?: [number, number]
  to?: [number, number]
  duration?: number
}

export interface ActionResult {
  ok: boolean
  error?: string
  screenshot?: string
}

export async function executeAction(action: OSWorldAction): Promise<ActionResult> {
  try {
    switch (action.action_type) {
      case 'CLICK':
        await executeTool('mouse_click', { x: action.x, y: action.y, button: 'left' })
        return { ok: true }
      case 'DOUBLE_CLICK':
        await executeTool('mouse_click', { x: action.x, y: action.y, button: 'left', double: true })
        return { ok: true }
      case 'RIGHT_CLICK':
        await executeTool('mouse_click', { x: action.x, y: action.y, button: 'right' })
        return { ok: true }
      case 'TYPING':
        await executeTool('keyboard_type', { text: action.text })
        return { ok: true }
      case 'KEY':
        await executeTool('keyboard_key', { key: action.key })
        return { ok: true }
      case 'HOTKEY':
        await executeTool('keyboard_key', { key: (action.keys ?? []).join('+') })
        return { ok: true }
      case 'SCROLL':
        await executeTool('mouse_scroll', { x: action.x, y: action.y, dx: action.dx, dy: action.dy })
        return { ok: true }
      case 'DRAG':
        await executeTool('mouse_drag', {
          from_x: action.from?.[0], from_y: action.from?.[1],
          to_x: action.to?.[0], to_y: action.to?.[1],
        })
        return { ok: true }
      case 'MOVE_TO':
      case 'WAIT':
        await new Promise(r => setTimeout(r, action.duration ?? 500))
        return { ok: true }
      case 'SCREENSHOT': {
        const img = await executeTool('screenshot', {}) as string
        return { ok: true, screenshot: img }
      }
      case 'DONE':
      case 'FAIL':
        return { ok: true }
      default:
        return { ok: false, error: `unknown action: ${(action as any).action_type}` }
    }
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) }
  }
}
