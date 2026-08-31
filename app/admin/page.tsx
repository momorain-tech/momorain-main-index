import Link from "next/link"

// 管理后台首页。
//
// 原来这里直接 redirect 到 /admin/projects（当时只有一个模块）。
// 加了数据看板之后就需要一个真正的导航页了——
// 否则看板只能靠手输网址访问，等于没上线。
export default function AdminPage() {
  const modules = [
    {
      href: "/admin/analytics",
      title: "数据看板",
      desc: "账号增长、登录漏斗、短信成本与各站点活跃度",
    },
    {
      href: "/admin/projects",
      title: "项目管理",
      desc: "首页展示的项目列表，含内部 Wiki",
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
          <span className="font-medium">{m.title}</span>
          <span className="text-sm text-muted-foreground">{m.desc}</span>
        </Link>
      ))}
    </div>
  )
}
