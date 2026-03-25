// SYNTH — Meta-Progression Tree Screen
// Visual tree display shown from the game over screen ("Spend Points" button).
// Draws nodes as circles connected by lines.
// Unlocked = bright, locked = dim, affordable = pulsing.

import Phaser from 'phaser'
import {
  META_NODES, META_EDGES,
  loadMetaProgression, saveMetaProgression,
  canUnlockNode, unlockNode,
  type MetaNode, type MetaProgressionState, type MetaCategory,
} from '../systems/MetaProgression'

// ── Category Colors ──────────────────────────────────────────────────

const CATEGORY_COLORS: Record<MetaCategory, number> = {
  combat: 0xff4444,
  defense: 0x44ff88,
  speed: 0x44ddff,
  partner: 0x88ff44,
  special: 0xffaa44,
  keystone: 0xcc44ff,
}

const CATEGORY_LABELS: Record<MetaCategory, string> = {
  combat: 'COMBAT',
  defense: 'DEFENSE',
  speed: 'SPEED',
  partner: 'PARTNER',
  special: 'SPECIAL',
  keystone: 'KEYSTONE',
}

// ── Node Visual State ────────────────────────────────────────────────

type NodeVisualState = 'unlocked' | 'affordable' | 'locked'

interface NodeVisual {
  node: MetaNode
  state: NodeVisualState
  circle: Phaser.GameObjects.Arc
  border: Phaser.GameObjects.Arc
  label: Phaser.GameObjects.Text
  costLabel: Phaser.GameObjects.Text
  screenX: number
  screenY: number
}

// ── MetaTreeScreen ───────────────────────────────────────────────────

type CloseCallback = () => void

export class MetaTreeScreen {
  private scene: Phaser.Scene
  private container: Phaser.GameObjects.Container
  private onClose: CloseCallback
  private active = false
  private state: MetaProgressionState
  private nodeVisuals: NodeVisual[] = []
  private pointsLabel: Phaser.GameObjects.Text | null = null
  private tooltipContainer: Phaser.GameObjects.Container | null = null
  private pulsingTweens: Phaser.Tweens.Tween[] = []

  // Layout constants
  private readonly MARGIN_X = 40
  private readonly MARGIN_Y = 70
  private readonly NODE_RADIUS = 14
  private readonly KEYSTONE_RADIUS = 20

  constructor(scene: Phaser.Scene, onClose: CloseCallback) {
    this.scene = scene
    this.onClose = onClose
    this.state = loadMetaProgression()
    this.container = scene.add.container(0, 0).setDepth(300).setScrollFactor(0).setVisible(false)
  }

  // ── Show / Hide ────────────────────────────────────────────────────

