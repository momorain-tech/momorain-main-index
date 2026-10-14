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

export const CONTACT_TYPES = ["微信", "电话", "邮箱"]
const contactFields: IntakeField[] = [
  {
    key: "contactType",
    label: "联系方式类型",
    type: "select",
    required: true,
    options: CONTACT_TYPES,
  },
  {
    key: "contact",
    label: "联系方式",
    required: true,
    max: 100,
    hint: "仅用于平台和你对接，不公开展示，也不会发给 AI 模型。",
  },
]

// ─── 需求方：两步 ───────────────────────────────────────────────
export const demandGroups: IntakeGroup[] = [
  {
    title: "需求与结果",
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
      },
      {
        key: "outcome",
        label: "希望得到什么结果",
        required: true,
        type: "textarea",
        min: 10,
        max: 2000,
        hint: "完成以后，希望能看到、使用或交付什么？",
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
      },
      { key: "budget", label: "预算范围", max: 200, extra: true, hint: "可以写「待评估」" },
      { key: "timeline", label: "期望时间", max: 200, extra: true, hint: "可以写「不着急」" },
    ],
  },
  {
    title: "联系方式与确认",
    description: "平台收到后由专人跟进，联系方式只用于对接。",
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
