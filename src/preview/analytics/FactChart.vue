<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { init, use, type ECharts } from 'echarts/core'
import { BarChart, LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'
import type { Chart } from './boards'
use([BarChart, LineChart, GridComponent, TooltipComponent, SVGRenderer])
const props = defineProps<{ chart: Chart }>()
const emit = defineEmits<{ select: [key: string] }>()
const surface = ref<HTMLElement>()
let instance: ECharts | undefined
let observer: ResizeObserver | undefined

function draw() {
  if (!surface.value || !instance) return
  const css = getComputedStyle(surface.value)
  const color = (token: string) => css.getPropertyValue(token).trim()
  const palette = ['--mes-primary', '--mes-accent', '--ui-text-muted'].map(color)
  instance.setOption({
    animation: false, color: palette,
    textStyle: { fontFamily: css.fontFamily, color: color('--ui-text-secondary') },
    grid: { left: 5, right: 18, top: 14, bottom: 4, containLabel: true },
    tooltip: { trigger: 'axis', confine: true, valueFormatter: (value: number) => value.toLocaleString('zh-CN') + ' ' + props.chart.unit },
    xAxis: { type: 'category', data: props.chart.labels, boundaryGap: props.chart.type === 'bar',
      axisTick: { show: false }, axisLine: { lineStyle: { color: color('--mes-grid') }},
      axisLabel: { color: color('--ui-text-secondary'), fontSize: 11, hideOverlap: true, margin: 12, interval: Math.max(0, Math.ceil(props.chart.labels.length / 8) - 1) }},
    yAxis: { type: 'value', minInterval: props.chart.unit === '笔' ? 1 : undefined, splitNumber: 4, axisLabel: { fontSize: 10, color: color('--ui-text-muted') },
      splitLine: { lineStyle: { color: color('--mes-grid'), type: 'dashed' }}},
    series: props.chart.series.map((line, i) => ({
      name: line.name, data: line.values, type: props.chart.type, barMaxWidth: 36, showSymbol: props.chart.labels.length <= 10,
      symbolSize: 6, symbol: 'circle', lineStyle: { width: 2.5 }, areaStyle: props.chart.type === 'line' ? { opacity: 0.055 } : undefined,
      itemStyle: { color: palette[i], borderRadius: [2, 2, 0, 0] },
    })),
  }, true)
}

onMounted(() => {
  if (!surface.value) return
  instance = init(surface.value, undefined, { renderer: 'svg' })
  observer = new ResizeObserver(() => instance?.resize())
  observer.observe(surface.value)
  instance.getZr().on('click', event => {
    const point = [event.offsetX, event.offsetY]
    if (!instance?.containPixel('grid', point)) return
    const index = instance.convertFromPixel({ xAxisIndex: 0 }, point[0]) as number
    const key = props.chart.keys[Math.round(index)]
    if (key) emit('select', key)
  })
  draw()
})
watch(() => props.chart, draw)
onBeforeUnmount(() => {
  observer?.disconnect()
  instance?.dispose()
})
</script>
<template>
  <div class="chart-legend"><span>单位 · {{ chart.unit }}</span><span v-for="(line, i) in chart.series" :key="line.name"><i :class="'ink-' + i" />{{ line.name }}</span></div>
  <div ref="surface" class="chart-surface" role="img" :aria-label="chart.title + '，单位' + chart.unit" />
  <details class="chart-values"><summary>查看数据点</summary><div><button v-for="(key, i) in chart.keys" :key="key" @click="emit('select', key)">{{ chart.labels[i] }} · {{ chart.series.map(s => s.values[i]).join(' / ') }} {{ chart.unit }}</button></div></details>
</template>
