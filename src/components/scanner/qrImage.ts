/** Local-only QR decoding; no upload, URL navigation or business operation. */
export function validateQrImage(file: File): void {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('请选择 PNG、JPEG 或 WebP 图片')
  if (file.size > 10 * 1024 * 1024) throw new Error('图片不能超过 10 MB')
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
  try { image = await createImageBitmap(file) } catch { throw new Error('图片无法读取，请更换图片或人工输入码值') }
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
  } finally { image.close() }
}
