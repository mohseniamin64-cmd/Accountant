import {Camera, Keyboard, ScanLine, X} from 'lucide-react';
import {useEffect, useRef, useState, type ChangeEvent} from 'react';
import {playScanBeepSound, prepareScanBeepSound, scanImageFile} from '../utils/qrScanner.js';
import {currentDeviceKind} from './device-kind.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (serialNumber: string) => void;
}

export function SerialBarcodeScanner({open, onClose, onDetected}: Props) {
  const [deviceKind] = useState(currentDeviceKind);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serial, setSerial] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const captureRequestedRef = useRef(false);
  const sessionRef = useRef(0);
  const workingRef = useRef(false);
  const hasCameraCapture = deviceKind === 'mobile' || deviceKind === 'tablet';

  useEffect(() => {
    sessionRef.current += 1;
    setError(null);
    setSerial('');
    setPending(false);
    workingRef.current = false;
    if (!open) captureRequestedRef.current = false;
    if (open && !hasCameraCapture) inputRef.current?.focus();
    return () => { sessionRef.current += 1; };
  }, [open, hasCameraCapture]);

  useEffect(() => {
    if (!open || !hasCameraCapture || captureRequestedRef.current) return;
    captureRequestedRef.current = true;
    prepareScanBeepSound();
    fileRef.current?.click();
  }, [open, hasCameraCapture]);

  function acceptSerial(): void {
    const value = serial.trim();
    if (!value) {
      setError('شماره سریال دستگاه را وارد کنید.');
      return;
    }
    onDetected(value);
  }

  async function readPhoto(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file || workingRef.current) return;
    const session = sessionRef.current;
    workingRef.current = true;
    setPending(true);
    setError(null);
    try {
      if (file.size > 25 * 1024 * 1024) throw new Error('حجم عکس باید کمتر از ۲۵ مگابایت باشد.');
      const value = (await scanImageFile(file, () => session !== sessionRef.current))?.trim();
      if (session !== sessionRef.current) return;
      if (!value) throw new Error('بارکد یا QR خوانایی در عکس پیدا نشد؛ عکس واضح‌تری بگیرید یا سریال را دستی وارد کنید.');
      playScanBeepSound();
      onDetected(value);
    } catch (caught) {
      if (session === sessionRef.current) setError(caught instanceof Error ? caught.message : 'خواندن عکس انجام نشد؛ سریال را دستی وارد کنید.');
    } finally {
      if (session === sessionRef.current) {
        workingRef.current = false;
        setPending(false);
      }
    }
  }

  if (!open) return null;

  return (
    <section className="serial-scanner" aria-label="ورود شماره سریال" aria-busy={pending}>
      <header>
        <span><ScanLine aria-hidden /> {hasCameraCapture ? 'بارکدخوان گوشی' : deviceKind === 'desktop' ? 'بارکدخوان فیزیکی' : 'ورود دستی سریال'}</span>
        <button className="icon-button" onClick={onClose} type="button" aria-label="بستن بارکدخوان"><X aria-hidden /></button>
      </header>
      {hasCameraCapture ? (
        <div className="serial-scanner-capture">
          <Camera aria-hidden />
          <p>از بارکد عکس بگیرید. پس از تأیید عکس، سریال خوانده و در صفحه وارد می‌شود.</p>
          <button className="button primary" disabled={pending} onClick={() => { prepareScanBeepSound(); fileRef.current?.click(); }} type="button">
            <Camera aria-hidden /> {pending ? 'در حال خواندن عکس…' : 'گرفتن عکس بارکد'}
          </button>
          <input accept="image/*" capture="environment" hidden disabled={pending} onChange={(event) => void readPhoto(event)} ref={fileRef} type="file" />
        </div>
      ) : <p>{deviceKind === 'desktop' ? 'بارکدخوان USB یا Bluetooth را وصل کنید، این کادر را انتخاب و بارکد را اسکن کنید. برای تأیید Enter بزنید؛ ورود دستی هم امکان‌پذیر است.' : 'نوع دستگاه مشخص نیست؛ شماره سریال را دستی وارد کنید.'}</p>}
      <div className="serial-scanner-entry">
        <label className="field">
          <span>{hasCameraCapture ? 'ورود دستی در صورت نیاز' : 'شماره سریال دستگاه'}</span>
          <input autoComplete="off" dir="ltr" disabled={pending} maxLength={160} value={serial} onChange={(event) => setSerial(event.currentTarget.value)} onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            acceptSerial();
          }} ref={inputRef} />
        </label>
        <button className="button secondary" disabled={pending} onClick={acceptSerial} type="button"><Keyboard aria-hidden /> تأیید سریال</button>
      </div>
      {error ? <div className="serial-scanner-error" role="alert">{error}</div> : null}
    </section>
  );
}
