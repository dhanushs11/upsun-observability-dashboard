import path from 'node:path'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { WebSocketServer } from 'ws'
import { api } from './routes.js'
import { attachTerminal } from './terminal.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 8787)
const app = express()

app.use('/api', api)
app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err)
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

if (process.env.NODE_ENV === 'production') {
  const distDir = process.env.DIST_DIR ?? path.resolve(__dirname, '../../dist')
  app.use(express.static(distDir))
  app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')))
}

const server = http.createServer(app)
const wss = new WebSocketServer({ noServer: true })
attachTerminal(wss)

server.on('upgrade', (req, socket, head) => {
  if ((req.url ?? '').startsWith('/ws')) {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req))
  } else {
    socket.destroy()
  }
})

server.listen(PORT, () => {
  const authMode =
    process.env.UPSUN_API_TOKEN || process.env.PLATFORMSH_CLI_TOKEN ? 'api-token' : 'platform-cli-fallback'
  console.log(`upsun-dashboard server listening on :${PORT} (auth=${authMode})`)
})
