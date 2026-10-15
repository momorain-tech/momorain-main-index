import "server-only"
import { createHash } from "node:crypto"
import type { PoolConnection, RowDataPacket } from "mysql2/promise"

import { getPool } from "@/lib/db"
import type { SessionUser } from "@/lib/auth"
import { projectProvider } from "@/config/platform"
import {
  CONSENT_VERSION,
  CONTACT_KEYS,
  contactsOf,
  isContactType,
  type ContactEntry,
} from "@/components/participation/intake-fields"
import type { DemandSubmission, ProviderSubmission, Values } from "@/lib/intake-validation"
import { enqueueAnalysis } from "@/lib/intake/analysis"
import { newId } from "@/lib/intake/http"
import {
  APPLICATION_STATUSES,
  DEPLOY_STATUSES,
  REQUEST_FOLLOWING,
  REQUEST_SEARCH_MAX,
  REQUEST_STATUSES,
  type AnalysisResult,
  type AnalysisStatus,
  type ApplicationStatus,
  type DeployStatus,
  type RequestStatus,
} from "@/lib/intake/constants"

// ─── 资料接收的数据层 ─────────────────────────────────────────────
//
// 和 lib/projects.ts / projects-admin.ts 一样，SQL 只写在这一层，接口和页面不直接碰表。
// 两条贯穿全文件的规矩：
// 1. 提交者只能读到 owner_id = 自己 的记录。查不到和没权限都回「不存在」（接口层转成 404），
//    不区分——否则别人能用「403 还是 404」试探出哪些编号存在
// 2. 「成功」只在事务 COMMIT 之后返回。数据库出任何错，调用方拿到的都是异常，不会是假的 201

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex")
const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString())

async function withTx<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  const conn = await getPool().getConnection()
  try {
    await conn.beginTransaction()
    const out = await fn(conn)
    await conn.commit()
    return out
  } catch (err) {
    await conn.rollback().catch(() => {})
    throw err
  } finally {
    conn.release()
  }
}

async function addEvent(
  conn: PoolConnection,
  e: { type: "request" | "application"; id: string; actor?: SessionUser | null; event: string; note?: string; version: number },
) {
  await conn.execute(
    `INSERT INTO intake_events (entity_type, entity_id, actor_id, actor_name, event_type, note, version)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [e.type, e.id, e.actor?.userId ?? null, e.actor?.nickname ?? null, e.event, e.note ?? null, e.version],
  )
}

// 幂等的结果：created = 新建；replayed = 同一个键、同样的内容，返回原来那条；conflict = 同键不同内容
export type CreateOutcome<T> = { kind: "created" | "replayed"; record: T } | { kind: "conflict" }

// ─── 需求 ───────────────────────────────────────────────────────

export type ReferenceSnapshot = { slug: string; name: string; provider: string | null }

// 参考作品只认已发布的项目，名称和提供者在服务端从数据库/配置里取（不信客户端传的名字）
export async function resolveReference(slug: string): Promise<ReferenceSnapshot | null> {
  if (!slug) return null
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT slug, name FROM projects WHERE slug = ? AND published = 1",
    [slug],
  )
  if (!rows[0]) return null
  return { slug: rows[0].slug, name: rows[0].name, provider: projectProvider(rows[0].slug)?.name ?? null }
}

export type RequestReceipt = {
  id: string
  status: RequestStatus
  analysisStatus: AnalysisStatus
  createdAt: string
}

export async function createRequest(
  user: SessionUser,
  sub: DemandSubmission,
  reference: ReferenceSnapshot | null,
): Promise<CreateOutcome<RequestReceipt>> {
  const payload = {
    values: sub.values,
    reference,
    analysisConsent: sub.analysisConsent,
    consentVersion: CONSENT_VERSION,
  }
  // 哈希只算用户填的内容（不含同意书版本这种我们这边会变的东西），重放判断才稳定
  const hash = sha256(JSON.stringify([sub.values, reference?.slug ?? "", sub.analysisConsent]))
  const title = ((sub.values.title as string) || (sub.values.problem as string).replace(/\s+/g, " ")).slice(0, 60)

  const existing = async (conn: PoolConnection | null) => {
    const exec = conn ?? getPool()
    const [rows] = await exec.execute<RowDataPacket[]>(
      "SELECT id, payload_hash, status, analysis_status, created_at FROM intake_requests WHERE owner_id = ? AND request_key = ?",
      [user.userId, sub.requestKey],
    )
    return rows[0]
  }
  const replay = (row: RowDataPacket): CreateOutcome<RequestReceipt> =>
    row.payload_hash === hash
      ? {
          kind: "replayed",
          record: { id: row.id, status: row.status, analysisStatus: row.analysis_status, createdAt: iso(row.created_at) },
        }
      : { kind: "conflict" }

  try {
    return await withTx(async (conn) => {
      const found = await existing(conn)
      if (found) return replay(found)
      const id = newId("rq")
      await conn.execute(
        `INSERT INTO intake_requests (id, owner_id, request_key, payload_hash, payload_json, title)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, user.userId, sub.requestKey, hash, JSON.stringify(payload), title],
      )
      await addEvent(conn, { type: "request", id, actor: user, event: "received", note: "提交需求", version: 1 })
      // AI 排队和需求写入在同一个事务里：要么都有，要么都没有。
      // 排队只是插一行，耗时可以忽略；真正调模型在事务之外的后台循环里
      const analysisStatus: AnalysisStatus = sub.analysisConsent
        ? await enqueueAnalysis(conn, id, 1, user.userId)
        : "not_requested"
      await conn.execute("UPDATE intake_requests SET analysis_status = ? WHERE id = ?", [analysisStatus, id])
      return {
        kind: "created" as const,
        record: { id, status: "received" as const, analysisStatus, createdAt: new Date().toISOString() },
      }
    })
  } catch (err) {
    // 两个相同请求几乎同时到达：都没查到旧记录，后插入的那个撞唯一键。这时再查一次按重放处理
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      const found = await existing(null)
      if (found) return replay(found)
    }
    throw err
  }
}

