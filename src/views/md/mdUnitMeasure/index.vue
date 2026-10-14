<script setup lang="ts">
import CrudPage from '@/components/CrudPage.vue'
import { api } from '@/api/md/mdUnitMeasure'
import type { Field } from '@/lib/crud'
import { ref } from 'vue'
import { sync } from '@/api/md/mdUnitMeasure'
import SyncButton from '@/components/business/SyncButton.vue'
const page = ref<InstanceType<typeof CrudPage> | null>(null)

const fields: Field[] = [
  {
    key: 'measureId',
    label: '计量单位主键',
    kind: 'text',
    readonly: true,
    required: true,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'measureCode',
    label: '计量单位编码',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 64
  },
  {
    key: 'measureName',
    label: '计量单位名称',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: true,
    maxLength: 255
  },
  {
    key: 'primaryFlag',
    label: '主单位标识，Y为主单位，N为换算单位',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 1
  },
  {
    key: 'primaryId',
    label: '关联主单位的主键，主单位自身可不填写',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'changeRate',
    label: '相对于主单位的换算比例',
    kind: 'decimal',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 18
  },
  {
    key: 'enableFlag',
    label: '启用标识，Y为启用，N为停用',
    kind: 'text',
    readonly: false,
    required: true,
    searchable: false,
    maxLength: 1
  },
  {
    key: 'remark',
    label: '计量单位补充说明',
    kind: 'text',
    readonly: false,
    required: false,
    searchable: false,
    maxLength: 500
  },
  {
    key: 'createBy',
    label: '创建人账号标识',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'createTime',
    label: '创建时间',
    kind: 'datetime',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 19
  },
  {
    key: 'updateBy',
    label: '最近修改人账号标识',
    kind: 'text',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 64
  },
  {
    key: 'updateTime',
    label: '最近修改时间',
    kind: 'datetime',
    readonly: true,
    required: false,
    searchable: false,
    maxLength: 19
  }
]
</script>

<template>
  <CrudPage
    ref="page"
    table-key="business:md:unit:measure:list"
    title="计量单位"
    permission="business:md:unit:measure"
    list-action="list"
    detail-action="query"
    :api="api"
    :fields="fields"
    id-key="measureId"
  >
    <template #toolbar>
      <SyncButton permission="business:md:unit:measure:sync" scope="factory" :run="sync" @completed="page?.load()" />
    </template>
  </CrudPage>
</template>
