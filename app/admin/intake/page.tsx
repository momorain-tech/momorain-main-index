import { redirect } from "next/navigation"

// /admin/intake 没有单独的总览，直接进需求队列（服务申请在页面顶部切换）
export default function AdminIntakePage() {
  redirect("/admin/intake/requests")
}
