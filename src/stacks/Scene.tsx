/* THE STACKS — the canvas layer. One vertical run of volume rooms;
   page scroll drives the camera down through them. Bodies drift
   unless the reader asked for stillness. Activating a body lands
   on the issue's real route — the spread is the destination. */
import { useMemo, useRef, useEffect, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useNavigate } from 'react-router-dom'
import * as THREE from 'three'
import type { Volume } from './volumes'
import type { IssueRecord } from '../content/issues/schema'
import { bodyFor } from './bodies'
import { paintCover, type CoverSurface } from './coverPainter'
import { readCoverTheme } from './coverTheme'

const ROOM_HEIGHT = 14           // world units between volume rooms
const SHEET_W = 2.1
const SHEET_H = 3

function coverTexture(issue: IssueRecord): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 720
  const ctx = canvas.getContext('2d')!
  const surface = Object.assign(ctx, { width: canvas.width, height: canvas.height }) as unknown as CoverSurface
  paintCover(issue, surface, readCoverTheme(issue))
  const texture = new THREE.CanvasTexture(canvas)
  texture.anisotropy = 4
  return texture
}

/** Deterministic per-issue drift seed — no Math.random, so the
 *  room composes identically on every visit. */
function seed(issue: IssueRecord, salt: number): number {
  return ((Number(issue.number) * 2654435761 + salt * 40503) % 1000) / 1000
}

function SheetBody({ issue, home, still, onOpen }: {
  issue: IssueRecord
  home: [number, number, number]
  still: boolean
  onOpen: (n: string) => void
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const texture = useMemo(() => coverTexture(issue), [issue])
  const geometry = useMemo(() => {
    const g = new THREE.PlaneGeometry(SHEET_W, SHEET_H, 12, 1)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, Math.sin((pos.getX(i) / SHEET_W) * Math.PI) * 0.09) // paper curl
    }
    g.computeVertexNormals()
    return g
  }, [])

  useEffect(() => {
    return () => {
      texture.dispose()
      geometry.dispose()
    }
  }, [texture, geometry])

  useFrame(({ clock }) => {
    if (!mesh.current) return
    const t = still ? 0 : clock.elapsedTime
    const [x, y, z] = home
    mesh.current.position.set(
      x + Math.sin(t * 0.21 + seed(issue, 1) * 6.28) * 0.25,
      y + Math.cos(t * 0.17 + seed(issue, 2) * 6.28) * 0.2,
      z,
    )
    mesh.current.rotation.set(
      Math.sin(t * 0.1 + seed(issue, 3) * 6.28) * 0.12,
      Math.sin(t * 0.13 + seed(issue, 4) * 6.28) * 0.3 + seed(issue, 5) - 0.5,
      0,
    )
  })

  // bodyFor is the M2-M4 seam; every kind renders a sheet until
  // its body component lands.
  switch (bodyFor(issue)) {
    case 'sheet':
    default:
      return (
        <mesh
          ref={mesh}
          geometry={geometry}
          onClick={(e) => { e.stopPropagation(); onOpen(issue.number) }}
          onPointerOver={() => { document.body.style.cursor = 'pointer' }}
          onPointerOut={() => { document.body.style.cursor = '' }}
        >
          <meshStandardMaterial map={texture} side={THREE.DoubleSide} roughness={0.6} />
        </mesh>
      )
  }
}

/** Sheet homes fan around the volume lockup, deterministic. */
function homes(volume: Volume, roomY: number): Array<[number, number, number]> {
  return volume.issues.map((issue, i) => {
    const angle = (i / Math.max(volume.issues.length, 1)) * Math.PI * 2 + seed(issue, 6) * 0.8
    const radius = 3.4 + seed(issue, 7) * 1.6
    return [
      Math.cos(angle) * radius,
      roomY + (seed(issue, 8) - 0.5) * 2.4,
      -1.5 - seed(issue, 9) * 2.5,
    ]
  })
}

function Rig({ still }: { still: boolean }) {
  useFrame(({ camera }) => {
    const progress = window.scrollY / Math.max(document.body.scrollHeight - window.innerHeight, 1)
    const targetY = -progress * ((document.body.dataset.stacksVolumes
      ? Number(document.body.dataset.stacksVolumes) - 1
      : 0) * ROOM_HEIGHT)
    camera.position.y = still
      ? targetY
      : camera.position.y + (targetY - camera.position.y) * 0.08
    camera.position.z = 8
  })
  return null
}

export function StacksScene({ volumes }: { volumes: Volume[] }) {
  const navigate = useNavigate()
  const [still, setStill] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setStill(query.matches)
    const onChange = () => setStill(query.matches)
    query.addEventListener('change', onChange)
    document.body.dataset.stacksVolumes = String(volumes.length)
    return () => {
      query.removeEventListener('change', onChange)
      delete document.body.dataset.stacksVolumes
    }
  }, [volumes.length])

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 8], fov: 50 }}
      frameloop={still ? 'demand' : 'always'}
      style={{ position: 'fixed', inset: 0, zIndex: 0 }}
      aria-hidden="true"
    >
      <ambientLight intensity={1.1} />
      <directionalLight position={[4, 6, 8]} intensity={1.4} />
      <Rig still={still} />
      {volumes.map((volume, v) => (
        <group key={volume.label}>
          {homes(volume, -v * ROOM_HEIGHT).map((home, i) => (
            <SheetBody
              key={volume.issues[i].number}
              issue={volume.issues[i]}
              home={home}
              still={still}
              onOpen={(n) => navigate(`/issues/${n}`)}
            />
          ))}
        </group>
      ))}
    </Canvas>
  )
}
