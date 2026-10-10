<!-- MES-CODEGEN: Base Design System; shared CRUD interactions and explicit field contract. -->
<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/acceptance/person'
import type { Field } from '@/lib/crud'

const fields: Field[] = [
  {
    key: 'id',
    label: '编号',
    kind: 'text',
    readonly: true,
    required: true,
    maxLength: 64
  },
  {
    key: 'name',
    label: '姓名',
    kind: 'text',
    readonly: false,
    required: true,
    maxLength: 64
  }
]
</script>

<template>
  <CrudPage
    title="人员"
    permission="business:person"
    :api="api"
    :fields="fields"
    id-key="id"
  />
</template>
