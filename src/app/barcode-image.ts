export interface BarcodePixels {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export function fitBarcodeImage(width: number, height: number, limit: number) {
  const scale = Math.min(1, limit / Math.max(width, height));
  return {width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale))};
}

export function drawBarcodeImage(image: HTMLImageElement, canvas: HTMLCanvasElement, limit: number): void {
  const size = fitBarcodeImage(image.naturalWidth || image.width, image.naturalHeight || image.height, limit);
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('مرورگر امکان پردازش عکس را ندارد.');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, size.width, size.height);
  context.drawImage(image, 0, 0, size.width, size.height);
}

export function rotateBarcodePixels(image: BarcodePixels): BarcodePixels {
  const data = new Uint8ClampedArray(image.data.length);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const source = (y * image.width + x) * 4;
      const target = (x * image.height + image.height - 1 - y) * 4;
      data.set(image.data.subarray(source, source + 4), target);
    }
  }
  return {data, width: image.height, height: image.width};
}

// Independent of native BarcodeDetector and secure contexts.
export async function decodeBarcodePixels(image: BarcodePixels): Promise<string | null> {
  const {MultiFormatOneDReader, QRCodeReader, DataMatrixReader, RGBLuminanceSource, BinaryBitmap, HybridBinarizer, GlobalHistogramBinarizer, DecodeHintType} = await import('@zxing/library');
  const gray = new Uint8ClampedArray(image.width * image.height);
  let darkest = 255;
  let lightest = 0;
  for (let i = 0; i < gray.length; i++) {
    const offset = i * 4;
    const alpha = (image.data[offset + 3] ?? 255) / 255;
    const value = Math.round(((image.data[offset] ?? 0) * 0.299 +
      (image.data[offset + 1] ?? 0) * 0.587 + (image.data[offset + 2] ?? 0) * 0.114) * alpha + 255 * (1 - alpha));
    gray[i] = value;
    darkest = Math.min(darkest, value);
    lightest = Math.max(lightest, value);
  }
  if (lightest === darkest) return null;
  // Normalize contrast before adaptive binarization.
  for (let i = 0; i < gray.length; i++) gray[i] = Math.round(((gray[i] ?? 0) - darkest) * 255 / (lightest - darkest));
  const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);
  const readers = [new MultiFormatOneDReader(hints), new QRCodeReader(), new DataMatrixReader()];
  const source = new RGBLuminanceSource(gray, image.width, image.height);
  for (const luminance of [source, source.invert()]) {
    for (const bitmap of [new BinaryBitmap(new HybridBinarizer(luminance)), new BinaryBitmap(new GlobalHistogramBinarizer(luminance))]) {
      for (const reader of readers) {
        try { return reader.decode(bitmap, hints).getText() || null; }
        catch { /* Try the next format, threshold method or polarity. */ }
        finally { reader.reset(); }
      }
    }
  }
  return null;
}
