import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
const apiTarget=process.env.MES_DEV_API_TARGET??'http://127.0.0.1:8080'
if(!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(apiTarget))throw new Error('Development proxy requires an explicit loopback backend')
export default defineConfig({plugins:[vue()],resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},server:{watch:process.env.MES_DEV_WATCH_POLLING==='true'?{usePolling:true,interval:1000}:undefined,proxy:{'/api':{target:apiTarget},'/health':{target:apiTarget}}},test:{environment:'jsdom',restoreMocks:true}})
