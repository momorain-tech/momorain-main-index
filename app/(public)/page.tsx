import type { Metadata } from "next"
import Link from "next/link"

import { getHomeProjects, type Project } from "@/lib/projects"
import { RevealRoot } from "@/components/jike/reveal"
import { HeroCtas, WhoGrid, PlayButton, ToastButton } from "@/components/jike/home-actions"

// 设计稿移植：jike-tiyan/index.html → Next.js 首页
// 文案与区块顺序照设计稿原样；货架卡片的数据来自 lib/projects
// （DB 未配置时走静态 fallback，与旧首页同一套数据层，跳转目标不变）

export const metadata: Metadata = {
  // absolute：不带根布局的 "%s | 即刻体验" 模板，避免标题重复品牌名
  title: { absolute: "即刻体验 — 网上的神器，点开就能用" },
  description:
    "AI 神器超市：不用下载，点开就能用。上班族写周报，学生做作业，自媒体做视频，爸妈修老照片——会用手机就会用。",
}

// ISR：与旧首页一致（构建时预渲染，最多每 5 分钟后台刷新）
export const revalidate = 300

// ─── 静态内容（设计稿原文） ─────────────────────────────────────────

const MARQUEE_CHIPS = [
  "🪄 AI 一键抠图",
  "🎨 AI 画图",
  "✍️ AI 写文案",
  "📷 老照片修复",
  "🎬 AI 做视频",
  "💬 AI 聊天助手",
  "🗣️ 语音变文字",
  "🎙️ 文字变语音",
]

const CHAT_MESSAGES = [
  { avatar: "🦌", name: "小鹿", text: "跟着教程做，小白第一次就把证件照抠好了" },
  { avatar: "🎥", name: "阿豪", text: "群里问一句，十分钟就有人讲明白了" },
  { avatar: "👔", name: "老张", text: "把写文案神器教给我妈，她现在天天发朋友圈" },
  { avatar: "💼", name: "Mia", text: "昨天刚学的画图技巧，今天老板夸我 PPT 好看了" },
  { avatar: "📚", name: "阿杰", text: "期末笔记全靠录音转文字，室友都来问我怎么弄" },
  { avatar: "🏪", name: "燕子", text: "不会就问，这里的人都挺愿意教" },
  { avatar: "📱", name: "大川", text: "跟着群里的攻略，我的号一周涨了两千粉" },
  { avatar: "🎓", name: "琪琪", text: "本来只想玩一玩，结果学会了剪视频" },
]

// 货架徽章：现有数据按分区（猜你喜欢/当前最热/用户收藏）映射成设计稿徽章
const CATEGORY_BADGES = {
  recommended: "⭐ 今日必玩",
  trending: "🔥 最热门",
  starred: "❤️ 大家最爱",
} as const

// 占位卡片：设计稿 8 格里与真实项目零重叠的 2 个，等真实产品上线后替换
type ToolCard = {
  icon: string
  name: string
  badge?: string
  desc: string
  tags: string[]
  count: string
  demo?: string
}

const PLACEHOLDER_TOOLS: ToolCard[] = [
  {
    icon: "🎨",
    name: "AI 画图",
    desc: "一句话出大片：头像、壁纸、配图、海报，再也不用满网找图。",
    tags: ["自媒体", "学生"],
    count: "🚧 即将上架",
  },
  {
    icon: "📷",
    name: "老照片修复",
    desc: "模糊变高清、黑白上色。把爸妈年轻时的照片修好，发家族群被夸爆。",
    tags: ["爸妈长辈", "学生"],
    count: "🚧 即将上架",
  },
]

// ─── 页面 ───────────────────────────────────────────────────────────

