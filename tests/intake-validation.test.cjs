const { test } = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('./load-ts.cjs')
const {
  validateFields,
  validateContact,
  contactErrors,
  isDraft,
  isFieldVisible,
  normalizeValues,
  validateDemandSubmission,
  validateProviderSubmission,
  validateWork,
  legacyContactShape,
} = load('lib/intake-validation.ts')
const { contactsOf, migrateLegacyContact } = load('components/participation/intake-fields.ts')

const KEY = 'k_1234567890abcdef'

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
test('最少字数：「想用 AI」这种一句话不算说清了问题', () => {
  const fields = [{ key: 'problem', label: '问题', required: true, min: 10 }]
  assert.ok(validateFields(fields, { problem: '想用AI' }).problem)
  assert.deepEqual(validateFields(fields, { problem: '每周要把十几个培训视频手工整理成图文' }), {})
})
test('勾选框字段：必须勾上，值只能是「是」', () => {
  const fields = [{ key: 'ok', label: '授权', type: 'check', required: true }]
  assert.ok(validateFields(fields, {}).ok)
  assert.ok(validateFields(fields, { ok: 'yes' }).ok)
  assert.deepEqual(validateFields(fields, { ok: '是' }), {})
})
test('联系方式按类型校验，不能把全标点当作电话', () => {
  assert.equal(validateContact('邮箱', 'person@example.com'), undefined)
  assert.equal(validateContact('电话', '+86 13800138000'), undefined)
  assert.equal(validateContact('微信', 'demo_wechat'), undefined)
  for (const [type, value] of [['邮箱', 'invalid'], ['电话', '------'], ['微信', 'has space'], ['未知', '123456']]) assert.ok(validateContact(type, value))
})
test('电话：手机号和带区号的固定电话都能过，分隔符随便写；位数不对、缺区号的挡下', () => {
  for (const v of ['13800138000', '138 0013 8000', '+86 138-0013-8000', '0086 13800138000', '0571-88886666', '(010) 1234 5678',
    '0571-88886666 转 802', '0755-12345678 ext.12', '+86 571 8888 6666', '400-123-4567', '+1 415 555 0100'])
    assert.equal(validateContact('电话', v), undefined, v)
  for (const v of ['12345678', '1380013800', '23800138000', '88886666', '------', '+86 123', '138001380001'])
    assert.ok(validateContact('电话', v), v)
})
test('微信：按官方规则（6—20 位、字母开头），也接受绑定微信的手机号', () => {
  for (const v of ['wang_123', 'aiyouhuo-2026', 'abcdef', '13800138000', '+86 138 0013 8000']) assert.equal(validateContact('微信', v), undefined, v)
  for (const v of ['abc', '1wang_123', 'wang 123', '王先生的微信', 'a'.repeat(21), 'wang@123']) assert.ok(validateContact('微信', v), v)
})
test('异常和超量本地草稿安全拒绝，合法草稿可以恢复', () => {
  const valid = { version: 2, requestKey: KEY, values: { name: '测试', directions: ['网站'] }, works: [{}], reference: 'clip-sketch', assets: {} }
  assert.equal(isDraft(valid), true)
  for (const invalid of [
    null, [], {},
    { ...valid, version: 1 },
    { ...valid, requestKey: 'short' },
    { ...valid, works: [] },
    { ...valid, works: Array(7).fill({}) },
    { ...valid, values: { contact: { nested: true } } },
    { ...valid, values: { name: 'x'.repeat(4001) } },
    { ...valid, assets: { bad: { name: 'a', type: 'image', size: 1 } } },
    { ...valid, assets: { as_1234567890abcdef: { name: 'a', type: 'svg', size: 1 } } },
    { ...valid, analysisConsent: 'true' },
  ]) assert.equal(isDraft(invalid), false)
  // 新草稿带上「是否同意 AI 初评」，旧草稿没有这个字段也照样能恢复
  assert.equal(isDraft({ ...valid, analysisConsent: false }), true)
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
  assert.deepEqual(validateFields([other], { industry: '教育培训' }), {})
  assert.ok(validateFields([other], { industry: '其他' }).industryOther)
})
test('规范化：只留定义过且可见的字段，多选按选项顺序排——同样的内容得到同样的结果（幂等哈希靠它）', () => {
  const fields = [
    { key: 'a', label: 'A' },
    { key: 'm', label: 'M', type: 'multi', options: ['x', 'y', 'z'] },
    { key: 'hidden', label: 'H', showWhen: { key: 'a', value: '显示' } },
  ]
  const out = normalizeValues(fields, { a: '  文字 ', m: ['z', 'x', '伪造'], hidden: '残留', injected: '<script>' })
  assert.deepEqual(out, { a: '文字', m: ['x', 'z'] })
  assert.deepEqual(JSON.stringify(normalizeValues(fields, { m: ['x', 'z'], a: '文字' })), JSON.stringify(out))
})

