"use client"

import { useRef, useState } from "react"
import { Paperclip, X } from "lucide-react"

import { MAX_ASSETS_PER_WORK, type AssetMeta } from "@/lib/intake-validation"

// 作品附件上传：截图/录屏（最多 6 个）或一个静态 Demo 包（ZIP）。
//
// 为什么用 XMLHttpRequest 而不是 fetch？fetch 到现在还拿不到「上传进度」，
// 传一个 80MB 的录屏时用户需要看到进度条，否则会以为卡死了反复点。
// 请求体直接是文件本身（不是表单），服务端边收边检查，见 app/api/intake/uploads/route.ts。
//
// 上传成功只说明「文件收到了、格式检查通过」，界面上不说「已审核」「已部署」。

export type UploadConfig = {
  enabled: boolean
  limits?: { image: number; video: number; zip: number; zipUnpacked: number; zipEntries: number }
}

const mb = (n: number) => `${Math.round(n / 1024 / 1024)}MB`

export function WorkAssets({
  id,
  mode,
  ids,
  meta,
  config,
  loggedIn,
  loginHref,
  onBeforeLogin,
  error,
  onChange,
}: {
  id: string
  mode: "media" | "zip"
  ids: string[]
  meta: Record<string, AssetMeta>
  config: UploadConfig | null
  loggedIn: boolean
  loginHref: string
  onBeforeLogin: () => void
  error?: string
  onChange: (ids: string[], added?: AssetMeta) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [message, setMessage] = useState("")
  const max = mode === "zip" ? 1 : MAX_ASSETS_PER_WORK
  const limits = config?.limits

  if (!config?.enabled) {
    return <p className="field-error">上传暂未开放，请把作品方式改成「在线链接」，或通过微信发送材料。</p>
  }
  if (!loggedIn) {
    return (
      <div className="work-assets">
        <p className="field-hint">上传文件需要先登录，这样只有你和平台能看到这些材料。</p>
        <a className="intake-text-button" href={loginHref} onClick={onBeforeLogin}>
          先保存草稿并登录 →
        </a>
      </div>
    )
  }

  function upload(file: File) {
    const type = mode === "zip" ? "zip" : file.type.startsWith("video/") ? "video" : "image"
    // 浏览器侧先挡一下明显超限的，省得白传几十 MB 再被服务端拒绝（服务端照样会检查）
    const limit = limits?.[type]
    if (limit && file.size > limit) {
      setMessage(`「${file.name}」超过 ${mb(limit)} 上限`)
      return
    }
    setMessage("")
    setProgress(0)
    const xhr = new XMLHttpRequest()
    xhr.open("POST", `/api/intake/uploads?type=${type}&name=${encodeURIComponent(file.name)}`)
    xhr.setRequestHeader("Content-Type", "application/octet-stream")
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      setProgress(null)
      let data: { id?: string; name?: string; size?: number; type?: AssetMeta["type"]; error?: string } = {}
      try {
        data = JSON.parse(xhr.responseText)
      } catch {
        /* 非 JSON（比如网关错误页） */
      }
      if (xhr.status === 201 && data.id) {
        const added: AssetMeta = { id: data.id, name: data.name ?? file.name, type: data.type ?? type, size: data.size ?? file.size }
        onChange(mode === "zip" ? [data.id] : [...ids, data.id], added)
        setMessage(`「${added.name}」已上传，提交后由平台审核`)
      } else if (xhr.status === 401) {
        setMessage("登录已过期，请先保存草稿并重新登录")
      } else {
        setMessage(data.error ?? `上传失败（${xhr.status || "网络异常"}），可以重试`)
      }
    }
    xhr.onerror = () => {
      setProgress(null)
      setMessage("网络异常，上传没有完成，可以重试")
    }
    xhr.send(file)
  }

  return (
    <div className="work-assets" id={id} tabIndex={-1}>
      <p className="field-hint">
        {mode === "zip"
          ? `上传构建好的静态网页目录压缩包（含 index.html），${limits ? `不超过 ${mb(limits.zip)}，解压后不超过 ${mb(limits.zipUnpacked)}` : ""}。平台审核后安排部署到独立的展示域名，部署完成前不会有可访问地址。`
          : `JPG／PNG／WebP 截图${limits ? `（单张 ≤${mb(limits.image)}）` : ""}或 MP4 录屏${limits ? `（≤${mb(limits.video)}）` : ""}，最多 ${max} 个。材料仅平台可见，公开前会和你确认。`}
      </p>
      {ids.length > 0 && (
        <ul className="work-asset-list">
          {ids.map((aid) => (
            <li key={aid}>
              <Paperclip size={14} aria-hidden="true" />
              <span>{meta[aid]?.name ?? aid}</span>
              {meta[aid] && <small>{(meta[aid].size / 1024 / 1024).toFixed(1)}MB</small>}
              <button type="button" aria-label={`移除附件 ${meta[aid]?.name ?? aid}`} onClick={() => onChange(ids.filter((x) => x !== aid))}>
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {ids.length < max && (
        <>
          <input
            ref={inputRef}
            type="file"
            hidden
            accept={mode === "zip" ? ".zip,application/zip" : "image/jpeg,image/png,image/webp,video/mp4"}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = "" // 允许重复选同一个文件
              if (file) upload(file)
            }}
          />
          <button type="button" className="btn-ghost btn-md" disabled={progress !== null} onClick={() => inputRef.current?.click()}>
            <Paperclip size={16} /> {progress !== null ? `上传中 ${progress}%` : mode === "zip" ? "选择 ZIP 文件" : "选择截图或录屏"}
          </button>
        </>
      )}
      {progress !== null && <progress max={100} value={progress} aria-label="上传进度" />}
      <p className="intake-status" role="status" aria-live="polite">
        {message}
      </p>
      {error && <p className="field-error">{error}</p>}
    </div>
  )
}
