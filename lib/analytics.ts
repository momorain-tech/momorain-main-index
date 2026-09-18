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
//   2. 所有跨模块 SQL 都在这里，user-login 改表时只需要改这一个文件
//
// 关于「出不出单个用户」：
// 原来这里还有一条"只出聚合数、不返回单条用户记录"。2026-09-18 加天粒度
// 看板时按需求放开了——「今天具体有哪些用户登录了」这个问题，聚合数
// 天然回答不了。放开的同时把边界钉死：
//
//   · 明细只出**昵称 + 脱敏手机号**（138****1234），完整号码绝不进这一层
//   · 明细只出现在 /admin 下（三层守卫 + 白名单），不进任何访客端查询
//   · 每天的明细有条数上限，页面上注明被截断，不做"导出全部用户"这种接口
//
// 换句话说：看板是给管理员看「谁在用」的，不是一个用户数据导出口。
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

/** 天粒度趋势里的一天 */
export type DailyPoint = {
  /** 20260918 */
  day: number
  /** 09-18 */
  label: string
  /** 当天带着登录态访问过任一站点的去重人数 */
  active: number
  /** 其中真的走了一次登录流程的人数（老用户登录 + 新注册） */
  loggedIn: number
  /** 其中是当天新注册的 */
  newUsers: number
  /** 登录动作次数（同一个人一天登录三次算 3） */
  events: number
}

/** 某一天具体活跃过的某个用户 */
export type DayUser = {
  userId: string
  name: string
  /** 脱敏手机号，没绑手机号则为空串 */
  phone: string
  hasWechat: boolean
  /** 当天在哪些站点活跃过 */
  apps: string[]
  hits: number
  lastAt: number
  /** 当天是否走了登录流程（false = 带着老 Cookie 直接访问的） */
  didLogin: boolean
  /** 当天是否是新注册 */
  isNew: boolean
  methods: string[]
  /** 截至这一天已经连续活跃了几天 */
  streak: number
  /** 连续天数是否顶到了统计窗口的边界（真实值可能更大） */
  streakCapped: boolean
}

export type DayDetail = {
  day: number
  /** 当天去重活跃人数（可能大于 users.length——列表有上限） */
  total: number
  loggedIn: number
  newUsers: number
  users: DayUser[]
  truncated: boolean
}

export type StreakUser = {
  userId: string
  name: string
  phone: string
  days: number
  /** 这段连续活跃从哪天开始 */
  since: number
  capped: boolean
  /** 最后一天活跃是今天还是昨天 */
  lastDay: number
}

export type StreakSummary = {
  /** 口径基准日（今天） */
  asOf: number
  /** 当前连续活跃 ≥2 / ≥3 / ≥7 天的人数 */
  ge2: number
  ge3: number
  ge7: number
  /** 纳入统计的总人数（今天或昨天来过的人） */
  population: number
  buckets: Bucket[]
  top: StreakUser[]
}

