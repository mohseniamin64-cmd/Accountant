import jsQR from 'jsqr';

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

// Audio Context beep generator
export function playScanBeepSound(): void {
  try {
    const scannerWindow = window as ScannerWindow;
    const AudioContextConstructor =
      window.AudioContext ?? scannerWindow.webkitAudioContext;
    if (!AudioContextConstructor) return;
    const audioCtx = new AudioContextConstructor();
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
  } catch (e) {
    console.warn('Scan sound could not play:', e);
  }
}

// Decode QR Code or Barcode from Canvas / Image Pixel Data
export async function scanImageData(canvas: HTMLCanvasElement): Promise<string | null> {
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
      inversionAttempts: 'dontInvert',
    });
    if (code && code.data) {
      return code.data;
    }
    // Try inverted if not found
    const codeInverted = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'onlyInvert',
    });
    if (codeInverted && codeInverted.data) {
      return codeInverted.data;
    }
  } catch (err) {
    console.warn('jsQR scan error:', err);
  }

  return null;
}

// Helper to decode an uploaded image file
export function scanImageFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const result = await scanImageData(canvas);
          resolve(result);
        } else {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      const result = event.target?.result;
      if (typeof result !== 'string') {
        resolve(null);
        return;
      }
      img.src = result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