const demand = {
  requestKey: KEY,
  consent: true,
  analysisConsent: true,
  reference: 'clip-sketch',
  values: { problem: '每周要把十几个培训视频手工整理成图文', outcome: '自动生成可编辑的分步图文教程', name: '王先生', wechat: 'wang_123' },
}
test('需求提交：合法资料通过；缺同意、坏幂等键、坏参考作品都被挡下', () => {
  const ok = validateDemandSubmission(demand)
  assert.equal(ok.ok, true)
  assert.equal(ok.value.analysisConsent, true)
  assert.equal(validateDemandSubmission({ ...demand, consent: false }).ok, false)
  assert.ok(validateDemandSubmission({ ...demand, requestKey: '../../x' }).errors.requestKey)
  assert.ok(validateDemandSubmission({ ...demand, reference: '<script>' }).errors.reference)
  assert.ok(validateDemandSubmission({ ...demand, values: { ...demand.values, wechat: 'has space' } }).errors.wechat)
  // 服务端只存认识的字段：客户端多塞的键直接丢掉
  const extra = validateDemandSubmission({ ...demand, values: { ...demand.values, isAdmin: 'true' } })
  assert.equal('isAdmin' in extra.value.values, false)
})
test('联系方式：电话、微信、邮箱至少填一项；填了的逐项按格式校验', () => {
  assert.deepEqual(Object.keys(contactErrors({})), ['contacts'])
  assert.deepEqual(Object.keys(contactErrors({ phone: '  ', wechat: '' })), ['contacts']) // 只有空白不算填了
  assert.deepEqual(contactErrors({ email: 'a@b.cn' }), {})
  assert.deepEqual(contactErrors({ phone: '13800138000', wechat: 'wang_123', email: 'a@b.cn' }), {})
  // 填了两项、其中一项格式不对：报那一项，不报「至少一项」
  assert.deepEqual(Object.keys(contactErrors({ phone: '13800138000', email: 'x@' })), ['email'])
})
test('需求提交：一项联系方式都没有不通过；多填的都保留', () => {
  const none = validateDemandSubmission({ ...demand, values: { ...demand.values, wechat: '' } })
  assert.equal(none.ok, false)
  assert.ok(none.errors.contacts)
  const many = validateDemandSubmission({ ...demand, values: { ...demand.values, phone: '0571-88886666 转 802', email: 'w@example.com' } })
  assert.equal(many.ok, true)
  assert.deepEqual([many.value.values.phone, many.value.values.wechat, many.value.values.email], ['0571-88886666 转 802', 'wang_123', 'w@example.com'])
})
test('旧格式兼容：contactType + contact 的提交和草稿搬到新字段，读记录时新旧都认', () => {
  const { wechat: _, ...rest } = demand.values
  const legacy = { ...rest, contactType: '电话', contact: '13800138000' }
  const res = validateDemandSubmission({ ...demand, values: legacy })
  assert.equal(res.ok, true)
  assert.equal(res.value.values.phone, '13800138000')
  assert.equal('contactType' in res.value.values, false)
  // 新字段已经有值时不覆盖
  assert.equal(migrateLegacyContact({ contactType: '电话', contact: '1', phone: '13800138000' }).phone, '13800138000')
  assert.deepEqual(contactsOf({ contactType: '邮箱', contact: 'a@b.cn' }), [{ type: '邮箱', value: 'a@b.cn' }])
  assert.deepEqual(contactsOf({ email: 'a@b.cn', phone: '13800138000' }).map((c) => c.type), ['电话', '邮箱'])
  assert.deepEqual(contactsOf({ contactType: '其他', contact: 'x' }), [])
})
test('跨版本重试：迁移后的内容能还原成改版前的规范化结果（幂等哈希逐字节一致），多填了就没有旧版对应', () => {
  // 改版前 normalizeValues 的产物：键按旧字段定义顺序，contactType、contact 在 name 后面
  const oldDemand = { problem: demand.values.problem, outcome: demand.values.outcome, name: '王先生', contactType: '电话', contact: '13800138000' }
  const { wechat: _, ...rest } = demand.values
  const migrated = validateDemandSubmission({ ...demand, values: { ...rest, contactType: '电话', contact: '13800138000' } }).value.values
  assert.equal(JSON.stringify(legacyContactShape(migrated)), JSON.stringify(oldDemand))
  // 服务方：联系方式后面还有字段（type、city），位置也要对上
  const oldProfile = { displayName: '测试工作室', directions: ['定制化 Agent'], capability: '做企业知识库问答', name: '李', contactType: '邮箱', contact: 'li@example.com', type: '个人', city: '杭州' }
  const { email: __, ...p } = provider.values
  const res = validateProviderSubmission({ ...provider, values: { ...p, city: '杭州', type: '个人', contactType: '邮箱', contact: 'li@example.com' } })
  assert.equal(JSON.stringify(legacyContactShape(res.value.profile)), JSON.stringify(oldProfile))
  // 新格式填了两项：旧版不可能有这样的提交
  assert.equal(legacyContactShape({ name: 'x', phone: '13800138000', email: 'a@b.cn' }), null)
})
test('需求提交：没勾 AI 初评就是 false，不能靠传字符串蒙混成同意', () => {
  assert.equal(validateDemandSubmission({ ...demand, analysisConsent: 'true' }).value.analysisConsent, false)
})

