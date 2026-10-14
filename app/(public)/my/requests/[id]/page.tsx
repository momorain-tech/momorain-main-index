import type { Metadata } from "next"

import { ReceiptView } from "@/components/participation/receipt-view"

// 提交者查看自己的需求进度。页面本身只是个外壳（不读 cookies，不查库），
// 数据由 ReceiptView 在浏览器里带着登录态去取；不是本人的记录接口会回 404
export const metadata: Metadata = {
  title: "需求进度",
  robots: { index: false, follow: false },
}

type PageProps = { params: Promise<{ id: string }> }

export default async function Page({ params }: PageProps) {
  const { id } = await params
  return (
    <div className="wrap participation-page receipt-page">
      <ReceiptView kind="request" id={id} />
    </div>
  )
}
