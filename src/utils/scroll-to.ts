export function scrollTo(position:number, duration:number) { window.scrollTo({ top: position, behavior: duration ? 'smooth' : 'auto' }) }
