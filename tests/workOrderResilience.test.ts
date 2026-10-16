import { expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { useAuth } from '../src/stores/auth'
import Pagination from '../src/components/Pagination/index.vue'
import WorkOrders from '../src/views/production/workorder/index.vue'
const list = vi.hoisted(() => vi.fn())
vi.mock('../src/api/production/workorder', () => ({ api: { list } }))
it('keeps healthy and incomplete orders visible and marks only the incomplete row', async() => {
 vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
 const row = (id: string, missing: boolean) => ({ workorder: { id, code: 'WO-' + id, plannedQty: '10.000001', status: 'RELEASED' }, productCode: 'P', productName: '产品', routingCode: 'R', routingVersion: 1, erpExtraMissing: missing, allocation: { allocatedTargetQty: '0', remainingTargetQty: '10.000001', excessTargetQty: '0' } })
 list.mockResolvedValue({ items: [row('1', false), row('2', true)], total: 2 })
 const pinia = createPinia(), auth = useAuth(pinia); auth.factoryId = 'A'; auth.factoryPermissions = ['workorder:list']
 const wrapper = mount(WorkOrders, { global: { plugins: [pinia, ElementPlus] } }); await flushPromises()
 expect(wrapper.text()).toContain('WO-1'); expect(wrapper.text()).toContain('WO-2')
 expect(wrapper.findAll('.el-tag').filter(t => t.text() === '扩展记录缺失')).toHaveLength(1)
 expect(wrapper.findComponent(Pagination).props('total')).toBe(2); wrapper.unmount()
})
