import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { WebSocket, WebSocketServer } from 'ws'

/**
 * Bridges a browser WebSocket to `platform ssh` (exec-into-container
 * equivalent). The CLI handles SSH certificate auth; we only pipe bytes.
 */
export function attachTerminal(wss: WebSocketServer): void {
  wss.on('connection', (socket, req) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const project = url.searchParams.get('project') ?? ''
    const env = url.searchParams.get('env') ?? ''
    const app = url.searchParams.get('app') ?? ''

    if (!project || !env || !app) {
      socket.close(4000, 'project, env and app query params are required')
      return
    }

    let child: ChildProcessWithoutNullStreams
    try {
      child = spawn(
        'platform',
        [
          'ssh',
          '--no-interaction',
          '-p',
          project,
          '-e',
          env,
          '-A',
          app,
          '--',
          '/bin/bash',
          '-l',
        ],
        {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, TERM: 'xterm-256color' },
        },
      )
    } catch (err) {
      socket.close(1011, `failed to spawn ssh: ${String(err)}`)
      return
    }

    const onData = (buf: Buffer) => {
      if (socket.readyState === WebSocket.OPEN) socket.send(buf)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)

    socket.on('message', (data) => {
      child.stdin.write(data)
    })

    const cleanup = () => {
      child.removeAllListeners()
      child.kill('SIGKILL')
    }
    socket.on('close', cleanup)
    socket.on('error', () => {
      cleanup()
      socket.terminate()
    })
    child.on('close', () => socket.close())
  })
}
