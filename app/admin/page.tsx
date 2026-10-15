import Link from "next/link"

import { isDbConfigured } from "@/lib/db"
import { adminPendingCounts } from "@/lib/intake/store"

// 管理后台首页。
//
// 原来这里直接 redirect 到 /admin/projects（当时只有一个模块）。
// 加了数据看板之后就需要一个真正的导航页了——
// 否则看板只能靠手输网址访问，等于没上线。
//
// 用户需求、服务申请两张卡片上带「待处理」数字，进后台第一眼就知道有没有新需求。
// 数字只是锦上添花：没配数据库、表还没建、库连不上，都只是不显示数字，页面照常打开
export default async function AdminPage() {
  let pending: { requests: number; applications: number } | null = null
  if (isDbConfigured()) {
    try {
      pending = await adminPendingCounts()
    } catch {
      pending = null
    }
  }

  const modules = [
    {
      href: "/admin/intake/requests",
      title: "用户需求",
      desc: "首页提交的 AI 需求：统计、搜索筛选、查看联系方式，指派负责人并跟进状态",
      badge: pending ? `待处理 ${pending.requests}` : null,
    },
    {
      href: "/admin/intake/providers",
      title: "服务申请",
      desc: "服务方提交的资料与作品：审核、附件与 Demo 部署工单",
      badge: pending ? `待审核 ${pending.applications}` : null,
    },
    {
      href: "/admin/analytics",
      title: "数据看板",
      desc: "账号增长、登录漏斗、短信成本与各站点活跃度",
      badge: null,
    },
    {
      href: "/admin/projects",
      title: "项目管理",
      desc: "项目内容、发布状态、预览，含内部 Wiki",
      badge: null,
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {modules.map((m) => (
        <Link
          key={m.href}
          href={m.href}
          className="flex flex-col gap-1.5 rounded-lg border p-5 transition-colors hover:bg-muted/40"
        >
          <span className="flex items-center gap-2 font-medium">
            {m.title}
            {m.badge && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{m.badge}</span>
            )}
          </span>
          <span className="text-sm text-muted-foreground">{m.desc}</span>
        </Link>
      ))}
    </div>
  )
}
