export function formatDateTime(value: unknown) {
  if (value == null || value === '') return ''
  const date = value instanceof Date
    ? value
    : new Date(typeof value === 'number' ? value : String(value).replace(' ', 'T'))
  if (Number.isNaN(date.getTime())) return ''
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
