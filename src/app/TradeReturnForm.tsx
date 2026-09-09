import {CheckSquare2, RotateCcw, SquareX} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {ContextHelpButton} from './ContextHelpButton.js';
import type {HelpDefinition} from './help-content.js';
import {jalaliInputToIso} from './jalali-date.js';
import {JalaliDateField} from './JalaliDateField.js';
import type {
  TradeReturnSelection,
  TradeReturnableLine,
} from './trade-return.types.js';

interface TradeReturnFormProps {
  kind: 'purchase' | 'sale';
  lines: readonly TradeReturnableLine[];
  acting: boolean;
  help: HelpDefinition;
  onCancel: () => void;
  onSubmit: (
    returnDate: string,
    reason: string,
    lines: TradeReturnSelection[],
  ) => void;
}

interface LineSelectionState {
  selected: boolean;
  quantity: string;
  serialNumbers: string[];
}

function todayInTehran(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function quantityText(value: string): string {
  return new Intl.NumberFormat('fa-IR', {
    maximumFractionDigits: 6,
  }).format(Number(value));
}

function hasPositiveQuantity(value: string): boolean {
  const quantity = Number(value);
  return Number.isFinite(quantity) && quantity > 0;
}

export function TradeReturnForm({
  kind,
  lines,
  acting,
  help,
  onCancel,
  onSubmit,
}: TradeReturnFormProps) {
  const [states, setStates] = useState<Record<string, LineSelectionState>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const noun = kind === 'purchase' ? 'خرید' : 'فروش';
  const returnableLines = lines.filter((line) =>
    line.trackingType === 'serial'
      ? line.returnableSerialNumbers.length > 0
      : hasPositiveQuantity(line.remainingQuantity),
  );

  function defaultState(line: TradeReturnableLine): LineSelectionState {
    if (line.trackingType === 'serial') {
      return {
        selected: true,
        quantity: String(line.returnableSerialNumbers.length),
        serialNumbers: [...line.returnableSerialNumbers],
      };
    }
    return {
      selected: true,
      quantity: line.remainingQuantity,
      serialNumbers: [],
    };
  }

  function toggleLine(line: TradeReturnableLine, selected: boolean): void {
    setFormError(null);
    setStates((current) => ({
      ...current,
      [line.id]: selected
        ? defaultState(line)
        : {selected: false, quantity: '', serialNumbers: []},
    }));
  }

  function changeQuantity(lineId: string, quantity: string): void {
    setFormError(null);
    setStates((current) => ({
      ...current,
      [lineId]: {
        selected: true,
        quantity,
        serialNumbers: [],
      },
    }));
  }

  function toggleSerial(
    line: TradeReturnableLine,
    serial: string,
    selected: boolean,
  ): void {
    setFormError(null);
    setStates((current) => {
      const existing = current[line.id] ?? {
        selected: false,
        quantity: '',
        serialNumbers: [],
      };
      const serialNumbers = selected
        ? [...new Set([...existing.serialNumbers, serial])]
        : existing.serialNumbers.filter((value) => value !== serial);
      return {
        ...current,
        [line.id]: {
          selected: serialNumbers.length > 0,
          quantity: String(serialNumbers.length),
          serialNumbers,
        },
      };
    });
  }

  function selectAll(): void {
    setFormError(null);
    setStates(Object.fromEntries(
      returnableLines.map((line) => [line.id, defaultState(line)]),
    ));
  }

  function clearAll(): void {
    setFormError(null);
    setStates({});
  }

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const selections: TradeReturnSelection[] = [];

    for (const line of lines) {
      const state = states[line.id];
      if (!state?.selected) continue;
      if (line.trackingType === 'serial') {
        if (state.serialNumbers.length === 0) {
          setFormError('برای کالای سریالی حداقل یک سریال را انتخاب کنید.');
          return;
        }
        selections.push({
          originalLineId: line.id,
          quantity: String(state.serialNumbers.length),
          serialNumbers: state.serialNumbers,
        });
        continue;
      }

      const quantity = Number(state.quantity);
      const remaining = Number(line.remainingQuantity);
      if (
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        quantity > remaining
      ) {
        setFormError(
          `مقدار مرجوعی «${line.productName}» باید بیشتر از صفر و حداکثر ${quantityText(line.remainingQuantity)} باشد.`,
        );
        return;
      }
      selections.push({
        originalLineId: line.id,
        quantity: state.quantity,
        serialNumbers: [],
      });
    }

    if (selections.length === 0) {
      setFormError('حداقل یک ردیف یا شماره سریال را برای مرجوعی انتخاب کنید.');
      return;
    }
    setFormError(null);
    onSubmit(
      jalaliInputToIso(String(form.get('returnDate') ?? '')),
      String(form.get('reason') ?? '').trim(),
      selections,
    );
  }

  const selectedCount = Object.values(states).filter(
    (state) => state.selected,
  ).length;

  return (
    <form className="purchase-cancel-form trade-return-form" onSubmit={submit}>
      <div className="form-section-heading">
        <ContextHelpButton help={help} />
        <h3>ثبت مرجوعی جزئی یا کامل {noun}</h3>
      </div>
      <p className="trade-return-warning">
        فقط ردیف‌ها و سریال‌های انتخاب‌شده مرجوع می‌شوند. موجودی، مانده طرف‌حساب
        و سند مالی به همان میزان اصلاح خواهد شد.
      </p>

      <div className="trade-return-toolbar" aria-label="ابزار انتخاب مرجوعی">
        <button
          className="button secondary"
          disabled={acting || returnableLines.length === 0}
          onClick={selectAll}
          type="button"
        >
          <CheckSquare2 aria-hidden />
          انتخاب همه موارد قابل مرجوعی
        </button>
        <button
          className="button ghost"
          disabled={acting || selectedCount === 0}
          onClick={clearAll}
          type="button"
        >
          <SquareX aria-hidden />
          پاک‌کردن انتخاب‌ها
        </button>
      </div>

      {returnableLines.length > 0 ? (
        <fieldset className="trade-return-lines" disabled={acting}>
          <legend>انتخاب ردیف‌ها و مقدار مرجوعی</legend>
          {lines.map((line) => {
            const state = states[line.id] ?? {
              selected: false,
              quantity: '',
              serialNumbers: [],
            };
            const available = line.trackingType === 'serial'
              ? line.returnableSerialNumbers.length > 0
              : hasPositiveQuantity(line.remainingQuantity);
            return (
              <article
                className={[
                  'trade-return-line',
                  state.selected ? 'selected' : '',
                  available ? '' : 'unavailable',
                ].filter(Boolean).join(' ')}
                key={line.id}
              >
                <label className="trade-return-line-heading">
                  <input
                    checked={state.selected}
                    disabled={!available}
                    onChange={(event) => toggleLine(line, event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <strong>{line.productName}</strong>
                    <small>{line.productCode}</small>
                  </span>
                </label>
                <dl className="trade-return-line-summary">
                  <div>
                    <dt>مقدار فاکتور</dt>
                    <dd>{quantityText(line.quantity)}</dd>
                  </div>
                  <div>
                    <dt>مرجوع‌شده قبلی</dt>
                    <dd>{quantityText(line.returnedQuantity)}</dd>
                  </div>
                  <div>
                    <dt>مانده مرجوع‌نشده</dt>
                    <dd>{quantityText(line.remainingQuantity)}</dd>
                  </div>
                </dl>

                {line.trackingType === 'serial' ? (
                  <>
                    <div className="trade-return-serial-heading">
                      <strong>سریال‌های قابل مرجوعی</strong>
                      <span>
                        {new Intl.NumberFormat('fa-IR').format(
                          line.returnableSerialNumbers.length,
                        )} مورد
                      </span>
                    </div>
                    {line.returnableSerialNumbers.length > 0 ? (
                      <div className="trade-return-serials">
                        {line.returnableSerialNumbers.map((serial) => (
                          <label key={serial}>
                            <input
                              checked={state.serialNumbers.includes(serial)}
                              onChange={(event) =>
                                toggleSerial(line, serial, event.target.checked)}
                              type="checkbox"
                            />
                            <code dir="ltr">{serial}</code>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="trade-return-unavailable">
                        سریال قابل مرجوعی در وضعیت فعلی وجود ندارد؛ ممکن است
                        دستگاه در تعمیر باشد یا قبلاً مرجوع شده باشد.
                      </p>
                    )}
                  </>
                ) : (
                  <label className="field trade-return-quantity">
                    <span>مقدار مرجوعی *</span>
                    <input
                      disabled={!state.selected}
                      inputMode="decimal"
                      max={line.remainingQuantity}
                      min="0.000001"
                      onChange={(event) =>
                        changeQuantity(line.id, event.target.value)}
                      required={state.selected}
                      step="0.000001"
                      type="number"
                      value={state.quantity}
                    />
                  </label>
                )}
              </article>
            );
          })}
        </fieldset>
      ) : (
        <p className="trade-return-unavailable" role="status">
          ردیف یا سریال قابل مرجوعی برای این فاکتور باقی نمانده است.
        </p>
      )}

      <div className="trade-return-details">
        <JalaliDateField
          defaultIsoValue={todayInTehran()}
          label="تاریخ مرجوعی"
          name="returnDate"
          required
        />
        <label className="field">
          <span>دلیل مرجوعی *</span>
          <textarea name="reason" minLength={5} maxLength={1000} required rows={3} />
        </label>
      </div>

      {formError ? (
        <p className="form-error trade-return-error" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="purchase-detail-actions">
        <button
          className="button danger"
          disabled={acting || returnableLines.length === 0}
          type="submit"
        >
          <RotateCcw aria-hidden />
          {acting ? 'در حال ثبت مرجوعی…' : 'ثبت مرجوعی انتخاب‌شده'}
        </button>
        <button
          className="button secondary"
          disabled={acting}
          onClick={onCancel}
          type="button"
        >
          انصراف
        </button>
      </div>
    </form>
  );
}
