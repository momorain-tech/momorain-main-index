// 两类表单的字段定义：一份数据同时驱动「渲染、校验、摘要、服务端接收」四件事。
//
// 第三版（docs/MAIN_INDEX_V3_DEVELOPMENT.md §4）的变化：
// - 必填大幅减少：需求方只要「问题、期望结果、称呼、联系方式」；
//   服务方只要「名称、方向、能做什么、联系方式」+ 每个作品「名称、用途、提供方式、授权」
// - 不常用的字段收进折叠的「补充（选填）」区（extra: true），默认不打扰
// - 「第三方/开源基础」「使用条件」先问是/否，选「是」才展开要求细节，不再逼人写「无」
// - 这个文件不 import 任何服务端或 React 模块：服务端 API 也直接用它校验
export type IntakeField = {
  key: string
  label: string
  // check：单个勾选框，勾上的值是 "是"，没勾是 ""（必填 = 必须勾上）
  type?: "text" | "textarea" | "select" | "multi" | "url" | "check"
  required?: boolean
  hint?: string
  // 输入框里的灰色示例。只放「写成什么样」的例子，不放规则——规则写在 hint 里，
  // 因为一开始输入 placeholder 就消失了，用户会忘
  placeholder?: string
  // 手机键盘类型和浏览器自动填充。目前只有联系方式的三个输入框用
  inputMode?: "tel" | "email" | "text" | "url"
  autoComplete?: string
  // 「几项里至少填一项」的分组名。同组字段在表单里包进一个 fieldset，各自选填，
  // 由 lib/intake-validation.ts 的 contactErrors() 检查「至少一项」
  oneOf?: string
  options?: string[]
  max?: number
  // 最少字数。只用在「问题 / 期望结果」这种说一句「想用 AI」等于没说的地方
  min?: number
  // 收进折叠的「补充（选填）」区。只能用在选填字段上——必填的藏起来，用户找不到
  extra?: boolean
  // 条件字段：只有 showWhen.key 的值等于 showWhen.value 时才显示、校验、写进摘要。
  // 例如「其他行业说明」只在行业选了「其他」时出现——否则改选别的行业后，
  // 摘要里会同时出现「所属行业：教育培训」和一段「其他行业说明」，互相矛盾
  showWhen?: { key: string; value: string }
}
export type IntakeGroup = { title: string; description: string; fields: IntakeField[] }

// ─── 联系方式：电话、微信、邮箱三个输入框，至少填一个 ─────────────────
// 2026-10-15 前是「选一种类型（contactType）+ 填一个值（contact）」；现在改成三个独立字段，
// 用户想留几个就留几个，后台照着填了的那几种联系。旧记录在数据库里仍是 contactType + contact，
// 读的时候一律走 contactsOf()，新旧两种格式都认，**不需要迁移数据**。
//
// ⚠️ 下面的 type（电话/微信/邮箱）就是旧记录里 contactType 存的值，不能改字
export const CONTACT_TYPES = ["电话", "微信", "邮箱"] as const
export type ContactType = (typeof CONTACT_TYPES)[number]
export function isContactType(v: unknown): v is ContactType {
  return typeof v === "string" && (CONTACT_TYPES as readonly string[]).includes(v)
}
// 三个字段在表单里归成一组（oneOf: "contacts"），组的报错挂在这个键上
export const CONTACT_GROUP = "contacts"
export const CONTACT_KEYS: Record<ContactType, string> = { 电话: "phone", 微信: "wechat", 邮箱: "email" }

const contactFields: IntakeField[] = [
  {
    key: "phone",
    label: "电话",
    max: 100,
    oneOf: CONTACT_GROUP,
    placeholder: "手机号，或带区号的固定电话，如 0571-8888 6666",
    // 手机上 tel 弹拨号盘、email 弹带 @ 的键盘；autoComplete 让浏览器能自动填入自己的号码 / 邮箱
    inputMode: "tel",
    autoComplete: "tel",
  },
  {
    key: "wechat",
    label: "微信",
    max: 100,
    oneOf: CONTACT_GROUP,
    placeholder: "能搜到、能加好友的微信号，或绑定微信的手机号",
    inputMode: "text",
    autoComplete: "off",
  },
  {
    key: "email",
    label: "邮箱",
    max: 100,
    oneOf: CONTACT_GROUP,
    placeholder: "name@example.com",
    inputMode: "email",
    autoComplete: "email",
  },
]
// 组的标题和说明（FieldList 把 oneOf 相同的字段包进一个 fieldset，用这里的文字）
export const CONTACT_GROUP_TEXT = {
  legend: "联系方式",
  hint: "电话、微信、邮箱至少填一项，填了的平台都可能用来联系你，和登录用的手机号无关。只用于对接，不公开展示，也不会发给 AI 模型。",
}

