<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '@/stores/auth'

const auth = useAuth(), router = useRouter()
const selected = ref(''), loading = ref(false), submitting = ref(false), error = ref('')
async function load() {
  loading.value = true
  error.value = ''
  try { await auth.loadFactoryOptions() } catch(failure) {
    error.value = failure instanceof Error ? failure.message : '工厂列表加载失败'
  } finally { loading.value = false }
}
async function select() {
  submitting.value = true
  error.value = ''
  try {
    await auth.selectFactory(selected.value)
    await router.replace('/')
  } catch(failure) {
    selected.value = ''
    error.value = failure instanceof Error ? failure.message : '工厂切换失败'
  } finally { submitting.value = false }
}
async function continueWithoutFactory() {
  await auth.selectFactory('', false)
  await router.replace('/')
}
async function logout() {
  try { await auth.logout() } finally { await router.replace('/login') }
}
onMounted(load)
</script>

<template>
  <el-result icon="warning" title="请重新选择工厂" sub-title="原工厂上下文不可用，登录状态已保留。选择后进入工作台，原操作不会自动重试。">
    <template #extra>
      <el-alert v-if="error" :title="error" type="error" :closable="false" />
      <el-select v-model="selected" :loading="loading" :disabled="loading || submitting" placeholder="请选择工厂" aria-label="重新选择工厂">
        <el-option v-for="factory in auth.factories" :key="factory.factoryId" :label="factory.name" :value="factory.factoryId" />
      </el-select>
      <el-button type="primary" :loading="submitting" :disabled="!selected || loading" @click="select">进入工厂</el-button>
      <el-button :disabled="loading || submitting" @click="load">刷新列表</el-button>
      <p v-if="!loading && !error && !auth.factories.length">暂无可选工厂，可进入平台或个人工作区。</p>
      <p><el-button :disabled="submitting" @click="continueWithoutFactory">暂不选择，进入工作台</el-button><el-button :disabled="submitting" @click="logout">退出登录</el-button></p>
    </template>
  </el-result>
</template>
