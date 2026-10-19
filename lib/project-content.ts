// ─── 项目「案例内容」的数据模型 + 校验 + 发布检查 ─────────────────────
//
// 为什么单独一个文件：这里的东西前后端都要用——
// - 服务端 API 用它校验提交上来的数据、在「发布」时做完整检查（真正的防线）
// - 后台表单用同一个 checkPublish() 在页面上实时显示「还缺哪几项」（只为即时反馈）
// 所以这个文件**不能 import 任何服务端模块**（mysql2、next/headers、Buffer 都不行），
// 否则会被打包进浏览器、构建直接失败。算字节数用 TextEncoder，浏览器和 Node 都有。
//
// 设计依据：docs/MAIN_INDEX_EVOLUTION_V1.md §5（详情模板）和 §8（数据模型、发布门槛）

// ─── 枚举 ─────────────────────────────────────────────────────────
// 数据库里存 VARCHAR，取值范围由应用层这几个数组决定（加一个值不用改表结构）

export const OWNERSHIPS = ["client", "internal", "self"] as const
export type Ownership = (typeof OWNERSHIPS)[number]

export const OWNERSHIP_LABELS: Record<Ownership, string> = {
  client: "客户交付",
  internal: "团队自用",
  self: "自研产品",
}

// 成熟度：决定前台出不出「立即体验」按钮。和「是否发布」是两件事——
// 一个项目可以已发布但只能看成果（showcase），也可以未发布但其实能用
export const MATURITIES = ["interactive", "showcase", "developing"] as const
export type Maturity = (typeof MATURITIES)[number]

export const MATURITY_LABELS: Record<Maturity, string> = {
  interactive: "可体验",
  showcase: "成果演示",
  developing: "开发中",
}

// 成果的类型和来源标记。「示例成果」和「操作录像」必须分开标，
// 预录的视频不能让人以为是正在实时执行（§6.1）
export const OUTPUT_TYPES = ["image", "video", "file"] as const
export type OutputType = (typeof OUTPUT_TYPES)[number]

// 第四版加了两种（建议 §8「原始素材、生成结果、人工修订版明确区分」）：
// - input：这份样例用的原始素材（原视频、逐字稿……）。首页首屏「输入 → 输出」对照的左边就是它；
//   它不算成果，发布检查里的「至少一项真实成果」不认它
// - revised：人工修订过的成果。和 sample（工具直接生成、没改过的）分开标，访客才知道哪些是机器做的
export const OUTPUT_KINDS = ["sample", "recording", "revised", "input"] as const
export type OutputKind = (typeof OUTPUT_KINDS)[number]

export const OUTPUT_KIND_LABELS: Record<OutputKind, string> = {
  sample: "示例成果",
  recording: "操作录像",
  revised: "人工修订版",
  input: "原始素材",
}

// 案例里的「成果」= 除了原始素材以外的产物；「样例输入」= 标成原始素材的那几项
export function resultOutputs(c: CaseContent | undefined): CaseOutput[] {
  return (c?.outputs ?? []).filter((o) => o.kind !== "input")
}
export function inputOutputs(c: CaseContent | undefined): CaseOutput[] {
  return (c?.outputs ?? []).filter((o) => o.kind === "input")
}

// ─── 结构 ─────────────────────────────────────────────────────────

export type CaseOutput = {
  type: OutputType
  kind: OutputKind
  url: string
  caption: string // 这是什么成果、用什么输入得到的
  source: string // 素材来源 / 授权说明（公开部分），如「团队自拍视频」
  poster?: string // 视频封面
}

// 封面的性质（第三版）：screenshot = 真实运行截图 / 成片帧；illustration = 功能示意图（说明图，不是运行结果）。
// 示意图封面可以出现在普通作品列表里，但卡片上必须标「功能示意」，也不能拿来当精选（§3.4、§8.1）。
// 老数据没有这个字段 = 按截图对待（迁移 004 之前录入的封面都是手工挑的真实图）
export const COVER_KINDS = ["screenshot", "illustration"] as const
export type CoverKind = (typeof COVER_KINDS)[number]

export type ProjectCover = {
  url: string
  alt: string
  width?: number
  height?: number
  kind?: CoverKind
}

