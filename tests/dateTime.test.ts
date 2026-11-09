import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DateTimeText from '../src/components/DateTimeText.vue'
import { formatDateTime } from '../src/lib/dateTime'
import { parseTime } from '../src/utils/ruoyi'

describe('shared date-time display', () => {
  it('formats timestamps as local YYYY-MM-DD HH:mm:ss and omits milliseconds', () => {
    expect(formatDateTime('2026-03-04 05:06:07.987')).toBe('2026-03-04 05:06:07')
    expect(formatDateTime(new Date(2026, 2, 4, 5, 6, 7, 987))).toBe('2026-03-04 05:06:07')
  })

  it('keeps empty and invalid timestamps empty for callers to apply their own fallback', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime(undefined)).toBe('')
    expect(formatDateTime('')).toBe('')
    expect(formatDateTime('not a timestamp')).toBe('')
  })

  it('keeps the legacy parseTime entry point on the shared format', () => {
    expect(parseTime('2026-03-04T05:06:07.987')).toBe('2026-03-04 05:06:07')
  })

  it('renders the shared format and a dash for missing values', () => {
    const wrapper = mount(DateTimeText, { props: { value: '2026-03-04T05:06:07.987' }})
    expect(wrapper.text()).toBe('2026-03-04 05:06:07')
    expect(wrapper.attributes('title')).toBe('2026-03-04 05:06:07')

    wrapper.unmount()
    const empty = mount(DateTimeText, { props: { value: null }})
    expect(empty.text()).toBe('—')
    empty.unmount()
  })
})
