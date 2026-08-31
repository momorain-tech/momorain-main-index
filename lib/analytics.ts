import { isDbConfigured, query } from "@/lib/db"

// 数据看板的查询层。
//
// ⚠️ 这个文件是**唯一**允许读 user-login 那几张表的地方。
//
// 为什么要立这条规矩？看板放在主站，但数据在认证服务 user-login 手里
// （两者共用生产库 momorain）。直接读别人的表是一处跨模块耦合——
// user-login 那边改一次表结构，这边就可能悄悄查不出数据。
//
// 把耦合关进一个文件里，代价就变得可控：
//   1. 只读，绝不写
//   2. 只做聚合查询，不返回单条用户记录
//   3. 所有跨模块 SQL 都在这里，user-login 改表时只需要改这一个文件
//
// 另一条硬规矩：**看板永远不落单个用户的手机号**。全部出聚合数。
//
// ── 表名的坑 ────────────────────────────────────────────────────────
// 同一个库里 user-login 用 xorm，表名是单数 `user`；
// one-api 用 GORM，表名是复数 `users`。两者恰好不冲突，但只差一个 s，
// 写 SQL 时极易看错。这里只碰 user-login 的表（单数那套）。

// ── 类型 ────────────────────────────────────────────────────────────

export type DayPoint = { day: number; value: number }
export type Bucket = { key: string; value: number }

export type FunnelStep = {
  label: string
  value: number
  /** 相对上一步的转化率，第一步为 null */
  rate: number | null
}

export type SmsHealth = {
  used24h: number
  limit: number
  success7d: number
  failed7d: number
  successRate: number | null
  errorCodes: Bucket[]
}

export type GrowthSummary = {
  totalUsers: number
  withPhone: number
  withWechat: number
  newThisWeek: number
  newLastWeek: number
  wau: number
  wauPrev: number
  dauAvg: number
}

export type SuspiciousIp = {
  ipHash: string
  attempts: number
  distinctPhones: number
}

export type Analytics = {
  growth: GrowthSummary
  weeklyRegister: { week: string; sms: number; wechat: number; total: number }[]
  weeklyActive: { week: string; wau: number; dauAvg: number }[]
  funnel: FunnelStep[]
  sms: SmsHealth
  appUsage: Bucket[]
  suspicious: SuspiciousIp[]
  /** 采集是否刚上线——数据太少时页面要说明白，而不是显示一堆 0 */
  collectingSince: number | null
}

// ── 日期工具 ────────────────────────────────────────────────────────
//
// user-login 的新表用 20260830 这种整数日期键（东八区），
// 这里必须用同一套算法，否则两边对"今天"的理解会差一天。

const CN_OFFSET_MS = 8 * 60 * 60 * 1000

function cnDate(offsetDays = 0): Date {
  const t = Date.now() + CN_OFFSET_MS + offsetDays * 86400_000
  return new Date(t)
}

