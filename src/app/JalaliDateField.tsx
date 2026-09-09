import {CalendarDays, ChevronLeft, ChevronRight} from 'lucide-react';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getCurrentJalaliDateParts,
  getJalaliMonthLength,
  getJalaliMonthStartWeekday,
  isoDateToJalaliInput,
  jalaliPartsToInput,
  parseJalaliDateInput,
  toPersianDateDigits,
  type JalaliDateParts,
} from './jalali-date.js';

interface JalaliDateFieldProps {
  name: string;
  label: string;
  required?: boolean;
  defaultIsoValue?: string | null | undefined;
  className?: string;
  disabled?: boolean;
}

const placeholder = '۱۴۰۵/۰۶/۰۹';
const hint = 'تاریخ شمسی؛ نمونه: ' + placeholder;
const monthNames = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;
const weekdays = [
  ['ش', 'شنبه'],
  ['ی', 'یکشنبه'],
  ['د', 'دوشنبه'],
  ['س', 'سه‌شنبه'],
  ['چ', 'چهارشنبه'],
  ['پ', 'پنجشنبه'],
  ['ج', 'جمعه'],
] as const;

function inputFromIso(value?: string | null): string {
  if (!value) return '';
  try {
    return isoDateToJalaliInput(value);
  } catch {
    return '';
  }
}

function viewFromInput(value: string): JalaliDateParts {
  try {
    return parseJalaliDateInput(value);
  } catch {
    return getCurrentJalaliDateParts();
  }
}

export function JalaliDateField({
  name,
  label,
  required = false,
  defaultIsoValue,
  className,
  disabled = false,
}: JalaliDateFieldProps) {
  const inputId = useId();
  const hintId = useId();
  const calendarId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const initialValue = inputFromIso(defaultIsoValue);
  const [value, setValue] = useState(initialValue);
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<JalaliDateParts>(() =>
    viewFromInput(initialValue),
  );

  const selected = useMemo(() => {
    try {
      return parseJalaliDateInput(value);
    } catch {
      return null;
    }
  }, [value]);
  const today = getCurrentJalaliDateParts();
  const monthLength = getJalaliMonthLength(view.year, view.month);
  const firstWeekday = getJalaliMonthStartWeekday(view.year, view.month);

  useEffect(() => {
    const nextValue = inputFromIso(defaultIsoValue);
    setValue(nextValue);
    if (nextValue) setView(viewFromInput(nextValue));
  }, [defaultIsoValue]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [isOpen]);

  function toggleCalendar() {
    if (disabled) return;
    if (!isOpen) setView(viewFromInput(value));
    setIsOpen((open) => !open);
  }

  function moveMonth(offset: number) {
    setView((current) => {
      const monthIndex = current.year * 12 + current.month - 1 + offset;
      const minimum = 1200 * 12;
      const maximum = 1700 * 12 + 11;
      const bounded = Math.min(maximum, Math.max(minimum, monthIndex));
      return {
        year: Math.floor(bounded / 12),
        month: (bounded % 12) + 1,
        day: 1,
      };
    });
  }

  function chooseDate(parts: JalaliDateParts) {
    setValue(jalaliPartsToInput(parts));
    setView(parts);
    setIsOpen(false);
  }

  function normalizeInput() {
    try {
      setValue(jalaliPartsToInput(parseJalaliDateInput(value)));
    } catch {
      // پیام دقیق هنگام ثبت فرم نمایش داده می‌شود.
    }
  }

  return (
    <div
      className={'field jalali-date-field' + (className ? ' ' + className : '')}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          setIsOpen(false);
          event.preventDefault();
        }
      }}
      ref={rootRef}
    >
      <label htmlFor={inputId}>
        {label}
        {required ? <b aria-label="الزامی"> *</b> : null}
      </label>
      <div className="field-control">
        <input
          aria-controls={calendarId}
          aria-describedby={hintId}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          autoComplete="off"
          dir="ltr"
          disabled={disabled}
          id={inputId}
          inputMode="numeric"
          maxLength={10}
          name={name}
          onBlur={normalizeInput}
          onChange={(event) => setValue(event.currentTarget.value)}
          placeholder={placeholder}
          required={required}
          title={hint}
          type="text"
          value={value}
        />
        <button
          aria-controls={calendarId}
          aria-expanded={isOpen}
          aria-label={'انتخاب ' + label + ' از تقویم شمسی'}
          className="field-icon-button calendar-trigger"
          disabled={disabled}
          onClick={toggleCalendar}
          title="انتخاب از تقویم شمسی"
          type="button"
        >
          <CalendarDays aria-hidden />
        </button>
        {isOpen ? (
        <div
          aria-label={'تقویم شمسی برای ' + label}
          className="jalali-calendar"
          id={calendarId}
          role="dialog"
        >
          <div className="jalali-calendar-header">
            <button
              aria-label="ماه قبل"
              disabled={view.year === 1200 && view.month === 1}
              onClick={() => moveMonth(-1)}
              type="button"
            >
              <ChevronRight aria-hidden />
            </button>
            <strong aria-live="polite">
              {monthNames[view.month - 1]} {toPersianDateDigits(String(view.year))}
            </strong>
            <button
              aria-label="ماه بعد"
              disabled={view.year === 1700 && view.month === 12}
              onClick={() => moveMonth(1)}
              type="button"
            >
              <ChevronLeft aria-hidden />
            </button>
          </div>
          <div className="jalali-calendar-weekdays" aria-hidden="true">
            {weekdays.map(([shortName, fullName]) => (
              <span key={fullName} title={fullName}>{shortName}</span>
            ))}
          </div>
          <div
            aria-label={'روزهای ماه ' + monthNames[view.month - 1]}
            className="jalali-calendar-days"
            role="grid"
          >
            {Array.from({length: firstWeekday}, (_, index) => (
              <span aria-hidden="true" key={'empty-' + index} />
            ))}
            {Array.from({length: monthLength}, (_, index) => {
              const day = index + 1;
              const isSelected =
                selected?.year === view.year &&
                selected.month === view.month &&
                selected.day === day;
              const isToday =
                today.year === view.year &&
                today.month === view.month &&
                today.day === day;
              return (
                <button
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={
                    toPersianDateDigits(String(day)) +
                    ' ' +
                    monthNames[view.month - 1] +
                    ' ' +
                    toPersianDateDigits(String(view.year))
                  }
                  aria-selected={isSelected}
                  className={
                    (isSelected ? 'selected ' : '') + (isToday ? 'today' : '')
                  }
                  key={day}
                  onClick={() => chooseDate({...view, day})}
                  role="gridcell"
                  type="button"
                >
                  {toPersianDateDigits(String(day))}
                </button>
              );
            })}
          </div>
          <div className="jalali-calendar-footer">
            <button onClick={() => chooseDate(today)} type="button">
              امروز
            </button>
          </div>
        </div>
        ) : null}
      </div>

      <small className="jalali-date-hint" id={hintId}>{hint}</small>
    </div>
  );
}
