<script setup lang="ts">
import { reactive, ref, watch, onBeforeUnmount, computed } from 'vue'
import { ElMessageBox } from 'element-plus'
import { useAuth } from '@/stores/auth'
import Pagination from '@/components/Pagination/index.vue'
import { qualityV2 as api, wasteLabels, type DefectType, type TypeInput, type WasteCategory } from '@/api/quality/qualityV2'
const props = defineProps<{ operationId: string }>()
const emit = defineEmits<{ pending: [value: boolean]; busy: [value: boolean] }>()
const auth = useAuth(), can = (action: string) => auth.hasPermission('business:operation:defect:type:' + action, 'factory')
const access = computed(() => ['read', 'create', 'update', 'delete'].map(can).join(','))
const rows = ref<DefectType[]>([]), page = ref(1), total = ref(0), error = ref(''), editing = ref<DefectType | null>(null), open = ref(false), busy = ref(false), loading = ref(false)
const empty = (): TypeInput => ({ code: '', name: '', defaultWasteCategory: '' as WasteCategory, status: 'ENABLED', sort: 0, remark: null })
const form = reactive<TypeInput>(empty()); const chosenCategory = ref(false)
let generation = 0, attempt = 0
function clear() { generation++; attempt++; rows.value = [];total.value = 0;error.value = '';open.value = false;editing.value = null;busy.value = false;loading.value = false;emit('pending', false);emit('busy', false) }
async function load() { const scope = generation, ticket = ++attempt; rows.value = []; error.value = ''; if (!can('read')) return; loading.value = true; try { const p = await api.types(props.operationId, (page.value - 1) * 20); if (scope === generation && ticket === attempt) { rows.value = p.items;total.value = p.total } } catch(e) { if (scope === generation && ticket === attempt) error.value = String(e instanceof Error ? e.message : e) } finally { if (scope === generation && ticket === attempt)loading.value = false } }
watch(() => [props.operationId, auth.factoryId, auth.revision, access.value], () => { clear();page.value = 1;void load() }, { immediate: true, flush: 'sync' })
onBeforeUnmount(clear)
function begin(row?:DefectType) { editing.value = row ?? null;Object.assign(form, row ? { code: row.code, name: row.name, defaultWasteCategory: row.defaultWasteCategory, status: row.status, sort: row.sort, remark: row.remark, expectedRevision: row.revision } : empty()); if (!row) delete form.expectedRevision; chosenCategory.value = !!row;open.value = true;emit('pending', true) }
async function save() { if (busy.value || !chosenCategory.value || !can(editing.value ? 'update' : 'create')) return;const scope = generation;busy.value = true;emit('busy', true);error.value = '';try { if (editing.value) await api.updateType(props.operationId, editing.value.id, { ...form });else await api.createType(props.operationId, { ...form });if (scope !== generation) return;open.value = false;emit('pending', false);await load() } catch(e) { if (scope === generation)error.value = e instanceof Error ? e.message : '保存失败' } finally { if (scope === generation) { busy.value = false;emit('busy', false) } } }
async function remove(row:DefectType) { const scope = generation;try { await ElMessageBox.confirm('仅能删除未被历史申报引用的配置，确认删除？', '删除不良类型');if (scope !== generation || !can('delete')) return;await api.deleteType(props.operationId, row);if (scope === generation) await load() } catch(e) { if (scope === generation && e instanceof Error)error.value = e.message } }
async function close() { if (busy.value) return;try { await ElMessageBox.confirm('是否放弃本次配置编辑？', '关闭确认');open.value = false;emit('pending', false) } catch { /* User keeps editing. */ } }
</script>
<template>
  <section aria-label="工序不良类型配置">
    <div class="table-toolbar"><strong>工序所属不良类型</strong><el-button v-if="can('create')" @click="begin()">新增不良类型</el-button></div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <el-table v-loading="loading" :data="rows" row-key="id"><el-table-column prop="code" label="编码" /><el-table-column prop="name" label="名称" /><el-table-column label="默认工废/料废类别"><template #default="{row}">{{ wasteLabels[row.defaultWasteCategory] }}</template></el-table-column><el-table-column label="状态"><template #default="{row}">{{ row.status==='ENABLED'?'启用':'停用' }}</template></el-table-column><el-table-column prop="sort" label="排序" width="80" /><el-table-column label="操作"><template #default="{row}"><el-button v-if="can('update')" link @click="begin(row)">编辑/启停</el-button><el-button v-if="can('delete')" link type="danger" @click="remove(row)">删除</el-button></template></el-table-column></el-table>
    <Pagination v-model:page="page" :total="total" :limit="20" @pagination="load" />
    <el-dialog v-model="open" :title="editing?'修改不良类型':'新增不良类型'" width="min(560px, 95vw)" :before-close="close" append-to-body>
      <el-form label-width="100px" :disabled="busy" @submit.prevent="save"><el-form-item label="编码" required><el-input v-model="form.code" maxlength="64" /></el-form-item><el-form-item label="名称" required><el-input v-model="form.name" maxlength="255" /></el-form-item><el-form-item label="默认工废/料废类别" required><el-select v-model="form.defaultWasteCategory" :placeholder="chosenCategory?'':'请明确选择工废/料废类别'" @change="chosenCategory=true"><el-option v-for="v in ['PROCESS','MATERIAL','BOTH']" :key="v" :value="v" :label="wasteLabels[v]" /></el-select><span v-if="!chosenCategory">请明确选择，不自动采用默认值。</span></el-form-item><el-form-item label="状态"><el-select v-model="form.status"><el-option label="启用" value="ENABLED" /><el-option label="停用" value="DISABLED" /></el-select></el-form-item><el-form-item label="排序"><el-input-number v-model="form.sort" :min="0" :precision="0" /></el-form-item><el-form-item label="备注"><el-input v-model="form.remark" type="textarea" maxlength="500" /></el-form-item></el-form>
      <template #footer><el-button @click="close">取消</el-button><el-button type="primary" :loading="busy" :disabled="!chosenCategory" @click="save">保存配置</el-button></template>
    </el-dialog>
  </section>
</template>
