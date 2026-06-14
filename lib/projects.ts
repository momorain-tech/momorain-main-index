export type Project = {
  slug: string       // URL 标识符，如 "rainflow"
  icon: string
  name: string
  desc: string       // 卡片上的简短描述
  longDesc: string   // 详情页的完整介绍
  tags: string[]
  link?: string      // 可选的外部链接
  demo?: string      // 可选的 Demo 地址，支持 iframe 内嵌展示
}

export const RECOMMENDED_PROJECTS: Project[] = [
  {
    slug: "rainflow",
    icon: "🌊",
    name: "RainFlow",
    desc: "轻量级数据流状态管理库，零依赖，支持 SSR",
    longDesc:
      "RainFlow 是一个极简的 React 状态管理库，核心代码不足 200 行，零运行时依赖。它借鉴了 Zustand 的 API 设计，并针对 Next.js SSR 场景做了专门优化，确保服务端和客户端状态完全一致，彻底消除 hydration 警告。",
    tags: ["React", "状态管理", "SSR", "TypeScript"],
    demo: "https://demo.rainflow.momorain.tech",
  },
  {
    slug: "palettekit",
    icon: "🎨",
    name: "PaletteKit",
    desc: "可视化主题生成工具，一键导出 Tailwind 配置",
    longDesc:
      "PaletteKit 提供一个直观的调色盘界面，让你通过拖拽和色轮选取品牌色，系统会自动生成符合 WCAG 对比度标准的完整色阶，并一键导出为 tailwind.config.ts、CSS 变量或 shadcn/ui 主题格式。",
    tags: ["Tailwind CSS", "设计工具", "可访问性"],
    demo: "https://demo.palettekit.momorain.tech",
  },
  {
    slug: "searchx",
    icon: "🔍",
    name: "SearchX",
    desc: "全文检索组件，支持中文分词与模糊匹配",
    longDesc:
      "SearchX 是一个开箱即用的前端搜索组件，内置基于 TF-IDF 的相关度排序和结果高亮。中文分词基于结巴分词的 WASM 版本，无需后端接口，所有计算在浏览器内完成，适合文档站、博客等静态场景。",
    tags: ["搜索", "中文", "WASM", "无后端"],
    demo: "https://demo.searchx.momorain.tech",
  },
  {
    slug: "boxui",
    icon: "📦",
    name: "BoxUI",
    desc: "企业级 React 组件库，覆盖 50+ 常用场景",
    longDesc:
      "BoxUI 基于 Radix UI 原语封装，提供 50+ 无障碍、可主题化的业务组件，覆盖表单、表格、模态框、数据展示等常见场景。完整支持 TypeScript，组件 API 经过真实项目打磨，文档包含可交互的 Storybook 示例。",
    tags: ["组件库", "Radix UI", "无障碍", "企业级"],
    demo: "https://demo.boxui.momorain.tech",
  },
  {
    slug: "fastroute",
    icon: "⚡",
    name: "FastRoute",
    desc: "基于 Radix Tree 的高性能 Next.js 路由增强",
    longDesc:
      "FastRoute 在 Next.js App Router 之上提供额外的路由能力：基于 Radix Tree 的参数匹配比内置方案快 3 倍、支持路由级别的权限守卫、内置路由分析面板实时展示各页面加载耗时，帮助快速定位性能瓶颈。",
    tags: ["Next.js", "路由", "性能", "权限"],
    demo: "https://demo.fastroute.momorain.tech",
  },
]