export default async function HomePage() {
  const { recommended, trending, starred } = await getHomeProjects()

  // 真实项目在前（按现有分区顺序），占位卡片殿后；真实卡没有使用人数数据，
  // 不伪造数字（设计稿的「👥 N 人用过」是占位值，README 注明上线前替换）
  const shelf: ToolCard[] = [
    ...recommended.map((p) => toCard(p, CATEGORY_BADGES.recommended)),
    ...trending.map((p) => toCard(p, CATEGORY_BADGES.trending)),
    ...starred.map((p) => toCard(p, CATEGORY_BADGES.starred)),
    ...PLACEHOLDER_TOOLS,
  ]

  return (
    <RevealRoot>
      {/* Hero */}
      <header className="hero" id="top">
        <div className="wrap">
          <span className="hero-badge">✨ 为不会写代码的你准备 · 0 基础也能玩</span>
          <h1>
            网上的神器，<span className="grad-text">点开就能用</span>
          </h1>
          <p className="sub">
            刷到过太多"神器推荐"，却一个都用不上？
            <br />
            我们把网上的 AI 神器全部装好——<b>不用下载</b>，会用手机就会用。
          </p>
          <HeroCtas />
          <div className="hero-note">
            <span>无需下载</span>
            <span>全中文</span>
            <span>每步有教程</span>
          </div>
        </div>

        {/* 神器流动条：数组渲染两遍实现无缝循环（对应设计稿 JS 的 innerHTML 复制） */}
        <div className="marquee">
          <div className="marquee-track">
            {[...MARQUEE_CHIPS, ...MARQUEE_CHIPS].map((chip, i) => (
              <span key={i} className="m-chip">
                <span className="dot"></span>
                {chip}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* 痛点共鸣区 */}
      <section id="pain">
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="kicker">Pain Points</span>
            <h2>这说的是不是你？</h2>
            <p>每次刷到"神器推荐"，结局总是惊人的相似</p>
          </div>
          <div className="pain-grid">
            <div className="pain-card reveal" style={{ transitionDelay: ".05s" }}>
              <span className="emoji">📱</span>
              <h3>刷到神器，用不上</h3>
              <p>
                短视频说"这个 AI 工具绝了"，你兴冲冲点进去——要下载、要注册、要付费。折腾一圈，算了。看得见，用不着。
              </p>
            </div>
            <div className="pain-card reveal" style={{ transitionDelay: ".12s" }}>
              <span className="emoji">📌</span>
              <h3>收藏夹里吃灰</h3>
              <p>
                "先码后看"= 再也不看。收藏了几十个神器，一个都没真正打开过。不是懒，是打开还要研究半天。
              </p>
            </div>
            <div className="pain-card reveal" style={{ transitionDelay: ".19s" }}>
              <span className="emoji">😰</span>
              <h3>怕自己不会用</h3>
              <p>
                英文界面、设置按钮、看不懂的选项……"我是小白，玩得转吗？"还没开始，自己先怂了。
              </p>
            </div>
            <div className="pain-card reveal" style={{ transitionDelay: ".26s" }}>
              <span className="emoji">🤯</span>
              <h3>不知道选哪个</h3>
              <p>AI 工具一天出一个，到底哪个适合我？没人告诉我，试错的成本全是你自己的。</p>
            </div>
          </div>
        </div>
      </section>

      {/* 对比区 */}
      <section id="contrast" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="kicker">Before / After</span>
            <h2>
              从 <span className="old-text">半小时还不会</span> 到{" "}
              <span className="grad-text">30 秒上手</span>
            </h2>
          </div>
          <div className="contrast">
            <div className="panel old-panel reveal">
              <h3>以前 · 想用上一个神器</h3>
              <div className="step old">
                <span className="mark">✕</span>刷到推荐，先收藏再说
              </div>
              <div className="step old">
                <span className="mark">✕</span>下载、注册，可能还要付费
              </div>
              <div className="step old">
                <span className="mark">✕</span>英文界面，看不懂从哪开始
              </div>
              <div className="step old">
                <span className="mark">✕</span>折腾半小时……还是没用上
              </div>
              <div className="time-tag">神器继续在收藏夹吃灰</div>
            </div>
            <div className="vs reveal">VS</div>
            <div className="panel new-panel reveal">
              <h3>现在 · 在即刻体验</h3>
              <div className="step new">
                <span className="mark">✓</span>打开网页，中文导览
              </div>
              <div className="step new">
                <span className="mark">✓</span>点一下「点开就玩」
              </div>
              <div className="step new">
                <span className="mark">✓</span>30 秒上手，当场判断好不好用
              </div>
              <div className="step new">
                <span className="mark">✓</span>好用的留下，不合适的换下一个
              </div>
              <div className="time-tag">
                <span className="grad-text">平均 30 秒，当场用上</span> ⚡
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 身份入口 */}
      <section id="who" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="kicker">For You</span>
            <h2>不管你是谁，这里都有你的神器</h2>
            <p>点一下你的身份，看别人用它做什么</p>
          </div>
          <div className="reveal">
            <WhoGrid />
          </div>
        </div>
      </section>

      {/* 神器货架 */}
      <section id="shelf" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-head reveal">
            <span className="kicker">Playground</span>
            <h2>神器货架 · 点开就玩</h2>
            <p>全部装好了，不用下载，点一下就能上手。玩不明白？群里总有人答。</p>
          </div>
          <div className="proj-grid">
            {shelf.map((tool, i) => (
              <div
                key={tool.name}
                className="proj-card reveal"
                style={{ transitionDelay: `${0.06 * (i % 3)}s` }}
              >
                <div className="proj-top">
                  <span className="proj-icon">{tool.icon}</span>
                  <div>
                    <div className="proj-name">{tool.name}</div>
                    {tool.badge && <div className="proj-badge">{tool.badge}</div>}
                  </div>
                </div>
                <p className="proj-desc">{tool.desc}</p>
                <div className="proj-tags">
                  {tool.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="proj-meta">
                  <span className="proj-count">{tool.count}</span>
                  <PlayButton demo={tool.demo} name={tool.name} />
                </div>
              </div>
            ))}
          </div>
          <div className="proj-more reveal">
            <Link href="/#subscribe">每周都有新神器上架，订阅第一时间知道 →</Link>
          </div>
        </div>
      </section>

      {/* 大家在聊（消息为设计稿虚构版，社群上线后换真实消息） */}
      <section id="chat" style={{ padding: "0 0 56px" }}>
        <div className="wrap">
          <p className="chat-title reveal">
            💬 大家在聊什么 <span className="hint">· 群里更热闹</span>
          </p>
          <div className="chat-panel reveal" style={{ transitionDelay: ".1s" }}>
            <div className="chat-feed">
              <div className="chat-track">
                {[...CHAT_MESSAGES, ...CHAT_MESSAGES].map((m, i) => (
                  <div key={i} className="chat-msg">
                    <span className="chat-avatar">{m.avatar}</span>
                    <div>
                      <span className="name">{m.name}</span>
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="chat-foot">👥 3,412 人正在群里交流玩法</div>
          </div>
        </div>
      </section>

      {/* 数据条（设计稿的「50+ 神器」为占位值，按实际货架数量改） */}
      <div className="wrap reveal">
        <div className="stats">
          <div className="stat">
            <div className="num grad-text">8</div>
            <div className="label">神器已上架</div>
          </div>
          <div className="stat">
            <div className="num grad-text">0 下载</div>
            <div className="label">0 安装</div>
          </div>
          <div className="stat">
            <div className="num grad-text">30 秒</div>
            <div className="label">上手一个神器</div>
          </div>
          <div className="stat">
            <div className="num grad-text">全中文</div>
            <div className="label">每步有教程</div>
          </div>
        </div>
      </div>

      {/* 定制开发区 */}
      <section id="custom">
        <div className="wrap">
          <div className="custom-box reveal">
            <h2>
              玩着玩着，想要一个能帮你<span className="grad-text">赚钱</span>的神器？
            </h2>
            <p>
              别人用 AI 做副业，你还在观望？把你的想法告诉我们——专属神器 +
              手把手教程，从「会用」到「用上」，一步到位。
            </p>
            <div className="custom-steps">
              <div className="custom-step">
                <div className="n">1</div>
                <h4>说出你的想法</h4>
                <p>你想用它做什么？一句话说清</p>
              </div>
              <div className="custom-step">
                <div className="n">2</div>
                <h4>定制你的专属版</h4>
                <p>我们改好装好，点开就能用</p>
              </div>
              <div className="custom-step">
                <div className="n">3</div>
                <h4>手把手教你用到</h4>
                <p>中文教程带练，直到你用上为止</p>
              </div>
            </div>
            <ToastButton className="btn-primary" msg="🛒 专属定制通道即将开放，先订阅占个位吧！">
              说出你的需求
            </ToastButton>
          </div>
        </div>
      </section>

      {/* 开发者区 */}
      <section id="dev" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="dev-box reveal">
            <div>
              <h3>🛠️ 你手里有神器？</h3>
              <p>有好用的工具、好玩的网站？放上货架，让几万人亲手帮你验证它到底神不神。</p>
            </div>
            <ToastButton className="btn-ghost" msg="🚀 神器上架通道即将开放，敬请期待！">
              神器上架 →
            </ToastButton>
          </div>
        </div>
      </section>
    </RevealRoot>
  )
}

// ─── 数据映射 ───────────────────────────────────────────────────────

function toCard(p: Project, badge: string): ToolCard {
  return {
    icon: p.icon,
    name: p.name,
    badge,
    desc: p.desc,
    tags: p.tags,
    count: "⚡ 在线可玩 · 免下载",
    demo: p.demo,
  }
}
