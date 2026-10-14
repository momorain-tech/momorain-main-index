// 静态数据备份 —— 本地开发没有 DB 连接时作为 fallback
// 基础字段与 migrations/003_real_projects.sql 一致（没有 wiki，wiki 只在管理端出现）。
// 线上以 MySQL 为准：在 /admin 改过的内容不会同步回这里，两边漂移是正常的。
//
// 迁移 004 之后多出来的字段（归属、成熟度、精选、案例内容）在这里的取值原则：
// - ownership / maturity 全部留空 = 「还没评估」。这两项要业务和技术负责人确认，
//   本地样例不替他们下结论（和迁移 004 不猜归属是同一个道理）
// - featured 全部 false：精选要求有真实成果素材，目前一份都还没有
// - 视频转手绘、AI 视频工坊给了一份案例内容，**只写各仓库文档里能查到的事实**，
//   用来在本地看详情模板长什么样。没有 outputs（成果素材还没拍）
//
// 相对 003 改了两处简介文字（线上库里的旧文字需要在后台同样改掉）：
// - 视频转手绘：原文「不上传服务器」不准确——项目数据确实只存在浏览器里，
//   但生成时画面和文字会发给模型网关和模型供应商（§11）
// - AI 视频工坊：登录门槛从「开拍」挪到了「开始创作」（OpenMontage DEPLOY.md，2026-09-08）

import type { Project } from "./projects"
import type { ProjectCover } from "./project-content"

// 第三版的过渡封面：自制的功能示意图（public/images/demos/<slug>/cover.svg），不是运行截图。
// 卡片上会标「功能示意」，也不能用于精选。线上库由 migrations/006 写入同样的值
function illustrationCover(slug: string, name: string): ProjectCover {
  return {
    url: `/images/demos/${slug}/cover.svg`,
    alt: `${name}的输入输出功能示意，非运行截图`,
    width: 1440,
    height: 900,
    kind: "illustration",
  }
}

