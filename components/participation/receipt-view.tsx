"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

import {
  ANALYSIS_LIST_KEYS,
  ANALYSIS_STATUS_LABELS,
  APPLICATION_STATUS_PUBLIC,
  DEPLOY_STATUS_LABELS,
  FEASIBILITY_LABELS,
  REQUEST_STATUS_PUBLIC,
  formatTime,
  type AnalysisResult,
  type AnalysisStatus,
  type ApplicationStatus,
  type DeployStatus,
  type RequestStatus,
} from "@/lib/intake/constants"
import type { Values } from "@/lib/intake-validation"

// 提交者查看自己的回执和进度（/my/requests/[id]、/my/applications/[id]）。
//
// 数据全在客户端取（和账号页同一个理由：页面本身不读 cookies，保持静态外壳）。
// AI 初评排队 / 分析中时每 3 秒刷新一次；页面切到后台就暂停，
// 2 分钟还没出结果就停下来，提示「稍后回来看」——不无限转圈，也不假装快好了。

type RequestView = {
  id: string
  title: string
  status: RequestStatus
  customerNote: string | null
  values: Values
  reference: { slug: string; name: string; provider: string | null } | null
  analysis: { status: AnalysisStatus; result?: AnalysisResult }
  createdAt: string
  updatedAt: string
}
type ApplicationView = {
  id: string
  displayName: string
  status: ApplicationStatus
  customerNote: string | null
  profile: Values
  works: (Values & { assets?: string[] })[]
  assets: Record<string, { id: string; name: string; type: string; size: number }>
  deployments: { workIndex: number; status: DeployStatus; publicUrl: string | null; failureSummary: string | null }[]
  createdAt: string
  updatedAt: string
}

type Load<T> = { state: "loading" } | { state: "ok"; data: T } | { state: "login" } | { state: "missing" } | { state: "error" }

const POLL_MS = 3000
const POLL_GIVE_UP_MS = 2 * 60 * 1000

export function ReceiptView({ kind, id }: { kind: "request" | "application"; id: string }) {
  const [load, setLoad] = useState<Load<RequestView | ApplicationView>>({ state: "loading" })
  const [gaveUp, setGaveUp] = useState(false)
  const url = kind === "request" ? `/api/intake/requests/${id}` : `/api/intake/provider-applications/${id}`

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const started = Date.now()
    const fetchOnce = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" })
        if (cancelled) return
        if (res.status === 401) return setLoad({ state: "login" })
        if (res.status === 404) return setLoad({ state: "missing" })
        if (!res.ok) return setLoad({ state: "error" })
        const data = await res.json()
        if (cancelled) return
        setLoad({ state: "ok", data })
        const pending = kind === "request" && ["queued", "running"].includes((data as RequestView).analysis.status)
        if (!pending) return
        if (Date.now() - started > POLL_GIVE_UP_MS) return setGaveUp(true)
        schedule()
      } catch {
        if (!cancelled) setLoad({ state: "error" })
      }
    }
    // 页面在后台时不轮询；回到前台再接着来
    const schedule = () => {
      timer = setTimeout(() => {
        if (document.hidden) {
          document.addEventListener("visibilitychange", function resume() {
            if (!document.hidden) {
              document.removeEventListener("visibilitychange", resume)
              fetchOnce()
            }
          })
        } else fetchOnce()
      }, POLL_MS)
    }
    fetchOnce()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [url, kind])

  if (load.state === "loading") return <p className="receipt-muted">正在读取……</p>
  if (load.state === "login")
    return (
      <div className="receipt-box">
        <p>查看进度需要先登录提交时用的账号。</p>
        <a className="btn-primary btn-md" href={`/login?next=${encodeURIComponent(location.pathname)}`}>
          去登录
        </a>
      </div>
    )
  if (load.state === "missing")
    return (
      <div className="receipt-box">
        <p>没有找到这条记录。可能编号有误，或者它不是用当前账号提交的。</p>
        <Link href="/account">查看我的提交 →</Link>
      </div>
    )
  if (load.state === "error")
    return (
      <div className="receipt-box" role="alert">
        <p>暂时读取不到进度，请稍后刷新。资料已经保存在平台，不会因此丢失。</p>
      </div>
    )

  return kind === "request" ? (
    <RequestReceipt data={load.data as RequestView} gaveUp={gaveUp} />
  ) : (
    <ApplicationReceipt data={load.data as ApplicationView} />
  )
}

function Meta({ id, createdAt, updatedAt, status }: { id: string; createdAt: string; updatedAt: string; status: string }) {
  return (
    <dl className="receipt-meta">
      <div>
        <dt>记录编号</dt>
        <dd className="receipt-id">{id}</dd>
      </div>
      <div>
        <dt>提交时间</dt>
        <dd>{formatTime(createdAt)}</dd>
      </div>
      <div>
        <dt>当前状态</dt>
        <dd>
          <b>{status}</b>
        </dd>
      </div>
      <div>
        <dt>最近更新</dt>
        <dd>{formatTime(updatedAt)}</dd>
      </div>
    </dl>
  )
}

