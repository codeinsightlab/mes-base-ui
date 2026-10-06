<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ modelValue?: string | number | null;options?: any[];normalizer?: (node:any) => any;placeholder?: string }>();const emit = defineEmits(['update:modelValue'])
function normalize(items:any[]):any[] { return items.map(item => { const value = props.normalizer ? props.normalizer(item) : item;return { id: value.id, label: value.label, children: value.children ? normalize(value.children) : undefined } }) }
const data = computed(() => normalize(props.options ?? []))
</script><template><el-tree-select :model-value="modelValue" :data="data" node-key="id" :props="{value:'id',label:'label',children:'children'}" :placeholder="placeholder" check-strictly filterable clearable style="width:100%" @update:model-value="emit('update:modelValue',$event)" /></template>
