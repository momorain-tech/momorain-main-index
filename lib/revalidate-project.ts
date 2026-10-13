import { revalidatePath } from "next/cache"

// 项目同时出现在首页、提供者作品页和需求参考列表，状态变更须一起刷新。
export function revalidateProjectPages(slug: string) {
  revalidatePath("/")
  revalidatePath(`/projects/${slug}`)
  revalidatePath("/requests/new")
  revalidatePath("/providers/momorain")
}
