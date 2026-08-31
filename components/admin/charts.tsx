// 看板用的几个小图表组件。
//
// 为什么不装 recharts / chart.js？
// 这里要画的东西只有柱、线、条、进度四种，每种都是几行 CSS 或一段 SVG。
// 装一个图表库要多 200KB 的 JS，还会把这些服务端组件变成客户端组件
// （图表库都依赖浏览器 API）——而这个页面本来一行客户端 JS 都不需要。
//
// **先看清需求有多大，再决定要不要引依赖。** 等将来真的需要
// 交互式 tooltip、缩放、时间轴刷选了，再换库也不迟。

import { cn } from "@/lib/utils"

// ── 卡片 ────────────────────────────────────────────────────────────

export function Card({
  title,
  hint,
  children,
  className,
}: {
  title: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-lg border p-4", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        {hint && (
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

// ── 数字卡片 ────────────────────────────────────────────────────────

export function Stat({
  label,
  value,
  delta,
  foot,
}: {
  label: string
  value: string | number
  /** 环比变化，正数向上。null = 没有可比的上一期 */
  delta?: number | null
  foot?: string
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-4">
      <h3 className="text-sm font-medium text-muted-foreground">{label}</h3>
      <div className="flex items-end justify-between gap-3">
        <span className="text-3xl font-semibold leading-none tracking-tight">
          {value}
        </span>
        {delta != null && <Delta value={delta} />}
      </div>
      {foot && <p className="text-xs leading-relaxed text-muted-foreground">{foot}</p>}
    </div>
  )
}

function Delta({ value }: { value: number }) {
  const pct = Math.round(value * 1000) / 10
  // 涨跌用颜色 + 箭头**两个**通道表示。
  // 只靠颜色的话，红绿色盲用户看到的是两个一样的灰。
  const up = pct > 0
  const flat = pct === 0
  return (
    <span
      className="font-mono text-xs tabular-nums"
      style={{
        color: flat
          ? "hsl(var(--muted-foreground))"
          : up
            ? "var(--status-good)"
            : "var(--status-crit)",
      }}
    >
      {flat ? "持平" : `${up ? "↑" : "↓"} ${Math.abs(pct)}%`}
    </span>
  )
}

// ── 堆叠柱状图 ──────────────────────────────────────────────────────

export type StackedColumn = {
  label: string
  segments: { value: number; color: string }[]
}

export function StackedColumns({
  data,
  height = 150,
}: {
  data: StackedColumn[]
  height?: number
}) {
  const totals = data.map((d) => d.segments.reduce((a, s) => a + s.value, 0))
  const max = Math.max(1, ...totals)

  return (
    <div className="flex flex-col gap-1.5">
      {/* 数值直接标在柱子上方。图表里最容易被忽略的一点：
          有轴刻度不代表读者愿意去比对，直接标出来才真的会被读到 */}
      <div className="flex gap-1.5">
        {totals.map((t, i) => (
          <span
            key={i}
            className="flex-1 text-center font-mono text-[10px] tabular-nums text-muted-foreground"
          >
            {t || ""}
          </span>
        ))}
      </div>

      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((col, i) => (
          <div key={i} className="flex flex-1 flex-col justify-end gap-[2px]">
            {/* 从上往下画：数组顺序 = 视觉从上到下 */}
            {/* 段与段之间靠 gap-[2px] 分隔（露出背景色），而不是描边。
                描边会给图表增加与数据无关的墨水量 */}
            {[...col.segments].reverse().map((seg, j) => (
              <div
                key={j}
                className="mx-auto w-full max-w-[24px]"
                style={{
                  height: `${(seg.value / max) * height}px`,
                  background: seg.color,
                  // 只有最顶上那段是圆角，底部贴基线保持方角——
                  // 圆角在基线上会让柱子看起来比实际短
                  borderRadius: j === 0 ? "4px 4px 0 0" : undefined,
                }}
                aria-hidden
              />
            ))}
          </div>
        ))}
      </div>

      <div className="flex gap-1.5">
        {data.map((col, i) => (
          <span
            key={i}
            className="flex-1 overflow-hidden text-center font-mono text-[10px] text-muted-foreground"
          >
            {col.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function Legend({
  items,
}: {
  items: { label: string; color: string }[]
}) {
  // 两个及以上系列必须有图例。
  // 直接标签是补充，图例才是可靠的身份通道——
  // 绝不能让读者只靠"记住哪个颜色是哪个"来读图。
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm"
            style={{ background: it.color }}
            aria-hidden
          />
          {it.label}
        </span>
      ))}
    </div>
  )
}

// ── 折线图 ──────────────────────────────────────────────────────────

export function LineChart({
  series,
  labels,
}: {
  series: { name: string; color: string; points: number[] }[]
  labels: string[]
}) {
  const all = series.flatMap((s) => s.points)
  const max = Math.max(1, ...all)
  const W = 480
  const H = 180
  const [x0, x1, y0, yb] = [34, W - 28, 18, H - 30]
  const n = Math.max(1, labels.length - 1)

  const px = (i: number) => x0 + ((x1 - x0) * i) / n
  const py = (v: number) => yb - (v / max) * (yb - y0)

  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f))

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={series.map((s) => `${s.name} 趋势`).join("，")}
    >
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={x0}
            x2={x1}
            y1={py(t)}
            y2={py(t)}
            stroke="hsl(var(--border))"
            strokeWidth="1"
          />
          <text
            x={x0 - 6}
            y={py(t) + 3}
            textAnchor="end"
            fontSize="9"
            fontFamily="ui-monospace, monospace"
            fill="hsl(var(--muted-foreground))"
          >
            {t}
          </text>
        </g>
      ))}

      {series.map((s) => (
        <polyline
          key={s.name}
          fill="none"
          stroke={s.color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={s.points.map((v, i) => `${px(i)},${py(v)}`).join(" ")}
        />
      ))}

      {/* 末点加一个圆点 + 背景色描边：线交叠时它仍然看得清 */}
      {series.map((s) => {
        const last = s.points.length - 1
        if (last < 0) return null
        return (
          <circle
            key={s.name}
            cx={px(last)}
            cy={py(s.points[last])}
            r="4"
            fill={s.color}
            stroke="hsl(var(--background))"
            strokeWidth="2"
          />
        )
      })}

      {labels.length > 0 && (
        <>
          <text
            x={x0}
            y={H - 8}
            fontSize="9"
            fontFamily="ui-monospace, monospace"
            fill="hsl(var(--muted-foreground))"
          >
            {labels[0]}
          </text>
          <text
            x={x1}
            y={H - 8}
            textAnchor="end"
            fontSize="9"
            fontFamily="ui-monospace, monospace"
            fill="hsl(var(--muted-foreground))"
          >
            {labels[labels.length - 1]}
          </text>
        </>
      )}
    </svg>
  )
}

