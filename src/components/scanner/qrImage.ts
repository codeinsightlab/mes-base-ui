/** Local-only QR decoding; no upload, URL navigation or business operation. */
export function validateQrImage(file: File): void {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('请选择 PNG、JPEG 或 WebP 图片')
  if (file.size > 10 * 1024 * 1024) throw new Error('图片不能超过 10 MB')
}

function imageUrlFromTransfer(transfer: DataTransfer): string | null {
  const uri = transfer.getData('text/uri-list').split(/\r?\n/).map(value => value.trim()).find(value => value && !value.startsWith('#'))
  if (uri) return uri
  const html = transfer.getData('text/html')
  if (!html) return null
  const source = new DOMParser().parseFromString(html, 'text/html').querySelector('img')?.getAttribute('src')
  return source ?? null
}

export async function droppedQrImage(transfer: DataTransfer): Promise<File[]> {
  const files = Array.from(transfer.files)
  if (files.length) return files
  const itemFile = Array.from(transfer.items).map(item => item.kind === 'file' ? item.getAsFile() : null).filter((file): file is File => file !== null)
  if (itemFile.length) return itemFile
  const source = imageUrlFromTransfer(transfer)
  if (!source) return []
  let url: URL
  try {
    url = new URL(source, window.location.href)
  } catch {
    throw new Error('无法读取拖入图片，请选择图片文件')
  }
  const supportedImage = url.protocol === 'data:' && url.href.startsWith('data:image/')
    || url.protocol === 'blob:'
    || ['http:', 'https:'].includes(url.protocol)
  if (!supportedImage) throw new Error('拖入内容不是受支持的图片，请选择 PNG、JPEG 或 WebP 图片')
  const response = await fetch(url.href, { credentials: 'omit', mode: 'cors' })
  if (!response.ok) throw new Error('无法读取拖入图片，请选择图片文件')
  const blob = await response.blob()
  if (blob.size > 10 * 1024 * 1024) throw new Error('图片不能超过 10 MB')
  const type = blob.type.split(';', 1)[0] || 'application/octet-stream'
  return [new File([blob], 'dropped-qr-image', { type })]
}
export async function decodeQrPixels(data: Uint8ClampedArray, width: number, height: number): Promise<string> {
  const { default: jsQR } = await import('jsqr')
  const result = jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })
  if (!result?.data) throw new Error('未识别到二维码，请使用清晰的单个二维码图片，或人工输入码值')
  return result.data
}
export async function readQrImage(file: File): Promise<string> {
  validateQrImage(file)
  let image: ImageBitmap
  try {
    image = await createImageBitmap(file)
  } catch {
    throw new Error('图片无法读取，请更换图片或人工输入码值')
  }
  try {
    if (!image.width || !image.height || image.width * image.height > 16_000_000) throw new Error('图片尺寸过大，请裁剪到二维码区域后重试')
    const scale = Math.min(1, 2048 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('当前浏览器无法读取图片，请人工输入码值')
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    return await decodeQrPixels(pixels.data, pixels.width, pixels.height)
  } finally {
    image.close()
  }
}
