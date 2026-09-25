import {afterEach, describe, expect, it, vi} from 'vitest';
import {BarcodeFormat, QRCodeWriter} from '@zxing/library';
import {drawBarcodeImage, rotateBarcodePixels, type BarcodePixels} from './barcode-image.js';
import {scanImageData, scanImageFile} from '../utils/qrScanner.js';

afterEach(() => vi.unstubAllGlobals());

function canvasFor(pixels: BarcodePixels): HTMLCanvasElement {
  return {width: pixels.width, height: pixels.height,
    getContext: () => ({getImageData: () => pixels})} as unknown as HTMLCanvasElement;
}

function code39(inverted = false, lowContrast = false): BarcodePixels {
  // Independent Code 39 fixture: *123* with quiet zones and off-centre bars.
  const patterns = ['nwnnwnwnn', 'wnnwnnnnw', 'nnwwnnnnw', 'wnwwnnnnn', 'nwnnwnwnn'];
  const bars: Array<{x: number; width: number}> = [];
  let x = 36;
  for (const pattern of patterns) {
    for (let i = 0; i < pattern.length; i++) {
      const width = pattern[i] === 'w' ? 9 : 3;
      if (i % 2 === 0) bars.push({x, width});
      x += width;
    }
    x += 3;
  }
  const width = x + 36;
  const height = 360;
  const white = lowContrast ? 160 : 255;
  const black = lowContrast ? 110 : 0;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) for (let column = 0; column < width; column++) {
    const isBar = y >= 25 && y < 80 && bars.some((bar) => column >= bar.x && column < bar.x + bar.width);
    const gray = isBar !== inverted ? black : white;
    data.set([gray, gray, gray, 255], (y * width + column) * 4);
  }
  return {data, width, height};
}

describe('photo barcode regression', () => {
  it('fits the entire 48MP phone image, including its bottom-right corner', () => {
    const drawImage = vi.fn();
    const canvas = {width: 0, height: 0, getContext: () => ({drawImage, fillRect: vi.fn()})} as unknown as HTMLCanvasElement;
    const image = {naturalWidth: 8000, naturalHeight: 6000} as HTMLImageElement;
    drawBarcodeImage(image, canvas, 1600);
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(drawImage).toHaveBeenCalledWith(image, 0, 0, 1600, 1200);
  });

  it.each(['horizontal', 'vertical', 'inverted', 'low-contrast'] as const)('reads an off-centre %s Code 39 without native browser support', async (variant) => {
    vi.stubGlobal('window', {});
    let image = code39(variant === 'inverted', variant === 'low-contrast');
    if (variant === 'vertical') image = rotateBarcodePixels(image);
    expect(await scanImageData(canvasFor(image))).toBe('123');
  });

  it('still decodes a real QR image on HTTP', async () => {
    vi.stubGlobal('window', {});
    const matrix = new QRCodeWriter().encode('DIACO-123', BarcodeFormat.QR_CODE, 240, 240, new Map());
    const data = new Uint8ClampedArray(240 * 240 * 4);
    for (let y = 0; y < 240; y++) for (let x = 0; x < 240; x++) {
      const value = matrix.get(x, y) ? 0 : 255;
      data.set([value, value, value, 255], (y * 240 + x) * 4);
    }
    expect(await scanImageData(canvasFor({width: 240, height: 240, data}))).toBe('DIACO-123');
  });

  it('returns no serial for a blank photograph', async () => {
    vi.stubGlobal('window', {});
    expect(await scanImageData(canvasFor({width: 100, height: 100, data: new Uint8ClampedArray(40000).fill(255)}))).toBeNull();
  });

  it('reports an unreadable photo format and releases its local URL', async () => {
    const revoke = vi.fn();
    vi.stubGlobal('URL', {createObjectURL: () => 'blob:test-photo', revokeObjectURL: revoke});
    vi.stubGlobal('document', {createElement: () => ({width: 1, height: 1})});
    vi.stubGlobal('Image', class {
      onerror?: () => void;
      set src(_value: string) { queueMicrotask(() => this.onerror?.()); }
    });
    await expect(scanImageFile(new Blob() as File)).rejects.toThrow('JPEG');
    expect(revoke).toHaveBeenCalledWith('blob:test-photo');
  });
});
