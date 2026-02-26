// ─── Iteration Canvas: Line-Level Diff Engine ──────────────
//
// Zero-dependency LCS-based diff for comparing artifact versions.
// Used by ArtifactCard to show inline code changes when the user
// iterates on previously generated code.

export interface DiffLine {
  type: 'equal' | 'add' | 'remove'
  content: string
  oldLineNo?: number
  newLineNo?: number
}

/**
 * Simple line-by-line diff using longest common subsequence.
 * Returns an array of DiffLines with add/remove/equal markers.
 */
const MAX_DIFF_LINES = 2000

export function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')

  const m = oldLines.length
  const n = newLines.length

  // Guard: for files over 2000 lines, the O(m*n) DP table would be too large.
  // Fall back to a naive line-by-line comparison (mark all old as removed, all new as added).
  if (m > MAX_DIFF_LINES || n > MAX_DIFF_LINES) {
    const result: DiffLine[] = []
    for (let i = 0; i < m; i++) result.push({ type: 'remove', content: oldLines[i], oldLineNo: i + 1 })
    for (let j = 0; j < n; j++) result.push({ type: 'add', content: newLines[j], newLineNo: j + 1 })
    return result
  }

  // Build LCS table
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to get diff
  const stack: DiffLine[] = []
  let i = m, j = n

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      stack.push({ type: 'equal', content: oldLines[i - 1], oldLineNo: i, newLineNo: j })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      stack.push({ type: 'add', content: newLines[j - 1], newLineNo: j })
      j--
    } else {
      stack.push({ type: 'remove', content: oldLines[i - 1], oldLineNo: i })
      i--
    }
  }

  // Reverse (we built it backwards)
  const result: DiffLine[] = []
  while (stack.length > 0) {
    result.push(stack.pop()!)
  }

  return result
}

/** Count changes in a diff */
export function diffStats(diff: DiffLine[]): { additions: number; removals: number } {
  let additions = 0, removals = 0
  for (const line of diff) {
    if (line.type === 'add') additions++
    if (line.type === 'remove') removals++
  }
  return { additions, removals }
}