const work = { title: '视频转手绘', summary: '把视频变成分步教程，我负责全部开发', method: '在线链接', url: 'https://momorain.com/clip-sketch', publicConsent: '是', openSource: '否，全部自己开发' }
const provider = {
  requestKey: KEY,
  consent: true,
  values: { displayName: '测试工作室', directions: ['定制化 Agent'], capability: '做企业知识库问答', name: '李', email: 'li@example.com' },
  works: [work],
}
test('服务方提交：作品只要一种提供方式；开源基础选「是」才要求写来源', () => {
  assert.equal(validateProviderSubmission(provider).ok, true)
  const withBasis = { ...work, openSource: '是，基于第三方或开源项目' }
  assert.ok(validateWork(withBasis)['basis'])
  assert.deepEqual(validateWork({ ...withBasis, basis: '基于 exprtrain（MIT），改了界面和服务端' }), {})
})
test('服务方提交：上传方式必须带附件，Demo 包只能一个；改回在线链接后残留附件不提交', () => {
  assert.ok(validateWork({ ...work, method: '上传截图或录屏', url: undefined }).assets)
  assert.ok(validateWork({ ...work, method: '提交静态 Demo 包', assets: ['as_1234567890abcdef', 'as_1234567890abcdeg'] }).assets)
  assert.ok(validateWork({ ...work, method: '上传截图或录屏', assets: ['../../etc/passwd'] }).assets)
  assert.deepEqual(validateWork({ ...work, method: '上传截图或录屏', assets: ['as_1234567890abcdef'] }), {})
  const res = validateProviderSubmission({ ...provider, works: [{ ...work, assets: ['as_1234567890abcdef'] }] })
  assert.equal(res.ok, true)
  assert.equal(res.value.works[0].assets, undefined)
})
test('服务方提交：作品数量 1—6，未勾公开授权不通过', () => {
  assert.equal(validateProviderSubmission({ ...provider, works: [] }).ok, false)
  assert.equal(validateProviderSubmission({ ...provider, works: Array(7).fill(work) }).ok, false)
  assert.ok(validateProviderSubmission({ ...provider, works: [{ ...work, publicConsent: '' }] }).errors['work-0-publicConsent'])
})

// ─── 轻量咨询（第四版）─────────────────────────────────────────────
const { validateConsultSubmission, isConsultDraft } = load('lib/intake-validation.ts')
test('轻量咨询：两道选择题必选、联系方式至少一项；不要求问题和期望结果', () => {
  const r = validateConsultSubmission({ requestKey: KEY, values: {}, consent: true })
  assert.equal(r.ok, false)
  assert.equal(r.errors.scene, '请选择想处理什么')
  assert.equal(r.errors.stage, '请选择目前到哪一步')
  assert.ok(r.errors.contacts)
  assert.equal(r.errors.problem, undefined)
  const ok = validateConsultSubmission({
    requestKey: KEY,
    values: { scene: '制作讲解视频', stage: '了解可行性', wechat: 'wx_test123', note: '  ', extra: '多塞的字段' },
    reference: 'whiteboard-video',
    consent: true,
  })
  assert.equal(ok.ok, true)
  // 空白的补充说明、没定义过的字段都不进库
  assert.deepEqual(ok.value.values, { scene: '制作讲解视频', stage: '了解可行性', wechat: 'wx_test123' })
  assert.equal(ok.value.reference, 'whiteboard-video')
})
test('轻量咨询：选项外的字、没勾确认、非法参考作品都不通过', () => {
  const base = { requestKey: KEY, values: { scene: '帮我写论文', stage: '了解可行性', email: 'a@b.cn' }, consent: true }
  assert.ok(validateConsultSubmission(base).errors.scene)
  assert.ok(validateConsultSubmission({ ...base, values: { ...base.values, scene: '其他' }, consent: false }).errors.consent)
  assert.ok(validateConsultSubmission({ ...base, values: { ...base.values, scene: '其他' }, reference: '../x' }).errors.reference)
})
test('轻量咨询草稿：结构不对就不恢复', () => {
  assert.equal(isConsultDraft({ version: 1, requestKey: KEY, values: { scene: '其他' }, reference: '' }), true)
  assert.equal(isConsultDraft({ version: 2, requestKey: KEY, values: {}, reference: '' }), false)
  assert.equal(isConsultDraft({ version: 1, requestKey: 'x', values: {}, reference: '' }), false)
  assert.equal(isConsultDraft({ version: 1, requestKey: KEY, values: { note: 'x'.repeat(5000) }, reference: '' }), false)
})
