import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CodeText from '../src/components/CodeText.vue'
import MetricValue from '../src/components/MetricValue.vue'
import { latencyTone, operationStatus } from '../src/lib/dataPresentation'

describe('Data console semantics', () => {
  it.each([[0, 'normal'], [999, 'normal'], [1000, 'attention'], [3000, 'attention'], [3001, 'warning'], [5000, 'warning'], [5001, 'error']])('classifies %s ms without inventing a timeout', (value, tone) => {
    expect(latencyTone(value)).toBe(tone)
  })
  it('does not turn missing or invalid durations into a zero', () => {
    for (const value of [null, undefined, '', 'invalid', NaN, -1]) expect(latencyTone(value)).toBe('unknown')
    expect(mount(MetricValue, { props: { value: null, unit: 'ms', latency: true }}).text()).toContain('—')
    expect(mount(MetricValue, { props: { value: 0, unit: 'ms', latency: true }}).text()).toContain('0ms')
  })
  it('preserves the full precision of string IDs and shows the full value on hover', () => {
    const id = '9223372036854775807'
    const wrapper = mount(CodeText, { props: { value: id }})
    expect(wrapper.text()).toBe(id)
    expect(wrapper.attributes('title')).toBe(id)
  })
  it('does not label unknown operation outcomes as success', () => {
    expect(operationStatus(0)).toEqual({ label: '成功', tone: 'success' })
    expect(operationStatus(1)).toEqual({ label: '失败', tone: 'error' })
    expect(operationStatus('UNKNOWN')).toEqual({ label: 'UNKNOWN', tone: 'disabled' })
    expect(operationStatus(null)).toEqual({ label: '未记录', tone: 'disabled' })
  })
})