type JobRow = { status: AnalysisStatus; result_json: AnalysisResult | null; error_code: string | null; updated_at: Date }
async function latestJob(requestId: string, version: number): Promise<JobRow | undefined> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT status, result_json, error_code, updated_at FROM ai_analysis_jobs
     WHERE request_id = ? AND request_version = ? ORDER BY id DESC LIMIT 1`,
    [requestId, version],
  )
  return rows[0] as JobRow | undefined
}

export type OwnerRequestView = {
  id: string
  title: string
  status: RequestStatus
  customerNote: string | null
  values: Values
  reference: ReferenceSnapshot | null
  analysis: { status: AnalysisStatus; result?: AnalysisResult }
  createdAt: string
  updatedAt: string
}

// 提交者查看自己的回执。只返回可以给他看的东西：
// 不含内部备注、负责人、AI 的错误码和模型原始输出
export async function getRequestForOwner(id: string, ownerId: string): Promise<OwnerRequestView | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT id, title, status, customer_note, payload_json, analysis_status, version, created_at, updated_at
     FROM intake_requests WHERE id = ? AND owner_id = ?`,
    [id, ownerId],
  )
  const r = rows[0]
  if (!r) return null
  const job = await latestJob(r.id, r.version)
  const status: AnalysisStatus = job?.status ?? r.analysis_status
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    customerNote: r.customer_note,
    values: r.payload_json.values,
    reference: r.payload_json.reference ?? null,
    analysis: { status, ...(status === "succeeded" && job?.result_json ? { result: job.result_json } : {}) },
    createdAt: iso(r.created_at),
    updatedAt: iso(job && job.updated_at > r.updated_at ? job.updated_at : r.updated_at),
  }
}

// ─── 服务申请 ───────────────────────────────────────────────────

export type ApplicationReceipt = { id: string; status: ApplicationStatus; createdAt: string }

export class AssetRefError extends Error {}

