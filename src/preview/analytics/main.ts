import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import 'element-plus/dist/index.css'
import '@/assets/styles/tokens.css'
import '@/styles/mes-focus.css'
import AnalyticsPreview from './AnalyticsPreview.vue'
import './preview.css'

createApp(AnalyticsPreview).use(ElementPlus, { locale: zhCn }).mount('#app')
