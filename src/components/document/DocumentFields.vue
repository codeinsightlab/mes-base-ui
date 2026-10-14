<script setup lang="ts">
import type { Field, Row } from '@/lib/crud'
defineProps<{ fields: Field[]; draft: Row; disabled?: boolean; disabledKeys?: string[] }>()
defineEmits<{ submit: [] }>()
</script>
<template>
  <el-form label-position="top" class="form-grid" :disabled="disabled" @submit.prevent="$emit('submit')">
    <el-form-item
      v-for="field in fields.filter(f => !f.readonly && (!f.showWhen || draft[f.showWhen.key] === f.showWhen.value))"
      :key="field.key"
      :label="field.label"
      :required="field.required"
      :class="{ 'span-2': field.kind === 'textarea' || field.key === 'remark' }"
    >
      <slot :name="`field-${field.key}`" :draft="draft" :field="field" :disabled="disabled || disabledKeys?.includes(field.key)">
        <el-select v-if="field.options" v-model="draft[field.key] as any" clearable placeholder="请选择">
          <el-option v-for="option in field.options" :key="option.value" :label="option.label" :value="option.value" />
        </el-select>
        <el-switch v-else-if="field.kind === 'boolean'" v-model="draft[field.key] as any" />
        <el-input
          v-else
          v-model="draft[field.key] as any"
          :maxlength="field.maxLength"
          :type="field.kind === 'password' ? 'password' : field.kind === 'textarea' || field.key === 'remark' ? 'textarea' : field.kind === 'datetime' ? 'datetime-local' : field.kind === 'date' ? 'date' : field.kind === 'number' ? 'number' : 'text'"
          :show-password="field.kind === 'password'"
          :disabled="disabledKeys?.includes(field.key)"
          :inputmode="field.kind === 'decimal' ? 'decimal' : undefined"
          :placeholder="'请输入' + field.label"
        />
      </slot>
    </el-form-item>
  </el-form>
</template>
