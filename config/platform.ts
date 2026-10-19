// 首页、导航与页脚共用一份导航，避免改名后入口不一致。
// 第四版（2026-10-19）按「场景 → 成果 → 合作 → 团队 → 咨询」重排，导航只留三项，
// 右侧主按钮「聊聊我的场景」在 components/jike/nav.tsx 里
export const platformNavigation = [
  { href: "/#scenes", label: "场景演示" },
  { href: "/#cooperation", label: "合作方式" },
  { href: "/#team", label: "核心团队" },
]

// 服务方合作入口（第四版移到页脚，不再和需求入口并排放在首页上）
export const providerJoin = { href: "/providers/join", label: "服务方合作" }

// 第二版到第四版之间，为了宣传把作品分在四个随机名字的「服务方」名下展示（2026-10-13），
// 实际都是同一个团队开发和对接。第四版建议（§6）要求统一对外身份，用户 2026-10-19 确认合并：
// 首页、作品详情、原服务方页一起改成「核心团队」。
//
// 这几个地址已经转发出去了，不能直接 404：/providers/<slug> 永久跳转到首页的核心团队区
// （app/(public)/providers/[slug]/page.tsx）。这份名单只用来生成跳转，别再往里加
export const legacyProviderSlugs = ["nightowl_7k", "Aster0921", "linzh_dev", "kai-w3n", "momorain"]

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
