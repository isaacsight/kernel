// macOS Accessibility tree reader.
//
// Uses AppleScript System Events to walk the AX hierarchy of the frontmost
// app and return elements with their coordinates and roles. Top OSWorld
// scorers combine this with screenshots for grounding — pixel-only agents
// plateau around 40%.
//
// Status: STUB. Plan:
//   1. Query frontmost process + its windows
//   2. Recursively walk AXUIElement tree (role, title, position, size, enabled)
//   3. Return a flat list of addressable elements for SoM overlay

import { execFileSync } from 'node:child_process'

export interface AXElement {
  role: string          // AXButton, AXTextField, AXWindow, ...
  title?: string
  value?: string
  x: number
  y: number
  w: number
  h: number
  enabled: boolean
  children?: AXElement[]
}

export function frontmostApp(): string {
  const out = execFileSync('osascript', [
    '-e', 'tell application "System Events" to get name of first process whose frontmost is true',
  ], { encoding: 'utf8', timeout: 3000 })
  return out.trim()
}

export function readAXTree(_app?: string): AXElement[] {
  // TODO: implement via osascript that walks UI elements of frontmost process.
  // AppleScript example (to be productionised):
  //   tell application "System Events"
  //     tell process "Safari"
  //       set ui to entire contents of window 1
  //     end tell
  //   end tell
  // Returns a linear list which we enrich with position/size via AXPosition/AXSize.
  throw new Error('axtree.readAXTree: not implemented yet')
}
