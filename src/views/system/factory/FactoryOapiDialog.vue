<template>
  <PageDialog :model-value="true" title="鼎捷 E10 OAPI 配置" width="760px" :close-on-click-modal="false" :close-on-press-escape="!saving" :show-close="!saving" @close="emit('close')">
    <p class="secondary">工厂：{{ factory.factoryName }}（{{ factory.factoryId }}） · 当前模式：{{ factory.runtimeMode === 'ERP' ? 'ERP' : '独立 MES' }}</p>
    <el-alert title="保存连接参数不会切换工厂运行模式，也不会向 ERP 发送请求。" type="info" :closable="false" />
    <p v-if="error" role="alert" class="secondary">{{ error }} <el-button v-if="!loaded" link @click="load">重试</el-button></p>
    <div v-loading="loading">
      <template v-if="loaded">
        <p class="secondary">{{ reference ? '已保存 · 配置版本 ' + configurationRevision + ' · 真实 ERP 读取尚未验证' : '尚未配置' }}</p>
        <p v-if="locked" role="status" class="secondary">该连接已被 ERP 业务绑定，参数只读。身份或连接变更需通过受控迁移流程。</p>
        <el-form ref="formRef" :model="settings" label-position="top" :disabled="locked || saving" autocomplete="off">
          <el-form-item label="OAPI 地址" prop="endpoint" :rules="requiredRule"><el-input id="oapi-endpoint" v-model="settings.endpoint" placeholder="完整 HTTP(S) 接口地址" maxlength="2048" /></el-form-item>
          <el-divider content-position="left">调用方身份 · host</el-divider>
          <div class="oapi-fields">
            <el-form-item v-for="field in hostFields" :key="field.key" :label="field.label" :prop="'host.' + field.key" :rules="field.key === 'id' ? [] : requiredRule">
              <el-input :id="'oapi-host-' + field.key" v-model="settings.host[field.key]" :placeholder="field.key === 'id' ? '允许显式留空' : '按 ERP 已确认配置填写'" maxlength="512" />
            </el-form-item>
          </div>
          <el-divider content-position="left">服务方身份 · service</el-divider>
          <div class="oapi-fields">
            <el-form-item v-for="field in serviceFields" :key="field.key" :label="field.label" :prop="'service.' + field.key" :rules="requiredRule">
              <el-input :id="'oapi-service-' + field.key" v-model="settings.service[field.key]" maxlength="512" />
            </el-form-item>
          </div>
          <p class="secondary">参数加密保存在中心库，仅有工厂编辑权限的平台管理员可读取维护。时区和服务标识按 ERP 原值填写。</p>
        </el-form>
      </template>
    </div>
    <template #footer>
      <el-button :disabled="saving" @click="emit('close')">关闭</el-button>
      <el-button v-if="loaded && !locked" type="primary" :loading="saving" @click="save">保存配置</el-button>
    </template>
  </PageDialog>
</template>

<script setup lang="ts">
import PageDialog from '@/components/page/PageDialog.vue'

import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useAuth } from '@/stores/auth'
import { ElMessage, type FormInstance } from 'element-plus'
import { getFactoryOapi, saveFactoryOapi, type FactoryOapiSettings } from '@/api/system/datasource'

const props = defineProps<{ factory: { factoryId: string; factoryName: string; runtimeMode: string }}>()
const emit = defineEmits<{ close: []; saved: [] }>()
const auth = useAuth()
watch(() => [auth.token, auth.factoryId, auth.revision, auth.platformPermissions.join(',')], () => emit('close'))
const formRef = ref<FormInstance>()
const settings = reactive<FactoryOapiSettings>({ endpoint: '', host: { ver: '', prod: '', timezone: '', ip: '', id: '', lang: '', acct: '' }, service: { prod: '', ip: '', id: '' }})
const hostFields: { key: keyof FactoryOapiSettings['host']; label: string }[] = [
  { key: 'ver', label: '版本 · ver' }, { key: 'prod', label: '调用方产品 · prod' },
  { key: 'timezone', label: '时区 · timezone' }, { key: 'ip', label: '调用方地址 · ip' },
  { key: 'id', label: '调用方标识 · id（可空）' }, { key: 'lang', label: '语言 · lang' }, { key: 'acct', label: '账套 · acct' }
]
const serviceFields: { key: keyof FactoryOapiSettings['service']; label: string }[] = [
  { key: 'prod', label: '服务方产品 · prod' }, { key: 'ip', label: '服务方地址 · ip' }, { key: 'id', label: '服务方标识 · id' }
]
const requiredRule = [{ required: true, whitespace: true, message: '请填写已确认的 ERP 配置', trigger: 'blur' }]
const loading = ref(false)
const loaded = ref(false)
const saving = ref(false)
const locked = ref(false)
const error = ref('')
const reference = ref<string | null>(null)
const configurationRevision = ref(0)
let factoryRevision = 0
let active = true
let requestRevision = 0

async function load() {
  const revision = ++requestRevision
  loading.value = true
  error.value = ''
  try {
    const view = await getFactoryOapi(props.factory.factoryId)
    if (!active || revision !== requestRevision) return
    factoryRevision = view.factoryRevision
    locked.value = view.locked
    reference.value = view.reference
    configurationRevision.value = view.configurationRevision
    if (view.settings) Object.assign(settings, view.settings)
    loaded.value = true
  } catch(failure) {
    if (active && revision === requestRevision) error.value = failure instanceof Error ? failure.message : '配置读取失败'
  } finally {
    if (active && revision === requestRevision) loading.value = false
  }
}
async function save() {
  if (saving.value || locked.value || !await formRef.value?.validate().catch(() => false)) return
  saving.value = true
  error.value = ''
  try {
    const view = await saveFactoryOapi(props.factory.factoryId, factoryRevision, settings)
    if (!active) return
    factoryRevision = view.factoryRevision
    configurationRevision.value = view.configurationRevision
    reference.value = view.reference
    locked.value = view.locked
    ElMessage.success('OAPI 参数已保存，工厂运行模式保持不变')
    emit('saved')
  } catch(failure) {
    if (active) error.value = failure instanceof Error ? failure.message : '配置保存失败'
  } finally {
    if (active) saving.value = false
  }
}
onMounted(load)
onBeforeUnmount(() => {
  active = false
  requestRevision++
  settings.syncContract = null
  settings.endpoint = ''
  for (const key of Object.keys(settings.host) as (keyof FactoryOapiSettings['host'])[]) settings.host[key] = ''
  for (const key of Object.keys(settings.service) as (keyof FactoryOapiSettings['service'])[]) settings.service[key] = ''
})
</script>

<style scoped>
.oapi-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--ui-space-4, 16px); }
@media (max-width: 640px) { .oapi-fields { grid-template-columns: minmax(0, 1fr); } }
</style>
