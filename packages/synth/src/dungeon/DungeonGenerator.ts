import type { FloorData, RoomData, RoomType, Vec2 } from '../types'
import { createRoom, carveDoor } from './Room'

// ── BSP Tree Dungeon Generator ──

interface BSPNode {
  x: number
  y: number
  width: number
  height: number
  left?: BSPNode
  right?: BSPNode
  room?: { x: number; y: number; width: number; height: number }
  roomIndex?: number
}

/** Random integer in [min, max] inclusive */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

/** Shuffle an array in place (Fisher-Yates) */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = randInt(0, i)
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// ── BSP Partition ──

const MIN_PARTITION_SIZE = 35
const MIN_ROOM_WIDTH = 22
const MAX_ROOM_WIDTH = 32
const MIN_ROOM_HEIGHT = 16
const MAX_ROOM_HEIGHT = 24
const BOSS_ROOM_WIDTH = 32
const BOSS_ROOM_HEIGHT = 26

function splitBSP(node: BSPNode, depth: number): void {
  if (depth <= 0) return
  if (node.width < MIN_PARTITION_SIZE * 2 && node.height < MIN_PARTITION_SIZE * 2) return

  // Decide split direction based on aspect ratio
  const splitHorizontal =
    node.width > node.height * 1.25 ? false :
    node.height > node.width * 1.25 ? true :
    Math.random() > 0.5

  if (splitHorizontal) {
    if (node.height < MIN_PARTITION_SIZE * 2) return
    const splitAt = randInt(MIN_PARTITION_SIZE, node.height - MIN_PARTITION_SIZE)
    node.left = { x: node.x, y: node.y, width: node.width, height: splitAt }
    node.right = { x: node.x, y: node.y + splitAt, width: node.width, height: node.height - splitAt }
  } else {
    if (node.width < MIN_PARTITION_SIZE * 2) return
    const splitAt = randInt(MIN_PARTITION_SIZE, node.width - MIN_PARTITION_SIZE)
    node.left = { x: node.x, y: node.y, width: splitAt, height: node.height }
    node.right = { x: node.x + splitAt, y: node.y, width: node.width - splitAt, height: node.height }
  }

  splitBSP(node.left, depth - 1)
  splitBSP(node.right, depth - 1)
}

/** Collect all leaf nodes from BSP tree */
function getLeaves(node: BSPNode): BSPNode[] {
  if (!node.left && !node.right) return [node]
  const leaves: BSPNode[] = []
  if (node.left) leaves.push(...getLeaves(node.left))
  if (node.right) leaves.push(...getLeaves(node.right))
  return leaves
}

/** Get the center point of a BSP node's room (or partition center if no room) */
function getCenter(node: BSPNode): Vec2 {
  if (node.room) {
    return {
      x: node.room.x + Math.floor(node.room.width / 2),
      y: node.room.y + Math.floor(node.room.height / 2),
    }
  }
  return {
    x: node.x + Math.floor(node.width / 2),
    y: node.y + Math.floor(node.height / 2),
  }
}

/** Find connections between sibling partitions in the BSP tree */
function findConnections(node: BSPNode): Array<{ leftLeaf: BSPNode; rightLeaf: BSPNode }> {
  if (!node.left || !node.right) return []
  const connections: Array<{ leftLeaf: BSPNode; rightLeaf: BSPNode }> = []

  // Connect one leaf from the left subtree to one leaf from the right subtree
  const leftLeaves = getLeaves(node.left)
  const rightLeaves = getLeaves(node.right)

  // Find the closest pair
  let bestDist = Infinity
  let bestLeft = leftLeaves[0]
  let bestRight = rightLeaves[0]

  for (const ll of leftLeaves) {
    for (const rl of rightLeaves) {
      const lc = getCenter(ll)
      const rc = getCenter(rl)
      const dist = Math.abs(lc.x - rc.x) + Math.abs(lc.y - rc.y)
      if (dist < bestDist) {
        bestDist = dist
        bestLeft = ll
        bestRight = rl
      }
    }
  }

  connections.push({ leftLeaf: bestLeft, rightLeaf: bestRight })

  // Recurse into subtrees
  connections.push(...findConnections(node.left))
  connections.push(...findConnections(node.right))

  return connections
}

