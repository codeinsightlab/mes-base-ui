import { inject, type InjectionKey, type Ref } from 'vue'

export interface PageOverlay {
  forceClose: () => void
  beforeLeave?: () => boolean | Promise<boolean>
}

export interface PageOverlayScope {
  active: Readonly<Ref<boolean>>
  register: (overlay: PageOverlay) => () => void
}

export const pageOverlayScopeKey: InjectionKey<PageOverlayScope> = Symbol('page-overlay-scope')

export function usePageOverlayScope(): PageOverlayScope | undefined {
  return inject(pageOverlayScopeKey, undefined)
}

type StyleValue = { value: string; priority: string }
type ScrollSnapshot = { body: HTMLElement; overflow: StyleValue; overflowX: StyleValue; overflowY: StyleValue; padding: StyleValue }
const owners = new Set<symbol>()
let snapshot: ScrollSnapshot | undefined

function readStyle(style: CSSStyleDeclaration, property: string): StyleValue {
  return { value: style.getPropertyValue(property), priority: style.getPropertyPriority(property) }
}

function restoreStyle(style: CSSStyleDeclaration, property: string, previous: StyleValue) {
  if (previous.value) style.setProperty(property, previous.value, previous.priority)
  else style.removeProperty(property)
}

/** Every overlay owns one token; a nested close cannot unlock another overlay. */
export function acquirePageScrollLock(): () => void {
  if (typeof document === 'undefined') return () => {}
  const token = Symbol('page-scroll-owner')
  if (!owners.size) {
    const body = document.body
    snapshot = { body, overflow: readStyle(body.style, 'overflow'), overflowX: readStyle(body.style, 'overflow-x'),
      overflowY: readStyle(body.style, 'overflow-y'), padding: readStyle(body.style, 'padding-right') }
    const width = Math.max(0, window.innerWidth - document.documentElement.clientWidth)
    const padding = window.getComputedStyle(body).paddingRight || '0px'
    body.style.setProperty('overflow', 'hidden', 'important')
    if (width) body.style.setProperty('padding-right', `calc(${padding} + ${width}px)`, 'important')
  }
  owners.add(token)
  return () => {
    if (!owners.delete(token) || owners.size || !snapshot) return
    restoreStyle(snapshot.body.style, 'overflow', snapshot.overflow)
    restoreStyle(snapshot.body.style, 'overflow-x', snapshot.overflowX)
    restoreStyle(snapshot.body.style, 'overflow-y', snapshot.overflowY)
    restoreStyle(snapshot.body.style, 'padding-right', snapshot.padding)
    snapshot = undefined
  }
}
