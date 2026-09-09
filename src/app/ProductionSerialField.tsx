import {
  Camera,
  RefreshCw,
  ScanLine,
  X,
} from 'lucide-react';
import {
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import {api, errorMessage} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {parseSerialNumbers} from './purchase.helpers.js';
import type {AvailableProductionSerial} from './production.types.js';
import {playScanBeepSound, scanImageFile} from '../utils/qrScanner.js';

interface ProductionSerialFieldProps {
  name: string;
  label: string;
  productId?: string;
  warehouseId?: string;
  allowInventoryLookup?: boolean;
  defaultSerials?: readonly string[];
}

function safeSerials(text: string): string[] {
  try {
    return parseSerialNumbers(text);
  } catch {
    return text
      .split(/[\n,،;؛]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
}

export function ProductionSerialField({
  name,
  label,
  productId,
  warehouseId,
  allowInventoryLookup = false,
  defaultSerials = [],
}: ProductionSerialFieldProps) {
  const [value, setValue] = useState(defaultSerials.join('\n'));
  const [available, setAvailable] = useState<AvailableProductionSerial[]>([]);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selected = safeSerials(value);

  async function loadAvailable(): Promise<void> {
    if (!productId || !warehouseId) {
      setMessage('کالا و انبار این ماده مشخص نیست.');
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({
        productId,
        warehouseId,
        search,
        limit: '50',
      });
      setAvailable(
        await api<AvailableProductionSerial[]>(
          '/api/production/material-serials?' + params.toString(),
        ),
      );
    } catch (caught) {
      setMessage(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  function addSerial(serialNumber: string): void {
    const current = safeSerials(value);
    if (current.includes(serialNumber)) {
      setMessage('این شماره سریال قبلاً انتخاب شده است.');
      return;
    }
    setValue([...current, serialNumber].join('\n'));
    setMessage(null);
    playScanBeepSound();
  }

  function removeSerial(serialNumber: string): void {
    setValue(
      safeSerials(value)
        .filter((item) => item !== serialNumber)
        .join('\n'),
    );
  }

  async function scanFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await scanImageFile(file);
      if (!result) {
        setMessage('سریال یا بارکد خوانایی در تصویر پیدا نشد؛ آن را دستی وارد کنید.');
        return;
      }
      addSerial(result.trim());
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="production-serial-field">
      <header>
        <ContextHelpButton help={appHelp.productionSerials} />
        <div>
          <strong>{label}</strong>
          <small>
            هر سریال را در یک خط وارد کنید. تعداد نهایی هنگام ثبت کنترل می‌شود.
          </small>
        </div>
        <button
          className="button secondary"
          disabled={pending}
          onClick={() => fileRef.current?.click()}
          type="button"
        >
          <Camera aria-hidden /> اسکن با دوربین
        </button>
      </header>
      <input
        accept="image/*"
        capture="environment"
        className="production-hidden-file"
        onChange={(event) => void scanFile(event)}
        ref={fileRef}
        type="file"
      />
      <textarea
        name={name}
        onChange={(event) => setValue(event.target.value)}
        placeholder={'SERIAL-001\nSERIAL-002'}
        value={value}
      />
      {selected.length > 0 ? (
        <div className="production-serial-chips">
          {selected.map((serial) => (
            <button
              className="production-serial-chip selected"
              key={serial}
              onClick={() => removeSerial(serial)}
              type="button"
            >
              <span>{serial}</span><X aria-hidden />
            </button>
          ))}
        </div>
      ) : null}
      {allowInventoryLookup ? (
        <div className="production-serial-lookup">
          <label className="field">
            <span>جستجو در سریال‌های موجود</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              value={search}
            />
          </label>
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => void loadAvailable()}
            type="button"
          >
            <RefreshCw aria-hidden /> دریافت سریال‌ها
          </button>
          <div className="production-serial-chips production-available-serials">
            {available.map((serial) => (
              <button
                className="production-serial-chip"
                disabled={selected.includes(serial.serialNumber)}
                key={serial.id}
                onClick={() => addSerial(serial.serialNumber)}
                type="button"
              >
                <ScanLine aria-hidden /><span>{serial.serialNumber}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {message ? <p className="production-inline-error">{message}</p> : null}
    </section>
  );
}
