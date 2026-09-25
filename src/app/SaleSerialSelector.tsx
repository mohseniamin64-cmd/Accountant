import {
  Check,
  ScanLine,
  Search,
  Trash2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import {api, errorMessage} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {SerialBarcodeScanner} from './SerialBarcodeScanner.js';
import type {AvailableSaleSerial} from './sale.types.js';

interface SaleSerialSelectorProps {
  productId: string;
  warehouseId: string;
  quantity: string;
  selected: readonly string[];
  excluded: ReadonlySet<string>;
  disabled?: boolean;
  onChange: (serialNumbers: string[]) => void;
}

const numberFormat = new Intl.NumberFormat('fa-IR');

export function SaleSerialSelector({
  productId,
  warehouseId,
  quantity,
  selected,
  excluded,
  disabled = false,
  onChange,
}: SaleSerialSelectorProps) {
  const [search, setSearch] = useState('');
  const [available, setAvailable] = useState<AvailableSaleSerial[]>([]);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [cameraScannerOpen, setCameraScannerOpen] = useState(false);

  const load = useCallback(async (term: string): Promise<AvailableSaleSerial[]> => {
    if (!productId || !warehouseId) {
      setAvailable([]);
      return [];
    }
    setPending(true);
    setMessage(null);
    try {
      const params = new URLSearchParams({
        productId,
        warehouseId,
        q: term.trim(),
        limit: '100',
      });
      const result = await api<AvailableSaleSerial[]>(
        '/api/sales/available-serials?' + params.toString(),
      );
      setAvailable(result);
      return result;
    } catch (caught) {
      setMessage(errorMessage(caught));
      return [];
    } finally {
      setPending(false);
    }
  }, [productId, warehouseId]);

  useEffect(() => {
    setSearch('');
    setMessage(null);
    void load('');
  }, [load]);

  function requestedCount(): number | null {
    const parsed = Number(quantity);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }

  function addSerial(serialNumber: string): void {
    if (selected.includes(serialNumber)) {
      setMessage('\u0627\u06cc\u0646 \u0633\u0631\u06cc\u0627\u0644 \u0642\u0628\u0644\u0627\u064b \u062f\u0631 \u0647\u0645\u06cc\u0646 \u0631\u062f\u06cc\u0641 \u0627\u0646\u062a\u062e\u0627\u0628 \u0634\u062f\u0647 \u0627\u0633\u062a.');
      return;
    }
    if (excluded.has(serialNumber)) {
      setMessage('\u0627\u06cc\u0646 \u0633\u0631\u06cc\u0627\u0644 \u062f\u0631 \u0631\u062f\u06cc\u0641 \u062f\u06cc\u06af\u0631 \u0647\u0645\u06cc\u0646 \u0641\u0627\u06a9\u062a\u0648\u0631 \u0627\u0646\u062a\u062e\u0627\u0628 \u0634\u062f\u0647 \u0627\u0633\u062a.');
      return;
    }
    const required = requestedCount();
    if (required !== null && selected.length >= required) {
      setMessage('\u062a\u0639\u062f\u0627\u062f \u0633\u0631\u06cc\u0627\u0644\u200c\u0647\u0627\u06cc \u0627\u0646\u062a\u062e\u0627\u0628\u06cc \u0628\u0647 \u062a\u0639\u062f\u0627\u062f \u0631\u062f\u06cc\u0641 \u0631\u0633\u06cc\u062f\u0647 \u0627\u0633\u062a.');
      return;
    }
    setMessage(null);
    onChange([...selected, serialNumber]);
  }

  function toggle(serialNumber: string): void {
    if (selected.includes(serialNumber)) {
      onChange(selected.filter((item) => item !== serialNumber));
      setMessage(null);
      return;
    }
    addSerial(serialNumber);
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    await load(search);
  }

  async function selectScannedSerial(rawValue: string): Promise<void> {
    const scanned = rawValue.trim();
    if (!scanned || disabled) return;
    setMessage(null);
    setSearch(scanned);
    try {
      const matches = await load(scanned);
      const exact = matches.find(
        (item) => item.serialNumber.toLocaleLowerCase('en-US') ===
          scanned.toLocaleLowerCase('en-US'),
      );
      if (!exact) {
        throw new Error('سریال اسکن‌شده در کالا و انبار انتخابی قابل فروش نیست.');
      }
      addSerial(exact.serialNumber);
    } catch (caught) {
      setMessage(errorMessage(caught));
    }
  }

  return (
    <section className="sale-serial-selector">
      <header>
        <ContextHelpButton help={appHelp.saleSerials} />
        <div>
          <strong>{'\u0633\u0631\u06cc\u0627\u0644\u200c\u0647\u0627\u06cc \u0642\u0627\u0628\u0644 \u0641\u0631\u0648\u0634'}</strong>
          <small>
            {'\u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647: '}
            {numberFormat.format(selected.length)}
            {' / '}
            {numberFormat.format(requestedCount() ?? 0)}
          </small>
        </div>
        <div className="sale-scan-actions">
          <button
            aria-expanded={cameraScannerOpen}
            className="button secondary sale-scan-button"
            disabled={disabled}
            onClick={() => setCameraScannerOpen((value) => !value)}
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
          void selectScannedSerial(serialNumber);
        }}
        open={cameraScannerOpen}
      />

      <form className="sale-serial-search" onSubmit={(event) => void submitSearch(event)}>
        <label className="field">
          <span>{'\u062c\u0633\u062a\u200c\u0648\u062c\u0648\u06cc \u0634\u0645\u0627\u0631\u0647 \u0633\u0631\u06cc\u0627\u0644'}</span>
          <input
            dir="ltr"
            disabled={disabled}
            maxLength={160}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              void selectScannedSerial(event.currentTarget.value);
            }}
            placeholder="SN-..."
            value={search}
          />
        </label>
        <button className="button secondary" disabled={disabled || pending} type="submit">
          <Search aria-hidden />{'\u062c\u0633\u062a\u200c\u0648\u062c\u0648'}
        </button>
      </form>

      {message ? <p className="sale-serial-message" role="alert">{message}</p> : null}

      {selected.length > 0 ? (
        <div className="sale-selected-serials" aria-label={'\u0633\u0631\u06cc\u0627\u0644\u200c\u0647\u0627\u06cc \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647'}>
          {selected.map((serial) => (
            <button
              className="sale-serial-chip selected"
              disabled={disabled}
              key={serial}
              onClick={() => toggle(serial)}
              type="button"
            >
              <Check aria-hidden /><span dir="ltr">{serial}</span><Trash2 aria-hidden />
            </button>
          ))}
        </div>
      ) : null}

      {pending ? (
        <div className="sale-serial-empty">{'\u062f\u0631 \u062d\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u0633\u0631\u06cc\u0627\u0644\u200c\u0647\u0627\u2026'}</div>
      ) : available.length > 0 ? (
        <div className="sale-available-serials">
          {available.map((item) => {
            const isSelected = selected.includes(item.serialNumber);
            const isExcluded = excluded.has(item.serialNumber);
            return (
              <button
                className={'sale-serial-chip' + (isSelected ? ' selected' : '')}
                disabled={disabled || isExcluded}
                key={item.id}
                onClick={() => toggle(item.serialNumber)}
                type="button"
              >
                {isSelected ? <Check aria-hidden /> : null}
                <span dir="ltr">{item.serialNumber}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="sale-serial-empty">{'\u0633\u0631\u06cc\u0627\u0644 \u0642\u0627\u0628\u0644 \u0641\u0631\u0648\u0634\u06cc \u0628\u0627 \u0627\u06cc\u0646 \u062c\u0633\u062a\u200c\u0648\u062c\u0648 \u067e\u06cc\u062f\u0627 \u0646\u0634\u062f.'}</div>
      )}
    </section>
  );
}