export async function createApplication(
  user: SessionUser,
  sub: ProviderSubmission,
): Promise<CreateOutcome<ApplicationReceipt>> {
  const hash = sha256(JSON.stringify([sub.profile, sub.works]))
  const scope = Array.isArray(sub.profile.publicScope) ? sub.profile.publicScope : []
  const existing = async (conn: PoolConnection | null) => {
    const exec = conn ?? getPool()
    const [rows] = await exec.execute<RowDataPacket[]>(
      "SELECT id, payload_hash, review_status, created_at FROM provider_applications WHERE owner_id = ? AND request_key = ?",
      [user.userId, sub.requestKey],
    )
    return rows[0]
  }
  const replay = (row: RowDataPacket): CreateOutcome<ApplicationReceipt> =>
    row.payload_hash === hash
      ? { kind: "replayed", record: { id: row.id, status: row.review_status, createdAt: iso(row.created_at) } }
      : { kind: "conflict" }

  try {
    return await withTx(async (conn) => {
      const found = await existing(conn)
      if (found) return replay(found)
      const id = newId("pa")

      // 附件必须：属于当前用户、还没被别的申请用过、类型和提供方式对得上。
      // FOR UPDATE 锁住这些行，防止同一个附件被两份并发提交的申请同时认领
      const allIds = sub.works.flatMap((w) => w.assets ?? [])
      if (allIds.length) {
        const [rows] = await conn.query<RowDataPacket[]>(
          "SELECT id, type FROM media_assets WHERE id IN (?) AND owner_id = ? AND application_id IS NULL FOR UPDATE",
          [allIds, user.userId],
        )
        const types = new Map(rows.map((r) => [r.id as string, r.type as string]))
        sub.works.forEach((w, i) => {
          for (const a of w.assets ?? []) {
            const t = types.get(a)
            if (!t) throw new AssetRefError(`作品 ${i + 1} 的附件已失效，请重新上传`)
            if (w.method === "提交静态 Demo 包" ? t !== "zip" : t === "zip")
              throw new AssetRefError(`作品 ${i + 1} 的附件类型和提供方式不符`)
          }
        })
        await conn.query("UPDATE media_assets SET application_id = ? WHERE id IN (?)", [id, allIds])
      }

      await conn.execute(
        `INSERT INTO provider_applications
           (id, owner_id, request_key, payload_hash, profile_json, works_json, display_name, public_scope, consent_version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          user.userId,
          sub.requestKey,
          hash,
          JSON.stringify(sub.profile),
          JSON.stringify(sub.works),
          String(sub.profile.displayName).slice(0, 100),
          JSON.stringify(scope),
          CONSENT_VERSION,
        ],
      )
      // 每个 Demo 包开一张部署工单，初始「待审核」。上传成功 ≠ 部署成功
      for (const [i, w] of sub.works.entries()) {
        if (w.method === "提交静态 Demo 包" && w.assets?.[0]) {
          await conn.execute(
            "INSERT INTO demo_deployments (application_id, work_index, package_asset_id) VALUES (?, ?, ?)",
            [id, i, w.assets[0]],
          )
        }
      }
      await addEvent(conn, { type: "application", id, actor: user, event: "received", note: "提交服务资料", version: 1 })
      return {
        kind: "created" as const,
        record: { id, status: "pending_review" as const, createdAt: new Date().toISOString() },
      }
    })
  } catch (err) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") {
      const found = await existing(null)
      if (found) return replay(found)
    }
    throw err
  }
}

export type AssetView = { id: string; name: string; type: string; size: number }
export type DeploymentView = {
  workIndex: number
  status: DeployStatus
  // 只有 deployed 才给地址：没验证过的地址不能让人点
  publicUrl: string | null
  failureSummary: string | null
  version: number
}
export type OwnerApplicationView = {
  id: string
  displayName: string
  status: ApplicationStatus
  customerNote: string | null
  profile: Values
  works: (Values & { assets?: string[] })[]
  assets: Record<string, AssetView>
  deployments: DeploymentView[]
  createdAt: string
  updatedAt: string
}

async function assetsFor(applicationId: string): Promise<Record<string, AssetView>> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, original_name, type, size FROM media_assets WHERE application_id = ?",
    [applicationId],
  )
  return Object.fromEntries(rows.map((r) => [r.id, { id: r.id, name: r.original_name, type: r.type, size: Number(r.size) }]))
}
async function deploymentsFor(applicationId: string, includeDraftUrl: boolean): Promise<DeploymentView[]> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT work_index, status, public_url, failure_summary, version FROM demo_deployments WHERE application_id = ? ORDER BY work_index",
    [applicationId],
  )
  return rows.map((r) => ({
    workIndex: r.work_index,
    status: r.status,
    publicUrl: includeDraftUrl || r.status === "deployed" ? r.public_url : null,
    failureSummary: r.failure_summary,
    version: r.version,
  }))
}

export async function getApplicationForOwner(id: string, ownerId: string): Promise<OwnerApplicationView | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    `SELECT id, display_name, review_status, customer_note, profile_json, works_json, created_at, updated_at
     FROM provider_applications WHERE id = ? AND owner_id = ?`,
    [id, ownerId],
  )
  const r = rows[0]
  if (!r) return null
  return {
    id: r.id,
    displayName: r.display_name,
    status: r.review_status,
    customerNote: r.customer_note,
    profile: r.profile_json,
    works: r.works_json,
    assets: await assetsFor(r.id),
    deployments: await deploymentsFor(r.id, false),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  }
}

export type MineItem = { kind: "request" | "application"; id: string; title: string; status: string; createdAt: string }
export async function listMine(ownerId: string): Promise<MineItem[]> {
  const pool = getPool()
  const [reqs] = await pool.execute<RowDataPacket[]>(
    "SELECT id, title, status, created_at FROM intake_requests WHERE owner_id = ? ORDER BY created_at DESC LIMIT 50",
    [ownerId],
  )
  const [apps] = await pool.execute<RowDataPacket[]>(
    "SELECT id, display_name, review_status, created_at FROM provider_applications WHERE owner_id = ? ORDER BY created_at DESC LIMIT 50",
    [ownerId],
  )
  return [
    ...reqs.map((r) => ({ kind: "request" as const, id: r.id, title: r.title, status: r.status, createdAt: iso(r.created_at) })),
    ...apps.map((r) => ({
      kind: "application" as const,
      id: r.id,
      title: r.display_name,
      status: r.review_status,
      createdAt: iso(r.created_at),
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

// ─── 素材 ───────────────────────────────────────────────────────

export async function insertAsset(a: {
  id: string
  ownerId: string
  objectKey: string
  type: string
  mime: string
  size: number
  sha256: string
  name: string
}) {
  await getPool().execute(
    `INSERT INTO media_assets (id, owner_id, object_key, type, mime, size, sha256, original_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.id, a.ownerId, a.objectKey, a.type, a.mime, a.size, a.sha256, a.name],
  )
}
// 24 小时内的上传次数和总字节，做每个账号的配额
export async function uploadUsage(ownerId: string): Promise<{ count: number; bytes: number }> {
  const [[row]] = await getPool().execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM media_assets WHERE owner_id = ? AND created_at >= NOW() - INTERVAL 1 DAY",
    [ownerId],
  )
  return { count: Number(row.n), bytes: Number(row.bytes) }
}
export async function getAsset(id: string) {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, owner_id, object_key, type, mime, size, original_name FROM media_assets WHERE id = ?",
    [id],
  )
  return rows[0] as
    | { id: string; owner_id: string; object_key: string; type: string; mime: string; size: number; original_name: string }
    | undefined
}
// 上传了却一直没提交的素材，7 天后清理（§5.3 留存建议）。返回要删的文件 key，由调用方删文件
export async function takeAbandonedAssets(): Promise<string[]> {
  const pool = getPool()
  const [rows] = await pool.execute<RowDataPacket[]>(
    "SELECT id, object_key FROM media_assets WHERE application_id IS NULL AND created_at < NOW() - INTERVAL 7 DAY LIMIT 200",
  )
  if (!rows.length) return []
  await pool.query("DELETE FROM media_assets WHERE id IN (?) AND application_id IS NULL", [rows.map((r) => r.id)])
  return rows.map((r) => r.object_key)
}

// ─── 管理端 ─────────────────────────────────────────────────────

export type AdminListParams = { status?: string; page: number }
export const ADMIN_PAGE_SIZE = 30

// 需求列表的筛选条件。status 除了五个具体状态，还认一个分组值 "following"（= REQUEST_FOLLOWING）；
// contactType = 「留了这种联系方式」（电话 / 微信 / 邮箱）
export type AdminRequestQuery = AdminListParams & { q?: string; contactType?: string }

// 联系方式在 JSON 里的位置。新记录是 phone / wechat / email 三个键，旧记录是 contactType + contact
// （见 intake-fields.ts 的 contactsOf）。SQL 里取出这五列，回到 Node 再用 contactsOf 合成一个列表
// col 是 JSON 列，base 是资料对象在 JSON 里的路径：需求是 payload_json 的 $.values，服务申请是 profile_json 的 $
const contactColumns = (col: string, base: string) =>
  (
    [
      ["phone", "c_phone"],
      ["wechat", "c_wechat"],
      ["email", "c_email"],
      ["contactType", "c_type"],
      ["contact", "c_value"],
    ] as const
  )
    .map(([key, alias]) => `JSON_UNQUOTE(JSON_EXTRACT(${col}, '${base}.${key}')) AS ${alias}`)
    .join(",\n            ")
const contactsFromRow = (r: RowDataPacket): ContactEntry[] =>
  contactsOf({
    phone: r.c_phone ?? undefined,
    wechat: r.c_wechat ?? undefined,
    email: r.c_email ?? undefined,
    contactType: r.c_type ?? undefined,
    contact: r.c_value ?? undefined,
  })

// LIKE 里 % 和 _ 是通配符，用户搜「100%」时要转义成普通字符（MySQL 默认的转义符是反斜杠）
const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&")

// 关键词在这几处里找：需求名称、问题、期望结果、称呼、三种联系方式（含旧格式的 contact）、公司名。
// 都是 JSON 里取出来的字符串，MySQL 给它们的排序规则是 utf8mb4_bin（区分大小写），
// 所以两边都 LOWER() 一下，搜「Wang」也能找到「wang_123」。
// 每一列**单独**和参数比较，不拼成一个长字符串——不同排序规则的列拼在一起会报「Illegal mix of collations」
const SEARCH_COLUMNS = [
  "r.title",
  ...["problem", "outcome", "name", "phone", "wechat", "email", "contact", "company"].map(
    (k) => `JSON_UNQUOTE(JSON_EXTRACT(r.payload_json, '$.values.${k}'))`,
  ),
]

// 把筛选条件翻译成 WHERE。列表和总数共用这一份，保证「第 N 页」和「共 M 条」是同一个集合。
// 全部用占位符传值，用户输入不会拼进 SQL
function requestWhere(p: AdminRequestQuery): { sql: string; args: string[] } {
  const conds: string[] = []
  const args: string[] = []
  if (p.status === "following") {
    conds.push(`r.status IN (${REQUEST_FOLLOWING.map(() => "?").join(", ")})`)
    args.push(...REQUEST_FOLLOWING)
  } else if (REQUEST_STATUSES.includes(p.status as RequestStatus)) {
    conds.push("r.status = ?")
    args.push(p.status as string)
  }
  if (isContactType(p.contactType)) {
    // 新记录：对应的键存在（空值在入库前已被 normalizeValues 去掉，所以「存在」= 填了）；
    // 旧记录：contactType 等于这种类型
    conds.push(
      `(JSON_EXTRACT(r.payload_json, '$.values.${CONTACT_KEYS[p.contactType]}') IS NOT NULL
        OR JSON_UNQUOTE(JSON_EXTRACT(r.payload_json, '$.values.contactType')) = ?)`,
    )
    args.push(p.contactType)
  }
  const q = p.q?.trim().slice(0, REQUEST_SEARCH_MAX)
  if (q) {
    const like = `%${escapeLike(q.toLowerCase())}%`
    // 编号精确匹配（管理员常常是从回执里复制编号来查）+ 各列模糊匹配
    conds.push(`(r.id = ? OR ${SEARCH_COLUMNS.map((c) => `LOWER(${c}) LIKE ?`).join(" OR ")})`)
    args.push(q, ...SEARCH_COLUMNS.map(() => like))
  }
  return { sql: conds.length ? `WHERE ${conds.join(" AND ")}` : "", args }
}

export type AdminRequestRow = {
  id: string
  title: string
  // 「想解决的问题」的开头，列表里放在标题下面，不用点进去也能大致知道是什么需求
  summary: string
  name: string
  // 用户留下的全部联系方式（列表页脱敏显示）
  contacts: ContactEntry[]
  status: RequestStatus
  analysisStatus: AnalysisStatus
  assigneeName: string | null
  createdAt: string
}
export async function adminListRequests(p: AdminRequestQuery): Promise<{ rows: AdminRequestRow[]; total: number }> {
  const { sql: where, args } = requestWhere(p)
  const pool = getPool()
  // 用 query 不用 execute：LIMIT ? 在 mysql2 的预处理语句里对参数类型很挑剔，query 在客户端转义，同样安全
  const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM intake_requests r ${where}`, args)
  // 列表里 AI 状态取「最新任务」的，没有任务就用提交时记下的决定。
  // 排序加上 id 做第二关键字：同一秒提交的两条，翻页时顺序固定，不会一条出现两次、一条消失
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT r.id, r.title, r.status, r.analysis_status, r.assignee_name, r.created_at,
            LEFT(JSON_UNQUOTE(JSON_EXTRACT(r.payload_json, '$.values.problem')), 80) AS summary,
            JSON_UNQUOTE(JSON_EXTRACT(r.payload_json, '$.values.name')) AS name,
            ${contactColumns("r.payload_json", "$.values")},
            (SELECT j.status FROM ai_analysis_jobs j WHERE j.request_id = r.id AND j.request_version = r.version
             ORDER BY j.id DESC LIMIT 1) AS job_status
     FROM intake_requests r ${where}
     ORDER BY r.created_at DESC, r.id DESC LIMIT ? OFFSET ?`,
    [...args, ADMIN_PAGE_SIZE, (p.page - 1) * ADMIN_PAGE_SIZE],
  )
  return {
    total: Number(count.n),
    rows: rows.map((r) => ({
      id: r.id,
      title: r.title,
      summary: (r.summary ?? "").replace(/\s+/g, " "),
      name: r.name ?? "",
      contacts: contactsFromRow(r),
      status: r.status,
      analysisStatus: r.job_status ?? r.analysis_status,
      assigneeName: r.assignee_name,
      createdAt: iso(r.created_at),
    })),
  }
}