function CustomerNote({ note }: { note: string | null }) {
  if (!note) return null
  return (
    <div className="receipt-note" role="note">
      <b>平台留言</b>
      <p>{note}</p>
    </div>
  )
}

function RequestReceipt({ data, gaveUp }: { data: RequestView; gaveUp: boolean }) {
  const a = data.analysis
  return (
    <>
      <h1>{data.title}</h1>
      <Meta id={data.id} createdAt={data.createdAt} updatedAt={data.updatedAt} status={REQUEST_STATUS_PUBLIC[data.status]} />
      <CustomerNote note={data.customerNote} />

      <section className="receipt-section">
        <h2>AI 初评</h2>
        <p className="receipt-muted">
          {ANALYSIS_STATUS_LABELS[a.status]}
          {["queued", "running"].includes(a.status) && !gaveUp && " · 页面会自动刷新"}
          {gaveUp && " · 分析还没完成，可以稍后回来查看"}
        </p>
        {a.status === "succeeded" && a.result && <AnalysisBlock result={a.result} />}
        <p className="field-hint">
          AI 初评只是帮助平台更快理解需求的参考，不是报价、工期或合作承诺；平台会人工跟进。
        </p>
      </section>

      <section className="receipt-section">
        <h2>你提交的内容</h2>
        <dl className="receipt-values">
          {data.values.problem && <Row label="想解决的问题" value={data.values.problem} />}
          {data.values.outcome && <Row label="期望结果" value={data.values.outcome} />}
          {data.reference && <Row label="参考作品" value={data.reference.name} />}
          {data.values.name && <Row label="称呼" value={data.values.name} />}
          {data.values.contact && <Row label={`联系方式（${data.values.contactType}）`} value={data.values.contact} />}
        </dl>
      </section>
      <p>
        <Link href="/account" className="inline-link">
          ← 我的全部提交
        </Link>
      </p>
    </>
  )
}

export function AnalysisBlock({ result, projectHref = true }: { result: AnalysisResult; projectHref?: boolean }) {
  return (
    <div className="analysis-block space-y-2 text-sm">
      <p className="analysis-feasibility">
        初步判断：<b>{FEASIBILITY_LABELS[result.feasibility]}</b>
      </p>
      <p>{result.understanding}</p>
      {ANALYSIS_LIST_KEYS.map(([key, label]) =>
        result[key].length ? (
          <div key={key} className="analysis-list">
            <h3 className="font-medium">{label}</h3>
            <ul className="list-disc pl-5">
              {result[key].map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null,
      )}
      {result.relatedProjectSlugs.length > 0 && (
        <div className="analysis-list">
          <h3 className="font-medium">可以参考的平台作品</h3>
          <ul className="list-disc pl-5">
            {result.relatedProjectSlugs.map((slug) => (
              <li key={slug}>{projectHref ? <Link href={`/projects/${slug}`}>{slug}</Link> : slug}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string | string[] }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{Array.isArray(value) ? value.join("、") : value}</dd>
    </div>
  )
}

function ApplicationReceipt({ data }: { data: ApplicationView }) {
  return (
    <>
      <h1>{data.displayName}</h1>
      <Meta id={data.id} createdAt={data.createdAt} updatedAt={data.updatedAt} status={APPLICATION_STATUS_PUBLIC[data.status]} />
      <CustomerNote note={data.customerNote} />
      <section className="receipt-section">
        <h2>代表作品</h2>
        {data.works.map((w, i) => {
          const dep = data.deployments.find((d) => d.workIndex === i)
          return (
            <div className="receipt-work" key={i}>
              <h3>
                作品 {i + 1}：{w.title}
              </h3>
              <p className="receipt-muted">提供方式：{w.method}</p>
              {w.url && (
                <p>
                  链接：
                  <a href={String(w.url)} target="_blank" rel="noopener noreferrer nofollow">
                    {String(w.url)}
                  </a>
                </p>
              )}
              {(w.assets ?? []).length > 0 && (
                <ul className="work-asset-list">
                  {(w.assets ?? []).map((aid) => (
                    <li key={aid}>
                      {/* 只有本人和管理员能打开，见 /api/intake/assets/[id] */}
                      <a href={`/api/intake/assets/${aid}`} target="_blank" rel="noopener noreferrer">
                        {data.assets[aid]?.name ?? aid}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {dep && (
                <p>
                  部署状态：<b>{DEPLOY_STATUS_LABELS[dep.status]}</b>
                  {/* 只有「已上线」才有地址（服务端只在这种状态下返回 publicUrl） */}
                  {dep.status === "deployed" && dep.publicUrl && (
                    <>
                      {" "}
                      ·{" "}
                      <a href={dep.publicUrl} target="_blank" rel="noopener noreferrer">
                        打开 Demo ↗
                      </a>
                    </>
                  )}
                  {dep.status === "failed" && dep.failureSummary && <span>（{dep.failureSummary}）</span>}
                </p>
              )}
            </div>
          )
        })}
      </section>
      <p className="field-hint">审核只核对资料是否完整、可公开，不代表认证或订单承诺。公开展示前会和你确认内容。</p>
      <p>
        <Link href="/account" className="inline-link">
          ← 我的全部提交
        </Link>
      </p>
    </>
  )
}