// 四个目标在这个项目上分别做到了什么（§5.2 第 6 项）。
// 写的是**这个项目的实际情况**，不是我们的服务承诺
export type CaseGoals = {
  usable?: string // 可用：使用条件、需不需要登录、产出什么
  deployable?: string // 可部署：已验证的部署方式（团队托管 / 客户环境）
  showcase?: string // 可展示：成果怎么看、怎么分享
  manageable?: string // 可管理：实际支持哪些配置和数据操作
}

// 第 1 版案例内容。version 字段留着：以后结构要变时，读的一方能认出旧数据
export type CaseContent = {
  version: 1
  audience?: string // 为谁
  scenario?: string // 业务场景
  problem?: string // 原来怎么处理、卡在哪
  role?: string // 应用负责哪一步
  input?: string // 公开输入样例的说明（首页场景演示里叫「本样例的处理范围」）
  manualEdits?: string // 这份样例产物里人工改了哪些（第四版：成果旁边必须说明，没改就写「未人工修改」）
  steps?: string[] // 关键步骤
  outputs?: CaseOutput[]
  contribution?: {
    self?: string // 团队自研部分
    openSource?: string // 开源基础（含必要署名）
    thirdParty?: string // 用到的第三方模型 / 服务
  }
  goals?: CaseGoals
  customization?: string[] // 可调整项
  deliverables?: string[] // 交付物
  excluded?: string[] // 不包含事项
  limits?: string[] // 格式、容量、时长、登录、额度、外部依赖
  dataFlow?: string // 数据去向：存在哪、发给谁、保留多久
}

// ─── 结构校验（保存时用：不管草稿还是发布都要过） ───────────────────
// 数据来自管理员，但仍按不可信输入处理：限制深度、数量、长度、URL 协议。
// 只认白名单里的字段，多余字段直接丢掉——所以存进库的永远是已知结构，
// 也就不存在「往 JSON 里塞一段 HTML 让前台执行」这回事（前台全部按纯文本渲染）

const TEXT_MAX = 2000 // 单段文字上限（字符）
const LIST_MAX = 20 // 列表最多几项
const ITEM_MAX = 300 // 列表每项上限
const OUTPUTS_MAX = 12
const CASE_BYTES_MAX = 60000 // 整个 JSON 的字节上限

