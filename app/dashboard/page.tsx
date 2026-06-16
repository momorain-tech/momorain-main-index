import { redirect } from "next/navigation"

// 后端登录成功后跳转到这里
// 目前只是中转，直接跳回首页
// 后续可以在这里加用户主页内容
export default function DashboardPage() {
  redirect("/")
}
