import { expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'
import AssignmentEntry from '../src/views/production/mesExecutionAssignment/index.vue'

it.each([['/production/mesExecutionAssignment', AssignmentEntry]] as const)('redirects legacy %s to the exact workorder bookmark', async(path, component) => {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path, component }, { path: '/production/mesProductionExecution', component: { template: '<p>工单</p>' }}] })
  await router.push({ path, query: { workorderId: '9007199254740993' }}); await router.isReady()
  const wrapper = mount(RouterView, { global: { plugins: [router] }}); await flushPromises()
  expect(router.currentRoute.value.path).toBe('/production/mesProductionExecution')
  expect(router.currentRoute.value.query.workorderId).toBe('9007199254740993')
  wrapper.unmount()
})

it('redirects the retired capability page to operation editing', async() => {
  const { default: component } = await import('../src/views/production/mesOperationUser/index.vue')
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/production/mesOperationUser', component }, { path: '/production/operation', component: { template: '<p>工序</p>' }}] })
  await router.push('/production/mesOperationUser'); await router.isReady()
  const wrapper = mount(RouterView, { global: { plugins: [router] }}); await flushPromises()
  expect(router.currentRoute.value.path).toBe('/production/operation'); wrapper.unmount()
})
