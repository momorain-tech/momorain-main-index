// 资料接收用到的各种状态 + 中文标签。纯数据，前台回执页、后台、接口三处共用。
//
// 三个状态彼此独立（§6.3「提交成功、AI 成功、人工已联系是三件事」）：
//   · 记录状态（status / review_status）：人工跟进到哪一步，只由管理员改
//   · AI 初评状态（analysis）：模型跑没跑完、成没成功
//   · 部署状态（deployment）：上传的 Demo 有没有真的上线
// 任何一个出问题都不能改写另外两个。比如 AI 失败了，需求照样是「已接收」。

export const REQUEST_STATUSES = [
  "received",
  "reviewing",
  "contacting",
  "waiting_customer",
  "closed",
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

// 后台看的标签
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  received: "已接收",
  reviewing: "评估中",
  contacting: "沟通中",
  waiting_customer: "等待对方补充",
  closed: "已关闭",
}
// 「跟进中」= 已经有人在看、还没关闭的三个状态。后台统计卡和筛选里的「跟进中」都按这一组算，
// 两边口径一致：点统计卡进去看到的条数 = 卡片上的数字
export const REQUEST_FOLLOWING: readonly RequestStatus[] = ["reviewing", "contacting", "waiting_customer"]
// 后台需求搜索的关键词长度上限
export const REQUEST_SEARCH_MAX = 50

// 提交者看的标签：站在对方角度说话
export const REQUEST_STATUS_PUBLIC: Record<RequestStatus, string> = {
  received: "已收到，等待平台跟进",
  reviewing: "平台正在评估",
  contacting: "已进入沟通",
  waiting_customer: "需要你补充资料",
  closed: "已关闭",
}

export const APPLICATION_STATUSES = [
  "pending_review",
  "needs_info",
  "ready_to_publish",
  "published",
  "declined",
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  pending_review: "待审核",
  needs_info: "需补充",
  ready_to_publish: "待发布确认",
  published: "已发布",
  declined: "暂不发布",
}
export const APPLICATION_STATUS_PUBLIC: Record<ApplicationStatus, string> = {
  pending_review: "已收到，等待平台审核",
  needs_info: "需要你补充资料",
  ready_to_publish: "资料已达到展示要求，等待和你确认发布内容",
  published: "已整理发布",
  declined: "暂不发布",
}

// AI 初评。not_requested = 用户没勾选；not_enabled = 平台还没配模型；
// limited = 今日名额用完（平台改人工评估）；stale = 需求改过，旧结果作废
export const ANALYSIS_STATUSES = [
  "not_requested",
  "not_enabled",
  "limited",
  "queued",
  "running",
  "succeeded",
  "failed",
  "needs_review",
  "stale",
] as const
export type AnalysisStatus = (typeof ANALYSIS_STATUSES)[number]
export const ANALYSIS_STATUS_LABELS: Record<AnalysisStatus, string> = {
  not_requested: "未要求 AI 初评",
  not_enabled: "AI 初评暂未开启，平台人工评估",
  limited: "今日 AI 初评名额已满，平台人工评估",
  queued: "排队中",
  running: "分析中",
  succeeded: "已完成",
  failed: "未能完成，平台人工评估",
  needs_review: "结果待平台核对",
  stale: "需求已更新，旧结果作废",
}

export const DEPLOY_STATUSES = [
  "pending_review",
  "queued",
  "building",
  "deployed",
  "failed",
  "paused",
] as const
export type DeployStatus = (typeof DEPLOY_STATUSES)[number]
export const DEPLOY_STATUS_LABELS: Record<DeployStatus, string> = {
  pending_review: "待审核",
  queued: "待部署",
  building: "部署中",
  deployed: "已上线",
  failed: "部署失败",
  paused: "已暂停",
}

// AI 初评的结构（§6.1）。只做初步判断，不承诺报价、工期、人选
export const FEASIBILITIES = ["likely_feasible", "needs_validation", "insufficient_information"] as const
export type Feasibility = (typeof FEASIBILITIES)[number]
export const FEASIBILITY_LABELS: Record<Feasibility, string> = {
  likely_feasible: "大概率可行",
  needs_validation: "需要验证",
  insufficient_information: "信息不足，暂难判断",
}
export type AnalysisResult = {
  understanding: string
  feasibility: Feasibility
  rationale: string[]
  suggestedApproach: string[]
  nextActions: string[]
  materialsNeeded: string[]
  openQuestions: string[]
  risksAndLimits: string[]
  deliveryOptions: string[]
  relatedProjectSlugs: string[]
}
export const ANALYSIS_LIST_KEYS = [
  ["rationale", "判断依据"],
  ["suggestedApproach", "建议的实现步骤"],
  ["nextActions", "接下来要做的事"],
  ["materialsNeeded", "需要你补充的样例或信息"],
  ["openQuestions", "尚待确认的问题"],
  ["risksAndLimits", "边界与风险"],
  ["deliveryOptions", "可能的交付形式"],
] as const

// 联系方式脱敏：列表里只露头尾，完整的只在详情里看
export function maskContact(v: string): string {
  const s = v.trim()
  if (s.includes("@")) {
    const [name, domain] = s.split("@")
    return `${name.slice(0, 2)}***@${domain}`
  }
  if (s.length <= 4) return s.slice(0, 1) + "***"
  return `${s.slice(0, 3)}****${s.slice(-2)}`
}

export function formatTime(v: string | Date): string {
  const d = typeof v === "string" ? new Date(v) : v
  // 服务器容器的时区是 Asia/Shanghai（Dockerfile 里设的），浏览器则用访客本地时区；
  // 显式写 timeZone 让两边算出来一样，避免水合不一致
  return d.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })
}