// 需求列表顶部的四个数。**不受筛选影响**，永远是全表：
// 累计 = 所有需求（含已关闭）；待处理 = 已接收还没人动；跟进中 = REQUEST_FOLLOWING；
// 提交用户数 = 提交过需求的不同账号数。所以「累计 = 待处理 + 跟进中 + 已关闭」
export type RequestStats = { total: number; pending: number; following: number; closed: number; users: number }
export async function adminRequestStats(): Promise<RequestStats> {
  // SUM(条件) 在 MySQL 里是「满足条件的行数」；表是空的时 SUM 返回 NULL，所以包一层 COALESCE
  const [[r]] = await getPool().query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(status = 'received'), 0) AS pending,
            COALESCE(SUM(status IN (?)), 0) AS following,
            COALESCE(SUM(status = 'closed'), 0) AS closed,
            COUNT(DISTINCT owner_id) AS users
     FROM intake_requests`,
    [REQUEST_FOLLOWING],
  )
  // SUM 的结果是 DECIMAL，mysql2 会给字符串，统一转成数字
  return { total: Number(r.total), pending: Number(r.pending), following: Number(r.following), closed: Number(r.closed), users: Number(r.users) }
}

export type IntakeEvent = { id: number; actorName: string | null; eventType: string; note: string | null; createdAt: string }
async function eventsFor(type: "request" | "application", id: string): Promise<IntakeEvent[]> {
  const [rows] = await getPool().execute<RowDataPacket[]>(
    "SELECT id, actor_name, event_type, note, created_at FROM intake_events WHERE entity_type = ? AND entity_id = ? ORDER BY id DESC LIMIT 200",
    [type, id],
  )
  return rows.map((r) => ({ id: r.id, actorName: r.actor_name, eventType: r.event_type, note: r.note, createdAt: iso(r.created_at) }))
}

export type AdminRequestDetail = {
  id: string
  ownerId: string
  title: string
  status: RequestStatus
  assigneeId: string | null
  assigneeName: string | null
  customerNote: string | null
  version: number
  values: Values
  reference: ReferenceSnapshot | null
  analysisConsent: boolean
  consentVersion: string
  analysis: { status: AnalysisStatus; result?: AnalysisResult; errorCode?: string | null }
  events: IntakeEvent[]
  createdAt: string
  updatedAt: string
}
export async function adminGetRequest(id: string): Promise<AdminRequestDetail | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>("SELECT * FROM intake_requests WHERE id = ?", [id])
  const r = rows[0]
  if (!r) return null
  const job = await latestJob(r.id, r.version)
  return {
    id: r.id,
    ownerId: r.owner_id,
    title: r.title,
    status: r.status,
    assigneeId: r.assignee_id,
    assigneeName: r.assignee_name,
    customerNote: r.customer_note,
    version: r.version,
    values: r.payload_json.values,
    reference: r.payload_json.reference ?? null,
    analysisConsent: !!r.payload_json.analysisConsent,
    consentVersion: r.payload_json.consentVersion ?? "",
    analysis: {
      status: job?.status ?? r.analysis_status,
      ...(job?.result_json ? { result: job.result_json } : {}),
      errorCode: job?.error_code ?? null,
    },
    events: await eventsFor("request", r.id),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  }
}

// 管理员的一次保存：状态、指派、给对方的说明、内部备注，可以只带其中几项。
// expectedVersion 是打开页面时看到的版本，对不上 = 期间别人改过 → 409，前端提示刷新
export type AdminPatch = {
  expectedVersion: number
  status?: string
  assign?: "me" | "none"
  customerNote?: string
  note?: string
}
export type PatchOutcome = { kind: "ok"; version: number } | { kind: "not_found" } | { kind: "conflict" } | { kind: "invalid"; error: string }

async function patchEntity(
  table: "intake_requests" | "provider_applications",
  id: string,
  admin: SessionUser,
  patch: AdminPatch,
): Promise<PatchOutcome> {
  const isRequest = table === "intake_requests"
  const statusCol = isRequest ? "status" : "review_status"
  const allowed: readonly string[] = isRequest ? REQUEST_STATUSES : APPLICATION_STATUSES
  if (patch.status !== undefined && !allowed.includes(patch.status)) return { kind: "invalid", error: "状态无效" }
  if (patch.customerNote !== undefined && patch.customerNote.length > 1000)
    return { kind: "invalid", error: "给对方的说明不能超过 1000 字" }
  if (patch.note !== undefined && patch.note.length > 4000) return { kind: "invalid", error: "备注不能超过 4000 字" }

  return withTx(async (conn) => {
    const [rows] = await conn.execute<RowDataPacket[]>(
      `SELECT ${statusCol} AS status, assignee_id, customer_note, version FROM ${table} WHERE id = ? FOR UPDATE`,
      [id],
    )
    const cur = rows[0]
    if (!cur) return { kind: "not_found" as const }
    if (cur.version !== patch.expectedVersion) return { kind: "conflict" as const }
    const next = cur.version + 1
    const type = isRequest ? ("request" as const) : ("application" as const)
    const sets: string[] = ["version = ?"]
    const args: (string | number | null)[] = [next]
    const events: { event: string; note: string }[] = []

    if (patch.status !== undefined && patch.status !== cur.status) {
      sets.push(`${statusCol} = ?`)
      args.push(patch.status)
      events.push({ event: "status", note: `${cur.status} → ${patch.status}` })
    }
    if (patch.assign === "me" && cur.assignee_id !== admin.userId) {
      sets.push("assignee_id = ?", "assignee_name = ?")
      args.push(admin.userId, admin.nickname)
      events.push({ event: "assign", note: `指派给 ${admin.nickname}` })
    } else if (patch.assign === "none" && cur.assignee_id) {
      sets.push("assignee_id = NULL", "assignee_name = NULL")
      events.push({ event: "assign", note: "取消指派" })
    }
    if (patch.customerNote !== undefined && patch.customerNote.trim() !== (cur.customer_note ?? "")) {
      sets.push("customer_note = ?")
      args.push(patch.customerNote.trim() || null)
      events.push({ event: "customer_note", note: patch.customerNote.trim() || "（清空给对方的说明）" })
    }
    if (patch.note?.trim()) events.push({ event: "note", note: patch.note.trim() })
    if (!events.length) return { kind: "ok" as const, version: cur.version } // 什么都没变，不升版本

    await conn.execute(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`, [...args, id])
    for (const e of events) await addEvent(conn, { type, id, actor: admin, event: e.event, note: e.note, version: next })
    return { kind: "ok" as const, version: next }
  })
}
export const adminPatchRequest = (id: string, admin: SessionUser, p: AdminPatch) => patchEntity("intake_requests", id, admin, p)
export const adminPatchApplication = (id: string, admin: SessionUser, p: AdminPatch) =>
  patchEntity("provider_applications", id, admin, p)

