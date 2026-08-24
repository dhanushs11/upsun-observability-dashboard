import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export default function Terminal({
  projectId,
  env,
  app,
  kind,
}: {
  projectId: string
  env: string
  app: string
  kind?: 'webapp' | 'worker'
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<XTerm | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting')

  useEffect(() => {
    if (!hostRef.current || termRef.current) return

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: "'SF Mono', Menlo, Consolas, monospace",
      theme: {
        background: '#181f25',
        foreground: '#d7dde2',
      },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(hostRef.current)
    fit.fit()
    term.writeln(`Connecting to ${app} in ${env}…`)
    termRef.current = term

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(
      `${proto}//${location.host}/ws/exec?project=${encodeURIComponent(projectId)}&env=${encodeURIComponent(env)}&app=${encodeURIComponent(app)}&kind=${kind === 'worker' ? 'worker' : 'app'}`,
    )
    ws.binaryType = 'arraybuffer'
    ws.onopen = () => {
      setStatus('open')
      term.reset()
      term.focus()
    }
    ws.onmessage = (ev) => term.write(new Uint8Array(ev.data as ArrayBuffer))
    ws.onclose = (ev) => {
      setStatus('closed')
      term.write(`\r\n\x1b[33m[session closed${ev.reason ? `: ${ev.reason}` : ''}]\x1b[0m\r\n`)
    }
    ws.onerror = () => {
      setStatus('closed')
      term.write('\r\n\x1b[31m[connection error]\x1b[0m\r\n')
    }
    wsRef.current = ws

    const dataSub = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    })

    const onResize = () => fit.fit()
    window.addEventListener('resize', onResize)

    return () => {
      dataSub.dispose()
      window.removeEventListener('resize', onResize)
      ws.close()
      term.dispose()
      termRef.current = null
    }
  }, [projectId, env, app, kind])

  return (
    <div>
      <div className="toolbar">
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>
          Shell into <strong>{app}</strong> · {env} — type <code>exit</code> to close.
        </span>
        <span className={`chip ${status === 'open' ? 'Running' : status === 'connecting' ? 'Pending' : 'Failed'}`}>
          {status}
        </span>
      </div>
      <div
        ref={hostRef}
        style={{ background: '#181f25', borderRadius: 6, padding: 8, minHeight: 420 }}
      />
    </div>
  )
}
