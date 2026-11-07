<script setup lang="ts">
import type { Row } from '@/lib/crud'
import { formatValue } from '@/lib/crud'
defineProps<{ document: Row; typeLabel?: string }>()
</script>
<template>
  <el-descriptions :column="document.documentType==='PURCHASE_RECEIPT' ? 3 : 2" border>
    <el-descriptions-item label="单据类型">{{ typeLabel || '类型待确认' }}</el-descriptions-item>
    <el-descriptions-item v-if="document.documentType==='PURCHASE_RECEIPT'" label="供应商">{{ document.supplierName || '—' }}</el-descriptions-item>
    <el-descriptions-item v-if="document.businessDate" label="业务日期">{{ document.businessDate }}</el-descriptions-item>
    <el-descriptions-item v-if="document.currency" label="币种">{{ document.currency==='CNY' ? '人民币' : document.currency }}</el-descriptions-item>
    <el-descriptions-item v-if="document.supplierDocumentNo" label="送货单号">{{ document.supplierDocumentNo }}</el-descriptions-item>
    <el-descriptions-item v-if="document.postedAt" label="审核时间">{{ formatValue(document.postedAt, 'datetime') }}</el-descriptions-item>
    <el-descriptions-item label="收发原因" :span="document.documentType==='PURCHASE_RECEIPT' ? 3 : 2">{{ document.reason || '—' }}</el-descriptions-item>
    <el-descriptions-item v-if="document.remark" label="备注" :span="document.documentType==='PURCHASE_RECEIPT' ? 3 : 2">{{ document.remark }}</el-descriptions-item>
  </el-descriptions>
</template>
