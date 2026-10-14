// 测试用的极简 TypeScript 加载器：用项目已有的 typescript 编译器把 .ts 转成 CommonJS 再执行，
// 不引入 ts-node / jest 之类的新依赖，也不改应用的构建配置。
// 额外处理两件事：
//   · "@/xxx" 路径别名 → 项目根目录（和 tsconfig 的 paths 一致）
//   · "server-only" → 空模块（它在 Next 之外 import 会直接抛错，测试里只是 Node 进程，不需要这道保护）
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

const root = path.resolve(__dirname, '..')
const cache = new Map()

function resolveFile(request, fromDir) {
  const base = request.startsWith('@/') ? path.join(root, request.slice(2)) : path.resolve(fromDir, request)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

function loadTs(filename) {
  if (cache.has(filename)) return cache.get(filename).exports
  const source = fs.readFileSync(filename, 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: filename,
  }).outputText
  const mod = new Module(filename, module)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  cache.set(filename, mod)
  const originalRequire = mod.require.bind(mod)
  mod.require = (request) => {
    if (request === 'server-only') return {}
    if (request.startsWith('@/') || request.startsWith('.')) {
      const file = resolveFile(request, path.dirname(filename))
      if (file && /\.tsx?$/.test(file)) return loadTs(file)
    }
    return originalRequire(request)
  }
  mod._compile(compiled, filename)
  return mod.exports
}

module.exports = { load: (relative) => loadTs(path.join(root, relative)) }
