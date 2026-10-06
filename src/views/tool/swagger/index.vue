<script setup lang="ts">
// SOURCE_PRODUCT_PORT: tool/swagger/index.vue; authenticated Vue3 Swagger instead of a public iframe.
import { onMounted, onBeforeUnmount, ref } from 'vue'
import SwaggerUI from 'swagger-ui-dist/swagger-ui-bundle.js'
import 'swagger-ui-dist/swagger-ui.css'
import { request } from '@/lib/request'
import { useAuth } from '@/stores/auth'

const auth = useAuth(), host = ref<HTMLElement>(), loading = ref(false), error = ref('')
let disposed = false
async function load() {
  loading.value = true; error.value = ''
  try {
    const document = await request<Record<string, unknown>>('/api/tool/swagger/json', { scope: 'platform' })
    if (disposed || !host.value) return
    SwaggerUI({
      domNode: host.value, spec: document, validatorUrl: null,
      persistAuthorization: false, docExpansion: 'none', deepLinking: false,
      requestInterceptor: (outgoing:{ url: string;headers: Record<string, string> }) => {
        const url = new URL(outgoing.url, window.location.origin)
        if (url.origin !== window.location.origin || (!url.pathname.startsWith('/api/') && !url.pathname.startsWith('/open-api/') && url.pathname !== '/health'))
          throw new Error('只能请求本系统同源接口')
        if (!url.pathname.startsWith('/open-api/')) {
          if (auth.token)outgoing.headers.Authorization = 'Bearer ' + auth.token
          if (auth.factoryId)outgoing.headers['X-Factory-Id'] = auth.factoryId
        }
        return outgoing
      }
    })
  } catch(failure) { error.value = failure instanceof Error ? failure.message : '接口文档加载失败' } finally { if (!disposed)loading.value = false }
}
onMounted(load)
onBeforeUnmount(() => { disposed = true })
</script>

<template>
  <div v-loading="loading" class="app-container">
    <PageHeader title="系统接口" description="当前系统真实接口文档" />
    <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon>
      <el-button size="small" @click="load">重试</el-button>
    </el-alert>
    <div ref="host" class="source-swagger" />
  </div>
</template>

<style scoped>
.source-swagger{min-height:240px;overflow-x:auto}
</style>