export const TRENDING_PROJECTS: Project[] = [
  {
    slug: "launchpad",
    icon: "🚀",
    name: "LaunchPad",
    desc: "一键部署工具，支持 Vercel / Railway / 自建服务器",
    longDesc:
      "LaunchPad 统一封装了主流托管平台的部署 API，通过一个配置文件 launch.yaml 描述你的应用，即可在 Vercel、Railway、Render 或自建 VPS 之间无缝切换，告别平台锁定。",
    tags: ["DevOps", "部署", "CI/CD"],
    demo: "https://demo.launchpad.momorain.tech",
  },
  {
    slug: "aiwidget",
    icon: "🤖",
    name: "AiWidget",
    desc: "嵌入式 AI 对话组件，接入任意 LLM 后端",
    longDesc:
      "AiWidget 是一个可嵌入任意网页的浮动 AI 对话组件，支持流式输出和 Markdown 渲染。后端适配器覆盖 OpenAI、Anthropic Claude、本地 Ollama 等主流接口，切换模型只需改一行配置。",
    tags: ["AI", "LLM", "组件", "流式输出"],
    demo: "https://demo.aiwidget.momorain.tech",
  },
  {
    slug: "chartrain",
    icon: "📊",
    name: "ChartRain",
    desc: "响应式数据可视化库，基于 Canvas 高性能渲染",
    longDesc:
      "ChartRain 使用 Canvas 2D 而非 SVG 渲染图表，在 10 万数据点场景下仍保持 60fps 流畅交互。内置折线图、柱状图、散点图、热力图等 12 种图表类型，支持暗色主题与自适应布局。",
    tags: ["可视化", "Canvas", "性能", "图表"],
    demo: "https://demo.chartrain.momorain.tech",
  },
  {
    slug: "authkit",
    icon: "🔐",
    name: "AuthKit",
    desc: "开箱即用的鉴权方案，支持 OAuth2 / Passkey",
    longDesc:
      "AuthKit 为 Next.js 应用提供完整的鉴权解决方案：支持 GitHub、Google OAuth2、Magic Link 邮件登录，以及最新的 Passkey 无密码认证。基于 JWT + HttpOnly Cookie，内置 CSRF 防护。",
    tags: ["鉴权", "OAuth2", "Passkey", "安全"],
    demo: "https://demo.authkit.momorain.tech",
  },
  {
    slug: "i18nflow",
    icon: "🌐",
    name: "I18nFlow",
    desc: "自动化国际化工作流，AI 辅助翻译 + 类型安全",
    longDesc:
      "I18nFlow 通过 CLI 扫描代码库，自动提取所有需要翻译的字符串，调用 LLM 完成初步翻译，并生成完整的 TypeScript 类型定义，让 t('key') 调用在编译期即可发现拼写错误和缺失翻译。",
    tags: ["i18n", "AI", "TypeScript", "自动化"],
    demo: "https://demo.i18nflow.momorain.tech",
  },
]

export const STARRED_PROJECTS: Project[] = [
  {
    slug: "solyricist",
    icon: "🎵",
    name: "SoLyricist",
    desc: "AI 辅助填词平台，已服务 10,000+ 创作者",
    longDesc:
      "SoLyricist 是 momorain-tech 旗下的旗舰产品，提供音节分析、韵脚推荐、意象联想等 AI 辅助填词功能。已积累超过 10,000 名创作者用户，生成词作 50 万首以上。",
    tags: ["AI", "音乐", "创作", "SaaS"],
    link: "https://solyricist.com",
    demo: "https://solyricist.com",
  },
  {
    slug: "imagegen",
    icon: "🖼️",
    name: "ImageGen",
    desc: "图像生成服务封装，统一调度多个 AI 绘图接口",
    longDesc:
      "ImageGen 作为 AI 绘图接口的聚合层，统一封装了 Stable Diffusion、DALL·E、Midjourney 等主流绘图服务。提供队列管理、失败重试、结果缓存和费用统计，大幅降低多模型调度的复杂度。",
    tags: ["AI 绘图", "API 聚合", "队列"],
    demo: "https://demo.imagegen.momorain.tech",
  },
  {
    slug: "notesync",
    icon: "📝",
    name: "NoteSync",
    desc: "多端同步笔记应用，端对端加密存储",
    longDesc:
      "NoteSync 采用 CRDT 算法实现无冲突的多端实时同步，所有内容在上传前经过 AES-256 端对端加密，服务端无法读取明文。支持 Markdown 编辑、双链笔记和知识图谱可视化。",
    tags: ["笔记", "CRDT", "端对端加密", "知识库"],
    demo: "https://demo.notesync.momorain.tech",
  },
  {
    slug: "filevault",
    icon: "🗂️",
    name: "FileVault",
    desc: "私有化文件管理系统，支持版本历史与协作",
    longDesc:
      "FileVault 是一个可自托管的团队文件管理平台，兼容 S3 协议的对象存储后端（MinIO、Cloudflare R2 等），提供文件版本历史、在线预览（PDF / 图片 / Office）、精细化权限控制和审计日志。",
    tags: ["文件管理", "自托管", "S3", "协作"],
    demo: "https://demo.filevault.momorain.tech",
  },
  {
    slug: "darkmatter",
    icon: "🌙",
    name: "DarkMatter",
    desc: "暗色主题设计系统，适配 shadcn/ui 生态",
    longDesc:
      "DarkMatter 是一套专为暗色环境设计的 UI 规范与主题包，在 shadcn/ui 的 CSS 变量体系上扩展了 20 个语义化颜色 token，解决了默认暗色模式下对比度不足、色彩疲劳等常见问题。",
    tags: ["设计系统", "暗色主题", "shadcn/ui"],
    demo: "https://demo.darkmatter.momorain.tech",
  },
]

// 所有项目合并，用于详情页通过 slug 查找
export const ALL_PROJECTS: Project[] = [
  ...RECOMMENDED_PROJECTS,
  ...TRENDING_PROJECTS,
  ...STARRED_PROJECTS,
]

export function getProjectBySlug(slug: string): Project | undefined {
  return ALL_PROJECTS.find((p) => p.slug === slug)
}
