import { getAnalytics, normalizeDayParam } from "@/lib/analytics"
import {
  BarList,
  Card,
  DayColumns,
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
  montage: "AI 视频工坊",
  unknown: "未识别",
}

// 登录方式。取值来自 user-login 的 object.Method* 常量
const METHOD_LABELS: Record<string, string> = {
  sms: "短信验证码",
  wechat: "微信扫码",
  mock: "测试账号",
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"]

/** 20260918 → "09-18 周四"。带星期是为了一眼看出周末的塌陷 */
function fmtDay(key: number): string {
  const y = Math.floor(key / 10000)
  const m = Math.floor((key % 10000) / 100)
  const d = key % 100
  const dow = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")} ${dow}`
}

/** Unix 秒 → 东八区的 HH:mm。不用 toLocaleString：服务器时区是 UTC，
    而看板上的时间必须和用户所在的东八区一致，手动补 8 小时最稳 */
function hhmm(ts: number): string {
  if (!ts) return "—"
  const d = new Date((ts + 8 * 3600) * 1000)
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
    d.getUTCMinutes()
  ).padStart(2, "0")}`
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

export default async function AnalyticsPage({
  searchParams,
}: {
  // Next 15 起 searchParams 是 Promise，要 await。
  // 读它不会让页面退出静态渲染——这页本来就是 force-dynamic
  searchParams: Promise<{ day?: string }>
}) {
  const { day: rawDay } = await searchParams
  // 来自 URL 的值一律先收敛：normalizeDayParam 把越界和乱写的值打回今天，
  // 免得有人靠翻 ?day=20200101 把看板当成全量用户浏览器
  const data = await getAnalytics(normalizeDayParam(rawDay))

  if (data === null) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        本地未配置数据库（DB_HOST 等环境变量为空），看板不可用。
        <br />
        看板读的是生产库 momorain 里 user-login 写入的统计表，没有静态 fallback。
      </div>
    )
  }

  const {
    growth,
    weeklyRegister,
    weeklyActive,
    funnel,
    sms,
    appUsage,
    suspicious,
    daily,
    dayDetail,
    streaks,
  } = data

  // daily 恰好就是可选日期的全集（最近 30 天，含没人来的天），
  // 所以「前一天 / 后一天」直接在数组里挪一格就行，不用做日期加减——
  // 20260930 + 1 = 20261001 这种事，能不自己算就不自己算
  const today = daily[daily.length - 1]
  const prevDay = daily[daily.length - 2]
  const firstDay = daily[0].day
  const lastDay = today.day
  const idx = daily.findIndex((d) => d.day === dayDetail.day)
  const prevKey = idx > 0 ? daily[idx - 1].day : firstDay
  const nextKey = idx >= 0 && idx < daily.length - 1 ? daily[idx + 1].day : lastDay

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

      {/* ── 面板 D：天粒度 ────────────────────────────────── */}
      {/*
        放在最前面，是因为这是打开看板最常想看的一屏：今天有多少人来、
        具体是谁。面板 A/B/C 是周粒度的宏观视角，往下翻。
        （编号沿用设计文档里的 A/B/C，D 是后加的，不重排编号——
         文档和代码对不上比编号不连续麻烦得多）
      */}
      <section id="day" className="flex scroll-mt-4 flex-col gap-3">
        <PanelHeading
          n="面板 D"
          title="每日登录"
          sub="按天看 · user_active_day / login_event"
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="今日活跃用户"
            value={today.active}
            delta={pctDelta(today.active, prevDay?.active ?? 0)}
            foot={`昨天 ${prevDay?.active ?? 0} 人。口径：当天带着有效登录态访问过任一站点的去重人数`}
          />
          <Stat
            label="今日走完登录流程"
            value={today.loggedIn}
            foot={`共 ${today.events} 次登录动作，其中新注册 ${today.newUsers} 人。Cookie 还没过期的人不在这个数里`}
          />
          <Stat
            label="连续登录 ≥2 天"
            value={streaks.ge2}
            foot={`≥3 天 ${streaks.ge3} 人，≥7 天 ${streaks.ge7} 人；纳入统计 ${streaks.population} 人`}
          />
          <Stat
            label="当前最长连续"
            value={
              streaks.top.length > 0
                ? `${streaks.top[0].days}${streaks.top[0].capped ? "+" : ""} 天`
                : "—"
            }
            foot={
              streaks.top.length > 0
                ? `${streaks.top[0].name} 从 ${fmtDay(streaks.top[0].since)} 起没断过`
                : "还没有连续活跃的用户"
            }
          />
        </div>

        <Card title="近 30 天每日登录人数" hint="点柱子看那天有谁">
          <DayColumns
            data={daily.map((d, i) => ({
              // 30 根柱子全标日期会糊成一团，每 5 天标一个；
              // 最后一根（今天）一定标上——它是读者的坐标原点
              label: i === daily.length - 1 || i % 5 === 0 ? d.label : "",
              value: d.active,
              sub: d.loggedIn,
              title: `${d.label}：活跃 ${d.active} 人，其中 ${d.loggedIn} 人走完登录流程，新注册 ${d.newUsers} 人`,
              href: `/admin/analytics?day=${d.day}#day`,
              selected: d.day === dayDetail.day,
            }))}
          />
          <Legend
            items={[
              { label: "当天活跃人数", color: "var(--funnel-1)" },
              { label: "其中走完登录流程", color: "var(--funnel-4)" },
            ]}
          />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <strong className="text-foreground">两个数为什么差那么多：</strong>
            「活跃」= 当天带着有效 session 打开过页面；「走完登录流程」= 当天真的输了一次验证码。
            session 没过期的老用户不需要重新登录，所以深色那段通常只是浅色的一小截——
            这是正常的，不是漏采。<br />
            没有柱子的那天画一道细线（而不是留空），这样「那天没人来」和「那天不在范围里」能区分开。
          </p>
        </Card>

        <Card
          title={`${fmtDay(dayDetail.day)} 活跃的用户`}
          hint={`${dayDetail.total} 人`}
        >
          {/* 日期切换。用普通链接而不是日历控件——这页刻意零客户端 JS */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {dayDetail.day > firstDay ? (
              <a
                className="rounded border px-2 py-1 hover:bg-muted"
                href={`/admin/analytics?day=${prevKey}#day`}
              >
                ← 前一天
              </a>
            ) : (
              <span className="rounded border px-2 py-1 text-muted-foreground opacity-50">
                ← 前一天
              </span>
            )}
            {dayDetail.day < lastDay ? (
              <a
                className="rounded border px-2 py-1 hover:bg-muted"
                href={`/admin/analytics?day=${nextKey}#day`}
              >
                后一天 →
              </a>
            ) : (
              <span className="rounded border px-2 py-1 text-muted-foreground opacity-50">
                后一天 →
              </span>
            )}
            {dayDetail.day !== lastDay && (
              <a
                className="rounded border px-2 py-1 hover:bg-muted"
                href="/admin/analytics#day"
              >
                回到今天
              </a>
            )}
            <span className="text-muted-foreground">
              其中 {dayDetail.loggedIn} 人走完登录流程 · 新注册 {dayDetail.newUsers} 人
            </span>
          </div>

          {dayDetail.users.length === 0 ? (
            <EmptyHint>
              {fmtDay(dayDetail.day)} 没有任何用户活跃记录。
              {dayDetail.day >= lastDay && "（今天才刚开始，也可能是还没人来）"}
            </EmptyHint>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <Th>用户</Th>
                    <Th>手机号</Th>
                    <Th>当天在哪些站点</Th>
                    <Th right>访问次数</Th>
                    <Th right>连续天数</Th>
                    <Th>最后活跃</Th>
                    <Th>当天登录</Th>
                  </tr>
                </thead>
                <tbody>
                  {dayDetail.users.map((u) => (
                    <tr key={u.userId} className="border-b last:border-0">
                      <td className="py-2 pr-4">
                        <span className="align-middle">{u.name}</span>
                        {u.isNew && (
                          <span
                            className="ml-1.5 rounded px-1 py-0.5 align-middle text-[10px]"
                            style={{
                              background: "var(--funnel-1)",
                              color: "var(--funnel-4)",
                            }}
                          >
                            新注册
                          </span>
                        )}
                        {u.hasWechat && (
                          <span className="ml-1.5 align-middle text-[10px] text-muted-foreground">
                            微信
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                        {u.phone || "—"}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {u.apps.length > 0
                          ? u.apps.map((a) => APP_LABELS[a] ?? a).join("、")
                          : "—"}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums">
                        {u.hits || "—"}
                      </td>
                      <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums">
                        {u.streak > 0 ? `${u.streak}${u.streakCapped ? "+" : ""}` : "—"}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs tabular-nums text-muted-foreground">
                        {hhmm(u.lastAt)}
                      </td>
                      <td className="py-2 text-xs">
                        {u.didLogin ? (
                          <>
                            <span className="mr-1.5" style={{ color: "var(--status-good)" }}>
                              ●
                            </span>
                            {u.methods.map((m) => METHOD_LABELS[m] ?? m).join("、") || "是"}
                          </>
                        ) : (
                          <span className="text-muted-foreground">Cookie 未过期</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {dayDetail.truncated && (
              <>
                <strong style={{ color: "var(--status-warn)" }}>列表已截断</strong>
                （单日上限 200 人，当天共 {dayDetail.total} 人）。
                <br />
              </>
            )}
            手机号一律脱敏；这张表只在 /admin 里出现，不进任何访客端查询。
            「连续天数」是截至这一天往前连着活跃了几天，带
            <code className="font-mono">+</code> 表示已顶到 60 天统计窗口的边界，真实值更长。
          </p>
        </Card>

        <div className="grid gap-3 lg:grid-cols-[1fr_1.4fr]">
          <Card title="连续登录天数分布" hint={`截至 ${fmtDay(streaks.asOf)}`}>
            <BarList items={streaks.buckets} />
            <p className="mt-auto text-[11px] leading-relaxed text-muted-foreground">
              分桶不等宽（1 / 2 / 3-4 / 5-6 / 7-13 / 14+）：连续天数的分布天然是长尾的，
              等宽分桶会让第一个桶吃掉九成的人，看不出差别。
            </p>
          </Card>

          <Card title="连续登录榜" hint="前 10 名">
            {streaks.top.length === 0 ? (
              <EmptyHint>今天和昨天都还没有人活跃。</EmptyHint>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <Th>用户</Th>
                      <Th>手机号</Th>
                      <Th right>连续</Th>
                      <Th>起始</Th>
                      <Th>最后活跃</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {streaks.top.map((s) => (
                      <tr key={s.userId} className="border-b last:border-0">
                        <td className="py-2 pr-4">{s.name}</td>
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                          {s.phone || "—"}
                        </td>
                        <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums">
                          {s.days}
                          {s.capped ? "+" : ""} 天
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs tabular-nums text-muted-foreground">
                          {fmtDay(s.since)}
                        </td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {s.lastDay === streaks.asOf ? "今天" : "昨天"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              「当前连续」从今天往回数；今天还没来的人从昨天起算——
              早上八点看看板时，昨天连来十天的人多半还没打开电脑，
              把他算成断签等于每天早上清一次榜。
            </p>
          </Card>
        </div>
      </section>

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

/** 表头单元格。三张表共用，省得每处都抄一遍那串 className */
function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={
        "py-2 pr-4 font-medium text-muted-foreground" + (right ? " text-right" : "")
      }
    >
      {children}
    </th>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
      {children}
    </p>
  )
}
