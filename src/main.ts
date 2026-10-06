import * as ElementIcons from '@element-plus/icons-vue'
import './assets/styles/ruoyi.css'
import { installSystem } from '@/utils/systemPlugin'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import './assets/styles/tokens.css'
import './styles.css'
import App from './App.vue'
import router, { installMenuRoutes } from './router'
import { useAuth } from './stores/auth'
import { configureRequests } from './lib/request'

const app = createApp(App), pinia = createPinia()
app.use(pinia)
const auth = useAuth()
configureRequests(() => ({
  token: auth.token,
  factoryId: auth.factoryId,
  revision: auth.revision
}), () => auth.clear())
app.directive('permission', {
  mounted(el, binding) {
    const value = binding.value as { code: string; scope: 'platform' | 'factory' }
    el.hidden = !auth.hasPermission(value.code, value.scope)
  }, updated(el, binding) {
    const value = binding.value as { code: string; scope: 'platform' | 'factory' }
    el.hidden = !auth.hasPermission(value.code, value.scope)
  }
})
installMenuRoutes()
app.use(router)
app.use(ElementPlus, { locale: zhCn })
for (const [name, icon] of Object.entries(ElementIcons)) app.component(name, icon)
installSystem(app)
app.mount('#app')