/** 20260830 形式的日期键（东八区），与 Go 侧的 dayKeyOf 一致 */
export function dayKey(offsetDays = 0): number {
  const d = cnDate(offsetDays)
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

/** 本周一（东八区）距今天几天。周一=0，周日=6 */
function daysSinceMonday(): number {
  const dow = cnDate().getUTCDay() // 0=周日
  return dow === 0 ? 6 : dow - 1
}

// ── 小工具 ──────────────────────────────────────────────────────────

function num(v: unknown): number {
  // MySQL 的 COUNT() 经 mysql2 回来可能是 number 也可能是 string（BIGINT），
  // 统一收敛一次，免得后面出现 "12" + 3 = "123" 这种经典 JS 坑
  const n = typeof v === "string" ? Number(v) : (v as number)
  return Number.isFinite(n) ? n : 0
}

async function scalar(sql: string, values?: unknown[]): Promise<number> {
  const rows = await query<{ v: unknown }>(sql, values)
  return rows.length ? num(rows[0].v) : 0
}

// ── 各段查询 ────────────────────────────────────────────────────────

async function getGrowth(): Promise<GrowthSummary> {
  const mondayOffset = daysSinceMonday()
  const thisMonday = dayKey(-mondayOffset)
  const lastMonday = dayKey(-mondayOffset - 7)
  const lastSunday = dayKey(-mondayOffset - 1)
  const today = dayKey()

  const [totalUsers, withPhone, withWechat] = await Promise.all([
    scalar("SELECT COUNT(*) AS v FROM `user`"),
    scalar("SELECT COUNT(*) AS v FROM `user` WHERE phone IS NOT NULL AND phone <> ''"),
    scalar("SELECT COUNT(*) AS v FROM `user` WHERE openid IS NOT NULL AND openid <> ''"),
  ])

  // 新注册看 login_event 而不是 user.created_time：
  // created_time 是 RFC3339 字符串，按周分组要 STR_TO_DATE 全表扫，
  // 而且它拿不到注册方式和来源站点。
  const [newThisWeek, newLastWeek] = await Promise.all([
    scalar(
      "SELECT COUNT(DISTINCT user_id) AS v FROM login_event " +
        "WHERE kind = 'register' AND created_at >= ?",
      [dayKeyToUnix(thisMonday)]
    ),
    scalar(
      "SELECT COUNT(DISTINCT user_id) AS v FROM login_event " +
        "WHERE kind = 'register' AND created_at >= ? AND created_at < ?",
      [dayKeyToUnix(lastMonday), dayKeyToUnix(thisMonday)]
    ),
  ])

  // WAU：本周内在任一站点活跃过的去重人数。
  // 一个人在三个站点活跃、活跃五天，仍然只算 1 个人——DISTINCT 是这个指标的全部。
  const [wau, wauPrev] = await Promise.all([
    scalar(
      "SELECT COUNT(DISTINCT user_id) AS v FROM user_active_day WHERE day BETWEEN ? AND ?",
      [thisMonday, today]
    ),
    scalar(
      "SELECT COUNT(DISTINCT user_id) AS v FROM user_active_day WHERE day BETWEEN ? AND ?",
      [lastMonday, lastSunday]
    ),
  ])

  // DAU 均值：先按天去重算出每天的人数，再对天求平均。
  // 不能直接 COUNT(DISTINCT) 除以天数——那算出来的是 WAU/天数，完全是另一个意思。
  const dauAvg = await scalar(
    "SELECT AVG(d) AS v FROM (" +
      "  SELECT day, COUNT(DISTINCT user_id) AS d FROM user_active_day " +
      "  WHERE day BETWEEN ? AND ? GROUP BY day" +
      ") t",
    [thisMonday, today]
  )

  return {
    totalUsers,
    withPhone,
    withWechat,
    newThisWeek,
    newLastWeek,
    wau,
    wauPrev,
    dauAvg: Math.round(dauAvg * 10) / 10,
  }
}

/** 把 20260830 转成当天 00:00（东八区）的 Unix 秒 */
function dayKeyToUnix(key: number): number {
  const y = Math.floor(key / 10000)
  const m = Math.floor((key % 10000) / 100)
  const d = key % 100
  return Math.floor(Date.UTC(y, m - 1, d) / 1000) - 8 * 3600
}

async function getWeeklyRegister(weeks: number) {
  // YEARWEEK 的 mode 3 = 周一为一周起点、ISO 周号，和国内习惯一致。
  // 默认 mode 0 是周日起点，会让所有周次错开一天。
  //
  // created_at + 28800：FROM_UNIXTIME 用的是 **MySQL 会话时区**，
  // 而服务器多半跑在 UTC。不先加 8 小时的话，每周的边界会整体偏移，
  // 周一凌晨的注册会被算进上一周——这种错位不会报错，只会让数字对不上。
  const since = Math.floor(Date.now() / 1000) - weeks * 7 * 86400
  const rows = await query<{ wk: number; method: string; n: unknown }>(
    "SELECT YEARWEEK(FROM_UNIXTIME(created_at + 28800), 3) AS wk, method, COUNT(DISTINCT user_id) AS n " +
      "FROM login_event WHERE kind = 'register' AND created_at >= ? " +
      "GROUP BY wk, method ORDER BY wk",
    [since]
  )

  const byWeek = new Map<number, { sms: number; wechat: number }>()
  for (const r of rows) {
    const cur = byWeek.get(r.wk) ?? { sms: 0, wechat: 0 }
    if (r.method === "wechat") cur.wechat += num(r.n)
    else cur.sms += num(r.n)
    byWeek.set(r.wk, cur)
  }

  return [...byWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([wk, v]) => ({
      week: `W${String(wk).slice(-2)}`,
      sms: v.sms,
      wechat: v.wechat,
      total: v.sms + v.wechat,
    }))
}

async function getWeeklyActive(weeks: number) {
  const since = dayKey(-weeks * 7)
  // 先算每天的去重人数，再按周聚合：
  // WAU 取周内去重（不是 7 天 DAU 相加），DAU 取周内均值。
  const rows = await query<{ wk: number; wau: unknown; dau: unknown }>(
    "SELECT YEARWEEK(STR_TO_DATE(day, '%Y%m%d'), 3) AS wk, " +
      "       COUNT(DISTINCT user_id) AS wau, " +
      "       COUNT(DISTINCT user_id, day) / COUNT(DISTINCT day) AS dau " +
      "FROM user_active_day WHERE day >= ? GROUP BY wk ORDER BY wk",
    [since]
  )
  return rows.map((r) => ({
    week: `W${String(r.wk).slice(-2)}`,
    wau: num(r.wau),
    dauAvg: Math.round(num(r.dau) * 10) / 10,
  }))
}

async function getFunnel(days: number): Promise<FunnelStep[]> {
  const from = dayKey(-days)

  // 前两级读 stat_daily（明细早被清理了，只剩汇总），
  // 最后一级读 login_event（这是精确的"真的登录成功了"）。
  const [captcha, code] = await Promise.all([
    scalar(
      "SELECT COALESCE(SUM(value),0) AS v FROM stat_daily " +
        "WHERE metric = 'captcha_issued' AND day >= ?",
      [from]
    ),
    scalar(
      "SELECT COALESCE(SUM(value),0) AS v FROM stat_daily " +
        "WHERE metric = 'sms_send' AND bucket = 'success' AND day >= ?",
      [from]
    ),
  ])
  const loggedIn = await scalar(
    "SELECT COUNT(*) AS v FROM login_event WHERE kind IN ('register','login') AND created_at >= ?",
    [dayKeyToUnix(from)]
  )

  const steps = [
    { label: "领取图形验证码", value: captcha },
    { label: "短信发出", value: code },
    { label: "验证通过并登录", value: loggedIn },
  ]
  return steps.map((s, i) => ({
    ...s,
    rate: i === 0 ? null : steps[i - 1].value > 0 ? s.value / steps[i - 1].value : null,
  }))
}

async function getSmsHealth(): Promise<SmsHealth> {
  const from7 = dayKey(-7)

  const [used24h, success7d, failed7d] = await Promise.all([
    // 24h 用量直接数明细（7 天内的明细还在），比汇总更实时
    scalar(
      "SELECT COUNT(*) AS v FROM sms_send_log WHERE created_at > ? AND status <> 'failed'",
      [Math.floor(Date.now() / 1000) - 86400]
    ),
    scalar(
      "SELECT COALESCE(SUM(value),0) AS v FROM stat_daily " +
        "WHERE metric = 'sms_send' AND bucket = 'success' AND day >= ?",
      [from7]
    ),
    scalar(
      "SELECT COALESCE(SUM(value),0) AS v FROM stat_daily " +
        "WHERE metric = 'sms_send' AND bucket = 'failed' AND day >= ?",
      [from7]
    ),
  ])

  const errRows = await query<{ bucket: string; n: unknown }>(
    "SELECT bucket, SUM(value) AS n FROM stat_daily " +
      "WHERE metric = 'sms_err' AND day >= ? GROUP BY bucket ORDER BY n DESC LIMIT 6",
    [from7]
  )

  const total = success7d + failed7d
  return {
    used24h,
    // 与 user-login 的 SMS_GLOBAL_DAILY_LIMIT 默认值保持一致。
    // 这个值在后端的环境变量里，前端读不到，所以只能约定——
    // 改后端阈值时记得同步这里，否则熔断线会画错。
    limit: Number(process.env.SMS_GLOBAL_DAILY_LIMIT ?? 1000),
    success7d,
    failed7d,
    // 成功率不含 pending：那是"已占配额、还没发出去"的占位记录，
    // 把它算进分母会让成功率无端偏低。
    successRate: total > 0 ? success7d / total : null,
    errorCodes: errRows.map((r) => ({ key: r.bucket || "unknown", value: num(r.n) })),
  }
}

async function getAppUsage(days: number): Promise<Bucket[]> {
  const rows = await query<{ app: string; n: unknown }>(
    "SELECT app, COUNT(DISTINCT user_id, day) AS n FROM user_active_day " +
      "WHERE day >= ? GROUP BY app ORDER BY n DESC",
    [dayKey(-days)]
  )
  return rows.map((r) => ({ key: r.app || "unknown", value: num(r.n) }))
}

async function getSuspicious(): Promise<SuspiciousIp[]> {
  // 「尝试数 ≈ 不同手机号数」是刷短信最干净的特征：
  // 正常人只会用自己那一个号反复试，脚本才会一个 IP 打一堆不同的号。
  //
  // 这里读的是 sms_send_log 的明文 IP（那张表 7 天就删，且频控本来就要用明文）。
  // 展示时会截断，不给出完整 IP。
  const rows = await query<{ ip: string; attempts: unknown; phones: unknown }>(
    "SELECT ip, COUNT(*) AS attempts, COUNT(DISTINCT phone) AS phones " +
      "FROM sms_send_log WHERE created_at > ? AND ip <> '' " +
      "GROUP BY ip HAVING phones > 1 ORDER BY phones DESC, attempts DESC LIMIT 8",
    [Math.floor(Date.now() / 1000) - 86400]
  )
  return rows.map((r) => ({
    ipHash: maskIp(r.ip),
    attempts: num(r.attempts),
    distinctPhones: num(r.phones),
  }))
}

/** 只保留首尾两段，中间打码——看板不需要完整 IP */
function maskIp(ip: string): string {
  const parts = ip.split(".")
  if (parts.length !== 4) return ip.slice(0, 6) + "…"
  return `${parts[0]}.**.**.${parts[3]}`
}

async function getCollectingSince(): Promise<number | null> {
  const rows = await query<{ v: unknown }>("SELECT MIN(day) AS v FROM stat_daily")
  const v = rows.length ? num(rows[0].v) : 0
  return v > 0 ? v : null
}

// ── 对外唯一入口 ────────────────────────────────────────────────────

/**
 * 拉取看板需要的全部数据。
 *
 * DB 未配置时返回 null——管理后台没有静态 fallback（和 projects-admin 一致），
 * 页面据此显示提示而不是崩掉。
 *
 * 所有查询并发发出：它们互不依赖，串行的话页面要多等好几百毫秒。
 */
export async function getAnalytics(): Promise<Analytics | null> {
  if (!isDbConfigured()) return null

  const [
    growth,
    weeklyRegister,
    weeklyActive,
    funnel,
    sms,
    appUsage,
    suspicious,
    collectingSince,
  ] = await Promise.all([
    getGrowth(),
    getWeeklyRegister(12),
    getWeeklyActive(12),
    getFunnel(7),
    getSmsHealth(),
    getAppUsage(28),
    getSuspicious(),
    getCollectingSince(),
  ])

  return {
    growth,
    weeklyRegister,
    weeklyActive,
    funnel,
    sms,
    appUsage,
    suspicious,
    collectingSince,
  }
}