type RawValues = Record<string, string | string[] | undefined>
export type ContactEntry = { type: ContactType; value: string }
// 一条记录里留下的全部联系方式，按 电话 → 微信 → 邮箱 排。新旧格式都认：
// 新格式读 phone / wechat / email；旧格式读 contactType + contact（只有一种）
export function contactsOf(v: RawValues | null | undefined): ContactEntry[] {
  if (!v) return []
  const out: ContactEntry[] = []
  for (const type of CONTACT_TYPES) {
    const value = v[CONTACT_KEYS[type]]
    if (typeof value === "string" && value.trim()) out.push({ type, value: value.trim() })
  }
  if (!out.length && isContactType(v.contactType) && typeof v.contact === "string" && v.contact.trim())
    out.push({ type: v.contactType, value: v.contact.trim() })
  return out
}
// 把旧格式（contactType + contact）搬到对应的新字段上。两个地方用：
// 1) 恢复上线前存下的本地草稿，不让用户填过的联系方式凭空消失；
// 2) 服务端接收——上线那一刻还开着旧页面的人提交上来的仍是旧格式，照样能收
export function migrateLegacyContact<T extends RawValues>(values: T): T {
  const { contactType, contact } = values
  if (!isContactType(contactType) || typeof contact !== "string") return values
  const { contactType: _t, contact: _c, ...rest } = values
  const key = CONTACT_KEYS[contactType]
  return { ...rest, [key]: typeof rest[key] === "string" && (rest[key] as string).trim() ? rest[key] : contact } as T
}

// ─── 需求方：两步 ───────────────────────────────────────────────
export const demandGroups: IntakeGroup[] = [
  {
    title: "描述需求",
    description: "不用先懂技术，把现在的问题和希望得到的结果说清楚就好。",
    fields: [
      {
        key: "problem",
        label: "你想解决什么问题",
        required: true,
        type: "textarea",
        min: 10,
        max: 2000,
        hint: "现在最麻烦、最耗时，或者一直做不好的事情是什么？谁在做、大概怎么做的？",
        placeholder: "例如：每周要把 20 多个内部培训视频整理成图文教程，现在靠两个人手工截图、写说明，一个视频要花半天。",
      },
      {
        key: "outcome",
        label: "希望得到什么结果",
        required: true,
        type: "textarea",
        min: 10,
        max: 2000,
        hint: "完成以后，希望能看到、使用或交付什么？",
        placeholder: "例如：上传视频后自动生成带截图的分步教程，可以导出 Word，我们再人工改改就能发给学员。",
      },
      {
        key: "title",
        label: "需求名称",
        max: 100,
        hint: "一句话概括，例如：把培训视频整理成图文教程。不填的话，后台会用问题的开头当标题。",
      },
      { key: "company", label: "公司／团队名称", max: 100, extra: true },
      {
        key: "industry",
        label: "所属行业／业务领域",
        type: "select",
        options: ["内容传媒", "教育培训", "电商零售", "企业服务", "制造业", "其他"],
        extra: true,
      },
      {
        key: "industryOther",
        label: "其他行业说明",
        max: 100,
        extra: true,
        showWhen: { key: "industry", value: "其他" },
      },
      {
        key: "current",
        label: "目前是怎么处理的",
        type: "textarea",
        max: 2000,
        extra: true,
        hint: "用了什么工具、经过哪些步骤？",
        placeholder: "例如：剪映截图 → 复制到 Word → 手写步骤说明 → 发群里",
      },
      { key: "budget", label: "预算范围", max: 200, extra: true, hint: "可以写「待评估」", placeholder: "例如：1 万以内 / 待评估" },
      { key: "timeline", label: "期望时间", max: 200, extra: true, hint: "可以写「不着急」", placeholder: "例如：月底前先看到样例 / 不着急" },
    ],
  },
  {
    title: "联系与确认",
    description: "留下至少一种联系方式，核对一遍需求就可以提交了。",
    fields: [{ key: "name", label: "怎么称呼你", required: true, max: 50 }, ...contactFields],
  },
]

