const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')
const { load } = require('./load-ts.cjs')

const { sniff, inspectZip, displayName, ownerSegment, objectKeyFor } = load('lib/intake/uploads.ts')
const { parseResult } = load('lib/intake/analysis.ts')
const { maskContact } = load('lib/intake/constants.ts')

// ── 手工拼一个 ZIP：本地文件头 + 中央目录 + 结束标记 ──
// 用来造各种「恶意」压缩包（路径穿越、符号链接、压缩炸弹……），不依赖任何 zip 库。
// entries: { name, data?, symlink?, original?(声称的解压大小), compressed? }
function buildZip(entries) {
  const locals = []
  const centrals = []
  let offset = 0
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8')
    const data = e.data ?? Buffer.alloc(0)
    const original = e.original ?? data.length
    const compressed = e.compressed ?? data.length
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x800, 6) // UTF-8 文件名
    local.writeUInt32LE(compressed, 18)
    local.writeUInt32LE(original, 22)
    local.writeUInt16LE(name.length, 26)
    locals.push(local, name, data)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(0x031e, 4) // made by Unix
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x800, 8)
    central.writeUInt32LE(compressed, 20)
    central.writeUInt32LE(original, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt32LE(((e.symlink ? 0o120777 : 0o100644) << 16) >>> 0, 38)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, name)
    offset += 30 + name.length + data.length
  }
  const cd = Buffer.concat(centrals)
  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(entries.length, 8)
  eocd.writeUInt16LE(entries.length, 10)
  eocd.writeUInt32LE(cd.length, 12)
  eocd.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, eocd])
}
async function check(entries) {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zip-test-')), 'a.zip')
  const buf = buildZip(entries)
  fs.writeFileSync(file, buf)
  try {
    await inspectZip(file, buf.length)
    return null
  } catch (err) {
    return err.message
  }
}
const html = { name: 'index.html', data: Buffer.from('<h1>demo</h1>') }

test('文件类型只看文件头：JPG/PNG/WebP/MP4/ZIP 认得出，SVG/HTML/改了扩展名的都不认', () => {
  assert.equal(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg')
  assert.equal(sniff(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png')
  assert.equal(sniff(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')), 'image/webp')
  assert.equal(sniff(Buffer.from('\0\0\0\x18ftypmp42', 'latin1')), 'video/mp4')
  assert.equal(sniff(buildZip([html]).subarray(0, 16)), 'application/zip')
  for (const bad of ['<svg xmlns="http://www.w3.org/2000/svg">', '<!doctype html><script>', 'GIF89a......']) assert.equal(sniff(Buffer.from(bad)), null, bad)
})
test('合法的静态 Demo 包通过：index.html 在根目录，或在唯一的顶层文件夹里', async () => {
  assert.equal(await check([html, { name: 'assets/app.js', data: Buffer.from('1') }]), null)
  assert.equal(await check([{ name: 'dist/' }, { name: 'dist/index.html', data: Buffer.from('x') }, { name: '__MACOSX/._dist' }]), null)
})
test('恶意 / 不合格的压缩包全部拒收', async () => {
  const cases = {
    路径穿越: [html, { name: '../../etc/cron.d/x', data: Buffer.from('x') }],
    反斜杠穿越: [html, { name: '..\\..\\x', data: Buffer.from('x') }],
    绝对路径: [html, { name: '/etc/passwd', data: Buffer.from('x') }],
    盘符路径: [html, { name: 'C:/Windows/x', data: Buffer.from('x') }],
    符号链接: [html, { name: 'link', data: Buffer.from('/etc/passwd'), symlink: true }],
    层级过深: [html, { name: 'a/'.repeat(15) + 'x.js', data: Buffer.from('x') }],
    压缩炸弹: [html, { name: 'bomb.bin', data: Buffer.alloc(10), compressed: 10, original: 50 * 1024 * 1024 }],
    解压过大: [html, { name: 'big.bin', data: Buffer.alloc(10), compressed: 10 * 1024 * 1024, original: 210 * 1024 * 1024 }],
    没有入口: [{ name: 'readme.txt', data: Buffer.from('x') }],
    入口不在顶层: [{ name: 'a/index.html', data: Buffer.from('x') }, { name: 'b/x.js', data: Buffer.from('x') }],
  }
  for (const [label, entries] of Object.entries(cases)) assert.ok(await check(entries), `${label} 应被拒收`)
})
test('损坏的文件不当成 ZIP 处理', async () => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zip-test-')), 'b.zip')
  const buf = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), zlib.deflateSync(Buffer.alloc(100))])
  fs.writeFileSync(file, buf)
  await assert.rejects(inspectZip(file, buf.length))
})
test('存储路径由服务端生成：用户 id 不合规时取哈希，文件名不参与拼路径', () => {
  assert.equal(objectKeyFor('12345', 'as_abc'), 'intake/12345/as_abc/original')
  assert.match(ownerSegment('../../root'), /^[0-9a-f]{32}$/)
  assert.equal(displayName('../../evil\u0000name.html'), 'evilname.html')
  assert.equal(displayName(null), '未命名文件')
})

const valid = {
  understanding: '把培训视频整理成图文教程',
  feasibility: 'likely_feasible',
  rationale: ['已有成熟的视频关键帧提取方案'],
  suggestedApproach: ['抽取关键帧', '生成说明文字'],
  nextActions: ['提供一段样例视频'],
  materialsNeeded: [],
  openQuestions: ['视频平均时长？'],
  risksAndLimits: ['画面质量差时效果下降'],
  deliveryOptions: ['网页工具'],
  relatedProjectSlugs: ['clip-sketch', 'made-up-project'],
}
test('AI 输出：合法 JSON 通过，编造的作品 slug 被过滤，前后多余的文字容忍', () => {
  const r = parseResult('好的，结果如下：\n```json\n' + JSON.stringify(valid) + '\n```', new Set(['clip-sketch']))
  assert.ok(r)
  assert.deepEqual(r.relatedProjectSlugs, ['clip-sketch'])
})
test('AI 输出：结构不对整份作废，不「尽量修一修」', () => {
  const allowed = new Set(['clip-sketch'])
  assert.equal(parseResult('不是 JSON', allowed), null)
  assert.equal(parseResult(JSON.stringify({ ...valid, feasibility: 'guaranteed' }), allowed), null)
  assert.equal(parseResult(JSON.stringify({ ...valid, nextActions: '一段字符串' }), allowed), null)
  assert.equal(parseResult(JSON.stringify({ ...valid, understanding: '' }), allowed), null)
})
test('AI 输出：条数和长度有上限', () => {
  const r = parseResult(JSON.stringify({ ...valid, rationale: Array(20).fill('x'.repeat(1000)) }), new Set())
  assert.equal(r.rationale.length, 6)
  assert.equal(r.rationale[0].length, 200)
})
test('联系方式脱敏', () => {
  assert.equal(maskContact('wang_12345'), 'wan****45')
  assert.equal(maskContact('person@example.com'), 'pe***@example.com')
  assert.equal(maskContact('abc'), 'a***')
})
