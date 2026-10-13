// 首页、导航与页脚共用一份导航，避免改名后入口不一致。
export const platformNavigation = [
  { href: "/#platform", label: "平台介绍" },
  { href: "/#services", label: "服务内容" },
  { href: "/#projects", label: "Demo展示" },
  { href: "/#contact", label: "联系方式" },
]
export const participationPaths = [
  {
    role: "需求方",
    title: "我有 AI 需求",
    description: "把业务里最麻烦的一步说清楚，一起梳理实现方向与合作范围。",
    action: "整理项目需求",
    href: "/requests/new",
    steps: ["梳理需求", "沟通方案与服务方", "确认合作意向"],
  },
  {
    role: "服务方",
    title: "我能提供 AI 服务",
    description: "用真实作品说明你的能力，让有相关需求的人看懂你能交付什么。",
    action: "整理服务资料",
    href: "/providers/join",
    steps: ["整理作品与资料", "平台检查与对接", "确认合作意向"],
  },
]
// 当前只有一个真实团队，不用不同名字伪装成多个入驻服务方。
export const momorainProvider = {
  slug: "momorain",
  name: "momorain 团队",
  type: "小团队",
  intro: "围绕具体业务任务，开发 AI 工具、应用与展示网站。",
  directions: ["内容生产工具", "网站与应用", "模型与工具集成"],
  availability: "承接范围与排期需沟通",
  projectSlugs: [
    "cv-workshop",
    "clip-sketch",
    "openmontage",
    "whiteboard-video",
    "exprtrain",
    "talk-to-fengge",
  ],
}
// 只为已确认归属的历史项目署名，新项目不能自动算到团队名下。
export function projectProvider(slug: string) {
  return momorainProvider.projectSlugs.includes(slug) ? momorainProvider : undefined
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
