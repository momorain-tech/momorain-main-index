// 静态数据备份 —— 本地开发没有 DB 连接时作为 fallback
// 内容与 migrations/003_real_projects.sql 保持一致（只是没有 wiki，wiki 只在管理端出现）。
// 线上以 MySQL 为准：在 /admin 改过的内容不会同步回这里，两边漂移是正常的

import type { Project } from "./projects"

export const STATIC_RECOMMENDED: Project[] = [
  {
    slug: "cv-workshop",
    icon: "📄",
    name: "简历工坊",
    desc: "在线写简历：左边编辑，右边实时预览，一键导出 PDF",
    longDesc:
      "简历工坊是 RenderCV 简历引擎的网页版。左边用 YAML 或表单填写经历，右边按页实时预览排版效果，满意后导出 PDF。默认使用带证件照的中文主题，内置中文字体，不用自己装任何东西。可以同时保存多份简历，数据存在你自己的浏览器里；编辑和预览无需登录，下载 PDF 时才需要手机号登录。",
    tags: ["简历", "PDF", "RenderCV", "在线工具"],
    demo: "https://momorain.com/cv-workshop",
  },
  {
    slug: "clip-sketch",
    icon: "✏️",
    name: "视频转手绘",
    desc: "把短视频变成手绘分步教程图，顺带写好社媒文案和封面",
    longDesc:
      "ClipSketch AI 把一段短视频（或一组图片）拆成关键步骤，生成手绘风格的分步教程图，同时产出适合发小红书等平台的文案和封面。所有项目数据都保存在浏览器本地，不上传服务器。默认使用 momorain 托管的模型，登录后即可生成；也可以填自己的 API Key。",
    tags: ["AI", "视频", "手绘", "内容创作"],
    demo: "https://momorain.com/clip-sketch/",
  },
]

export const STATIC_TRENDING: Project[] = [
  {
    slug: "talk-to-fengge",
    icon: "🎙️",
    name: "Talk to 峰哥",
    desc: "和 AI 分身实时语音聊天，声音和性格都像本人",
    longDesc:
      "像打电话一样和 AI 分身实时对话：语音识别、大模型回复、音色克隆合成串成一条链路，工程延迟压到 1 秒以内。除了声音，说话风格、口头禅和思维方式也做了人格注入。峰哥是这套架构的第一个完整示例，换一份语音素材和人格描述就能换成别人。需要允许浏览器使用麦克风。",
    tags: ["AI", "实时语音", "音色克隆", "LiveKit"],
    demo: "https://www.momorain.com/talk-to-fengge/",
  },
  {
    slug: "openmontage",
    icon: "🎬",
    name: "AI 视频工坊",
    desc: "一句话生成手绘解说视频",
    longDesc:
      "输入一句话主题，AI 自动写旁白、规划镜头、配音、生成手绘风格插画，最后合成完整的解说视频。开拍前可以先审阅每一段旁白和镜头规划，确认后才开始制作。浏览免登录，「开拍」这一步需要手机号登录。",
    tags: ["AI", "视频生成", "手绘", "Remotion"],
    demo: "https://www.momorain.com/OpenMontage/",
  },
]

export const STATIC_STARRED: Project[] = [
  {
    slug: "exprtrain",
    icon: "🗣️",
    name: "表达训练",
    desc: "对着麦克风说话，实时找出口头禅和含糊用词，AI 给出改进建议",
    longDesc:
      "一个训练口语表达精准度的工具：边说边实时转成字幕，自动标出填充词、犹豫词和笼统的说法并给出更精准的替代，说完生成从逻辑、直接性、用词密度等多个维度的分析报告。在线版基于开源项目 exprtrain（作者 fxy2311-youyou，MIT 协议）改造，语音识别和 AI 分析都放在服务端完成。需要允许浏览器使用麦克风。",
    tags: ["AI", "语音识别", "口语训练"],
    demo: "https://www.momorain.com/exprtrain/",
  },
  {
    slug: "whiteboard-video",
    icon: "🖍️",
    name: "白板视频",
    desc: "把中文逐字稿做成带配音、字幕的白板手绘动画视频",
    longDesc:
      "把一份中文逐字稿自动做成 1920×1080 的白板动画视频：旁白配音、逐句字幕、马克笔手绘动画（带画画的手）、低音量背景音乐一次合成，还能生成 YouTube、小红书、抖音等平台的封面。制作前可以逐段修改旁白、预览镜头规划，确认后才开始出片。",
    tags: ["AI", "视频生成", "白板动画", "TTS"],
    demo: "https://www.momorain.com/om-demo/",
  },
]
