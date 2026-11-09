import { afterEach, expect, it, vi } from 'vitest'
import { droppedQrImage } from '../src/components/scanner/qrImage'

afterEach(() => vi.unstubAllGlobals())

function transfer({ files = [], uri = '', html = '' }: { files?: File[]; uri?: string; html?: string } = {}): DataTransfer {
  return {
    files,
    items: files.map(file => ({ kind: 'file', getAsFile: () => file })),
    getData: (type: string) => type === 'text/uri-list' ? uri : type === 'text/html' ? html : ''
  } as unknown as DataTransfer
}

it('uses a dragged file when the browser exposes it in files or items', async() => {
  const file = new File(['qr'], 'qr.png', { type: 'image/png' })
  expect(await droppedQrImage(transfer({ files: [file] }))).toEqual([file])
  expect(await droppedQrImage(transfer({ files: [], uri: '', html: '' }))).toEqual([])
})

it('reads an image element dragged from the current page locally', async() => {
  const fetchImage = vi.fn().mockResolvedValue(new Response(new Blob(['qr'], { type: 'image/png' }), { headers: { 'Content-Type': 'image/png' }}))
  vi.stubGlobal('fetch', fetchImage)
  const images = await droppedQrImage(transfer({ html: '<img src="data:image/png;base64,cXIg">' }))
  expect(fetchImage).toHaveBeenCalledWith('data:image/png;base64,cXIg', { credentials: 'omit', mode: 'cors' })
  expect(images).toHaveLength(1)
  expect(images[0]!.type).toBe('image/png')
})

it('does not send cookies when reading a dragged image URL', async() => {
  const fetchImage = vi.fn().mockRejectedValue(new TypeError('CORS blocked image'))
  vi.stubGlobal('fetch', fetchImage)
  await expect(droppedQrImage(transfer({ uri: 'https://example.com/qr.png' }))).rejects.toThrow('CORS blocked image')
  expect(fetchImage).toHaveBeenCalledWith('https://example.com/qr.png', { credentials: 'omit', mode: 'cors' })
})