// ── 漏斗 ────────────────────────────────────────────────────────────

export function Funnel({
  steps,
}: {
  steps: { label: string; value: number; rate: number | null }[]
}) {
  const max = Math.max(1, ...steps.map((s) => s.value))
  const colors = [
    "var(--funnel-1)",
    "var(--funnel-2)",
    "var(--funnel-3)",
    "var(--funnel-4)",
  ]

  return (
    <div className="flex flex-col gap-2.5">
      {steps.map((s, i) => (
        <div key={s.label} className="flex flex-col gap-1">
          <div className="grid grid-cols-[minmax(88px,110px)_1fr_auto] items-center gap-2.5">
            <span className="text-xs text-muted-foreground">{s.label}</span>
            <span
              className="h-6 rounded-r"
              style={{
                width: `${Math.max((s.value / max) * 100, s.value > 0 ? 2 : 0)}%`,
                background: colors[Math.min(i, colors.length - 1)],
              }}
              aria-hidden
            />
            <span className="font-mono text-xs tabular-nums">
              {s.value.toLocaleString()}
            </span>
          </div>
          {s.rate != null && (
            <p
              className="pl-[98px] font-mono text-[10px] tracking-wide"
              style={{
                // 转化率低于 25% 标红：漏斗的价值就在于**一眼看出哪一步在漏人**，
                // 全用同一个颜色的话读者得自己算除法
                color:
                  s.rate < 0.25
                    ? "var(--status-crit)"
                    : "hsl(var(--muted-foreground))",
              }}
            >
              ↓ {(s.rate * 100).toFixed(1)}% 继续
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

// ── 进度条（用量 vs 上限）──────────────────────────────────────────

export function Meter({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  // 越接近上限颜色越紧张。轨道用同色系的浅色，
  // 这样"还剩多少"和"用了多少"是同一个语义尺度上的两段
  const color =
    pct >= 0.9
      ? "var(--status-crit)"
      : pct >= 0.7
        ? "var(--status-warn)"
        : "var(--funnel-4)"

  return (
    <div
      className="h-3 overflow-hidden rounded-full"
      style={{ background: "var(--funnel-1)" }}
      role="img"
      aria-label={`已用 ${value}，上限 ${max}`}
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${pct * 100}%`, background: color }}
      />
    </div>
  )
}

// ── 横向条形列表 ────────────────────────────────────────────────────

export function BarList({
  items,
}: {
  items: { key: string; value: number }[]
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  const colors = [
    "var(--funnel-4)",
    "var(--funnel-3)",
    "var(--funnel-2)",
    "var(--funnel-1)",
  ]

  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">暂无数据</p>
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((it, i) => (
        <div key={it.key} className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate font-mono text-[11px] text-muted-foreground">
              {it.key}
            </span>
            <span className="font-mono text-[11px] tabular-nums">{it.value}</span>
          </div>
          <span
            className="h-2 rounded-r"
            style={{
              width: `${(it.value / max) * 100}%`,
              background: colors[Math.min(i, colors.length - 1)],
            }}
            aria-hidden
          />
        </div>
      ))}
    </div>
  )
}
