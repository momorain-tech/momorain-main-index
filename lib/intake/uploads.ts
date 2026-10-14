import "server-only"
import { createHash } from "node:crypto"
import { createWriteStream } from "node:fs"
import { mkdir, open, readdir, rename, rm, stat } from "node:fs/promises"
import path from "node:path"

// ─── 用户上传的作品素材（§7.2）────────────────────────────────────
//
// 三类文件：截图（JPG/PNG/WebP）、录屏（MP4）、静态 Demo 包（ZIP）。
// 存在**持久卷**上（INTAKE_UPLOAD_DIR，Dokploy 里挂 volume），不进 Git、不进镜像、不进 public/。
// 没配这个目录 = 上传功能关闭，表单只显示「在线链接」这一种提供方式。
//
// 几条铁律：
// - 不信扩展名、不信浏览器给的 Content-Type，只认文件头几个字节（magic bytes）
// - 存储路径完全由服务端生成，用户的文件名只用于展示，绝不参与拼路径
// - ZIP 只检查目录表、**不解压**：路径穿越、绝对路径、符号链接、层级过深、解压后过大一律拒收
// - 这些文件只能通过带权限检查的 /api/intake/assets/[id] 读取，没有公开地址

export type AssetType = "image" | "video" | "zip"

// 初始上限（产品建议值，需结合代理、磁盘实测后调整；改了要同步改表单上的提示文字——
// 表单读的是 /api/intake/uploads 返回的 limits，所以只改这里就行）
export const UPLOAD_LIMITS: Record<AssetType, number> = {
  image: 10 * 1024 * 1024,
  video: 100 * 1024 * 1024,
  zip: 20 * 1024 * 1024,
}
export const ZIP_MAX_UNPACKED = 200 * 1024 * 1024
export const ZIP_MAX_ENTRIES = 2000
const ZIP_MAX_DEPTH = 12

export function uploadDir(): string | null {
  const dir = process.env.INTAKE_UPLOAD_DIR?.trim()
  return dir ? path.resolve(dir) : null
}

// 用户 id 原样进路径前先过一遍白名单；不符合的（理论上不会有）取哈希
export function ownerSegment(ownerId: string): string {
  return /^[A-Za-z0-9_-]{1,64}$/.test(ownerId)
    ? ownerId
    : createHash("sha256").update(ownerId).digest("hex").slice(0, 32)
}
export function objectKeyFor(ownerId: string, assetId: string) {
  return `intake/${ownerSegment(ownerId)}/${assetId}/original`
}
// object_key → 绝对路径。再确认一次结果确实在上传目录里面（防御性检查，key 本来就是自己生成的）
export function resolveObject(objectKey: string): string | null {
  const root = uploadDir()
  if (!root) return null
  const full = path.resolve(root, objectKey)
  return full.startsWith(root + path.sep) ? full : null
}

export class UploadError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

type Received = { tmpPath: string; size: number; sha256: string; mime: string }

// 把请求体流式写进临时文件：边写边算哈希、边数字节，超过上限立刻中断，
// 不把整个文件读进内存（100MB 的录屏放进内存，几个人同时传服务器就爆了）
export async function receiveToTemp(
  body: ReadableStream<Uint8Array>,
  type: AssetType,
  tmpName: string,
): Promise<Received> {
  const root = uploadDir()
  if (!root) throw new UploadError(503, "上传暂未开放")
  const tmpDir = path.join(root, "tmp")
  await mkdir(tmpDir, { recursive: true })
  const tmpPath = path.join(tmpDir, tmpName)
  const hash = createHash("sha256")
  const out = createWriteStream(tmpPath)
  let size = 0
  let head = Buffer.alloc(0)
  const reader = body.getReader()
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.length
      if (size > UPLOAD_LIMITS[type]) throw new UploadError(413, "文件超过大小上限")
      if (head.length < 16) head = Buffer.concat([head, Buffer.from(value.subarray(0, 16))])
      hash.update(value)
      if (!out.write(value)) await new Promise<void>((r) => out.once("drain", () => r()))
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())))
  } catch (err) {
    reader.cancel().catch(() => {})
    out.destroy()
    await rm(tmpPath, { force: true })
    throw err
  }
  if (size === 0) {
    await rm(tmpPath, { force: true })
    throw new UploadError(400, "文件是空的")
  }
  const mime = sniff(head)
  if (!mime || mimeType(mime) !== type) {
    await rm(tmpPath, { force: true })
    throw new UploadError(415, "文件格式不对：截图请用 JPG／PNG／WebP，录屏用 MP4，Demo 包用 ZIP")
  }
  if (type === "zip") {
    try {
      await inspectZip(tmpPath, size)
    } catch (err) {
      await rm(tmpPath, { force: true })
      throw err
    }
  }
  return { tmpPath, size, sha256: hash.digest("hex"), mime }
}

export async function commitTemp(tmpPath: string, objectKey: string) {
  const full = resolveObject(objectKey)
  if (!full) throw new UploadError(503, "上传暂未开放")
  await mkdir(path.dirname(full), { recursive: true })
  await rename(tmpPath, full)
}

// 只认这几种文件头。SVG、HTML 这类能带脚本的格式根本不在名单里——
// 它们在主站域名下被打开，就等于在主站运行了别人的脚本
export function sniff(head: Buffer): string | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "image/jpeg"
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])))
    return "image/png"
  if (head.length >= 12 && head.toString("latin1", 0, 4) === "RIFF" && head.toString("latin1", 8, 12) === "WEBP")
    return "image/webp"
  if (head.length >= 8 && head.toString("latin1", 4, 8) === "ftyp") return "video/mp4"
  if (head.length >= 4 && head.readUInt32LE(0) === 0x04034b50) return "application/zip"
  return null
}
function mimeType(mime: string): AssetType {
  return mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "zip"
}

