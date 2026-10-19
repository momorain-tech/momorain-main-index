import { sceneOfProject } from "@/config/showcase"
import { siteConfig } from "@/config/site"
import type { ConsultContext } from "@/components/consultation/consultation-card"

// 项目详情的公开地址（复制进咨询内容里，对方在微信里点开就能看到是哪个项目）
export function projectUrl(slug: string): string {
  return `${siteConfig.url}/projects/${slug}`
}

// 带项目上下文的咨询。只接收已发布项目的数据（服务端查出来的），不接收 URL 参数。
// 第四版：默认打开轻量咨询（选场景 + 进度 + 联系方式），场景按作品所属的首页场景预先选好；
// 微信联系在同一个弹窗里折叠着，始终可用
export function projectConsultContext(
  p: { slug: string; name: string },
  source: string,
): ConsultContext {
  return {
    source,
    intent: "demand",
    mode: "consult",
    scene: sceneOfProject(p.slug)?.consultScene,
    project: { slug: p.slug, name: p.name, url: projectUrl(p.slug) },
  }
}
