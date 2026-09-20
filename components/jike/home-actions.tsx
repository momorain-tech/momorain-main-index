"use client"

import { useState } from "react"

import { useToast } from "@/components/jike/toast"

// 首页的交互片段（对应设计稿 <script> 里的各函数）。
// 静态区块留在服务端渲染，只有需要点击行为的元素拆成客户端组件。

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
}

// ── Hero 两个按钮 ──
export function HeroCtas() {
  return (
    <div className="hero-cta">
      <button className="btn-primary" onClick={() => scrollToId("shelf")}>
        ▶ 挑个神器，开玩
      </button>
      <button className="btn-ghost" onClick={() => scrollToId("who")}>
        先看看有什么
      </button>
    </div>
  )
}

// ── 身份卡片（设计稿 pick()） ──
const WHO_CARDS = [
  { emoji: "💼", name: "上班族", desc: ["周报、PPT、开会记录", "半小时的活 3 分钟干完"] },
  { emoji: "🎓", name: "学生党", desc: ["作业、笔记、小组展示", "AI 帮你整理得明明白白"] },
  { emoji: "🎬", name: "自媒体", desc: ["文案、配图、视频、配音", "一个人就是一个团队"] },
  { emoji: "🏪", name: "个体户", desc: ["海报、宣传、朋友圈广告", "不用再花钱请人做"] },
  { emoji: "👵", name: "爸妈长辈", desc: ["老照片修复、语音聊天", "发给老伙计，倍有面子"] },
]

export function WhoGrid() {
  const notify = useToast()
  const [active, setActive] = useState("")

  function pick(name: string) {
    setActive(name)
    notify(`${name}——你的专属神器就在货架上，往下翻翻看！`)
    setTimeout(() => scrollToId("shelf"), 900)
  }

  return (
    <div className="id-grid">
      {WHO_CARDS.map((c, i) => (
        <div
          key={c.name}
          className={`id-card${active === c.name ? " active" : ""}`}
          style={{ transitionDelay: `${0.05 * (i + 1)}s` }}
          onClick={() => pick(c.name)}
        >
          <span className="emoji">{c.emoji}</span>
          <h4>{c.name}</h4>
          <p>
            {c.desc[0]}
            <br />
            {c.desc[1]}
          </p>
        </div>
      ))}
    </div>
  )
}

// ── 货架卡片的「点开就玩」 ──
// 真实项目（有 demo 链接）：直接新标签打开，保住跳转核心功能
// 占位卡片（未上线）：toast + 引导订阅（设计稿原行为）
export function PlayButton({ demo, name }: { demo?: string; name: string }) {
  const notify = useToast()

  if (demo) {
    return (
      <a className="proj-play" href={demo} target="_blank" rel="noreferrer">
        ▶ 点开就玩
      </a>
    )
  }

  return (
    <button
      className="proj-play"
      onClick={() => {
        notify(`🚀 「${name}」正在为你准备，即将开放。先订阅，开玩第一时间通知！`)
        setTimeout(() => scrollToId("subscribe"), 1200)
      }}
    >
      ▶ 点开就玩
    </button>
  )
}

// ── 定制区 / 开发者区按钮（设计稿 toast()） ──
export function ToastButton({
  className,
  msg,
  children,
}: {
  className: string
  msg: string
  children: React.ReactNode
}) {
  const notify = useToast()
  return (
    <button className={className} onClick={() => notify(msg)}>
      {children}
    </button>
  )
}
