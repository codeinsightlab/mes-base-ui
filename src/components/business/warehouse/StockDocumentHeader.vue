<script setup lang="ts">
import type { Row } from '@/lib/crud'
import { formatValue } from '@/lib/crud'
defineProps<{ document: Row; typeLabel?: string }>()
const statusLabels: Record<string, string> = { DRAFT: '草稿', POSTED: '已审核', CANCELLED: '草稿已作废', REVERSED: '已撤销' }
</script>
<template>
  <el-descriptions :column="document.documentType==='PURCHASE_RECEIPT' ? 3 : 2" border>
    <el-descriptions-item v-if="document.documentNo" label="单据编号">{{ document.documentNo }}</el-descriptions-item>
    <el-descriptions-item label="单据类型">{{ typeLabel || '类型待确认' }}</el-descriptions-item>
    <el-descriptions-item label="状态"><el-tag :type="document.status==='POSTED'?'success':document.status==='REVERSED'?'danger':document.status==='CANCELLED'?'info':'warning'">{{ statusLabels[String(document.status)] || '状态待确认' }}</el-tag></el-descriptions-item>
    <el-descriptions-item v-if="document.createTime" label="创建时间">{{ formatValue(document.createTime, 'datetime') }}</el-descriptions-item>
    <el-descriptions-item v-if="document.createBy" label="创建人">用户 {{ document.createBy }}</el-descriptions-item>
    <el-descriptions-item v-if="document.documentType==='PURCHASE_RECEIPT'" label="供应商">{{ document.supplierName || '—' }}</el-descriptions-item>
    <el-descriptions-item v-if="document.businessDate" label="业务日期">{{ document.businessDate }}</el-descriptions-item>
    <el-descriptions-item v-if="document.currency" label="币种">{{ document.currency==='CNY' ? '人民币' : document.currency }}</el-descriptions-item>
    <el-descriptions-item v-if="document.supplierDocumentNo" label="送货单号">{{ document.supplierDocumentNo }}</el-descriptions-item>
    <el-descriptions-item v-if="document.postedAt" label="审核时间">{{ formatValue(document.postedAt, 'datetime') }}</el-descriptions-item>
    <el-descriptions-item v-if="document.postedBy" label="审核人">用户 {{ document.postedBy }}</el-descriptions-item>
    <el-descriptions-item v-if="document.cancelledAt" label="草稿作废时间">{{ formatValue(document.cancelledAt, 'datetime') }}</el-descriptions-item>
    <el-descriptions-item v-if="document.cancelledBy" label="草稿作废人">用户 {{ document.cancelledBy }}</el-descriptions-item>
    <el-descriptions-item v-if="document.reversedAt" label="撤销时间">{{ formatValue(document.reversedAt, 'datetime') }}</el-descriptions-item>
    <el-descriptions-item v-if="document.reversedBy" label="撤销人">用户 {{ document.reversedBy }}</el-descriptions-item>
    <el-descriptions-item v-if="document.reversalRequestId" label="撤销操作ID">{{ document.reversalRequestId }}</el-descriptions-item>
    <el-descriptions-item v-if="document.reversalReason" label="撤销原因" :span="document.documentType==='PURCHASE_RECEIPT' ? 3 : 2">{{ document.reversalReason }}</el-descriptions-item>
    <el-descriptions-item label="收发原因" :span="document.documentType==='PURCHASE_RECEIPT' ? 3 : 2">{{ document.reason || '—' }}</el-descriptions-item>
    <el-descriptions-item v-if="document.remark" label="备注" :span="document.documentType==='PURCHASE_RECEIPT' ? 3 : 2">{{ document.remark }}</el-descriptions-item>
  </el-descriptions>
</template>
