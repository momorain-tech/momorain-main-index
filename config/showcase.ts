// 第四版首页的「场景演示」：首页和作品详情页共用这一份（第四版建议 §4、§9「详情承接：与首页共用同一份内容」）。
//
// 分工：
// - 这里写的是**场景本身**——这类任务适合谁、客户要准备什么、哪些自动哪些人工、边界在哪。
//   这些不随某一份样例变化，也是我们对「能做什么」的说明，所以写在代码里、改要走代码审查
// - **某一份样例**的东西（实际用了什么输入、真实产物、人工改了哪些）放在数据库的案例内容里
//   （projects.case_content 的 input / outputs / manualEdits），在 /admin 录入，不用改代码。
//   没录入真实产物之前，页面只说「样例整理中」，不拿示意图、宣传封面冒充成果
//
// 写这里的规矩：只写各仓库文档和代码里查得到的事实（见每条后面的出处），
// 没验证过的能力写进「仍需评估」，不写进「输出」。
//
// ⚠️ consultScene 必须是 components/participation/intake-fields.ts 里 CONSULT_SCENES 的一项：
// 轻量咨询会原样存下这个字，后台按字显示

export type Implementation = "runnable" | "prototype"
export const IMPLEMENTATION_LABELS: Record<Implementation, string> = {
  runnable: "可运行 Demo",
  prototype: "概念原型",
}

// 演示来源（第四版 §4「自研演示另外说明来源」）：这些都是我们自己的演示，不是客户案例；
// 其中有的是在开源项目上改造的，要如实写出原作——开源协议要求署名，也不能把别人的工作说成自研
export type Origin = { kind: "self" | "adapted"; note: string }
export const ORIGIN_LABELS: Record<Origin["kind"], string> = {
  self: "团队自研演示",
  adapted: "开源项目改造演示",
}

export type Scene = {
  id: string // 首页锚点 #scene-<id>，上线后别改（会被分享出去）
  nav: string // 场景导航上的短名字
  title: string // 场景标题：用业务任务的说法，不用作品名
  consultScene: string // 「我也有类似情况」带进轻量咨询的场景
  projectSlugs: string[] // 第一个是主作品（取成果、详情链接），其余是同场景的相关作品
  implementation: Implementation
  origin: Origin
  task: { audience: string; before: string }
  input: { prepare: string[] } // 客户要准备什么（本次样例实际用了什么 → 数据库 case_content.input）
  output: string // 会得到什么（文字说明；真实产物 → 数据库 case_content.outputs）
  process: { automated: string[]; manual: string[] }
  boundary: { verified: string[]; assess: string[] }
}

