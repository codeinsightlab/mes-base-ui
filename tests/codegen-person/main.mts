import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as icons from '@element-plus/icons-vue'
import 'element-plus/dist/index.css'
import '../../src/assets/styles/ruoyi.css'
import '../../src/assets/styles/tokens.css'
import '../../src/styles.css'
import App from '../../src/App.vue'
import Person from '../../src/views/acceptance/person/index.vue'
import menuJson from '../../src/menus/acceptance/person.json?raw'
import CodeText from '../../src/components/CodeText.vue'
import type { Menu } from '../../src/stores/auth'
import { useAuth } from '../../src/stores/auth'
import { configureRequests } from '../../src/lib/request'
import { createPersonMock } from './mock'

const menu = JSON.parse(menuJson) as Menu
const mock = createPersonMock()
window.fetch = mock.fetch as typeof fetch
const app = createApp(App), pinia = createPinia()
app.use(pinia)
const auth = useAuth()
auth.$patch({ token: 'TEST-ONLY-MOCK', expiresAt: '2099-01-01T00:00:00Z', username: 'Mock 验收', sessionReady: true, factoryId: 'TEST-ONLY', factories: [{ factoryId: 'TEST-ONLY', name: 'Mock 工厂' }],
  factoryMenus: [{ ...menu, name: menu.name + '（Mock）' }],
  factoryPermissions: ['read', 'create', 'update', 'delete'].map(action => 'business:person:' + action) })
configureRequests(() => ({ token: auth.token, factoryId: auth.factoryId, revision: auth.revision }), () => auth.clear())
const router = createRouter({ history: createWebHistory(), routes: [{ path: '/', redirect: menu.path }, { path: menu.path, component: Person, meta: { title: '人员（Mock 验收）' }}] })
app.use(router)
app.use(ElementPlus, { locale: zhCn })
for (const [name, icon] of Object.entries(icons)) app.component(name, icon)
app.component('CodeText', CodeText)
app.mount('#app')
// Explicit fixture controls; never imported by production main/router.
const controls = document.createElement('div')
controls.className = 'codegen-fixture-controls'
controls.innerHTML = '<span>Mock 验收 · person(id,name) · 数据仅保存在内存，刷新恢复</span>'
for (const [label, action] of [
  ['只读权限', () => { auth.factoryPermissions = ['business:person:read'];auth.revision++ }],
  ['完整权限', () => { auth.factoryPermissions = ['read', 'create', 'update', 'delete'].map(value => 'business:person:' + value);auth.revision++ }],
  ['下次请求失败', () => mock.fail()],
  ['清空示例', () => { mock.reset();auth.revision++ }]
] as const) { const button = document.createElement('button');button.textContent = label;button.onclick = action;controls.append(button) }
document.body.append(controls)
const style = document.createElement('style')
style.textContent = '.codegen-fixture-controls{position:fixed;bottom:0;left:0;right:0;z-index:1000;display:flex;gap:12px;flex-wrap:wrap;padding:8px 16px;background:var(--ui-surface);border-top:1px solid var(--ui-border);font-size:12px}.codegen-fixture-controls button{border:1px solid var(--ui-border);background:var(--ui-surface);color:var(--ui-text);padding:4px 8px;cursor:pointer}.workspace-main{padding-bottom:70px}'
document.head.append(style)