// 读 ZIP 末尾的「中央目录」逐条检查，不解压任何内容。
// ZIP 结构：[文件1][文件2]…[中央目录：每个文件一条记录][目录结束标记 EOCD]
export async function inspectZip(file: string, size: number) {
  const fh = await open(file, "r")
  try {
    // EOCD 在最后 22 字节 + 最多 65535 字节注释里，从后往前找签名 0x06054b50
    const tailLen = Math.min(size, 22 + 65535)
    const tail = Buffer.alloc(tailLen)
    await fh.read(tail, 0, tailLen, size - tailLen)
    let eocd = -1
    for (let i = tailLen - 22; i >= 0; i--) {
      if (tail.readUInt32LE(i) === 0x06054b50) {
        eocd = i
        break
      }
    }
    if (eocd < 0) throw new UploadError(415, "ZIP 文件已损坏")
    const entries = tail.readUInt16LE(eocd + 10)
    const cdSize = tail.readUInt32LE(eocd + 12)
    const cdOffset = tail.readUInt32LE(eocd + 16)
    // 0xFFFF / 0xFFFFFFFF 表示 ZIP64（超大包），我们的上限远用不到，直接拒收省得写 ZIP64 解析
    if (entries === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff)
      throw new UploadError(415, "不支持 ZIP64 格式的压缩包")
    if (entries === 0) throw new UploadError(415, "压缩包是空的")
    if (entries > ZIP_MAX_ENTRIES) throw new UploadError(415, `压缩包里的文件超过 ${ZIP_MAX_ENTRIES} 个`)
    if (cdOffset + cdSize > size) throw new UploadError(415, "ZIP 文件已损坏")
    const cd = Buffer.alloc(cdSize)
    await fh.read(cd, 0, cdSize, cdOffset)

    let pos = 0,
      unpacked = 0,
      hasIndex = false
    const tops = new Set<string>()
    for (let n = 0; n < entries; n++) {
      if (pos + 46 > cd.length || cd.readUInt32LE(pos) !== 0x02014b50) throw new UploadError(415, "ZIP 文件已损坏")
      const flags = cd.readUInt16LE(pos + 8)
      const compressed = cd.readUInt32LE(pos + 20)
      const original = cd.readUInt32LE(pos + 24)
      const nameLen = cd.readUInt16LE(pos + 28)
      const extraLen = cd.readUInt16LE(pos + 30)
      const commentLen = cd.readUInt16LE(pos + 32)
      const externalAttr = cd.readUInt32LE(pos + 38)
      const name = cd.toString(flags & 0x800 ? "utf8" : "latin1", pos + 46, pos + 46 + nameLen)
      pos += 46 + nameLen + extraLen + commentLen

      if (flags & 0x1) throw new UploadError(415, "不接受加密的压缩包")
      // 高 16 位是 Unix 文件模式，0o120000 = 符号链接（解压出来可能指向服务器上任意文件）
      if (((externalAttr >>> 16) & 0o170000) === 0o120000) throw new UploadError(415, "压缩包里不能有符号链接")
      const parts = name.replace(/\\/g, "/").split("/")
      if (name.startsWith("/") || name.startsWith("\\") || /^[A-Za-z]:/.test(name) || parts.includes(".."))
        throw new UploadError(415, "压缩包里有不安全的文件路径")
      if (parts.length > ZIP_MAX_DEPTH) throw new UploadError(415, "压缩包的目录层级太深")
      unpacked += original
      if (unpacked > ZIP_MAX_UNPACKED) throw new UploadError(415, "压缩包解压后超过 200MB")
      // 压缩比异常高的大文件 = 典型的「压缩炸弹」
      if (original > 1024 * 1024 && compressed > 0 && original / compressed > 100)
        throw new UploadError(415, "压缩包里有压缩比异常的文件")
      if (parts[0] === "__MACOSX") continue
      const clean = parts.filter(Boolean)
      if (clean.length) tops.add(clean[0])
      // 静态 Demo 的入口：根目录或唯一顶层文件夹里的 index.html
      if (clean.join("/") === "index.html" || (clean.length === 2 && clean[1] === "index.html")) hasIndex = true
    }
    if (!hasIndex) throw new UploadError(415, "没有找到 index.html：请打包构建好的静态网页目录（含 index.html）")
    // index.html 不在根目录、而是在某个文件夹里时，这个文件夹必须是唯一的顶层项
    if (!tops.has("index.html") && tops.size > 1)
      throw new UploadError(415, "index.html 需要在压缩包根目录，或唯一的顶层文件夹里")
  } finally {
    await fh.close()
  }
}

// 用户给的文件名只用来展示：去掉路径、控制字符，截断到 120 字
export function displayName(raw: string | null): string {
  const base = (raw ?? "").split(/[\\/]/).pop() ?? ""
  const clean = base.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 120)
  return clean || "未命名文件"
}

// 清理：tmp 下超过一天的半截文件（上传中断留下的）
export async function cleanTmp() {
  const root = uploadDir()
  if (!root) return
  const tmpDir = path.join(root, "tmp")
  let names: string[] = []
  try {
    names = await readdir(tmpDir)
  } catch {
    return
  }
  const cutoff = Date.now() - 24 * 3600 * 1000
  for (const name of names) {
    const p = path.join(tmpDir, name)
    try {
      if ((await stat(p)).mtimeMs < cutoff) await rm(p, { force: true })
    } catch {
      /* 并发删除等情况忽略 */
    }
  }
}

export async function removeObject(objectKey: string) {
  const full = resolveObject(objectKey)
  if (full) await rm(path.dirname(full), { recursive: true, force: true })
}
