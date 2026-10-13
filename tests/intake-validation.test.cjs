const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
// 用项目已有 TypeScript 编译器加载纯校验模块，不增加测试依赖或改应用构建配置。
const filename = path.resolve(__dirname, '../lib/intake-validation.ts')
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const loaded = new Module(filename, module)
loaded._compile(compiled, filename)
const { validateFields, validateContact, isDraft, isFieldVisible } = loaded.exports

test('缺少必填、空白文本和多选空数组均阻止前进；选填可空', () => {
  const fields = [{ key: 'name', label: '称呼', required: true }, { key: 'scope', label: '方向', type: 'multi', required: true }, { key: 'optional', label: '补充' }]
  assert.deepEqual(Object.keys(validateFields(fields, { name: '  ', scope: [] })), ['name', 'scope'])
  assert.deepEqual(validateFields(fields, { name: '测试用户', scope: ['开发'] }), {})
})
test('成果链接拒绝脚本、相对地址和内嵌凭证，允许真实网页链接', () => {
  const fields = [{ key: 'url', label: '成果链接', type: 'url', required: true }]
  for (const url of ['javascript:alert(1)', 'data:text/html,test', '//example.com', '/test', 'https://name:password@example.com']) assert.ok(validateFields(fields, { url }).url, url)
  for (const url of ['https://example.com/demo?q=1#results', 'http://localhost:3000/work']) assert.deepEqual(validateFields(fields, { url }), {})
})
test('从过期草稿恢复的无效选项与过长文字不会通过', () => {
  const fields = [{ key: 'status', label: '状态', type: 'select', options: ['可体验'] }, { key: 'name', label: '名称', max: 5 }]
  assert.ok(validateFields(fields, { status: '认证专家' }).status)
  assert.ok(validateFields(fields, { name: '123456' }).name)
  assert.ok(validateFields(fields, { status: '无效' }, 'work-0-')['work-0-status'])
})
test('联系方式按类型校验，不能把全标点当作电话', () => {
  assert.equal(validateContact('邮箱', 'person@example.com'), undefined)
  assert.equal(validateContact('电话', '+86 13800138000'), undefined)
  assert.equal(validateContact('微信', 'demo_wechat'), undefined)
  for (const [type, value] of [['邮箱', 'invalid'], ['电话', '------'], ['微信', 'has space'], ['未知', '123456']]) assert.ok(validateContact(type, value))
})
test('异常和超量本地草稿安全拒绝，合法草稿可以恢复', () => {
  const valid = { version: 1, values: { name: '测试', directions: ['网站'] }, works: [{}], reference: 'clip-sketch' }
  assert.equal(isDraft(valid), true)
  for (const invalid of [null, [], {}, { ...valid, version: 2 }, { ...valid, works: [] }, { ...valid, works: Array(7).fill({}) }, { ...valid, values: { contact: { nested: true } } }, { ...valid, values: { name: 'x'.repeat(4001) } }]) assert.equal(isDraft(invalid), false)
})

test('异常草稿的字段类型不应被空值或选项校验绕过', () => {
  const fields = [{ key: 'name', label: '名称', required: true }, { key: 'scope', label: '方向', type: 'multi', options: ['开发'] }]
  assert.ok(validateFields(fields, { name: ['测试'], scope: '开发' }).name)
  assert.ok(validateFields(fields, { name: '测试', scope: '开发' }).scope)
})
test('条件字段只在条件满足时显示和校验：改选别的行业后，「其他行业说明」不再生效', () => {
  const other = { key: 'industryOther', label: '其他行业说明', required: true, showWhen: { key: 'industry', value: '其他' } }
  assert.equal(isFieldVisible(other, { industry: '其他' }), true)
  assert.equal(isFieldVisible(other, { industry: '教育培训', industryOther: '残留的旧说明' }), false)
  // 藏起来时即使必填也不报错；显示时照常校验
  assert.deepEqual(validateFields([other], { industry: '教育培训' }), {})
  assert.ok(validateFields([other], { industry: '其他' }).industryOther)
})
