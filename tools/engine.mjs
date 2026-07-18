// One-command boot for the Creative Canvas engines.
//
//   npm run engine
//
// Starts both local generation daemons with prefixed logs:
//   image  — tools/local-image-server.mjs  (:5411, local mflux, free)
//   video  — tools/local-video-server.mjs  (:5412, fal.ai proxy, cost-gated)
//
// The video server reads FAL_KEY from .env via --env-file; the key never
// reaches this process's own logs or the browser.

import { spawn } from 'node:child_process'

const SERVERS = [
  { name: 'image', args: ['tools/local-image-server.mjs'] },
  { name: 'video', args: ['tools/local-video-server.mjs'] },
]

const children = []

function prefix(name, stream, out) {
  let buffer = ''
  stream.on('data', chunk => {
    buffer += chunk
    let index
    while ((index = buffer.indexOf('\n')) !== -1) {
      out.write(`[${name}] ${buffer.slice(0, index)}\n`)
      buffer = buffer.slice(index + 1)
    }
  })
}

for (const server of SERVERS) {
  const child = spawn(process.execPath, server.args, { stdio: ['ignore', 'pipe', 'pipe'] })
  prefix(server.name, child.stdout, process.stdout)
  prefix(server.name, child.stderr, process.stderr)
  child.on('exit', code => {
    console.error(`[engine] ${server.name} server exited (${code}) — shutting down`)
    shutdown(code ?? 1)
  })
  children.push(child)
}

function shutdown(code) {
  for (const child of children) child.kill('SIGTERM')
  process.exit(code)
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
console.log(`[engine] image :${process.env.IMAGE_SERVER_PORT || 5411} + video :${process.env.VIDEO_SERVER_PORT || 5412} — Ctrl+C stops both`)
