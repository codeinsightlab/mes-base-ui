<script setup lang="ts">
import { ref } from 'vue'
import PersonnelSelect from '../../src/components/business/directory/PersonnelSelect.vue'
import DepartmentSelect from '../../src/components/business/directory/DepartmentSelect.vue'
import PostSelect from '../../src/components/business/directory/PostSelect.vue'
import { directoryPermissions } from '../../src/api/business/directory'
import { useAuth } from '../../src/stores/auth'
const auth = useAuth()
const personnel = ref<string | null>('9007199254741017')
const department = ref<string | null>(null)
const post = ref<string | null>(null)
function toggle() { auth.factoryPermissions = auth.factoryPermissions.length ? [] : Object.values(directoryPermissions); auth.revision++ }
function switchFactory() { auth.factoryId = auth.factoryId === 'TEST-F1' ? 'TEST-F2' : 'TEST-F1'; auth.revision++ }
</script>
<template>
  <main>
    <h1>业务目录组件</h1>
    <p>TEST ONLY · 合成数据 · 无真实数据库请求 · 只读搜索与选择</p>
    <el-form label-position="top">
      <el-form-item label="人员"><PersonnelSelect v-model="personnel" /></el-form-item>
      <el-form-item label="部门"><DepartmentSelect v-model="department" /></el-form-item>
      <el-form-item label="岗位"><PostSelect v-model="post" /></el-form-item>
    </el-form>
    <p>人员：{{ personnel ?? '未选择' }} · 部门：{{ department ?? '未选择' }} · 岗位：{{ post ?? '未选择' }}</p>
    <el-button @click="toggle">切换查询权限</el-button>
    <el-button @click="switchFactory">切换测试工厂</el-button>
    <p>当前上下文：{{ auth.factoryId }}</p>
  </main>
</template>
<style scoped>
main { max-width: 720px; margin: 32px auto; padding: 24px; background: var(--mes-bg-surface); color: var(--mes-text-primary); }
p { color: var(--mes-text-secondary); overflow-wrap: anywhere; }
</style>
