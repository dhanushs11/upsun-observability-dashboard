import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

export interface SeriesDef {
  key: string
  label: string
  color: string
}

export function MetricChart({
  data,
  series,
  height = 260,
  unit,
}: {
  data: Array<Record<string, number | string>>
  series: SeriesDef[]
  height?: number
  unit?: string
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
        <XAxis
          dataKey="t"
          tickFormatter={(v) =>
            new Date(Number(v) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
          tick={{ fontSize: 11 }}
          minTickGap={40}
        />
        <YAxis tick={{ fontSize: 11 }} width={64} unit={unit} />
        <Tooltip
          labelFormatter={(v) => new Date(Number(v) * 1000).toLocaleTimeString()}
          contentStyle={{ fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.color}
            dot={false}
            strokeWidth={1.6}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

/** Usage bar with color thresholds like K8s dashboard resource gauges. */
export function Gauge({
  title,
  used,
  limit,
  format,
}: {
  title: string
  used: number | null
  limit: number | null
  format: (v: number) => string
}) {
  const pct = used != null && limit ? Math.min((used / limit) * 100, 100) : null
  const cls = pct == null ? '' : pct > 90 ? 'critical' : pct > 70 ? 'hot' : ''
  return (
    <div className="gauge">
      <div className="g-title">
        <span>{title}</span>
        {pct != null && <span>{pct.toFixed(0)}%</span>}
      </div>
      <div className="bar">
        <div className={cls} style={{ width: `${pct ?? 0}%` }} />
      </div>
      <div className="g-sub">
        {used != null ? format(used) : '—'} / {limit != null ? format(limit) : 'no limit'}
      </div>
    </div>
  )
}