// ─── 服务方：三步（基本资料与能力 → 代表作品 → 核对与提交） ─────────────
export const WORK_METHODS = ["在线链接", "上传截图或录屏", "提交静态 Demo 包"] as const
export const workFields: IntakeField[] = [
  { key: "title", label: "作品名称", required: true, max: 100 },
  {
    key: "summary",
    label: "用途与你承担的工作",
    required: true,
    type: "textarea",
    max: 1000,
    hint: "它解决什么问题、输入什么得到什么；你／团队负责了哪一部分。",
  },
  {
    key: "method",
    label: "作品怎么给我们看",
    required: true,
    type: "select",
    options: [...WORK_METHODS],
    hint: "选一种就够了，不用三样都准备。",
  },
  {
    key: "url",
    label: "Demo 或成果链接",
    required: true,
    type: "url",
    hint: "在线体验、录屏、截图或报告的链接都可以。",
    showWhen: { key: "method", value: "在线链接" },
  },
  {
    key: "publicConsent",
    label: "我有权公开这个作品的名称、用途和所提交的材料；含客户资料的部分已获授权并脱敏",
    type: "check",
    required: true,
  },
  {
    key: "openSource",
    label: "是否基于第三方或开源项目",
    required: true,
    type: "select",
    options: ["否，全部自己开发", "是，基于第三方或开源项目"],
  },
  {
    key: "basis",
    label: "原项目／作者，以及你改造了哪些部分",
    required: true,
    type: "textarea",
    max: 1000,
    showWhen: { key: "openSource", value: "是，基于第三方或开源项目" },
  },
  {
    key: "hasConditions",
    label: "使用时有没有前提条件",
    type: "select",
    options: ["没有，打开就能用", "有（登录、付费、配置等）"],
    extra: true,
  },
  {
    key: "conditions",
    label: "前提条件",
    type: "multi",
    options: ["需要登录", "需要付费", "需要自备 Key 或配置", "其他"],
    extra: true,
    showWhen: { key: "hasConditions", value: "有（登录、付费、配置等）" },
  },
  {
    key: "conditionsNote",
    label: "条件补充说明",
    max: 500,
    extra: true,
    showWhen: { key: "hasConditions", value: "有（登录、付费、配置等）" },
  },
  {
    key: "effect",
    label: "可验证的效果",
    type: "textarea",
    max: 1000,
    extra: true,
    hint: "只写有依据的效果，不要求收入或效率数字。",
  },
]
export const providerGroups: IntakeGroup[] = [
  {
    title: "基本资料与能力",
    description: "用客户看得懂的话介绍自己能做什么。联系方式只供平台对接。",
    fields: [
      { key: "displayName", label: "对外展示名称", required: true, max: 100 },
      {
        key: "directions",
        label: "主要服务方向",
        required: true,
        type: "multi",
        options: ["AI 业务咨询", "AI 能力培训", "定制化 Agent", "AI 工具开发", "知识库／问答", "其他"],
      },
      {
        key: "capability",
        label: "可以承接哪些工作",
        required: true,
        type: "textarea",
        max: 1000,
        hint: "例如：把企业培训视频整理成可编辑的图文教程。避免只写「精通各种大模型」。",
      },
      { key: "name", label: "联系人称呼", required: true, max: 50 },
      ...contactFields,
      {
        key: "type",
        label: "服务方类型",
        type: "select",
        options: ["个人", "小团队", "公司"],
        extra: true,
      },
      { key: "website", label: "个人主页／团队网站", type: "url", extra: true },
      { key: "city", label: "所在城市", max: 100, extra: true },
      { key: "industry", label: "熟悉的行业／场景", max: 300, extra: true },
      { key: "technology", label: "技术能力与工具", max: 500, extra: true },
      {
        key: "availability",
        label: "当前排期",
        type: "select",
        options: ["可接新项目", "需排期", "暂不接单"],
        extra: true,
      },
      {
        key: "pricing",
        label: "报价方式",
        type: "select",
        options: ["按项目评估", "按阶段报价", "按人天", "其他"],
        extra: true,
      },
    ],
  },
  {
    title: "代表作品",
    description: "至少一个真实作品。作品提供方式任选一种，最多六个作品。",
    fields: [],
  },
  {
    title: "核对与提交",
    description: "确认公开范围后提交。资料公开前，平台会逐项核对并和你确认。",
    fields: [
      {
        key: "publicScope",
        label: "愿意整理成公开展示的内容",
        type: "multi",
        options: ["展示名称", "服务方向与能力", "代表作品"],
        hint: "只表示你的意愿，发布前平台还会和你确认。联系方式始终不公开。",
      },
      { key: "scopeNote", label: "公开范围补充说明", max: 500 },
    ],
  },
]
// 同意条款的版本号。条款文字改了就升一下，后台能看出每份资料是按哪一版同意的
export const CONSENT_VERSION = "2026-10-v3"
