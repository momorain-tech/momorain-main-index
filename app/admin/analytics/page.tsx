import { getAnalytics } from "@/lib/analytics"
import {
  BarList,
  Card,
  Funnel,
  Legend,
  LineChart,
  Meter,
  StackedColumns,
  Stat,
} from "@/components/admin/charts"

// 数据看板。
//
// 上层 layout 已经做了权限守卫（非管理员 redirect 首页），
// 并且因为它读了 cookies()，/admin 下的路由都是每请求 SSR——
// 这正是看板想要的：每次打开都是最新数字，不吃缓存。
//
// 页面本身没有一行客户端 JS：所有查询在服务端跑完，直接吐 HTML。
export const dynamic = "force-dynamic"

const APP_LABELS: Record<string, string> = {
  main: "主站",
  cv: "简历工坊",
  clip: "视频转手绘",
  "one-api": "大模型网关",
  unknown: "未识别",
}

/** 从 20260830 这种日期键算出距今多少天 */
function daysSince(dayKey: number | null): number {
  if (!dayKey) return 0
  const y = Math.floor(dayKey / 10000)
  const m = Math.floor((dayKey % 10000) / 100)
  const d = dayKey % 100
  const then = Date.UTC(y, m - 1, d) - 8 * 3600_000 // 东八区零点
  return Math.max(1, Math.round((Date.now() - then) / 86400_000))
}

function pctDelta(now: number, prev: number): number | null {
  // 上一期是 0 时算不出百分比（除以零）。
  // 与其显示 "Infinity%" 或 "NaN%"，不如什么都不显示——
  // **看板宁可少说一句，也不能给一个错的数字。**
  if (prev === 0) return null
  return (now - prev) / prev
}

