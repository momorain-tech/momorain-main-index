// 表单以业务问题组织，和本地草稿、预览共用字段定义。
export type IntakeField = {
  key: string; label: string; type?: "text" | "textarea" | "select" | "multi" | "url"
  required?: boolean; hint?: string; options?: string[]; max?: number
}
export type IntakeGroup = { title: string; description: string; fields: IntakeField[] }
const contactFields: IntakeField[] = [
  { key: "contactType", label: "联系方式类型", type: "select", required: true, options: ["微信", "电话", "邮箱"] },
  { key: "contact", label: "联系方式", required: true, max: 100, hint: "仅用于平台对接，不公开展示。" },
]
export const demandGroups: IntakeGroup[] = [
  { title: "说清需求", description: "不用先懂技术，把问题和希望得到的结果说清楚就好。", fields: [
    { key: "title", label: "需求名称", required: true, max: 100, hint: "例如：把培训视频整理成图文教程" },
    { key: "problem", label: "你想解决什么问题", required: true, type: "textarea", hint: "现在最麻烦、最耗时，或者一直做不好的事情是什么？" },
    { key: "current", label: "目前是怎么处理的", type: "textarea", hint: "谁在做、用什么工具、大概经过哪些步骤？" },
    { key: "outcome", label: "希望得到什么结果", required: true, type: "textarea", hint: "完成以后，希望能看到、使用或交付什么？" },
  ] },
  { title: "补充背景与联系", description: "行业、用户和场景帮助双方沟通，不确定的部分可以留空。", fields: [
    { key: "industry", label: "所属行业／业务领域", type: "select", options: ["内容传媒", "教育培训", "电商零售", "企业服务", "制造业", "其他"] },
    { key: "industryOther", label: "其他行业说明", max: 100 },
    { key: "audience", label: "谁会使用", type: "multi", options: ["自己", "内部团队", "客户", "公众用户", "暂不确定"] },
    { key: "directions", label: "需求类型", type: "multi", options: ["内容生产", "办公自动化", "数据处理", "知识库／问答", "网站／应用", "其他", "不确定"] },
    { key: "name", label: "怎么称呼你", required: true, max: 50 },
    { key: "company", label: "公司／团队名称", max: 100 }, ...contactFields,
  ] },
]
export const workFields: IntakeField[] = [
  { key: "title", label: "作品名称", required: true, max: 100 },
  { key: "ownership", label: "项目类型", required: true, type: "select", options: ["客户项目", "团队自用", "自研项目"] },
  { key: "scenario", label: "适用场景与问题", required: true, type: "textarea" },
  { key: "contribution", label: "你／团队承担的工作", required: true, type: "textarea", hint: "说明独立开发、集成、前端、后端或其他职责。" },
  { key: "url", label: "Demo 或成果链接", required: true, type: "url", hint: "可查看的在线体验、录屏、截图或报告链接均可。" },
  { key: "output", label: "实际输出说明", required: true, type: "textarea", hint: "输入什么，最终得到什么？" },
  { key: "status", label: "当前状态", required: true, type: "select", options: ["可体验", "成果演示", "开发中"] },
  { key: "limits", label: "使用前提与限制", required: true, type: "textarea", hint: "登录、配置、费用、格式等；没有特殊条件也请说明。" },
  { key: "basis", label: "第三方或开源基础", required: true, type: "textarea", hint: "使用时写明原项目／作者及改造部分；未使用请写“无”。" },
  { key: "scope", label: "可公开范围", required: true, type: "textarea", hint: "确认可公开的材料，客户资料请先获得授权并脱敏。" },
  { key: "effect", label: "可验证的项目效果", type: "textarea", hint: "仅填写有依据的效果，不要求收入或效率数字。" },
]
export const providerGroups: IntakeGroup[] = [
  { title: "基本资料", description: "用客户能理解的名称和一句话介绍自己。联系方式默认仅供平台对接。", fields: [
    { key: "displayName", label: "对外展示名称", required: true, max: 100 },
    { key: "type", label: "服务方类型", required: true, type: "select", options: ["个人开发者", "小团队"] },
    { key: "intro", label: "一句话介绍", required: true, max: 200, hint: "例如：为内容团队开发视频与图文处理工具" },
    { key: "name", label: "联系人称呼", required: true, max: 50 }, ...contactFields,
    { key: "timezone", label: "所在城市／时区", max: 100 },
    { key: "website", label: "个人主页／团队网站", type: "url" },
    { key: "publicScope", label: "允许整理为公开展示的信息", type: "multi", required: true, options: ["展示名称", "一句话介绍", "服务能力", "代表作品", "联系方式"], hint: "仅表示你的公开意愿；平台整理后，发布前还会核对。联系方式可以不选。" },
  ] },
  { title: "服务能力", description: "将能力写成具体业务任务，把技术栈留作补充说明。", fields: [
    { key: "directions", label: "主要服务方向", required: true, type: "multi", options: ["内容生产工具", "办公自动化", "数据处理", "知识库／问答", "网站／应用", "模型集成", "其他"] },
    { key: "problems", label: "能解决的具体问题", required: true, type: "textarea", hint: "建议：将培训视频整理为可编辑、可导出的图文教程。避免只写“精通各种大模型”。" },
    { key: "deliverables", label: "可提供的交付内容", required: true, type: "multi", options: ["原型", "应用开发", "部署", "系统集成", "操作文档", "培训", "维护"] },
    { key: "deliveryNote", label: "交付内容补充说明", type: "textarea" },
    { key: "industry", label: "熟悉的行业／场景", max: 300 },
    { key: "technology", label: "技术能力与工具", max: 500 },
    { key: "limits", label: "可承接范围与限制", required: true, type: "textarea" },
  ] },
  { title: "代表作品", description: "至少一个真实作品，明确你承担的工作与材料公开范围。最多可整理六个作品。", fields: [] },
  { title: "承接条件", description: "排期与费用可以按项目评估，不需要提前承诺统一价格或周期。", fields: [
    { key: "availability", label: "当前承接状态", required: true, type: "select", options: ["可接新项目", "需排期", "暂不接单"] },
    { key: "cooperation", label: "合作方式", required: true, type: "multi", options: ["按项目", "阶段合作", "持续维护"] },
    { key: "start", label: "可开始时间", max: 100, hint: "日期或“需进一步沟通”" },
    { key: "time", label: "时间投入", type: "select", options: ["全职", "兼职", "按项目安排"] },
    { key: "pricing", label: "报价方式", required: true, type: "select", options: ["按项目评估", "按阶段报价", "其他"] },
    { key: "budget", label: "项目预算偏好", max: 200, hint: "范围或“需评估”" },
    { key: "deployment", label: "部署与维护能力", type: "textarea" },
    { key: "conditions", label: "其他合作条件", type: "textarea" },
  ] },
]