// 媒体只接受站内路径（/开头，不能是 // 开头的协议相对地址）或 https 地址
export function isSafeMediaUrl(v: string): boolean {
  if (v.length > 500) return false
  if (/^\/(?!\/)/.test(v)) return true
  return /^https:\/\/[^\s]+$/.test(v)
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

function optText(v: unknown, label: string, max = TEXT_MAX): Result<string | undefined> {
  if (v === undefined || v === null) return { ok: true, value: undefined }
  if (typeof v !== "string") return { ok: false, error: `${label}必须是文字` }
  const t = v.trim()
  if (t.length > max) return { ok: false, error: `${label}超过 ${max} 字上限` }
  return { ok: true, value: t || undefined }
}

function optList(v: unknown, label: string): Result<string[] | undefined> {
  if (v === undefined || v === null) return { ok: true, value: undefined }
  if (!Array.isArray(v)) return { ok: false, error: `${label}必须是列表` }
  if (v.length > LIST_MAX) return { ok: false, error: `${label}最多 ${LIST_MAX} 项` }
  const items: string[] = []
  for (const item of v) {
    if (typeof item !== "string") return { ok: false, error: `${label}的每一项必须是文字` }
    const t = item.trim()
    if (t.length > ITEM_MAX) return { ok: false, error: `${label}单项超过 ${ITEM_MAX} 字` }
    if (t) items.push(t)
  }
  return { ok: true, value: items.length ? items : undefined }
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

export function validateCover(v: unknown): Result<ProjectCover | undefined> {
  if (v === undefined || v === null) return { ok: true, value: undefined }
  if (!isObject(v)) return { ok: false, error: "封面（cover）格式不对" }
  const url = typeof v.url === "string" ? v.url.trim() : ""
  if (!url) return { ok: true, value: undefined } // 地址留空 = 没有封面
  if (!isSafeMediaUrl(url)) {
    return { ok: false, error: "封面地址必须是 / 开头的站内路径或 https:// 地址" }
  }
  const alt = typeof v.alt === "string" ? v.alt.trim() : ""
  if (!alt || alt.length > 200) {
    return { ok: false, error: "封面必须填替代文本（alt，200 字内），读屏用户靠它知道图里是什么" }
  }
  const cover: ProjectCover = { url, alt }
  if (v.kind !== undefined && v.kind !== null && v.kind !== "") {
    if (!COVER_KINDS.includes(v.kind as CoverKind)) return { ok: false, error: "封面类型只能是真实截图或功能示意图" }
    cover.kind = v.kind as CoverKind
  }
  for (const k of ["width", "height"] as const) {
    const n = v[k]
    if (n === undefined || n === null || n === "") continue
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 10000) {
      return { ok: false, error: `封面${k === "width" ? "宽" : "高"}必须是 1-10000 的整数` }
    }
    cover[k] = n
  }
  return { ok: true, value: cover }
}

function validateOutput(v: unknown, i: number): Result<CaseOutput> {
  const label = `第 ${i + 1} 个成果`
  if (!isObject(v)) return { ok: false, error: `${label}格式不对` }
  if (!OUTPUT_TYPES.includes(v.type as OutputType)) {
    return { ok: false, error: `${label}的类型必须是 image / video / file` }
  }
  if (!OUTPUT_KINDS.includes(v.kind as OutputKind)) {
    return { ok: false, error: `${label}必须标明是示例成果、操作录像、人工修订版还是原始素材` }
  }
  const url = typeof v.url === "string" ? v.url.trim() : ""
  if (!isSafeMediaUrl(url)) {
    return { ok: false, error: `${label}的地址必须是 / 开头的站内路径或 https:// 地址` }
  }
  const caption = optText(v.caption, `${label}的说明`, ITEM_MAX)
  if (!caption.ok) return caption
  const source = optText(v.source, `${label}的来源`, ITEM_MAX)
  if (!source.ok) return source
  if (!caption.value) return { ok: false, error: `${label}缺少说明` }
  if (!source.value) return { ok: false, error: `${label}缺少来源说明（素材从哪来、是否获授权）` }

  const out: CaseOutput = {
    type: v.type as OutputType,
    kind: v.kind as OutputKind,
    url,
    caption: caption.value,
    source: source.value,
  }
  if (typeof v.poster === "string" && v.poster.trim()) {
    if (!isSafeMediaUrl(v.poster.trim())) {
      return { ok: false, error: `${label}的封面地址不合法` }
    }
    out.poster = v.poster.trim()
  }
  return { ok: true, value: out }
}

export function validateCaseContent(v: unknown): Result<CaseContent | undefined> {
  if (v === undefined || v === null) return { ok: true, value: undefined }
  if (!isObject(v)) return { ok: false, error: "案例内容（caseContent）必须是对象" }
  if (v.version !== 1) return { ok: false, error: "案例内容的 version 必须是 1" }

  const c: CaseContent = { version: 1 }

  const texts: [keyof CaseContent & string, string][] = [
    ["audience", "适合谁"],
    ["scenario", "业务场景"],
    ["problem", "原来的问题"],
    ["role", "应用负责的环节"],
    ["input", "输入样例"],
    ["manualEdits", "人工修改说明"],
    ["dataFlow", "数据去向"],
  ]
  for (const [key, label] of texts) {
    const r = optText(v[key], label)
    if (!r.ok) return r
    if (r.value) (c as Record<string, unknown>)[key] = r.value
  }

  const lists: [keyof CaseContent & string, string][] = [
    ["steps", "关键步骤"],
    ["customization", "可调整项"],
    ["deliverables", "交付物"],
    ["excluded", "不包含事项"],
    ["limits", "限制与费用"],
  ]
  for (const [key, label] of lists) {
    const r = optList(v[key], label)
    if (!r.ok) return r
    if (r.value) (c as Record<string, unknown>)[key] = r.value
  }

  if (v.outputs !== undefined && v.outputs !== null) {
    if (!Array.isArray(v.outputs)) return { ok: false, error: "成果（outputs）必须是列表" }
    if (v.outputs.length > OUTPUTS_MAX) {
      return { ok: false, error: `成果最多 ${OUTPUTS_MAX} 个` }
    }
    const outputs: CaseOutput[] = []
    for (let i = 0; i < v.outputs.length; i++) {
      const r = validateOutput(v.outputs[i], i)
      if (!r.ok) return r
      outputs.push(r.value)
    }
    if (outputs.length) c.outputs = outputs
  }

  // 两个嵌套对象：逐个字段取，未知字段丢掉
  const nested: [
    "contribution" | "goals",
    string,
    [string, string][],
  ][] = [
    ["contribution", "团队贡献", [["self", "自研部分"], ["openSource", "开源基础"], ["thirdParty", "第三方服务"]]],
    ["goals", "四个目标", [["usable", "可用"], ["deployable", "可部署"], ["showcase", "可展示"], ["manageable", "可管理"]]],
  ]
  for (const [key, label, fields] of nested) {
    const obj = v[key]
    if (obj === undefined || obj === null) continue
    if (!isObject(obj)) return { ok: false, error: `${label}格式不对` }
    const picked: Record<string, string> = {}
    for (const [f, fLabel] of fields) {
      const r = optText(obj[f], `${label} · ${fLabel}`)
      if (!r.ok) return r
      if (r.value) picked[f] = r.value
    }
    if (Object.keys(picked).length) (c as Record<string, unknown>)[key] = picked
  }

  if (new TextEncoder().encode(JSON.stringify(c)).length > CASE_BYTES_MAX) {
    return { ok: false, error: "案例内容整体太长，请精简" }
  }
  // 除了 version 什么都没填 = 没有案例内容，存 NULL，和「从没写过」是同一种表示
  if (Object.keys(c).length === 1) return { ok: true, value: undefined }
  return { ok: true, value: c }
}

// ─── 发布检查（§8.2 发布门槛） ──────────────────────────────────────
// 保存草稿只要过上面的结构校验；「发布」还要过这里的完整性检查。
// 返回缺项列表（空数组 = 可以发布）。写成「缺什么」而不是一个布尔值，
// 是为了让后台能直接告诉运营还差哪几项。

export type PublishFields = {
  name: string
  desc: string
  demo?: string
  ownership?: Ownership | null
  maturity?: Maturity | null
  featured: boolean
  cover?: ProjectCover | null
  caseContent?: CaseContent | null
}

export function checkPublish(p: PublishFields): string[] {
  const missing: string[] = []
  const c = p.caseContent ?? undefined
  const g = c?.goals ?? {}

  if (!p.ownership) missing.push("项目归属")
  if (!p.maturity) missing.push("成熟度")
  if (p.maturity === "developing") missing.push("「开发中」的项目本期不公开，请先改成熟度或保持未发布")

  // 成果演示和可体验共同的要求：真实成果、归属、贡献、范围、限制齐全
  if (!c?.audience) missing.push("适合谁")
  if (!c?.scenario) missing.push("业务场景")
  if (!c?.problem) missing.push("原来的问题")
  if (!resultOutputs(c).length) missing.push("至少一项真实成果（原始素材不算）")
  if (!c?.contribution?.self) missing.push("团队贡献 · 自研部分")
  if (!c?.deliverables?.length) missing.push("交付物")
  if (!c?.limits?.length) missing.push("限制与费用")
  if (!g.usable || !g.deployable || !g.showcase || !g.manageable) {
    missing.push("四个目标的项目说明（可用 / 可部署 / 可展示 / 可管理 都要写）")
  }

  // 可体验：额外要能真的去用
  if (p.maturity === "interactive") {
    if (!p.demo) missing.push("体验地址（demo）")
    if (!c?.input) missing.push("输入样例说明")
    if (!c?.steps?.length) missing.push("关键步骤")
    if (!c?.dataFlow) missing.push("数据去向")
  }

  // 精选：公开输入样例、完整成果、交付说明
  if (p.featured) {
    if (!p.cover) missing.push("封面（精选项目必填）")
    else if (p.cover.kind === "illustration") missing.push("精选需要真实截图封面（功能示意图不行）")
    if (!c?.input) missing.push("输入样例说明（精选项目必填）")
    if (!c?.customization?.length) missing.push("可调整项（精选项目必填）")
  }

  // 去重（可体验和精选都可能报「输入样例说明」）
  return Array.from(new Set(missing))
}
