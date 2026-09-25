import jsQR from 'jsqr';
import {decodeBarcodePixels, drawBarcodeImage, rotateBarcodePixels, type BarcodePixels} from '../app/barcode-image.js';

interface DetectedBarcode {
  rawValue?: string;
}

interface BarcodeDetectorInstance {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}

interface BarcodeDetectorConstructor {
  new (options: {formats: string[]}): BarcodeDetectorInstance;
}

type ScannerWindow = Window & {
  BarcodeDetector?: BarcodeDetectorConstructor;
  webkitAudioContext?: typeof AudioContext;
};

let scanAudioContext: AudioContext | null = null;

export function prepareScanBeepSound(): void {
  try {
    const scannerWindow = window as ScannerWindow;
    const AudioContextConstructor = window.AudioContext ?? scannerWindow.webkitAudioContext;
    if (!AudioContextConstructor) return;
    scanAudioContext ??= new AudioContextConstructor();
    if (scanAudioContext.state === 'suspended') void scanAudioContext.resume();
  } catch {
    // Sound is optional feedback and must never block scanning.
  }
}

// Audio Context beep generator
export function playScanBeepSound(): void {
  try {
    prepareScanBeepSound();
    const audioCtx = scanAudioContext;
    if (!audioCtx) return;
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1900, audioCtx.currentTime); // 1900Hz crisp laser beep sound
    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      gainNode.disconnect();
    }, {once: true});
  } catch (e) {
    console.warn('Scan sound could not play:', e);
  }
}

// Decode QR Code or Barcode from Canvas / Image Pixel Data
export async function scanImageData(canvas: HTMLCanvasElement, cancelled: () => boolean = () => false): Promise<string | null> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const width = canvas.width;
  const height = canvas.height;
  if (width === 0 || height === 0) return null;

  // 1. Try Native BarcodeDetector if available in modern browsers (Chrome, Edge, Android, etc.)
  const BarcodeDetector = (window as ScannerWindow).BarcodeDetector;
  if (BarcodeDetector) {
    try {
      const barcodeDetector = new BarcodeDetector({
        formats: ['qr_code', 'code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'upc_a', 'data_matrix']
      });
      const barcodes = await barcodeDetector.detect(canvas);
      const firstBarcode = barcodes[0];
      if (firstBarcode?.rawValue) {
        return firstBarcode.rawValue;
      }
    } catch {
      // Fallback to jsQR
    }
  }

  // 2. jsQR Engine
  try {
    const imageData = ctx.getImageData(0, 0, width, height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (code && code.data) {
      return code.data;
    }
  } catch (err) {
    console.warn('jsQR scan error:', err);
  }

  let pixels: BarcodePixels = ctx.getImageData(0, 0, width, height);
  for (let orientation = 0; orientation < 2; orientation++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    if (cancelled()) return null;
    const value = await decodeBarcodePixels(pixels);
    if (value) return value;
    if (orientation === 0) {
      pixels = rotateBarcodePixels(pixels);
    }
  }
  return null;
}

// Helper to decode an uploaded image file
export async function scanImageFile(file: File, cancelled: () => boolean = () => false): Promise<string | null> {
  const url = URL.createObjectURL(file);
  const canvas = document.createElement('canvas');
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      const timeout = setTimeout(() => reject(new Error('بازکردن عکس طول کشید؛ عکس دیگری بگیرید.')), 15000);
      image.onload = () => { clearTimeout(timeout); resolve(image); };
      image.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('قالب عکس در این مرورگر باز نمی‌شود؛ عکس JPEG یا PNG انتخاب کنید.'));
      };
      image.src = url;
    });
    for (const limit of [1600, 2800]) {
      if (cancelled()) return null;
      drawBarcodeImage(img, canvas, limit);
      const result = await scanImageData(canvas, cancelled);
      if (result) return result;
      if (Math.max(img.naturalWidth, img.naturalHeight) <= limit) break;
    }
    return null;
  } finally {
    canvas.width = 1;
    canvas.height = 1;
    URL.revokeObjectURL(url);
  }
}
