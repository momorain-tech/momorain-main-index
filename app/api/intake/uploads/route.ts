import { rm } from "node:fs/promises"

import { guardWrite, isDbUnavailable, json, newId, rateLimited } from "@/lib/intake/http"
import { insertAsset, uploadUsage } from "@/lib/intake/store"
import {
  UPLOAD_LIMITS,
  UploadError,
  ZIP_MAX_ENTRIES,
  ZIP_MAX_UNPACKED,
  commitTemp,
  displayName,
  objectKeyFor,
  receiveToTemp,
  removeObject,
  uploadDir,
  type AssetType,
} from "@/lib/intake/uploads"

// 运行时才知道有没有挂上传目录（INTAKE_UPLOAD_DIR），不能在构建期定死
export const dynamic = "force-dynamic"

const DAILY_FILES = 50
const DAILY_BYTES = 1024 * 1024 * 1024

// GET /api/intake/uploads —— 上传是否开放、各类型上限。表单据此决定显示哪些「作品提供方式」
export async function GET() {
  return json({
    enabled: !!uploadDir(),
    limits: { ...UPLOAD_LIMITS, zipUnpacked: ZIP_MAX_UNPACKED, zipEntries: ZIP_MAX_ENTRIES },
  })
}

// POST /api/intake/uploads?type=image|video|zip&name=<原文件名>
// 请求体就是文件本身（不是 multipart 表单）：服务端可以一边收一边写盘、一边数字节，
// 超过上限立刻断开，不用先把整个文件读进内存再解析。
//   201 { id, type, size, name }   401 未登录   413 太大   415 格式不对   429 配额用完   503 上传未开放
// 上传成功只代表「文件收到了、格式检查通过」，还没有人审核，也没有任何公开地址
export async function POST(request: Request) {
  if (!uploadDir()) return json({ error: "上传暂未开放，请改用在线链接" }, 503)
  const guard = await guardWrite(request)
  if (!guard.ok) return guard.response
  const { user } = guard

  const url = new URL(request.url)
  const type = url.searchParams.get("type") as AssetType
  if (!["image", "video", "zip"].includes(type)) return json({ error: "文件类型参数无效" }, 400)
  const declared = Number(request.headers.get("content-length") ?? 0)
  if (declared > UPLOAD_LIMITS[type]) return json({ error: "文件超过大小上限" }, 413)
  if (!request.body) return json({ error: "没有收到文件" }, 400)

  if (rateLimited(`upload:${user.userId}`, 20, 10 * 60 * 1000))
    return json({ error: "上传太频繁，请稍后再试" }, 429)

  try {
    const usage = await uploadUsage(user.userId)
    if (usage.count >= DAILY_FILES || usage.bytes + declared > DAILY_BYTES)
      return json({ error: "今天的上传额度已用完，请明天再试或改用在线链接" }, 429)

    const id = newId("as")
    const received = await receiveToTemp(request.body, type, id)
    const objectKey = objectKeyFor(user.userId, id)
    try {
      await commitTemp(received.tmpPath, objectKey)
      await insertAsset({
        id,
        ownerId: user.userId,
        objectKey,
        type,
        mime: received.mime,
        size: received.size,
        sha256: received.sha256,
        name: displayName(url.searchParams.get("name")),
      })
    } catch (err) {
      // 写库失败就把文件也删掉，不留「磁盘上有、数据库里没有」的孤儿文件
      await rm(received.tmpPath, { force: true })
      await removeObject(objectKey)
      throw err
    }
    return json({ id, type, size: received.size, name: displayName(url.searchParams.get("name")) }, 201)
  } catch (err) {
    if (err instanceof UploadError) return json({ error: err.message }, err.status)
    if (isDbUnavailable(err)) return json({ error: "服务暂不可用，请稍后再试" }, 503)
    throw err
  }
}