export const STATIC_PROJECTS: Project[] = [
  {
    slug: "cv-workshop",
    cover: illustrationCover("cv-workshop", "简历工坊"),
    icon: "📄",
    name: "简历工坊",
    desc: "在线写简历：左边编辑，右边实时预览，一键导出 PDF",
    longDesc:
      "简历工坊是 RenderCV 简历引擎的网页版。左边用 YAML 或表单填写经历，右边按页实时预览排版效果，满意后导出 PDF。默认使用带证件照的中文主题，内置中文字体，不用自己装任何东西。可以同时保存多份简历，数据存在你自己的浏览器里；编辑和预览无需登录，下载 PDF 时才需要手机号登录。",
    tags: ["简历", "PDF", "RenderCV", "在线工具"],
    demo: "https://momorain.com/cv-workshop",
    featured: false,
  },
  {
    slug: "clip-sketch",
    cover: illustrationCover("clip-sketch", "视频转手绘"),
    icon: "✏️",
    name: "视频转手绘",
    desc: "把短视频变成手绘分步教程图，顺带写好社媒文案和封面",
    longDesc:
      "ClipSketch AI 把一段短视频（或一组图片）拆成关键步骤，生成手绘风格的分步教程图，同时产出适合发小红书等平台的文案和封面。项目数据保存在你自己的浏览器里；生成时会把选中的画面和文字发给模型服务处理。默认使用 momorain 托管的模型，登录后即可生成；也可以填自己的 API Key。",
    tags: ["AI", "视频", "手绘", "内容创作"],
    demo: "https://momorain.com/clip-sketch/",
    featured: false,
    caseContent: {
      version: 1,
      audience: "需要把操作类短视频整理成图文教程的内容创作者",
      scenario: "一段教程短视频，要改写成可以发在图文平台上的分步教程：每一步一张图，再配一段文案和一张封面。",
      problem: "手工做法是逐帧截图、再一张张重画或排版、再单独写文案，一条视频要花很长时间。",
      role: "从视频里挑出关键步骤的画面，生成统一手绘风格的分步图，并起草文案和封面。",
      steps: ["导入短视频或一组图片", "在视频上标记关键步骤", "生成手绘风格的分步教程图", "生成社媒文案和封面"],
      limits: [
        "生成需要手机号登录（全站统一账号），浏览和导入不需要",
        "默认使用 momorain 托管模型，按量消耗账号额度；也可以填自己的 API Key",
        "项目数据只存在当前浏览器里，换设备或清除浏览器数据后无法找回",
      ],
      dataFlow:
        "项目数据（标记、抽帧、生成的图和文案）保存在浏览器本地 IndexedDB，团队服务器不保存。生成时，选中的画面和文字会发送给模型网关和对应的模型供应商。",
      goals: {
        deployable: "纯前端静态站，Docker 部署在团队服务器上，挂在 momorain.com/clip-sketch。",
        manageable: "没有管理后台。项目数据只在用户自己的浏览器里，团队无法代为查看或恢复。",
      },
    },
  },
  {
    slug: "talk-to-fengge",
    icon: "🎙️",
    name: "Talk to 峰哥",
    desc: "和 AI 分身实时语音聊天，声音和性格都像本人",
    longDesc:
      "像打电话一样和 AI 分身实时对话：语音识别、大模型回复、音色克隆合成串成一条链路，工程延迟压到 1 秒以内。除了声音，说话风格、口头禅和思维方式也做了人格注入。峰哥是这套架构的第一个完整示例，换一份语音素材和人格描述就能换成别人。需要允许浏览器使用麦克风。",
    tags: ["AI", "实时语音", "音色克隆", "LiveKit"],
    demo: "https://www.momorain.com/talk-to-fengge/",
    featured: false,
  },
  {
    slug: "openmontage",
    cover: illustrationCover("openmontage", "AI 视频工坊"),
    icon: "🎬",
    name: "AI 视频工坊",
    desc: "一句话生成手绘解说视频",
    longDesc:
      "输入一句话主题，AI 自动写旁白、规划镜头、配音、生成手绘风格插画，最后合成完整的解说视频。开拍前可以先审阅每一段旁白和镜头规划，确认后才开始制作。浏览免登录，从「开始创作」起需要手机号登录。",
    tags: ["AI", "视频生成", "手绘", "Remotion"],
    demo: "https://www.momorain.com/OpenMontage/",
    featured: false,
    caseContent: {
      version: 1,
      audience: "需要批量做知识讲解、产品介绍类短视频的内容团队",
      scenario: "给一个主题，产出一条带旁白、配音和手绘插画的完整解说视频。",
      problem: "传统流程要分别写稿、配音、画插画、剪辑合成，环节多、协作成本高。",
      role: "串起写旁白、规划镜头、配音、生成插画、合成渲染这几步，中间留出人工审阅的环节。",
      steps: ["输入一句话主题", "审阅并修改每一段旁白和镜头规划", "确认后开拍，生成配音和插画", "合成渲染出完整视频"],
      contribution: {
        thirdParty: "脚本 DeepSeek；插画 豆包 Seedream；配音 豆包 SeedTTS；视频合成 Remotion",
      },
      limits: [
        "从「开始创作」（生成分镜）起需要手机号登录，这一步开始调用付费模型",
        "依赖多个第三方模型服务，任一服务不可用时任务无法完成",
      ],
      goals: {
        deployable: "FastAPI 服务 + Remotion 渲染，Docker 部署在团队服务器上，挂在 www.momorain.com/OpenMontage；渲染较吃内存，建议 2 核 4G 起步。",
      },
    },
  },
  {
    slug: "exprtrain",
    cover: illustrationCover("exprtrain", "表达训练"),
    icon: "🗣️",
    name: "表达训练",
    desc: "对着麦克风说话，实时找出口头禅和含糊用词，AI 给出改进建议",
    longDesc:
      "一个训练口语表达精准度的工具：边说边实时转成字幕，自动标出填充词、犹豫词和笼统的说法并给出更精准的替代，说完生成从逻辑、直接性、用词密度等多个维度的分析报告。在线版基于开源项目 exprtrain（作者 fxy2311-youyou，MIT 协议）改造，语音识别和 AI 分析都放在服务端完成。需要允许浏览器使用麦克风。",
    tags: ["AI", "语音识别", "口语训练"],
    demo: "https://www.momorain.com/exprtrain/",
    featured: false,
  },
  {
    slug: "whiteboard-video",
    cover: illustrationCover("whiteboard-video", "白板视频"),
    icon: "🖍️",
    name: "白板视频",
    desc: "把中文逐字稿做成带配音、字幕的白板手绘动画视频",
    longDesc:
      "把一份中文逐字稿自动做成 1920×1080 的白板动画视频：旁白配音、逐句字幕、马克笔手绘动画（带画画的手）、低音量背景音乐一次合成，还能生成 YouTube、小红书、抖音等平台的封面。制作前可以逐段修改旁白、预览镜头规划，确认后才开始出片。",
    tags: ["AI", "视频生成", "白板动画", "TTS"],
    demo: "https://www.momorain.com/om-demo/",
    featured: false,
  },
]