// ── Room Type Assignment ──

function assignRoomTypes(count: number, floorNumber: number): RoomType[] {
  const types: RoomType[] = new Array(count).fill('arena')

  // Last room is always boss
  types[count - 1] = 'boss'

  // 1-2 treasure rooms on non-start, non-boss positions
  const treasureCount = Math.min(randInt(1, 2), count - 2)
  const candidates = Array.from({ length: count - 2 }, (_, i) => i + 1) // skip index 0 (start) and last (boss)
  shuffle(candidates)

  for (let i = 0; i < treasureCount; i++) {
    types[candidates[i]] = 'treasure'
  }

  // Scale with floor number — more arenas on higher floors
  void floorNumber

  return types
}

// ── Path Validation ──

/** BFS to verify path exists from start to boss room */
function hasPath(connections: Array<{ from: number; to: number }>, start: number, end: number, roomCount: number): boolean {
  const adj: Set<number>[] = Array.from({ length: roomCount }, () => new Set<number>())
  for (const c of connections) {
    adj[c.from].add(c.to)
    adj[c.to].add(c.from)
  }

  const visited = new Set<number>()
  const queue = [start]
  visited.add(start)

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === end) return true
    for (const neighbor of adj[current]) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return false
}

/** Determine which wall direction connects two rooms based on their positions */
function getConnectionDirection(from: BSPNode, to: BSPNode): {
  fromDir: 'north' | 'south' | 'east' | 'west'
  toDir: 'north' | 'south' | 'east' | 'west'
} {
  const fc = getCenter(from)
  const tc = getCenter(to)
  const dx = tc.x - fc.x
  const dy = tc.y - fc.y

  if (Math.abs(dx) > Math.abs(dy)) {
    // Horizontal connection
    return dx > 0
      ? { fromDir: 'east', toDir: 'west' }
      : { fromDir: 'west', toDir: 'east' }
  } else {
    // Vertical connection
    return dy > 0
      ? { fromDir: 'south', toDir: 'north' }
      : { fromDir: 'north', toDir: 'south' }
  }
}

// ── Main Generator ──

/**
 * Generate a dungeon floor using Binary Space Partitioning.
 *
 * Produces 5-7 connected rooms with guaranteed path from start to boss.
 * Room dimensions: 15-25 tiles wide, 10-18 tiles tall.
 * Corridors: 3-tile-wide passages connecting rooms.
 */