  show(): void {
    if (this.active) return
    this.active = true
    this.state = loadMetaProgression()

    this.buildUI()

    this.container.setVisible(true)
    this.container.setAlpha(0)
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 300,
      ease: 'Cubic.easeOut',
    })
  }

  hide(): void {
    if (!this.active) return
    this.active = false

    // Stop all pulsing tweens
    for (const tw of this.pulsingTweens) {
      tw.stop()
      tw.destroy()
    }
    this.pulsingTweens = []

    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.cleanup()
        this.onClose()
      },
    })
  }

  isActive(): boolean {
    return this.active
  }

  destroy(): void {
    for (const tw of this.pulsingTweens) {
      tw.stop()
      tw.destroy()
    }
    this.pulsingTweens = []
    this.cleanup()
    this.container.destroy()
  }

  // ── Build the Full UI ──────────────────────────────────────────────

  private buildUI(): void {
    this.cleanup()

    const w = this.scene.cameras.main.width
    const h = this.scene.cameras.main.height

    // Dim background
    const dimBg = this.scene.add.rectangle(w / 2, h / 2, w, h, 0x000000, 0.85)
    dimBg.setInteractive() // block clicks through
    this.container.add(dimBg)

    // Title
    const title = this.scene.add.text(w / 2, 20, 'SYNTHESIS TREE', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#cc44ff',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    this.container.add(title)

    // Points display
    this.pointsLabel = this.scene.add.text(w / 2, 46, this.pointsText(), {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffaa44',
    }).setOrigin(0.5)
    this.container.add(this.pointsLabel)

    // Draw edges first (behind nodes)
    this.drawEdges(w, h)

    // Draw nodes
    this.drawNodes(w, h)

    // Category legend (bottom-left)
    this.drawLegend()

    // Close button (top-right)
    const closeBtn = this.scene.add.text(w - 16, 12, 'X', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#666666',
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
    closeBtn.on('pointerover', () => closeBtn.setColor('#ffffff'))
    closeBtn.on('pointerout', () => closeBtn.setColor('#666666'))
    closeBtn.on('pointerdown', () => this.hide())
    this.container.add(closeBtn)

    // ESC key to close
    const escKey = this.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    escKey.once('down', () => {
      if (this.active) this.hide()
    })

    // Stats footer
    const statsText = `Runs: ${this.state.totalRuns}  |  Best Floor: ${this.state.bestFloor}  |  Total SP Earned: ${this.state.totalPointsEarned}`
    const stats = this.scene.add.text(w / 2, h - 12, statsText, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#444444',
    }).setOrigin(0.5)
    this.container.add(stats)
  }

  // ── Draw Edges ─────────────────────────────────────────────────────

  private drawEdges(w: number, h: number): void {
    const treeW = w - this.MARGIN_X * 2
    const treeH = h - this.MARGIN_Y * 2

    for (const [fromId, toId] of META_EDGES) {
      const fromNode = META_NODES.find(n => n.id === fromId)
      const toNode = META_NODES.find(n => n.id === toId)
      if (!fromNode || !toNode) continue

      const x1 = this.MARGIN_X + fromNode.position.x * treeW
      const y1 = this.MARGIN_Y + fromNode.position.y * treeH
      const x2 = this.MARGIN_X + toNode.position.x * treeW
      const y2 = this.MARGIN_Y + toNode.position.y * treeH

      const fromUnlocked = this.state.unlockedNodes.includes(fromId)
      const toUnlocked = this.state.unlockedNodes.includes(toId)
      const bothUnlocked = fromUnlocked && toUnlocked

      const lineColor = bothUnlocked ? 0x888888 : 0x333333
      const lineAlpha = bothUnlocked ? 0.7 : 0.3

      const line = this.scene.add.line(0, 0, x1, y1, x2, y2, lineColor, lineAlpha)
        .setOrigin(0, 0)
        .setLineWidth(bothUnlocked ? 2 : 1)
      this.container.add(line)
    }
  }

  // ── Draw Nodes ─────────────────────────────────────────────────────

  private drawNodes(w: number, h: number): void {
    this.nodeVisuals = []

    const treeW = w - this.MARGIN_X * 2
    const treeH = h - this.MARGIN_Y * 2

    for (const node of META_NODES) {
      const sx = this.MARGIN_X + node.position.x * treeW
      const sy = this.MARGIN_Y + node.position.y * treeH
      const radius = node.isKeystone ? this.KEYSTONE_RADIUS : this.NODE_RADIUS
      const color = CATEGORY_COLORS[node.category]

      const isUnlocked = this.state.unlockedNodes.includes(node.id)
      const affordable = canUnlockNode(node.id, this.state)

      let visualState: NodeVisualState
      if (isUnlocked) {
        visualState = 'unlocked'
      } else if (affordable) {
        visualState = 'affordable'
      } else {
        visualState = 'locked'
      }

      // Border ring
      const borderAlpha = visualState === 'unlocked' ? 0.9 : visualState === 'affordable' ? 0.6 : 0.2
      const border = this.scene.add.circle(sx, sy, radius + 2, color, 0).setStrokeStyle(2, color, borderAlpha)
      this.container.add(border)

      // Fill circle
      const fillAlpha = visualState === 'unlocked' ? 0.8 : visualState === 'affordable' ? 0.4 : 0.1
      const circle = this.scene.add.circle(sx, sy, radius, color, fillAlpha)
      this.container.add(circle)

      // Pulsing for affordable nodes
      if (visualState === 'affordable') {
        const tw = this.scene.tweens.add({
          targets: circle,
          fillAlpha: { from: 0.2, to: 0.6 },
          duration: 800,
          ease: 'Sine.easeInOut',
          yoyo: true,
          repeat: -1,
        })
        this.pulsingTweens.push(tw)
      }

      // Keystone diamond indicator
      if (node.isKeystone) {
        const diamond = this.scene.add.star(sx, sy, 4, 6, 10, color, visualState === 'unlocked' ? 0.9 : 0.3)
        diamond.setAngle(45)
        this.container.add(diamond)
      }

      // Node name label
      const labelColor = visualState === 'unlocked' ? '#ffffff' : visualState === 'affordable' ? '#cccccc' : '#555555'
      const label = this.scene.add.text(sx, sy + radius + 8, node.name, {
        fontFamily: 'monospace',
        fontSize: node.isKeystone ? '8px' : '7px',
        color: labelColor,
        fontStyle: node.isKeystone ? 'bold' : 'normal',
        align: 'center',
        wordWrap: { width: 80 },
      }).setOrigin(0.5, 0)
      this.container.add(label)

      // Cost badge (only for locked/affordable)
      let costLabel: Phaser.GameObjects.Text
      if (!isUnlocked) {
        const costColor = affordable ? '#ffaa44' : '#444444'
        costLabel = this.scene.add.text(sx, sy - 2, `${node.cost}`, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: costColor,
          fontStyle: 'bold',
        }).setOrigin(0.5)
      } else {
        // Checkmark for unlocked
        costLabel = this.scene.add.text(sx, sy - 2, '\u2713', {
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#ffffff',
          fontStyle: 'bold',
        }).setOrigin(0.5)
      }
      this.container.add(costLabel)

      // Interactive: click to unlock or show tooltip
      circle.setInteractive({ useHandCursor: affordable })
      border.setInteractive({ useHandCursor: affordable })

      const visual: NodeVisual = {
        node,
        state: visualState,
        circle,
        border,
        label,
        costLabel,
        screenX: sx,
        screenY: sy,
      }
      this.nodeVisuals.push(visual)

      // Hover: show tooltip
      circle.on('pointerover', () => this.showTooltip(visual))
      circle.on('pointerout', () => this.hideTooltip())
      border.on('pointerover', () => this.showTooltip(visual))
      border.on('pointerout', () => this.hideTooltip())

      // Click: unlock
      const tryUnlock = () => {
        if (!this.active) return
        if (visual.state !== 'affordable') return

        const newState = unlockNode(node.id, this.state)
        if (newState) {
          this.state = newState
          // Flash the node
          this.scene.tweens.add({
            targets: circle,
            fillAlpha: 1,
            duration: 150,
            yoyo: true,
            ease: 'Quad.easeOut',
          })
          // Rebuild UI to reflect new state
          this.scene.time.delayedCall(200, () => {
            if (this.active) this.buildUI()
          })
        }
      }

      circle.on('pointerdown', tryUnlock)
      border.on('pointerdown', tryUnlock)
    }
  }

  // ── Tooltip ────────────────────────────────────────────────────────

  private showTooltip(visual: NodeVisual): void {
    this.hideTooltip()

    const node = visual.node
    const w = this.scene.cameras.main.width
    const color = CATEGORY_COLORS[node.category]
    const colorStr = `#${color.toString(16).padStart(6, '0')}`

    this.tooltipContainer = this.scene.add.container(0, 0).setDepth(310).setScrollFactor(0)

    const tipW = 160
    const tipH = 70
    // Position tooltip to stay on screen
    let tx = visual.screenX + 20
    let ty = visual.screenY - tipH / 2
    if (tx + tipW > w - 10) tx = visual.screenX - tipW - 20
    if (ty < 10) ty = 10

    const bg = this.scene.add.rectangle(tx + tipW / 2, ty + tipH / 2, tipW, tipH, 0x111122, 0.95)
      .setStrokeStyle(1, color, 0.5)
    this.tooltipContainer.add(bg)

    const nameText = this.scene.add.text(tx + 8, ty + 6, node.name, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: colorStr,
      fontStyle: 'bold',
    })
    this.tooltipContainer.add(nameText)

    const catText = this.scene.add.text(tx + tipW - 8, ty + 6, CATEGORY_LABELS[node.category], {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#666666',
    }).setOrigin(1, 0)
    this.tooltipContainer.add(catText)

    const descText = this.scene.add.text(tx + 8, ty + 22, node.description, {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#cccccc',
      wordWrap: { width: tipW - 16 },
    })
    this.tooltipContainer.add(descText)

    const isUnlocked = this.state.unlockedNodes.includes(node.id)
    const affordable = canUnlockNode(node.id, this.state)
    let statusStr: string
    let statusColor: string
    if (isUnlocked) {
      statusStr = 'UNLOCKED'
      statusColor = '#44ff88'
    } else if (affordable) {
      statusStr = `CLICK TO UNLOCK (${node.cost} SP)`
      statusColor = '#ffaa44'
    } else {
      statusStr = `LOCKED (${node.cost} SP)`
      statusColor = '#666666'
    }

    const statusText = this.scene.add.text(tx + 8, ty + tipH - 18, statusStr, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: statusColor,
    })
    this.tooltipContainer.add(statusText)

    this.container.add(this.tooltipContainer)
  }

  private hideTooltip(): void {
    if (this.tooltipContainer) {
      this.tooltipContainer.destroy(true)
      this.tooltipContainer = null
    }
  }

  // ── Legend ──────────────────────────────────────────────────────────

  private drawLegend(): void {
    const categories: MetaCategory[] = ['combat', 'defense', 'speed', 'partner', 'special', 'keystone']
    const startX = 12
    const startY = this.scene.cameras.main.height - 60

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i]
      const color = CATEGORY_COLORS[cat]
      const y = startY + i * 10

      const dot = this.scene.add.circle(startX, y, 3, color, 0.8)
      this.container.add(dot)

      const text = this.scene.add.text(startX + 8, y, CATEGORY_LABELS[cat], {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: `#${color.toString(16).padStart(6, '0')}`,
      }).setOrigin(0, 0.5)
      this.container.add(text)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private pointsText(): string {
    return `Synthesis Points: ${this.state.synthesisPoints}`
  }

  private cleanup(): void {
    for (const tw of this.pulsingTweens) {
      tw.stop()
      tw.destroy()
    }
    this.pulsingTweens = []
    this.nodeVisuals = []
    this.pointsLabel = null
    this.hideTooltip()
    this.container.removeAll(true)
    this.container.setVisible(false)
  }
}
