import {
  RefreshCw,
  ScanLine,
  X,
} from 'lucide-react';
import {
  useState,
} from 'react';
import {api, errorMessage} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {parseSerialNumbers} from './purchase.helpers.js';
import type {AvailableProductionSerial} from './production.types.js';
import {SerialBarcodeScanner} from './SerialBarcodeScanner.js';

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
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
  }

  function removeSerial(serialNumber: string): void {
    setValue(
      safeSerials(value)
        .filter((item) => item !== serialNumber)
        .join('\n'),
    );
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
        <div className="production-serial-actions">
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => setCameraScannerOpen(true)}
            type="button"
          >
            <ScanLine aria-hidden /> بارکدخوان
          </button>
        </div>
      </header>
      <SerialBarcodeScanner
        onClose={() => setCameraScannerOpen(false)}
        onDetected={(serialNumber) => {
          setCameraScannerOpen(false);
          addSerial(serialNumber);
        }}
        open={cameraScannerOpen}
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
