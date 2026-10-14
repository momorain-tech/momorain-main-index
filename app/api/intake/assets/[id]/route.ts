import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { Readable } from "node:stream"

import { getCurrentUser, isAdmin } from "@/lib/auth"
import { isDbConfigured } from "@/lib/db"
import { getAsset } from "@/lib/intake/store"
import { resolveObject } from "@/lib/intake/uploads"

type RouteContext = { params: Promise<{ id: string }> }

// GET /api/intake/assets/[id] —— 读取一个上传的素材。只有上传者本人和管理员能读，其余一律 404。
//
// 响应头是这个接口的安全重点：文件是用户传的，却挂在主站域名下，
// 万一某个文件被浏览器当成网页解析，里面的脚本就能以主站身份运行。所以：
// - Content-Type 用上传时按文件头识别出的类型，不用用户声明的
// - X-Content-Type-Options: nosniff —— 禁止浏览器自己「猜」类型
// - CSP sandbox —— 就算被当成网页打开，也是在沙箱里，没有脚本、没有同源权限
// - ZIP 强制下载（attachment），图片和视频才允许在页面里直接看
// 支持 Range：手机浏览器（尤其 Safari）播放视频必须能分段请求
export async function GET(request: Request, { params }: RouteContext) {
  const notFound = () => new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } })
  const { id } = await params
  if (!isDbConfigured() || !/^as_[A-Za-z0-9_-]{16}$/.test(id)) return notFound()
  const user = await getCurrentUser()
  if (!user) return notFound()
  const asset = await getAsset(id)
  if (!asset || (asset.owner_id !== user.userId && !isAdmin(user))) return notFound()
  const file = resolveObject(asset.object_key)
  if (!file) return notFound()
  let size: number
  try {
    size = (await stat(file)).size
  } catch {
    return notFound()
  }

  const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "application/zip": "zip" }[
    asset.mime
  ]
  const headers: Record<string, string> = {
    "Content-Type": asset.mime,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; media-src 'self'",
    "Cache-Control": "private, no-store",
    "Accept-Ranges": "bytes",
    // 下载时的文件名用编号，不用用户原文件名（原文件名可能含奇怪字符，后台页面上另有展示）
    "Content-Disposition": `${asset.type === "zip" ? "attachment" : "inline"}; filename="${asset.id}.${ext ?? "bin"}"`,
  }

  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/)
  if (range && (range[1] || range[2])) {
    // bytes=500-999 / bytes=500- / bytes=-500（最后 500 字节）
    let start = range[1] ? Number(range[1]) : size - Number(range[2])
    let end = range[1] && range[2] ? Number(range[2]) : size - 1
    start = Math.max(0, start)
    end = Math.min(end, size - 1)
    if (start > end) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } })
    return new Response(Readable.toWeb(createReadStream(file, { start, end })) as ReadableStream, {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    })
  }
  return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, {
    headers: { ...headers, "Content-Length": String(size) },
  })
}