export default async function AnalyticsPage() {
  const data = await getAnalytics()

  if (data === null) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        本地未配置数据库（DB_HOST 等环境变量为空），看板不可用。
        <br />
        看板读的是生产库 momorain 里 user-login 写入的统计表，没有静态 fallback。
      </div>
    )
  }

  const { growth, weeklyRegister, weeklyActive, funnel, sms, appUsage, suspicious } =
    data

  // 采集是第 1 期才上线的，刚开始几天数据必然很少。
  // 与其让人对着一堆 0 猜是不是坏了，不如把话说明白。
  const daysCollecting = daysSince(data.collectingSince)

  return (
    <div className="flex flex-col gap-8">
      {daysCollecting < 14 && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <strong className="text-foreground">采集刚上线</strong>
          {data.collectingSince
            ? `（第一条汇总在 ${data.collectingSince}，已积累约 ${daysCollecting} 天）。`
            : "，还没有任何汇总数据。"}
          周活跃、留存这类指标需要
          <strong className="text-foreground">至少两周</strong>
          的数据才有意义，在此之前看趋势会误导。面板 B 的短信与漏斗数据来自已有的表，会更早有数。
        </div>
      )}

      {/* ── 面板 A：账号增长 ─────────────────────────────── */}
      <section className="flex flex-col gap-3">
        <PanelHeading
          n="面板 A"
          title="账号增长"
          sub="谁在用 · user / login_event / user_active_day"
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="累计用户"
            value={growth.totalUsers.toLocaleString()}
            foot={`${growth.withPhone} 个有手机号，${growth.withWechat} 个绑了微信`}
          />
          <Stat
            label="本周新注册"
            value={growth.newThisWeek}
            delta={pctDelta(growth.newThisWeek, growth.newLastWeek)}
            foot={`上周 ${growth.newLastWeek}`}
          />
          <Stat
            label="周活跃用户"
            value={growth.wau}
            delta={pctDelta(growth.wau, growth.wauPrev)}
            foot="本周内带有效登录态访问过任一站点的去重人数"
          />
          <Stat
            label="粘性 DAU/WAU"
            value={growth.wau > 0 ? `${Math.round((growth.dauAvg / growth.wau) * 100)}%` : "—"}
            foot={`日均活跃 ${growth.dauAvg} 人，即活跃用户平均每周来 ${
              growth.wau > 0 ? ((growth.dauAvg / growth.wau) * 7).toFixed(1) : "—"
            } 天`}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
          <Card title="每周新注册" hint="按注册方式">
            {weeklyRegister.length === 0 ? (
              <EmptyHint>还没有注册事件。采集从本次部署开始。</EmptyHint>
            ) : (
              <>
                <StackedColumns
                  data={weeklyRegister.map((w) => ({
                    label: w.week,
                    segments: [
                      { value: w.sms, color: "var(--chart-1)" },
                      { value: w.wechat, color: "var(--chart-2)" },
                    ],
                  }))}
                />
                <Legend
                  items={[
                    { label: "手机号验证码", color: "var(--chart-1)" },
                    { label: "微信扫码", color: "var(--chart-2)" },
                  ]}
                />
              </>
            )}
          </Card>

          <Card title="活跃用户趋势" hint="人">
            {weeklyActive.length === 0 ? (
              <EmptyHint>还没有活跃记录。</EmptyHint>
            ) : (
              <>
                <LineChart
                  labels={weeklyActive.map((w) => w.week)}
                  series={[
                    {
                      name: "WAU 周活跃",
                      color: "var(--chart-1)",
                      points: weeklyActive.map((w) => w.wau),
                    },
                    {
                      name: "DAU 日均活跃",
                      color: "var(--chart-3)",
                      points: weeklyActive.map((w) => w.dauAvg),
                    },
                  ]}
                />
                <Legend
                  items={[
                    { label: "WAU 周活跃", color: "var(--chart-1)" },
                    { label: "DAU 日均活跃", color: "var(--chart-3)" },
                  ]}
                />
              </>
            )}
          </Card>
        </div>
      </section>

      {/* ── 面板 B：登录健康度与短信成本 ──────────────────── */}
      <section className="flex flex-col gap-3">
        <PanelHeading
          n="面板 B"
          title="登录健康度与短信成本"
          sub="顺不顺 · stat_daily / sms_send_log"
        />

        <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr]">
          <Card title="登录漏斗" hint="近 7 天">
            <Funnel steps={funnel} />
            <hr className="mt-auto" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              整体转化{" "}
              <strong className="text-foreground">
                {funnel[0]?.value
                  ? `${((funnel[funnel.length - 1].value / funnel[0].value) * 100).toFixed(1)}%`
                  : "—"}
              </strong>
              。「领了图形码却没发出短信」那一跳通常是最大流失点——可能是图形码太难认，
              也可能是用户走到「要填手机号」这一步就不干了。
            </p>
          </Card>

          <div className="flex flex-col gap-3">
            <Card title="短信 24h 用量" hint="全局熔断线">
              <Meter value={sms.used24h} max={sms.limit} />
              <div className="flex items-baseline justify-between font-mono text-[11px] tabular-nums text-muted-foreground">
                <span>{sms.used24h} 条</span>
                <span>上限 {sms.limit.toLocaleString()}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                按 0.045 元/条估算 ≈ ¥{(sms.used24h * 0.045).toFixed(2)}
              </p>
            </Card>

            <Card title="发送成功率" hint="近 7 天">
              <div className="flex items-end justify-between gap-3">
                <span className="text-2xl font-semibold tracking-tight">
                  {sms.successRate != null
                    ? `${(sms.successRate * 100).toFixed(1)}%`
                    : "—"}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {sms.success7d} 成功 / {sms.failed7d} 失败
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                不含 pending —— 那是已占配额但还没发出去的占位记录
              </p>
            </Card>

            <Card title="失败错误码" hint="err_code">
              <BarList items={sms.errorCodes} />
            </Card>
          </div>
        </div>

        <Card title="可疑来源" hint="近 24h · 一个 IP 打了几个不同手机号">
          {suspicious.length === 0 ? (
            <EmptyHint>近 24 小时没有「一个 IP 打多个手机号」的记录。</EmptyHint>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-4 font-medium text-muted-foreground">IP</th>
                    <th className="py-2 pr-4 text-right font-medium text-muted-foreground">
                      尝试
                    </th>
                    <th className="py-2 pr-4 text-right font-medium text-muted-foreground">
                      不同手机号
                    </th>
                    <th className="py-2 font-medium text-muted-foreground">判定</th>
                  </tr>
                </thead>
                <tbody>
                  {suspicious.map((s) => {
                    // 尝试数和不同手机号数越接近，越像脚本：
                    // 正常人只会用自己那一个号反复试
                    const ratio = s.attempts > 0 ? s.distinctPhones / s.attempts : 0
                    const bad = s.distinctPhones >= 5 && ratio > 0.8
                    return (
                      <tr key={s.ipHash} className="border-b last:border-0">
                        <td className="py-2 pr-4 font-mono text-xs">{s.ipHash}</td>
                        <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums">
                          {s.attempts}
                        </td>
                        <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums">
                          {s.distinctPhones}
                        </td>
                        <td className="py-2 text-xs">
                          <span
                            className="mr-1.5"
                            style={{
                              color: bad ? "var(--status-crit)" : "var(--status-warn)",
                            }}
                          >
                            ●
                          </span>
                          {bad ? "疑似脚本" : "关注 · 可能是同一办公网"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            IP 已截断显示；手机号一律不出现在看板上，只出聚合数。
          </p>
        </Card>
      </section>

      {/* ── 面板 C：跨模块使用 ───────────────────────────── */}
      <section className="flex flex-col gap-3">
        <PanelHeading
          n="面板 C"
          title="跨模块使用"
          sub="用户在哪个站点活跃 · user_active_day"
        />
        <Card title="各站点活跃人天" hint="近 4 周">
          {appUsage.length === 0 ? (
            <EmptyHint>还没有活跃记录。</EmptyHint>
          ) : (
            <BarList
              items={appUsage.map((a) => ({
                key: APP_LABELS[a.key] ?? a.key,
                value: a.value,
              }))}
            />
          )}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            「人天」= 去重的（用户 × 日期）。同一个人连续来 5 天算 5，一天来 50 次算 1。
            <br />
            匿名访客的漏斗、注册前的行为归因属于第 2 期（需要 anon_id 埋点），暂未接入。
          </p>
        </Card>
      </section>
    </div>
  )
}

function PanelHeading({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        {n}
      </span>
      <h2 className="text-base font-semibold">{title}</h2>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </div>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
      {children}
    </p>
  )
}