export const scenes: Scene[] = [
  {
    // 出处：clipsketch-ai/CLAUDE.md、lib/projects-data.ts 的 clip-sketch 案例内容
    id: "tutorial",
    nav: "视频整理成图文教程",
    title: "把培训或操作视频，整理成图文教程",
    consultScene: "整理培训资料",
    projectSlugs: ["clip-sketch"],
    implementation: "runnable",
    // clipsketch-ai 最初是外部项目 ClipSketch AI（git 历史里的 Earisty、kid 等），后来转到 momorain-tech 组织下
    origin: {
      kind: "adapted",
      note: "基于开源项目 ClipSketch AI 改造；团队负责接入统一登录、托管模型和部署。",
    },
    task: {
      audience: "要把操作演示、技能教学类短视频，改写成图文教程的培训和内容团队",
      before: "逐帧截图，再一张张排版、写步骤说明，一条视频要花几个小时。",
    },
    input: {
      prepare: ["一段操作或教学短视频（也可以是一组截图）", "希望教程用在哪个平台、给谁看"],
    },
    output: "一组按步骤排列的手绘风格教程图，每步配一句说明；另附一段社媒文案和一张封面。",
    process: {
      automated: ["按标记的画面生成统一手绘风格的分步图", "起草步骤说明、文案和封面"],
      manual: ["在视频上标记哪些画面是关键步骤", "核对每一步的说明文字，必要时重新生成单张"],
    },
    boundary: {
      verified: ["短视频 → 手绘分步图 + 文案的完整流程，线上工具可以跑通"],
      assess: [
        "画面是手绘重绘，不是原视频截图：需要保留真实界面截图的教程要另行评估",
        "长培训视频（几十分钟）、导出 Word / PDF 文档，目前没有验证过",
      ],
    },
  },
  {
    // 出处：OpenMontage/DEPLOY.md、whiteboard/DEPLOY_SHELL.md、lib/projects-data.ts
    id: "explainer",
    nav: "讲解内容做成配音视频",
    title: "把讲解内容，制作成配音视频",
    consultScene: "制作讲解视频",
    projectSlugs: ["whiteboard-video", "openmontage"],
    implementation: "runnable",
    // 白板视频是团队自己写的；AI 视频工坊是在开源项目 OpenMontage（AGPL-3.0）上加的网页体验壳
    origin: {
      kind: "self",
      note: "白板视频由团队自研；AI 视频工坊基于开源项目 OpenMontage（AGPL-3.0），团队做了网页体验版（输入主题、审阅分镜、出片）。",
    },
    task: {
      audience: "需要做知识讲解、操作说明类短视频，但没有专职剪辑和配音的团队",
      before: "写稿、配音、画插画、剪辑合成分头做，环节多，改一句旁白就要返工好几步。",
    },
    input: {
      // 白板视频的输入是逐字稿，AI 视频工坊是一句话主题。产品资料 → 逐字稿这一步工具不做，要单独说明
      prepare: ["一份中文逐字稿（白板视频）或一句话主题（AI 视频工坊）", "希望的时长、用途和发布平台"],
    },
    output: "一条带旁白配音、逐句字幕和手绘动画的横版视频（1920×1080），可同时生成各平台封面。",
    process: {
      automated: ["按逐字稿拆分镜头、生成插画和手绘动画", "配音、字幕、背景音乐合成成片"],
      manual: ["出片前逐段审阅、修改旁白和镜头规划", "从产品资料整理成逐字稿（工具不做这一步，需要人工或另行评估）"],
    },
    boundary: {
      verified: ["逐字稿 / 主题 → 完整成片的流程，两个线上工具都可以跑通"],
      assess: [
        "直接输入产品手册、PPT 等资料生成视频，没有验证过",
        "依赖多个第三方模型服务（配音、插画、脚本），任一不可用时任务无法完成",
      ],
    },
  },
  {
    // 出处：expression-trainer（web/app.js 只有麦克风输入，没有文件上传）、lib/projects-data.ts
    id: "feedback",
    nav: "检查口播表达问题",
    title: "检查口播或演讲中的表达问题",
    consultScene: "分析表达",
    projectSlugs: ["exprtrain"],
    implementation: "runnable",
    // MIT 协议要求保留原作者署名（workspace CLAUDE.md）
    origin: {
      kind: "adapted",
      note: "基于开源项目 exprtrain（作者 fxy2311-youyou，MIT 协议）改造；团队把语音识别和分析放到了服务端。",
    },
    task: {
      audience: "要练习口播、汇报、演讲表达的个人，或需要给学员做表达反馈的培训团队",
      before: "回听录音、逐句记下口头禅和含糊说法，再整理成建议，很花时间也容易漏。",
    },
    input: {
      prepare: ["对着麦克风说一段（浏览器里实时转写）", "想重点改进的方面，例如口头禅、逻辑、用词"],
    },
    output: "实时字幕上标出填充词、犹豫词和笼统说法并给出替代说法；说完生成多维度的分析报告。",
    process: {
      automated: ["语音实时转文字", "标出问题用词，生成改进建议和分析报告"],
      manual: ["分析报告是参考意见，具体改法需要人自己判断"],
    },
    boundary: {
      verified: ["麦克风实时说 → 字幕标注 + 分析报告，线上工具可以跑通"],
      assess: [
        "上传已有的录音或视频文件来分析，目前不支持",
        "批量处理多人、多段录音，以及按自己的评分标准出报告，需要另行评估",
      ],
    },
  },
]

// 首屏固定展示哪个场景（第四版 §3：首屏固定一个案例，不轮播）。
// 「若培训视频样例尚不完整，就换用证据最齐全的演示」由首页按真实产物自动判断，这里只写首选
export const heroSceneId = "tutorial"

export function sceneOfProject(slug: string): Scene | undefined {
  return scenes.find((s) => s.projectSlugs.includes(slug))
}

// 核心团队的职责说明（第四版 §6）。用户 2026-10-19 定：先只写职责、不写人名，
// 可公开的人员资料确认后再补姓名。四个随机名字的服务方展示身份已经合并，见 config/platform.ts
export const teamRoles = [
  {
    title: "需求沟通与业务梳理",
    text: "理解你的任务和现有做法，确认素材、输出要求和范围，全程跟进沟通。",
  },
  {
    title: "技术评估与实现",
    text: "用你的样例验证方案是否可行，负责开发适配、部署上线和后续维护的安排。",
  },
]

// 合作方式（第四版 §5）。⚠️ 建议原文要求「逐项核实后再发布」：
// 这三种形式上线前要业务负责人确认确实能承接，不能承接的删掉，不要留着当招牌
export const cooperationForms = [
  {
    title: "一次成果制作",
    get: "一份教程、一条讲解视频或一次表达分析结果",
    assess: "素材是否齐全、质量要求、可以修改几轮",
  },
  {
    title: "现有流程适配",
    get: "按你的流程调整模板、步骤、输入输出或对接接口",
    assess: "现在的流程、处理量、系统条件",
  },
  {
    title: "工具开发与部署",
    get: "约定范围内的工具，部署到约定的环境并交付使用说明",
    assess: "功能范围、运行环境、维护责任",
  },
]

export const cooperationSteps = ["提供样例", "评估效果与范围", "确认报价、交付物和验收标准", "实施与验收"]
