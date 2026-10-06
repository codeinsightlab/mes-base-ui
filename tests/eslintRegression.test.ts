import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shallowMount, flushPromises } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import RightToolbar from '../src/components/RightToolbar/index.vue'
import UserInfo from '../src/views/system/user/profile/userInfo.vue'
import CronSecond from '../src/components/Crontab/second.vue'
import CronWeek from '../src/components/Crontab/week.vue'
import { updateUserProfile } from '../src/api/system/user'

// TEST ONLY: mocked transport; these tests do not contact a backend.
vi.mock('../src/api/system/user', () => ({ updateUserProfile: vi.fn() }))
const global = { plugins: [ElementPlus] }
const check = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.floor(value)))
beforeEach(() => { vi.clearAllMocks() })

describe('Vue 3 component regression', () => {
  it('column visibility emits a new list and follows parent updates without mutating props', async() => {
    const columns = [{ key: 'code', label: '编码', visible: false }, { key: 'name', label: '名称', visible: true }]
    const wrapper = shallowMount(RightToolbar, { props: { columns }, global })
    expect(wrapper.vm.value).toEqual(['code'])
    wrapper.vm.dataChange(['name'])
    expect(columns.map(column => column.visible)).toEqual([false, true])
    const updated = wrapper.emitted('update:columns')![0][0] as typeof columns
    expect(updated.map(column => column.visible)).toEqual([true, false])
    await wrapper.setProps({ columns: updated })
    expect(wrapper.vm.value).toEqual(['name'])
    wrapper.unmount()
  })

  it('profile edits stay in a draft and notify the parent only after saving', async() => {
    const user = { nickName: 'TEST ONLY', phonenumber: '', email: '', sex: '0' }
    const success = vi.fn()
    let complete!: (value: unknown) => void
    vi.mocked(updateUserProfile).mockReturnValue(new Promise(resolve => { complete = resolve }))
    const wrapper = shallowMount(UserInfo, {
      props: { user },
      global: { ...global, mocks: { $modal: { msgSuccess: success }}, stubs: {
        ElForm: { template: '<div><slot /></div>', methods: { validate(callback: (valid: boolean) => void) { callback(true) } }}
      }, renderStubDefaultSlot: true }
    })
    await wrapper.setData({ formUser: { ...user, nickName: 'Edited draft' }})
    expect(user.nickName).toBe('TEST ONLY')
    wrapper.vm.submit()
    expect(updateUserProfile).toHaveBeenCalledWith(expect.objectContaining({ nickName: 'Edited draft' }))
    expect(wrapper.emitted('saved')).toBeUndefined()
    complete({})
    await flushPromises()
    expect(wrapper.emitted('saved')).toHaveLength(1)
    expect(success).toHaveBeenCalledOnce()
    await wrapper.setProps({ user: { ...user, nickName: 'Server refreshed' }})
    expect(wrapper.vm.formUser.nickName).toBe('Server refreshed')
    wrapper.unmount()
  })

  it('Cron components receive the validator through Vue 3 props and emit normalized expressions', async() => {
    const second = shallowMount(CronSecond, { props: { check, radioParent: 1 }, global })
    await second.setData({ cycle01: 70, cycle02: 80, radioValue: 2 })
    expect(second.vm.cycleTotal).toBe('58-59')
    expect(second.emitted('update')?.some(event => event[0] === 'second' && event[1] === '58-59')).toBe(true)
    second.unmount()
    const week = shallowMount(CronWeek, { props: { check, cron: { day: '?' }}, global })
    await week.setData({ cycle01: 0, cycle02: 9, average01: 9, average02: 0, weekday: 8 })
    expect(week.vm.cycleTotal).toBe('1-7')
    expect(week.vm.averageTotal).toBe('1#4')
    expect(week.vm.weekdayCheck).toBe(7)
    expect(week.vm.cycle01).toBe(0)
    expect(week.vm.average01).toBe(9)
    expect(week.vm.weekday).toBe(8)
    week.unmount()
  })

})
