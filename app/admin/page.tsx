import { redirect } from "next/navigation"

// 管理后台目前只有项目管理一个模块，/admin 直接跳过去
// 以后加新模块（用户管理等）时，这里可以改成模块导航页
export default function AdminPage() {
  redirect("/admin/projects")
}
