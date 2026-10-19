import { revalidatePath } from "next/cache"

// 项目同时出现在首页（场景演示 + 更多作品）、详情页和需求参考列表，状态变更须一起刷新。
// 第四版起没有按服务方分开的作品页了（/providers/<slug> 只是跳转），不用再刷
export function revalidateProjectPages(slug: string) {
  revalidatePath("/")
  revalidatePath(`/projects/${slug}`)
  revalidatePath("/requests/new")
}