export type Analytics = {
  growth: GrowthSummary
  weeklyRegister: { week: string; sms: number; wechat: number; total: number }[]
  weeklyActive: { week: string; wau: number; dauAvg: number }[]
  funnel: FunnelStep[]
  sms: SmsHealth
  appUsage: Bucket[]
  suspicious: SuspiciousIp[]
  /** 天粒度趋势，最近 TREND_DAYS 天，含没有人来的那些天 */
  daily: DailyPoint[]
  /** 选中那一天的用户明细 */
  dayDetail: DayDetail
  /** 连续登录 */
  streaks: StreakSummary
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

// ── 天粒度：每日登录、当天有哪些人、连续登录 ────────────────────────
//
// 这一段回答三个问题：
//   1. 每天有多少用户登录了？
//   2. 某一天具体是哪些用户？
//   3. 连续登录的有多少人？
//
// ⚠️ 口径（页面上也要写清楚，两个数字差很远时才不会被当成 bug）：
//
//   活跃 = user_active_day 里有记录 = 当天带着有效登录态访问过任一站点。
//          老用户 Cookie 还在，打开页面就算活跃，**不需要重新输验证码**。
//   登录 = login_event 里有记录 = 当天真的走完了一次登录流程。
//
// 绝大多数日子里「活跃」会远大于「登录」——这不是数据错了，
// 而是 session 有效期内本来就不用重新登录。问「有多少用户登录了」，
// 想知道的通常是前者（有多少人在用），所以两个都出，让读者自己挑。

/** 趋势图画多少天 */
const TREND_DAYS = 30

/**
 * 活跃矩阵取多少天。
 *
 * 比趋势图长一截，是为了算连续天数：一个人可能已经连来 45 天了，
 * 窗口只有 30 天的话就只能算出 30。窗口边界上的用户会打个「+」号。
 *
 * 为什么敢把 (user_id, day) 全量拉回 Node 里算，而不是写 SQL 窗口函数？
 * 行数 = 用户数 × 活跃天数。一千个活跃用户天天来，60 天也就 6 万行，
 * 几 MB，一次查询几十毫秒。而 gaps-and-islands 那套 SQL
 * （ROW_NUMBER 减日期分组）没几个人读得懂，改起来更没人敢动。
 * **数据量小的时候，可读性比"把计算下推到数据库"值钱。**
 * 等用户数上万了再回来换成窗口函数不迟。
 */
const MATRIX_DAYS = 60

/** 某一天的明细最多列多少人（超过就截断，页面会注明） */
const DAY_USER_LIMIT = 200

// ── 日期键的加减 ────────────────────────────────────────────────────
//
// 20260918 是个整数，但它不是能直接加减的数——20260931 不存在，
// 20260930 + 1 必须变成 20261001。所以每次加减都要绕一趟 Date。

function dayKeyToDate(key: number): Date {
  const y = Math.floor(key / 10000)
  const m = Math.floor((key % 10000) / 100)
  const d = key % 100
  return new Date(Date.UTC(y, m - 1, d))
}

function dateToDayKey(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate()
}

/** 日期键 ± n 天 */
function shiftDay(key: number, delta: number): number {
  return dateToDayKey(new Date(dayKeyToDate(key).getTime() + delta * 86400_000))
}

/** 20260918 → "09-18" */
function dayLabel(key: number): string {
  const m = String(Math.floor((key % 10000) / 100)).padStart(2, "0")
  const d = String(key % 100).padStart(2, "0")
  return `${m}-${d}`
}

// ── 活跃矩阵 ────────────────────────────────────────────────────────

type ActiveMatrix = {
  /** userId → 他活跃过的那些天（Set，用来往前数连续） */
  byUser: Map<string, Set<number>>
  /** 日期 → 当天去重活跃人数 */
  perDay: Map<number, number>
}

async function getActiveMatrix(days: number): Promise<ActiveMatrix> {
  // DISTINCT 把「同一个人同一天在三个站点活跃」压成一行——
  // 这里问的是"有多少人"，站点维度在面板 C 里单独看。
  const rows = await query<{ user_id: string; day: unknown }>(
    "SELECT DISTINCT user_id, day FROM user_active_day WHERE day >= ?",
    [dayKey(-days)]
  )

  const byUser = new Map<string, Set<number>>()
  const perDay = new Map<number, number>()
  for (const r of rows) {
    const d = num(r.day)
    let set = byUser.get(r.user_id)
    if (!set) byUser.set(r.user_id, (set = new Set()))
    set.add(d)
    perDay.set(d, (perDay.get(d) ?? 0) + 1)
  }
  return { byUser, perDay }
}

/**
 * 从 endDay 往前数，连续活跃了几天。endDay 当天没活跃就返回 0。
 *
 * capped = 数到窗口边界还没断，真实连续天数只会更长，不会更短。
 */
function streakEndingAt(
  days: Set<number>,
  endDay: number,
  windowStart: number
): { n: number; capped: boolean } {
  if (!days.has(endDay)) return { n: 0, capped: false }
  let n = 0
  let cur = endDay
  while (days.has(cur)) {
    n++
    if (cur <= windowStart) return { n, capped: true }
    cur = shiftDay(cur, -1)
  }
  return { n, capped: false }
}

// ── 每日登录动作 ────────────────────────────────────────────────────

type LoginDayRow = { users: number; events: number; regs: number }

async function getDailyLoginEvents(days: number): Promise<Map<number, LoginDayRow>> {
  // created_at + 28800 的理由同 getWeeklyRegister：FROM_UNIXTIME 走的是
  // MySQL 会话时区（服务器多半是 UTC），不补 8 小时的话，
  // 东八区 0 点到 8 点之间的登录会被算到前一天，跟 user_active_day
  // 的 day（Go 侧按东八区算的）对不上。
  //
  // `+ 0` 把 DATE_FORMAT 出来的字符串 '20260918' 转成数字，
  // 和 user_active_day.day 的类型对齐，省得 JS 那边还要判类型。
  const rows = await query<{
    day: unknown
    users: unknown
    events: unknown
    regs: unknown
  }>(
    "SELECT DATE_FORMAT(FROM_UNIXTIME(created_at + 28800), '%Y%m%d') + 0 AS day, " +
      "       COUNT(DISTINCT user_id) AS users, " +
      "       COUNT(*) AS events, " +
      "       COUNT(DISTINCT CASE WHEN kind = 'register' THEN user_id END) AS regs " +
      "FROM login_event " +
      "WHERE kind IN ('register', 'login') AND created_at >= ? " +
      "GROUP BY day",
    [dayKeyToUnix(dayKey(-days))]
  )

  const m = new Map<number, LoginDayRow>()
  for (const r of rows) {
    m.set(num(r.day), {
      users: num(r.users),
      events: num(r.events),
      regs: num(r.regs),
    })
  }
  return m
}

function buildDaily(matrix: ActiveMatrix, logins: Map<number, LoginDayRow>): DailyPoint[] {
  const out: DailyPoint[] = []
  // 从 days-1 天前一直排到今天，**没有人来的那天也要有一根 0 柱**。
  // 只画有数据的天，会把"断了三天"画成三天挨在一起，趋势就是假的。
  for (let i = TREND_DAYS - 1; i >= 0; i--) {
    const day = dayKey(-i)
    const lg = logins.get(day)
    out.push({
      day,
      label: dayLabel(day),
      active: matrix.perDay.get(day) ?? 0,
      loggedIn: lg?.users ?? 0,
      newUsers: lg?.regs ?? 0,
      events: lg?.events ?? 0,
    })
  }
  return out
}

// ── 用户名字 ────────────────────────────────────────────────────────

type UserBrief = { name: string; phone: string; hasWechat: boolean }

/** 手机号脱敏：13812341234 → 138****1234 */
function maskPhone(phone: string | null): string {
  if (!phone) return ""
  const s = String(phone)
  if (s.length < 7) return "***"
  return `${s.slice(0, 3)}****${s.slice(-4)}`
}

function briefOf(row: {
  nickname?: string | null
  phone?: string | null
  openid?: string | null
}): UserBrief {
  return {
    // 昵称可能为空（微信没授权、或者用户自己清空了），
    // 退回到 userId 前几位——**表格里绝不能出现一整列空白**，
    // 那会让人以为是数据坏了。
    name: (row.nickname ?? "").trim(),
    phone: maskPhone(row.phone ?? ""),
    hasWechat: !!(row.openid ?? "").trim(),
  }
}

function displayName(name: string, userId: string): string {
  return name || `未命名 · ${userId.slice(0, 8)}`
}

/** 按 id 批量取用户基本信息。给「只在 login_event 里出现」和连续榜用 */
async function getUserBriefs(ids: string[]): Promise<Map<string, UserBrief>> {
  const m = new Map<string, UserBrief>()
  if (ids.length === 0) return m
  // IN (?, ?, ...) 手动铺占位符：execute 是预处理语句，
  // 数组参数不会自动展开成列表（传数组进去会变成一个字符串，静默查不到）。
  const holes = ids.map(() => "?").join(",")
  const rows = await query<{
    id: string
    nickname: string | null
    phone: string | null
    openid: string | null
  }>(`SELECT id, nickname, phone, openid FROM \`user\` WHERE id IN (${holes})`, ids)
  for (const r of rows) m.set(r.id, briefOf(r))
  return m
}

// ── 某一天有哪些用户 ────────────────────────────────────────────────

async function getDayDetail(day: number, matrix: ActiveMatrix): Promise<DayDetail> {
  const windowStart = dayKey(-MATRIX_DAYS)
  const from = dayKeyToUnix(day)
  const to = from + 86400

  const [actRows, loginRows] = await Promise.all([
    // LEFT JOIN 而不是 INNER：用户被删了但活跃记录还在时，
    // INNER 会让这一行**整行消失**，人数对不上却查不出原因。
    query<{
      user_id: string
      nickname: string | null
      phone: string | null
      openid: string | null
      hits: unknown
      last_at: unknown
      apps: string | null
    }>(
      "SELECT a.user_id, u.nickname, u.phone, u.openid, " +
        "       SUM(a.hits) AS hits, MAX(a.last_at) AS last_at, " +
        "       GROUP_CONCAT(DISTINCT a.app ORDER BY a.app) AS apps " +
        "FROM user_active_day a LEFT JOIN `user` u ON u.id = a.user_id " +
        "WHERE a.day = ? " +
        "GROUP BY a.user_id, u.nickname, u.phone, u.openid " +
        `ORDER BY hits DESC, a.user_id LIMIT ${DAY_USER_LIMIT}`,
      [day]
    ),
    query<{
      user_id: string
      methods: string | null
      is_new: unknown
      first_at: unknown
    }>(
      "SELECT user_id, GROUP_CONCAT(DISTINCT method) AS methods, " +
        "       MAX(kind = 'register') AS is_new, MIN(created_at) AS first_at " +
        "FROM login_event " +
        "WHERE kind IN ('register', 'login') AND created_at >= ? AND created_at < ? " +
        "GROUP BY user_id",
      [from, to]
    ),
  ])

  const loginByUser = new Map(loginRows.map((r) => [r.user_id, r]))

  const users: DayUser[] = actRows.map((r) => {
    const b = briefOf(r)
    const lg = loginByUser.get(r.user_id)
    const st = streakEndingAt(
      matrix.byUser.get(r.user_id) ?? new Set(),
      day,
      windowStart
    )
    return {
      userId: r.user_id,
      name: displayName(b.name, r.user_id),
      phone: b.phone,
      hasWechat: b.hasWechat,
      apps: (r.apps ?? "").split(",").filter(Boolean),
      hits: num(r.hits),
      lastAt: num(r.last_at),
      didLogin: !!lg,
      isNew: !!lg && num(lg.is_new) > 0,
      methods: (lg?.methods ?? "").split(",").filter(Boolean),
      streak: st.n,
      streakCapped: st.capped,
    }
  })

  // 补漏：登录事件有、活跃表没有的人。
  // 正常不该出现（两个埋点是挨着调的），但埋点是"失败只记日志"的，
  // 真漏了一条的话，这里不补就会出现「登录人数 3、列表只有 2 行」。
  const seen = new Set(users.map((u) => u.userId))
  const missing = loginRows.map((r) => r.user_id).filter((id) => !seen.has(id))
  if (missing.length > 0) {
    const briefs = await getUserBriefs(missing.slice(0, DAY_USER_LIMIT))
    for (const id of missing.slice(0, DAY_USER_LIMIT)) {
      const lg = loginByUser.get(id)!
      const b = briefs.get(id) ?? { name: "", phone: "", hasWechat: false }
      users.push({
        userId: id,
        name: displayName(b.name, id),
        phone: b.phone,
        hasWechat: b.hasWechat,
        apps: [],
        hits: 0,
        lastAt: num(lg.first_at),
        didLogin: true,
        isNew: num(lg.is_new) > 0,
        methods: (lg.methods ?? "").split(",").filter(Boolean),
        streak: 0,
        streakCapped: false,
      })
    }
  }

  const total = matrix.perDay.get(day) ?? users.length
  return {
    day,
    total: Math.max(total, users.length),
    loggedIn: loginRows.length,
    newUsers: loginRows.filter((r) => num(r.is_new) > 0).length,
    users,
    truncated: actRows.length >= DAY_USER_LIMIT,
  }
}

// ── 连续登录 ────────────────────────────────────────────────────────

/**
 * 「当前连续活跃天数」= 从今天（今天还没来就从昨天）往回数，连着来了几天。
 *
 * 为什么允许从昨天起算？因为"今天"在大部分时刻都还没过完。
 * 早上八点看看板，昨天连来十天的人今天可能还没打开电脑——
 * 把他算成断签，等于每天早上都把连续榜清空一次。
 */
async function getStreaks(matrix: ActiveMatrix): Promise<StreakSummary> {
  const today = dayKey()
  const yesterday = dayKey(-1)
  const windowStart = dayKey(-MATRIX_DAYS)

  const all: { userId: string; days: number; capped: boolean; lastDay: number }[] = []
  for (const [userId, set] of matrix.byUser) {
    const end = set.has(today) ? today : set.has(yesterday) ? yesterday : 0
    if (!end) continue // 今天昨天都没来 = 已经断了，不在"当前连续"里
    const st = streakEndingAt(set, end, windowStart)
    all.push({ userId, days: st.n, capped: st.capped, lastDay: end })
  }

  all.sort((a, b) => b.days - a.days || a.userId.localeCompare(b.userId))

  const count = (min: number) => all.filter((s) => s.days >= min).length
  const between = (lo: number, hi: number) =>
    all.filter((s) => s.days >= lo && s.days <= hi).length

  // 分桶用「1 / 2 / 3-4 / 5-6 / 7-13 / 14+」而不是等宽：
  // 连续天数的分布天然是长尾的，等宽分桶会让第一个桶吃掉九成的人。
  const buckets: Bucket[] = [
    { key: "连续 1 天", value: between(1, 1) },
    { key: "连续 2 天", value: between(2, 2) },
    { key: "连续 3-4 天", value: between(3, 4) },
    { key: "连续 5-6 天", value: between(5, 6) },
    { key: "连续 7-13 天", value: between(7, 13) },
    { key: "连续 14 天以上", value: count(14) },
  ]

  const topIds = all.slice(0, 10).map((s) => s.userId)
  const briefs = await getUserBriefs(topIds)

  return {
    asOf: today,
    ge2: count(2),
    ge3: count(3),
    ge7: count(7),
    population: all.length,
    buckets,
    top: all.slice(0, 10).map((s) => {
      const b = briefs.get(s.userId) ?? { name: "", phone: "", hasWechat: false }
      return {
        userId: s.userId,
        name: displayName(b.name, s.userId),
        phone: b.phone,
        days: s.days,
        since: shiftDay(s.lastDay, -(s.days - 1)),
        capped: s.capped,
        lastDay: s.lastDay,
      }
    }),
  }
}

/**
 * 把 ?day= 收敛成一个合法的日期键。
 *
 * 这个值来自 URL，也就是来自任何人——但它只会被当成整数拼进 WHERE day = ?
 * 的参数位，注入不了。真正要防的是**范围**：
 * 放任查 20200101 的话，等于给了一个可以逐天翻的全量用户浏览器。
 */
export function normalizeDayParam(raw: string | undefined): number {
  const today = dayKey()
  if (!raw) return today
  const n = Number(raw)
  if (!Number.isInteger(n)) return today
  const earliest = dayKey(-(TREND_DAYS - 1))
  if (n < earliest || n > today) return today
  return n
}

// ── 对外唯一入口 ────────────────────────────────────────────────────

/**
 * 拉取看板需要的全部数据。
 *
 * `selectedDay` 是「天粒度」面板要看哪一天（20260918），默认今天。
 * 调用方传进来之前必须过一遍 `normalizeDayParam()`——它来自 URL。
 *
 * DB 未配置时返回 null——管理后台没有静态 fallback（和 projects-admin 一致），
 * 页面据此显示提示而不是崩掉。
 *
 * 并发策略：绝大多数查询互不依赖，一起发出去（串行的话页面要多等好几百毫秒）。
 * 唯一的例外是活跃矩阵——「某天有哪些人」和「连续登录」都要用它算连续天数，
 * 所以先把它拉回来，再把剩下的并发跑完。
 */
export async function getAnalytics(selectedDay?: number): Promise<Analytics | null> {
  if (!isDbConfigured()) return null

  const day = selectedDay ?? dayKey()
  const matrix = await getActiveMatrix(MATRIX_DAYS)

  const [
    growth,
    weeklyRegister,
    weeklyActive,
    funnel,
    sms,
    appUsage,
    suspicious,
    dailyLogins,
    dayDetail,
    streaks,
    collectingSince,
  ] = await Promise.all([
    getGrowth(),
    getWeeklyRegister(12),
    getWeeklyActive(12),
    getFunnel(7),
    getSmsHealth(),
    getAppUsage(28),
    getSuspicious(),
    getDailyLoginEvents(TREND_DAYS),
    getDayDetail(day, matrix),
    getStreaks(matrix),
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
    daily: buildDaily(matrix, dailyLogins),
    dayDetail,
    streaks,
    collectingSince,
  }
}
