<script setup lang="ts">
import { computed, useId } from 'vue'
import type { RoutingNode, RoutingEdge } from '@/api/production/routing'
import { contentError, graphLayout } from '@/lib/production/routingGraph'
const props = defineProps<{ nodes: RoutingNode[]; edges: RoutingEdge[]; selectedNodeIds?: string[] }>()
const marker = 'routing-arrow-' + useId().replaceAll(':', '')
const error = computed(() => contentError([], props.nodes, props.edges))
const layout = computed(() => graphLayout(props.nodes, props.edges))
const positions = computed(() => new Map(layout.value.nodes.map(node => [node.nodeCode, node])))
const selectedCodes = computed(() => (props.selectedNodeIds ?? []).map(id => props.nodes.find(node => node.id === id)?.nodeCode))
function selectedEdge(edge: RoutingEdge) {
  return selectedCodes.value.some((code, index) => code === edge.fromNodeCode && selectedCodes.value[index + 1] === edge.toNodeCode)
}
function path(edge: RoutingEdge) {
  const from = positions.value.get(edge.fromNodeCode), to = positions.value.get(edge.toNodeCode)
  if (!from || !to) return ''
  const x = from.x + 160, y = from.y + 29, middle = (x + to.x) / 2
  return `M ${x} ${y} C ${middle} ${y}, ${middle} ${to.y + 29}, ${to.x} ${to.y + 29}`
}
</script>
<template>
  <section class="graph-preview" aria-label="路线拓扑预览">
    <div class="table-toolbar"><strong>拓扑预览</strong><span class="secondary">{{ nodes.length }} 个节点 · {{ edges.length }} 条连接</span></div>
    <el-alert v-if="error" :title="error" type="warning" :closable="false" />
    <el-empty v-else-if="!nodes.length" description="添加工艺节点后查看拓扑" :image-size="45" />
    <div v-else class="graph-scroll">
      <svg :viewBox="`0 0 ${layout.width} ${layout.height}`" :style="{ width: layout.width + 'px', height: layout.height + 'px' }" role="img" aria-label="工艺节点有向连接图">
        <defs><marker :id="marker" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="graph-arrow" /></marker><marker :id="marker + '-selected'" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="selected-arrow" /></marker></defs>
        <path v-for="edge in edges" :key="`${edge.fromNodeCode}-${edge.toNodeCode}`" :d="path(edge)" :class="['graph-edge', { 'selected-edge': selectedEdge(edge) }]" :marker-end="`url(#${marker}${selectedEdge(edge) ? '-selected' : ''})`"><title>{{ edge.fromNodeCode }} → {{ edge.toNodeCode }}</title></path>
        <g v-for="node in layout.nodes" :key="node.nodeCode" :transform="`translate(${node.x}, ${node.y})`">
          <title>{{ node.nodeCode }} · {{ node.operationCode ?? node.operationId }} · {{ node.operationName }}</title>
          <rect width="160" height="58" rx="5" :class="['graph-node', { 'graph-key': node.isKey, 'selected-node': selectedCodes.includes(node.nodeCode) }]" />
          <text x="12" y="22" class="graph-code">{{ node.nodeCode }}</text>
          <text x="12" y="43" class="graph-name">{{ (node.operationName || node.operationCode || '已选工序').slice(0, 13) }}</text>
        </g>
      </svg>
    </div>
    <p class="secondary">箭头表示静态工艺关系；显示排序只影响布局。</p>
  </section>
</template>
<style scoped>
.graph-preview { margin-block: var(--ui-space-4); }
.graph-scroll { overflow: auto; max-height: 420px; }
svg { min-width: 100%; display: block; }
.graph-edge { fill: none; stroke: var(--mes-text-secondary); stroke-width: 1.8; }
.graph-arrow { fill: var(--mes-text-secondary); }
.graph-node { fill: var(--mes-bg-surface); stroke: var(--mes-border); stroke-width: 1.5; }
.graph-key { stroke: var(--mes-primary); stroke-width: 2; }
.selected-edge { stroke: var(--mes-accent); stroke-width: 3; }
.selected-arrow { fill: var(--mes-accent); }
.selected-node { stroke: var(--mes-accent); stroke-width: 2.5; fill: color-mix(in srgb, var(--mes-accent) 8%, var(--mes-bg-surface)); }
.graph-code { fill: var(--mes-text-primary); font-size: 13px; font-weight: 600; }
.graph-name { fill: var(--mes-text-secondary); font-size: 12px; }
</style>
