import React from 'react'

export function StatusChip({ state }: { state: string | undefined | null }) {
  if (!state) return <span className="chip Unknown">Unknown</span>
  return <span className={`chip ${state}`}>{state}</span>
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="loading">{label}</div>
}

export function ErrorBox({ message }: { message: string }) {
  return <div className="error-box">{message}</div>
}

export function Empty({ children = 'No resources found.' }: { children?: React.ReactNode }) {
  return <div className="empty">{children}</div>
}

export function age(iso: string | undefined): string {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h${mins % 60 ? ` ${mins % 60}m` : ''}`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

export function fmtBytes(bytes: number | null | undefined, digits = 1): string {
  if (bytes == null) return '—'
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
  let v = bytes
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(i === 0 ? 0 : digits)} ${units[i]}`
}
