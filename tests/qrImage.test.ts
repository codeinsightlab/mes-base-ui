import { expect, it, vi } from 'vitest'
import matrix from './fixtures/qr-execution.json'
import { decodeQrPixels, readQrImage, validateQrImage } from '../src/components/scanner/qrImage'
it('decodes a real QR fixture without converting its long batch value into a number', async() => {
  const scale = 4, width = matrix.length * scale, pixels = new Uint8ClampedArray(width * width * 4)
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const at = (y * width + x) * 4, color = matrix[Math.floor(y / scale)]![Math.floor(x / scale)] === '1' ? 0 : 255
    pixels.set([color, color, color, 255], at)
  }
  expect(await decodeQrPixels(pixels, width, width)).toBe('WO001:P001#9007199254740993')
  await expect(decodeQrPixels(new Uint8ClampedArray(100 * 100 * 4).fill(255), 100, 100)).rejects.toThrow('未识别到二维码')
})
it('rejects unsupported or oversized files before decoding', () => {
  expect(() => validateQrImage(new File(['x'], 'x.svg', { type: 'image/svg+xml' }))).toThrow('PNG')
  expect(() => validateQrImage(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'x.png', { type: 'image/png' }))).toThrow('10 MB')
})
it('releases image memory on dimension failure', async() => {
  const close = vi.fn(); vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 10000, height: 10000, close }))
  try { await expect(readQrImage(new File(['x'], 'x.png', { type: 'image/png' }))).rejects.toThrow('图片尺寸过大'); expect(close).toHaveBeenCalledOnce() } finally { vi.unstubAllGlobals() }
})