export function generateFloor(floorNumber: number): FloorData {
  const targetRoomCount = randInt(5, 7)

  // BSP partition space
  // Total space needs to accommodate rooms + corridors
  const totalWidth = 200
  const totalHeight = 150
  const root: BSPNode = { x: 0, y: 0, width: totalWidth, height: totalHeight }

  // Split depth determines number of leaves (roughly 2^depth)
  // depth 3 gives ~8 leaves max, we trim to 5-7
  splitBSP(root, 3)

  let leaves = getLeaves(root)

  // Trim leaves to target count
  if (leaves.length > targetRoomCount) {
    shuffle(leaves)
    leaves = leaves.slice(0, targetRoomCount)
  }

  // If we got fewer leaves than target, that is acceptable (minimum 4)
  if (leaves.length < 4) {
    // Fallback: create a linear chain of rooms
    leaves = []
    for (let i = 0; i < targetRoomCount; i++) {
      leaves.push({
        x: i * 40,
        y: 0,
        width: 30,
        height: 30,
      })
    }
  }

  const roomCount = leaves.length

  // Assign room types
  const roomTypes = assignRoomTypes(roomCount, floorNumber)

  // Create room data for each leaf
  const rooms: RoomData[] = []
  for (let i = 0; i < roomCount; i++) {
    const type = roomTypes[i]
    let w: number
    let h: number

    if (type === 'boss') {
      w = BOSS_ROOM_WIDTH
      h = BOSS_ROOM_HEIGHT
    } else if (type === 'treasure') {
      w = randInt(MIN_ROOM_WIDTH, 18)
      h = randInt(MIN_ROOM_HEIGHT, 13)
    } else {
      w = randInt(MIN_ROOM_WIDTH, MAX_ROOM_WIDTH)
      h = randInt(MIN_ROOM_HEIGHT, MAX_ROOM_HEIGHT)
    }

    const room = createRoom(type, w, h)
    rooms.push(room)

    // Assign BSP spatial info for connection calculations
    leaves[i].room = {
      x: leaves[i].x + Math.floor((leaves[i].width - w) / 2),
      y: leaves[i].y + Math.floor((leaves[i].height - h) / 2),
      width: w,
      height: h,
    }
    leaves[i].roomIndex = i
  }

  // Find connections from BSP structure
  const bspConnections = findConnections(root)

  // Build connection list (referencing room indices)
  const connections: Array<{ from: number; to: number }> = []

  for (const conn of bspConnections) {
    const fromIdx = conn.leftLeaf.roomIndex
    const toIdx = conn.rightLeaf.roomIndex
    if (fromIdx !== undefined && toIdx !== undefined) {
      connections.push({ from: fromIdx, to: toIdx })
    }
  }

  // Ensure all rooms are connected by adding edges for any isolated rooms
  const connected = new Set<number>()
  if (connections.length > 0) {
    // BFS from room 0
    const adj: Set<number>[] = Array.from({ length: roomCount }, () => new Set<number>())
    for (const c of connections) {
      adj[c.from].add(c.to)
      adj[c.to].add(c.from)
    }
    const queue = [0]
    connected.add(0)
    while (queue.length > 0) {
      const current = queue.shift()!
      for (const neighbor of adj[current]) {
        if (!connected.has(neighbor)) {
          connected.add(neighbor)
          queue.push(neighbor)
        }
      }
    }
  } else {
    connected.add(0)
  }

  // Connect any isolated rooms to the nearest connected room
  for (let i = 0; i < roomCount; i++) {
    if (!connected.has(i)) {
      // Find nearest connected room
      let bestDist = Infinity
      let bestIdx = 0
      const ic = getCenter(leaves[i])
      for (const ci of connected) {
        const cc = getCenter(leaves[ci])
        const dist = Math.abs(ic.x - cc.x) + Math.abs(ic.y - cc.y)
        if (dist < bestDist) {
          bestDist = dist
          bestIdx = ci
        }
      }
      connections.push({ from: bestIdx, to: i })
      connected.add(i)
    }
  }

  // Carve doors for each connection
  for (const conn of connections) {
    const fromLeaf = leaves[conn.from]
    const toLeaf = leaves[conn.to]
    const dirs = getConnectionDirection(fromLeaf, toLeaf)

    const fromRoom = rooms[conn.from]
    const toRoom = rooms[conn.to]

    // Calculate door offset (centered on the wall)
    const fromOffset = dirs.fromDir === 'north' || dirs.fromDir === 'south'
      ? Math.floor(fromRoom.width / 2) - 1
      : Math.floor(fromRoom.height / 2) - 1

    const toOffset = dirs.toDir === 'north' || dirs.toDir === 'south'
      ? Math.floor(toRoom.width / 2) - 1
      : Math.floor(toRoom.height / 2) - 1

    carveDoor(fromRoom, dirs.fromDir, fromOffset, conn.to)
    carveDoor(toRoom, dirs.toDir, toOffset, conn.from)
  }

  const startRoom = 0
  const bossRoom = roomCount - 1

  // Verify path from start to boss
  if (!hasPath(connections, startRoom, bossRoom, roomCount)) {
    // Force a direct connection
    connections.push({ from: startRoom, to: bossRoom })

    const dirs = getConnectionDirection(leaves[startRoom], leaves[bossRoom])
    const fromRoom = rooms[startRoom]
    const toRoom = rooms[bossRoom]

    const fromOffset = dirs.fromDir === 'north' || dirs.fromDir === 'south'
      ? Math.floor(fromRoom.width / 2) - 1
      : Math.floor(fromRoom.height / 2) - 1

    const toOffset = dirs.toDir === 'north' || dirs.toDir === 'south'
      ? Math.floor(toRoom.width / 2) - 1
      : Math.floor(toRoom.height / 2) - 1

    carveDoor(fromRoom, dirs.fromDir, fromOffset, bossRoom)
    carveDoor(toRoom, dirs.toDir, toOffset, startRoom)
  }

  return {
    rooms,
    connections,
    startRoom,
    bossRoom,
  }
}
