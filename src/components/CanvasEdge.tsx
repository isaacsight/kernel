export interface CanvasEdgeProps {
  id: string
  startX: number
  startY: number
  endX: number
  endY: number
  isActive?: boolean
  isDrafting?: boolean
}

export function CanvasEdge({
  id,
  startX,
  startY,
  endX,
  endY,
  isActive = false,
  isDrafting = false,
}: CanvasEdgeProps) {
  // Compute control points for a smooth S-curve Bezier path
  const dx = Math.max(Math.abs(endX - startX) / 2, 45)
  const controlX1 = startX + dx
  const controlY1 = startY
  const controlX2 = endX - dx
  const controlY2 = endY

  const path = `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`

  // Classes
  const draftingClass = isDrafting ? ' ka-canvas-edge--drafting' : ''
  const activeClass = isActive ? ' ka-canvas-edge--active' : ''

  return (
    <g>
      <path
        id={id}
        className={`ka-canvas-edge${draftingClass}${activeClass}`}
        d={path}
      />
      {/* Invisible thicker line to make mouse hover/selection easier in future */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={8}
        style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
      />
    </g>
  )
}