export type AdminApplicationRow = {
  id: string
  displayName: string
  name: string
  contacts: ContactEntry[]
  status: ApplicationStatus
  works: number
  assigneeName: string | null
  createdAt: string
}
export async function adminListApplications(p: AdminListParams): Promise<{ rows: AdminApplicationRow[]; total: number }> {
  const where = APPLICATION_STATUSES.includes(p.status as ApplicationStatus) ? "WHERE review_status = ?" : ""
  const args: string[] = where && p.status ? [p.status] : []
  const pool = getPool()
  const [[count]] = await pool.execute<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM provider_applications ${where}`, args)
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT id, display_name, review_status, assignee_name, created_at, JSON_LENGTH(works_json) AS works,
            JSON_UNQUOTE(JSON_EXTRACT(profile_json, '$.name')) AS name,
            ${contactColumns("profile_json", "$")}
     FROM provider_applications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...args, ADMIN_PAGE_SIZE, (p.page - 1) * ADMIN_PAGE_SIZE],
  )
  return {
    total: Number(count.n),
    rows: rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      name: r.name ?? "",
      contacts: contactsFromRow(r),
      status: r.review_status,
      works: Number(r.works),
      assigneeName: r.assignee_name,
      createdAt: iso(r.created_at),
    })),
  }
}

export type AdminApplicationDetail = OwnerApplicationView & {
  ownerId: string
  assigneeId: string | null
  assigneeName: string | null
  consentVersion: string
  version: number
  events: IntakeEvent[]
}
export async function adminGetApplication(id: string): Promise<AdminApplicationDetail | null> {
  const [rows] = await getPool().execute<RowDataPacket[]>("SELECT * FROM provider_applications WHERE id = ?", [id])
  const r = rows[0]
  if (!r) return null
  return {
    id: r.id,
    ownerId: r.owner_id,
    displayName: r.display_name,
    status: r.review_status,
    customerNote: r.customer_note,
    profile: r.profile_json,
    works: r.works_json,
    assets: await assetsFor(r.id),
    deployments: await deploymentsFor(r.id, true),
    assigneeId: r.assignee_id,
    assigneeName: r.assignee_name,
    consentVersion: r.consent_version,
    version: r.version,
    events: await eventsFor("application", r.id),
    createdAt: iso(r.created_at),
    updatedAt: iso(r.updated_at),
  }
}

// 部署工单（人工）：管理员把 Demo 包部署到隔离的展示域名后，在这里登记结果。
// 「已上线」必须带一个 https 地址；其他状态的地址不会给申请人看
export type DeploymentPatch = { expectedVersion: number; status: string; publicUrl?: string; failureSummary?: string }
export async function adminUpdateDeployment(
  applicationId: string,
  workIndex: number,
  admin: SessionUser,
  p: DeploymentPatch,
): Promise<PatchOutcome> {
  if (!DEPLOY_STATUSES.includes(p.status as DeployStatus)) return { kind: "invalid", error: "部署状态无效" }
  const url = p.publicUrl?.trim() ?? ""
  if (url) {
    try {
      const u = new URL(url)
      if (u.protocol !== "https:" || u.username || u.password) throw new Error()
    } catch {
      return { kind: "invalid", error: "访问地址必须是完整的 https:// 地址" }
    }
  }
  if (p.status === "deployed" && !url) return { kind: "invalid", error: "标记「已上线」前先填写验证过的访问地址" }
  const summary = p.failureSummary?.trim().slice(0, 500) || null
  return withTx(async (conn) => {
    const [rows] = await conn.execute<RowDataPacket[]>(
      "SELECT status, version FROM demo_deployments WHERE application_id = ? AND work_index = ? FOR UPDATE",
      [applicationId, workIndex],
    )
    const cur = rows[0]
    if (!cur) return { kind: "not_found" as const }
    if (cur.version !== p.expectedVersion) return { kind: "conflict" as const }
    await conn.execute(
      "UPDATE demo_deployments SET status = ?, public_url = ?, failure_summary = ?, version = version + 1 WHERE application_id = ? AND work_index = ?",
      [p.status, url || null, summary, applicationId, workIndex],
    )
    const [[app]] = await conn.execute<RowDataPacket[]>("SELECT version FROM provider_applications WHERE id = ?", [applicationId])
    await addEvent(conn, {
      type: "application",
      id: applicationId,
      actor: admin,
      event: "deployment",
      note: `作品 ${workIndex + 1} 部署：${cur.status} → ${p.status}${url ? `（${url}）` : ""}${summary ? `；${summary}` : ""}`,
      version: app?.version ?? 0,
    })
    return { kind: "ok" as const, version: cur.version + 1 }
  })
}

// 待处理数量：后台总览页上显示
export async function adminPendingCounts(): Promise<{ requests: number; applications: number }> {
  const pool = getPool()
  const [[a]] = await pool.execute<RowDataPacket[]>("SELECT COUNT(*) AS n FROM intake_requests WHERE status = 'received'")
  const [[b]] = await pool.execute<RowDataPacket[]>(
    "SELECT COUNT(*) AS n FROM provider_applications WHERE review_status = 'pending_review'",
  )
  return { requests: Number(a.n), applications: Number(b.n) }
}
