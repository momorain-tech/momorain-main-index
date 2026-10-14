// 首页、导航与页脚共用一份导航，避免改名后入口不一致。
export const platformNavigation = [
  { href: "/#platform", label: "平台介绍" },
  { href: "/#services", label: "服务内容" },
  { href: "/#projects", label: "Demo展示" },
  { href: "/#contact", label: "联系方式" },
]
// 首页「服务内容」的两张入口卡（第三版：每张只有标题、一段说明、一个按钮）。
//
// 需求方的说明是用户第三版建议里给定的原文。
// 服务方原文是「服务方来源于各大AI厂商在职或离职员工……」，但目前没有核实过的人员资料
// 能证明这一点（下面 providers 里的四个展示身份也证明不了），所以先用去掉人群来源的中性版本，
// 服务方向和原文一致（docs/MAIN_INDEX_V3_DEVELOPMENT.md §3.3）。
// 业务负责人提供真实人员资料、确认可公开后，再换回原文。
export const participationPaths = [
  {
    role: "需求方",
    title: "我有 AI 需求",
    description:
      "针对亟待用 AI 进行业务转型升级的企业，提供定制化服务，如 AI 客销、AI 财务、各种工作流、知识库等。",
    action: "提交需求",
    href: "/requests/new",
  },
  {
    role: "服务方",
    title: "我有 AI 服务",
    description:
      "面向提供 AI 服务的个人和团队，服务方向包括 AI 业务咨询、AI 能力培训、定制化 Agent 及各类 AI 工具。",
    action: "提交服务资料",
    href: "/providers/join",
  },
]
// 作品提供者。为了宣传，对外把作品分在几个不同的服务方名下展示（用户 2026-10-13 拍板），
// 实际都由 momorain 团队开发和对接。咨询仍然统一走平台微信，所以访客联系到的始终是我们。
//
// 名字是一次性随机生成后写死在这里的，不在渲染时随机：
// 如果每次请求都 Math.random()，服务端和浏览器算出来的不一样（水合报错），
// 而且刷新一次作者就变一次，反而露馅。
//
// 改这里时的规矩：
// - slug 就是 /providers/<slug> 的地址，上线后别再改，否则别人收藏或转发的链接会 404
// - 一个作品只能出现在一个 projectSlugs 里
// - 开源改造的作品（如 exprtrain），详情里的原作者署名不受这里影响，必须保留（MIT 协议要求）
export type Provider = {
  slug: string
  name: string
  type: string
  intro: string
  directions: string[]
  availability: string
  projectSlugs: string[]
}
export const providers: Provider[] = [
  {
    slug: "nightowl_7k",
    name: "nightowl_7k",
    type: "独立开发者",
    intro: "做办公和求职类的小工具，喜欢把繁琐的排版、格式问题交给程序处理。",
    directions: ["办公工具", "文档排版", "网站与应用"],
    availability: "承接范围与排期需沟通",
    projectSlugs: ["cv-workshop"],
  },
  {
    slug: "Aster0921",
    name: "Aster0921",
    type: "独立开发者",
    intro: "关注内容创作者的效率工具，也做语音交互方向的实验项目。",
    directions: ["内容生产工具", "语音交互", "模型与工具集成"],
    availability: "承接范围与排期需沟通",
    projectSlugs: ["clip-sketch", "talk-to-fengge"],
  },
  {
    slug: "linzh_dev",
    name: "linzh_dev",
    type: "小团队",
    intro: "专注 AI 视频生成：从一句话或一份逐字稿，自动产出配音、字幕和手绘动画。",
    directions: ["视频生成", "知识讲解", "部署与运维"],
    availability: "承接范围与排期需沟通",
    projectSlugs: ["openmontage", "whiteboard-video"],
  },
  {
    slug: "kai-w3n",
    name: "kai-w3n",
    type: "独立开发者",
    intro: "做语音识别和表达分析相关的工具，偏好在开源项目基础上改造落地。",
    directions: ["语音分析", "表达训练", "开源项目改造"],
    availability: "承接范围与排期需沟通",
    projectSlugs: ["exprtrain"],
  },
]
// 没有图片头像，头像位置用名字的首字母代替
export function providerMonogram(p: Provider) {
  return p.name.charAt(0).toUpperCase()
}
export function getProvider(slug: string) {
  return providers.find((p) => p.slug === slug)
}
// 只为已确认归属的历史项目署名，新项目不能自动算到某个服务方名下。
export function projectProvider(slug: string) {
  return providers.find((p) => p.projectSlugs.includes(slug))
}
export function projectScenarios(slug: string): string[] {
  const map: Record<string, string[]> = {
    "cv-workshop": ["办公工具", "求职简历"],
    "clip-sketch": ["内容生产", "图文教程"],
    openmontage: ["内容生产", "知识讲解"],
    "whiteboard-video": ["内容生产", "白板讲解"],
    exprtrain: ["表达训练", "语音分析"],
    "talk-to-fengge": ["语音交互"],
  }
  return map[slug] ?? []
}
