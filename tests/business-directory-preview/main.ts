import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import '../../src/assets/styles/tokens.css'
import App from './App.vue'
import { directoryPermissions } from '../../src/api/business/directory'
import { useAuth } from '../../src/stores/auth'
import { configureRequests } from '../../src/lib/request'
const pinia = createPinia()
const app = createApp(App).use(pinia).use(ElementPlus)
const auth = useAuth(pinia)
auth.factoryId = 'TEST-F1'
auth.factoryPermissions = Object.values(directoryPermissions)
configureRequests(() => ({ token: '', factoryId: auth.factoryId, revision: auth.revision }), () => {})
const names = { personnel: '测试人员', departments: '测试部门', posts: '测试岗位' }
window.fetch = async input => {
  const url = new URL(String(input), location.origin)
  const [, , , , resource, id] = url.pathname.split('/')
  const kind = resource as keyof typeof names
  const rows = Array.from({ length: 26 }, (_, i) => ({
    id: (9007199254740993n + BigInt(i)).toString(), name: names[kind] + (i + 1),
    code: kind === 'departments' ? null : 'REF' + (i + 1), parentId: null, departmentId: null
  }))
  const keyword = url.searchParams.get('keyword') ?? ''
  const items = rows.filter(row => row.name.includes(keyword))
  const offset = Number(url.searchParams.get('offset') ?? 0)
  return new Response(JSON.stringify(id ? rows.find(row => row.id === id) : {
    items: items.slice(offset, offset + 20), total: items.length, offset, limit: 20
  }), { headers: { 'Content-Type': 'application/json' }})
}
app.mount('#app')
