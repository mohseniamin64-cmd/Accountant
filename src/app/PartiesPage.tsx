import {Archive, ArchiveRestore, Edit3, Power, X} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {createPortal} from 'react-dom';
import type {AmountUnit} from '../../shared/contracts.js';
import {api, errorMessage, postJson} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {masterDataHelp} from './master-data.help.js';
import {
  amountInputToIrr,
  amountIrrToInput,
  buildListPath,
  nullableText,
  type ActiveFilter,
} from './master-data.helpers.js';
import {masterDataText as text} from './master-data.copy.js';
import {
  ActionFeedback,
  BooleanField,
  DataToolbar,
  MasterDataHeader,
  Pager,
  StatusPill,
} from './MasterDataUi.js';
import './parties-page.css';

interface PartyRecord {
  id: string;
  code: string;
  displayName: string;
  legalName: string | null;
  partyType: 'person' | 'company';
  isCustomer: boolean;
  isSupplier: boolean;
  nationalId: string | null;
  economicCode: string | null;
  registrationNumber: string | null;
  mobile: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  postalCode: string | null;
  creditLimitIrr: string;
  paymentTermsDays: number;
  province: string | null;
  city: string | null;
  isActive: boolean;
  isArchived: boolean;
  rowVersion: number;
}

interface PartiesPageProps {
  permissions: readonly string[];
  amountUnit: AmountUnit;
  isMainAdmin: boolean;
}

const PAGE_SIZE = 30;
const MODAL_FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');
const message = {
  confirmDeactivate: '\u0622\u06cc\u0627 \u0627\u0632 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644\u200c\u0633\u0627\u0632\u06cc \u0627\u06cc\u0646 \u0637\u0631\u0641\u200c\u062d\u0633\u0627\u0628 \u0645\u0637\u0645\u0626\u0646 \u0647\u0633\u062a\u06cc\u062f\u061f',
  confirmDiscard: 'تغییرات واردشده ذخیره نشده است. آیا بدون ذخیره از فرم خارج می‌شوید؟',
  confirmDiscardStatus: 'دلیل غیرفعال‌سازی واردشده ذخیره نشده است. آیا پنجره را می‌بندید؟',
  deactivateReasonRequired: 'دلیل غیرفعال‌سازی را وارد کنید.',
  deactivateReasonTooShort: 'دلیل غیرفعال‌سازی باید حداقل ۵ کاراکتر باشد.',
  customerAndSupplier: '\u0645\u0634\u062a\u0631\u06cc \u0648 \u062a\u0623\u0645\u06cc\u0646\u200c\u06a9\u0646\u0646\u062f\u0647',
  unitIrr: '\u0631\u06cc\u0627\u0644',
  unitToman: '\u062a\u0648\u0645\u0627\u0646',
} as const;

function InputField({
  name,
  label,
  defaultValue,
  required = false,
  type = 'text',
  maxLength,
  min,
  max,
  className,
  onBlur,
}: {
  name: string;
  label: string;
  defaultValue?: string | number | null | undefined;
  required?: boolean;
  type?: string;
  maxLength?: number;
  min?: string;
  max?: string;
  className?: string;
  onBlur?: (value: string) => void;
}) {
  return (
    <label className={'field' + (className ? ' ' + className : '')}>
      <span>{label}{required ? ' *' : ''}</span>
      <input
        defaultValue={defaultValue ?? ''}
        max={max}
        maxLength={maxLength}
        min={min}
        name={name}
        onBlur={(event) => onBlur?.(event.currentTarget.value)}
        required={required}
        type={type}
      />
    </label>
  );
}

const provinceCities: Record<string, readonly string[]> = {
  'آذربایجان شرقی': ['تبریز', 'مراغه', 'مرند', 'میانه', 'اهر'],
  'آذربایجان غربی': ['ارومیه', 'خوی', 'مهاباد', 'بوکان', 'میاندوآب'],
  'اردبیل': ['اردبیل', 'پارس‌آباد', 'مشگین‌شهر', 'خلخال'],
  'اصفهان': ['اصفهان', 'کاشان', 'خمینی‌شهر', 'نجف‌آباد', 'شهرضا'],
  'البرز': ['کرج', 'طالقان', 'نظرآباد', 'ساوجبلاغ'],
  'ایلام': ['ایلام', 'دهلران', 'مهران', 'دره‌شهر'],
  'بوشهر': ['بوشهر', 'دشتستان', 'کنگان', 'جم'],
  'تهران': ['تهران', 'ری', 'شمیرانات', 'شهریار', 'ورامین'],
  'چهارمحال‌وبختیاری': ['شهرکرد', 'بروجن', 'فارسان', 'لردگان'],
  'خراسان جنوبی': ['بیرجند', 'قائن', 'طبس', 'فردوس'],
  'خراسان رضوی': ['مشهد', 'نیشابور', 'سبزوار', 'تربت حیدریه', 'قوچان'],
  'خراسان شمالی': ['بجنورد', 'شیروان', 'اسفراین', 'جاجرم'],
  'خوزستان': ['اهواز', 'دزفول', 'آبادان', 'خرمشهر', 'شوشتر'],
  'زنجان': ['زنجان', 'ابهر', 'خرمدره', 'قیدار'],
  'سمنان': ['سمنان', 'شاهرود', 'دامغان', 'گرمسار'],
  'سیستان‌وبلوچستان': ['زاهدان', 'چابهار', 'ایرانشهر', 'خاش'],
  'فارس': ['شیراز', 'مرودشت', 'جهرم', 'فسا', 'لار'],
  'قزوین': ['قزوین', 'تاکستان', 'آبیک', 'الوند'],
  'قم': ['قم', 'جعفریه', 'کهک'],
  'کردستان': ['سنندج', 'سقز', 'بانه', 'مریوان', 'قروه'],
  'کرمان': ['کرمان', 'رفسنجان', 'سیرجان', 'جیرفت', 'بم'],
  'کرمانشاه': ['کرمانشاه', 'اسلام‌آباد غرب', 'پاوه', 'کنگاور'],
  'کهگیلویه‌وبویراحمد': ['یاسوج', 'دهدشت', 'گچساران'],
  'گلستان': ['گرگان', 'گنبدکاووس', 'علی‌آباد کتول', 'آق‌قلا'],
  'گیلان': ['رشت', 'لاهیجان', 'انزلی', 'رودسر', 'آستارا'],
  'لرستان': ['خرم‌آباد', 'بروجرد', 'دورود', 'الیگودرز'],
  'مازندران': ['ساری', 'بابل', 'آمل', 'قائم‌شهر', 'نوشهر', 'چالوس'],
  'مرکزی': ['اراک', 'ساوه', 'خمین', 'محلات'],
  'هرمزگان': ['بندرعباس', 'قشم', 'میناب', 'بندر لنگه'],
  'همدان': ['همدان', 'ملایر', 'نهاوند', 'تویسرکان'],
  'یزد': ['یزد', 'میبد', 'اردکان', 'بافق'],
} as const;

function normalizePersian(value: string): string {
  return value.trim().toLowerCase().replace(/ي/g, 'ی').replace(/ى/g, 'ی').replace(/ك/g, 'ک').replace(/ة/g, 'ه');
}

function AutocompleteField({
  name,
  label,
  value,
  options,
  disabled = false,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  options: readonly string[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const filtered = options.filter((option) =>
    normalizePersian(option).includes(normalizePersian(value)),
  ).slice(0, 8);

  function choose(option: string) {
    onChange(option);
    setOpen(false);
    setActiveIndex(0);
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === 'Enter' && open && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex]);
      return;
    }
    if (event.key === 'Escape') setOpen(false);
  }

  return (
    <label className="field location-field">
      <span>{label}</span>
      <div className="autocomplete-field">
        <input
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && filtered.length > 0}
          autoComplete="off"
          disabled={disabled}
          name={name}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            onChange(event.currentTarget.value);
            setOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          value={value}
        />
        {open && filtered.length > 0 ? (
          <ul className="autocomplete-options" id={listId} role="listbox">
            {filtered.map((option, index) => (
              <li key={option} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option)}
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </label>
  );
}

function PartyLocationFields({
  defaultProvince,
  defaultCity,
}: {
  defaultProvince?: string | null | undefined;
  defaultCity?: string | null | undefined;
}) {
  const [province, setProvince] = useState(defaultProvince ?? '');
  const [city, setCity] = useState(defaultCity ?? '');
  const provinces = Object.keys(provinceCities);
  const cities = provinceCities[province] ?? [];

  return (
    <>
      <AutocompleteField
        label="استان"
        name="province"
        options={provinces}
        value={province}
        onChange={(value) => {
          setProvince(value);
          if (!provinceCities[value]) setCity('');
          else if (!provinceCities[value].includes(city)) setCity('');
        }}
      />
      <AutocompleteField
        disabled={!provinceCities[province]}
        label="شهر"
        name="city"
        options={cities}
        value={city}
        onChange={setCity}
      />
    </>
  );
}
function partyRole(record: PartyRecord): string {
  if (record.isCustomer && record.isSupplier) return message.customerAndSupplier;
  return record.isCustomer ? text.customer : text.supplier;
}

function formatCredit(value: string, unit: AmountUnit): string {
  const shown = amountIrrToInput(value, unit);
  const [whole = '0', fraction] = shown.split('.');
  const formatted = new Intl.NumberFormat('fa-IR').format(BigInt(whole));
  return (fraction ? formatted + '/' + fraction : formatted) + ' ' +
    (unit === 'IRR' ? message.unitIrr : message.unitToman);
}

export function PartiesPage({permissions, amountUnit, isMainAdmin}: PartiesPageProps) {
  const canManage = permissions.includes('parties.manage');
  const [records, setRecords] = useState<readonly PartyRecord[]>([]);
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<ActiveFilter>('true');
  const [partyTypeFilter, setPartyTypeFilter] = useState<'all' | 'person' | 'company'>('all');
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<'all' | 'customer' | 'supplier'>('all');
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const normalized = draftQuery.trim();
    const timer = window.setTimeout(() => {
      setOffset((currentOffset) => (currentOffset === 0 ? currentOffset : 0));
      setQuery((currentQuery) => (currentQuery === normalized ? currentQuery : normalized));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [draftQuery]);
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [nameWarning, setNameWarning] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const [editing, setEditing] = useState<PartyRecord | null>(null);
  const [formPartyType, setFormPartyType] = useState<PartyRecord['partyType']>('person');
  const [formNameValue, setFormNameValue] = useState('');
  const [statusDialog, setStatusDialog] = useState<PartyRecord | null>(null);
  const [statusReason, setStatusReason] = useState('');
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusDirty, setStatusDirty] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLFormElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const statusDialogRef = useRef<HTMLFormElement>(null);
  const statusReasonRef = useRef<HTMLTextAreaElement>(null);
  const statusReturnFocusRef = useRef<HTMLElement | null>(null);
  const modalTitleId = useId();
  const modalDescriptionId = useId();
  const statusTitleId = useId();
  const statusDescriptionId = useId();

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      setRecords(await api<PartyRecord[]>(
        buildListPath('/api/parties', query, active, offset, PAGE_SIZE),
      ));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, [active, offset, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRecords = records.filter((record) => {
    const matchesType = partyTypeFilter === 'all' || record.partyType === partyTypeFilter;
    const matchesRole = roleFilter === 'all'
      || (roleFilter === 'customer' && record.isCustomer)
      || (roleFilter === 'supplier' && record.isSupplier);
    return matchesType && matchesRole;
  });

  useEffect(() => {
    if (!formOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const opener = returnFocusRef.current;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.querySelector<HTMLInputElement>('input[name="displayName"]')?.focus();
    });
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => opener?.focus());
    };
  }, [formOpen]);

  useEffect(() => {
    if (!statusDialog) return undefined;
    const previousOverflow = document.body.style.overflow;
    const opener = statusReturnFocusRef.current;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => statusReasonRef.current?.focus());
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.requestAnimationFrame(() => opener?.focus());
    };
  }, [statusDialog]);

  function openCreate() {
    returnFocusRef.current = createButtonRef.current;
    setEditing(null);
    setFormOpen(true);
    setFormDirty(false);
    setError(null);
    setSuccess(null);
    setModalError(null);
    setNameWarning(null);
  }

  function openEdit(record: PartyRecord, opener?: HTMLButtonElement) {
    returnFocusRef.current = opener ?? createButtonRef.current;
    setEditing(record);
    setFormOpen(true);
    setFormDirty(false);
    setError(null);
    setSuccess(null);
    setModalError(null);
    setNameWarning(null);
  }

  function closePartyForm(force = false): void {
    if (saving) return;
    if (!force && formDirty && !window.confirm(message.confirmDiscard)) return;
    setFormOpen(false);
    setFormDirty(false);
    setEditing(null);
    setModalError(null);
    setNameWarning(null);
  }

  function handleModalKeyDown(event: ReactKeyboardEvent<HTMLFormElement>): void {
    if (!event.currentTarget.contains(event.target as Node)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closePartyForm();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR),
    ).filter((element) => element.offsetParent !== null);
    if (focusable.length === 0) {
      event.preventDefault();
      event.currentTarget.focus();
      return;
    }
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function closeStatusDialog(force = false): void {
    if (saving) return;
    if (!force && statusDirty && !window.confirm(message.confirmDiscardStatus)) return;
    setStatusDialog(null);
    setStatusReason('');
    setStatusError(null);
    setStatusDirty(false);
  }

  function handleStatusModalKeyDown(event: ReactKeyboardEvent<HTMLFormElement>): void {
    if (!event.currentTarget.contains(event.target as Node)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeStatusDialog();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR),
    ).filter((element) => element.offsetParent !== null);
    if (focusable.length === 0) {
      event.preventDefault();
      event.currentTarget.focus();
      return;
    }
    const first = focusable.at(0);
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function checkNameAvailability(
    displayName: string,
    partyType: PartyRecord['partyType'],
    nationalId: string | null,
    mobile: string | null,
  ): Promise<boolean> {
    const trimmed = displayName.trim();
    if (trimmed.length < 2) return true;
    try {
      const params = new URLSearchParams({
        displayName: trimmed,
        partyType,
      });
      if (nationalId) params.set('nationalId', nationalId);
      if (mobile) params.set('mobile', mobile);
      if (editing) params.set('excludeId', editing.id);
      const result = await api<{available: boolean}>(
        '/api/parties/name-availability?' + params.toString(),
      );
      const warning = result.available
        ? null
        : 'این نام با شناسه‌های واردشده قبلاً ثبت شده است.';
      setNameWarning(warning);
      return result.available;
    } catch {
      return true;
    }
  }

  async function saveParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSaving(true);
    setModalError(null);
    setSuccess(null);
    try {
      const partyType = String(form.get('partyType') ?? 'person') as PartyRecord['partyType'];
      const nationalId = nullableText(form.get('nationalId'));
      const mobile = nullableText(form.get('mobile'));
      const displayName = String(form.get('displayName') ?? '').trim();
      const payload = {
        displayName,
        legalName: null,
        partyType,
        isCustomer: form.has('isCustomer') || !form.has('isSupplier'),
        isSupplier: form.has('isSupplier'),
        nationalId,
        economicCode: nullableText(form.get('economicCode')),
        registrationNumber: nullableText(form.get('registrationNumber')),
        mobile,
        phone: nullableText(form.get('phone')),
        email: nullableText(form.get('email')),
        address: nullableText(form.get('address')),
        postalCode: nullableText(form.get('postalCode')),
        province: nullableText(form.get('province')),
        city: nullableText(form.get('city')),
        creditLimitIrr: amountInputToIrr(
          String(form.get('creditLimit') || '0'),
          amountUnit,
        ),
        paymentTermsDays: Number(form.get('paymentTermsDays') || 0),
      };
      if (!(await checkNameAvailability(displayName, partyType, nationalId, mobile))) {
        setModalError('این نام با شناسه‌های واردشده تکراری است.');
        return;
      }
      if (editing) {
        await postJson(
          '/api/parties/' + editing.id,
          {...payload, rowVersion: editing.rowVersion},
          'PATCH',
        );
      } else {
        await postJson('/api/parties', payload);
      }
      formElement.reset();
      setFormDirty(false);
      setEditing(null);
      setNameWarning(null);
      setModalError(null);
      setFormOpen(false);
      setSuccess(text.partySaved);
      await load();
    } catch (caught) {
      setModalError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }
  async function changeStatus(record: PartyRecord, opener?: HTMLButtonElement) {
    if (saving) return;
    if (record.isActive) {
      statusReturnFocusRef.current = opener ?? createButtonRef.current;
      setStatusReason('');
      setStatusError(null);
      setStatusDirty(false);
      setStatusDialog(record);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await postJson(
        '/api/parties/' + record.id,
        {isActive: !record.isActive, rowVersion: record.rowVersion},
        'PATCH',
      );
      setSuccess(text.partyStatusChanged);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function changeArchive(record: PartyRecord) {
    if (saving) return;
    const action = record.isArchived ? 'بازگردانی از بایگانی' : 'بایگانی';
    if (!window.confirm(`آیا از ${action} «${record.displayName}» مطمئن هستید؟`)) {
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await postJson(
        '/api/parties/' + record.id,
        {isArchived: !record.isArchived, rowVersion: record.rowVersion},
        'PATCH',
      );
      setSuccess(record.isArchived
        ? 'طرف‌حساب از بایگانی بازگردانی شد.'
        : 'طرف‌حساب بایگانی شد و از فهرست فعال‌ها خارج شد.');
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeactivation(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!statusDialog || saving) return;
    const reason = String(new FormData(event.currentTarget).get('deactivationReason') ?? '').trim();
    setStatusReason(reason);
    if (!isMainAdmin && !reason) {
      setStatusError(message.deactivateReasonRequired);
      statusReasonRef.current?.focus();
      return;
    }
    if (!isMainAdmin && reason.length < 5) {
      setStatusError(message.deactivateReasonTooShort);
      statusReasonRef.current?.focus();
      return;
    }
    setSaving(true);
    setStatusError(null);
    setError(null);
    setSuccess(null);
    try {
      await postJson(
        '/api/parties/' + statusDialog.id,
        {
          ...(reason ? {deactivationReason: reason} : {}),
          isActive: false,
          rowVersion: statusDialog.rowVersion,
        },
        'PATCH',
      );
      setStatusDialog(null);
      setStatusReason('');
      setStatusDirty(false);
      setSuccess(text.partyStatusChanged);
      await load();
    } catch (caught) {
      setStatusError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content-page parties-page">
      <MasterDataHeader
        title={text.partyTitle}
        description={text.partyDescription}
        help={appHelp.parties}
      />
      <DataToolbar
        query={draftQuery}
        active={active}
        pending={pending}
        canCreate={canManage}
        createLabel={text.newParty}
        onQueryChange={setDraftQuery}
        onActiveChange={(value) => {
          setOffset(0);
          setActive(value);
        }}
        showSearchButton={false}
        partyType={partyTypeFilter}
        onPartyTypeChange={(value) => {
          setOffset(0);
          setPartyTypeFilter(value);
        }}
        moreOpen={moreFiltersOpen}
        onMoreFilters={() => setMoreFiltersOpen((open) => !open)}
        onCreate={openCreate}
        createButtonRef={createButtonRef}
      />
      {moreFiltersOpen ? (
        <div className="parties-more-filters" role="region" aria-label="فیلترهای بیشتر">
          <label className="field">
            <span>نقش طرف‌حساب</span>
            <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as 'all' | 'customer' | 'supplier')}>
              <option value="all">همه نقش‌ها</option>
              <option value="customer">مشتری</option>
              <option value="supplier">تأمین‌کننده</option>
            </select>
          </label>
          <button className="button secondary" onClick={() => setRoleFilter('all')} type="button">پاک‌کردن فیلترها</button>
        </div>
      ) : null}
      <ActionFeedback error={error} success={success} />

      <div className="table-card">
        {pending ? (
          <div className="empty-state">{text.loading}</div>
        ) : filteredRecords.length === 0 ? (
          <div className="empty-state">{text.noRecords}</div>
        ) : (
          <>
            <div className="table-scroll master-desktop-table">
              <table className="master-table">
                <thead>
                  <tr>
                    <th>{text.code}</th>
                    <th>{text.displayName}</th>
                    <th>{text.partyRoles}</th>
                    <th>{text.mobile}</th>
                    <th>{text.creditLimit}</th>
                    <th>{text.status}</th>
                    {canManage ? <th>{text.actions}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((record) => (
                    <tr key={record.id}>
                      <td>{record.code}</td>
                      <td>{record.displayName}</td>
                      <td>{partyRole(record)}</td>
                      <td>{record.mobile ?? '\u2014'}</td>
                      <td>{formatCredit(record.creditLimitIrr, amountUnit)}</td>
                      <td>{record.isArchived ? <span className="status-pill status-archived">بایگانی‌شده</span> : <StatusPill active={record.isActive} />}</td>
                      {canManage ? <td><RowActions record={record} saving={saving} onEdit={openEdit} onStatus={changeStatus} onArchive={changeArchive} /></td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="master-mobile-list">
              {filteredRecords.map((record) => (
                <article className="master-mobile-card" key={record.id}>
                  <header><div><small>{record.code}</small><h3>{record.displayName}</h3></div>{record.isArchived ? <span className="status-pill status-archived">بایگانی‌شده</span> : <StatusPill active={record.isActive} />}</header>
                  <dl>
                    <dt>{text.partyRoles}</dt><dd>{partyRole(record)}</dd>
                    <dt>{text.mobile}</dt><dd>{record.mobile ?? '\u2014'}</dd>
                    <dt>{text.creditLimit}</dt><dd>{formatCredit(record.creditLimitIrr, amountUnit)}</dd>
                  </dl>
                  {canManage ? <RowActions record={record} saving={saving} onEdit={openEdit} onStatus={changeStatus} onArchive={changeArchive} /> : null}
                </article>
              ))}
            </div>
          </>
        )}
      </div>
      <Pager
        offset={offset}
        pageSize={PAGE_SIZE}
        returned={filteredRecords.length}
        pending={pending}
        onPage={setOffset}
      />
      {formOpen ? createPortal(
        <div
          className="party-modal-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closePartyForm();
          }}
        >
          <form
            aria-describedby={modalDescriptionId}
            aria-labelledby={modalTitleId}
            aria-modal="true"
            className="party-modal"
            key={editing?.id ?? 'new-party'}
            onChange={() => setFormDirty(true)}
            onInput={(event) => {
              setFormDirty(true);
              const target = event.target as HTMLInputElement;
              if (target.name === 'displayName') setFormNameValue(target.value);
            }}
            onKeyDown={handleModalKeyDown}
            onSubmit={(event) => void saveParty(event)}
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <header className="party-modal-header">
              <ContextHelpButton help={masterDataHelp.partyForm} />
              <div>
                <p id={modalDescriptionId}>{text.partyDescription}</p>
                <h2 id={modalTitleId}>{editing ? text.editParty : text.newParty}</h2>
              </div>
              <button
                aria-label="بستن فرم طرف‌حساب"
                className="party-modal-close"
                disabled={saving}
                onClick={() => closePartyForm()}
                type="button"
              >
                <X aria-hidden />
              </button>
            </header>
            <div className="party-modal-body">
              <ActionFeedback error={modalError} success={null} />
              <div className="party-type-switch" role="radiogroup" aria-label="نوع شخصیت">
                <label className={formPartyType === 'person' ? 'party-type-option selected' : 'party-type-option'}>
                  <input
                    checked={formPartyType === 'person'}
                    name="partyType"
                    onChange={() => setFormPartyType('person')}
                    type="radio"
                    value="person"
                  />
                  <span>شخص حقیقی</span>
                </label>
                <label className={formPartyType === 'company' ? 'party-type-option selected' : 'party-type-option'}>
                  <input
                    checked={formPartyType === 'company'}
                    name="partyType"
                    onChange={() => setFormPartyType('company')}
                    type="radio"
                    value="company"
                  />
                  <span>شخص حقوقی</span>
                </label>
              </div>
              <div className="form-grid">
                <InputField
                  name="displayName"
                  label={formPartyType === 'person' ? 'نام و نام خانوادگی' : 'نام شرکت/فروشگاه/مؤسسه'}
                  defaultValue={editing?.displayName}
                  required
                  maxLength={200}
                  onBlur={(value) => void checkNameAvailability(
                    value,
                    formPartyType,
                    nullableText(dialogRef.current?.querySelector<HTMLInputElement>("input[name='nationalId']")?.value ?? null),
                    nullableText(dialogRef.current?.querySelector<HTMLInputElement>("input[name='mobile']")?.value ?? null),
                  )}
                />
                {editing ? (
                  <label className="field generated-code-field">
                    <span>کد طرف‌حساب</span>
                    <input readOnly value={editing.code} />
                  </label>
                ) : (
                  <p className="generated-code-note">کد طرف‌حساب پس از ذخیره، به‌صورت خودکار و یکتا ساخته می‌شود.</p>
                )}
                {nameWarning ? <p className="field-warning">{nameWarning}</p> : null}
                {formPartyType === 'person' ? (
                  <>
                    <InputField name="nationalId" label="کد ملی" defaultValue={editing?.nationalId} maxLength={30} />
                    <InputField name="mobile" label={text.mobile} defaultValue={editing?.mobile} maxLength={30} />
                    <InputField name="phone" label={text.phone} defaultValue={editing?.phone} maxLength={30} />
                    <InputField name="email" label={text.email} defaultValue={editing?.email} type="email" maxLength={180} />
                  </>
                ) : (
                  <>
                    <InputField name="nationalId" label="شناسه ملی" defaultValue={editing?.nationalId} maxLength={30} />
                    <InputField name="registrationNumber" label="شماره ثبت" defaultValue={editing?.registrationNumber} maxLength={80} />
                    <InputField name="economicCode" label="اطلاعات مالی / کد اقتصادی" defaultValue={editing?.economicCode} maxLength={30} />
                    <InputField name="mobile" label={text.mobile} defaultValue={editing?.mobile} maxLength={30} />
                    <InputField name="phone" label={text.phone} defaultValue={editing?.phone} maxLength={30} />
                    <InputField name="email" label={text.email} defaultValue={editing?.email} type="email" maxLength={180} />
                  </>
                )}
                <PartyLocationFields
                  defaultProvince={editing?.province}
                  defaultCity={editing?.city}
                />
                <InputField name="postalCode" label={text.postalCode} defaultValue={editing?.postalCode} maxLength={20} />
                <InputField
                  name="creditLimit"
                  label={text.creditLimit + ' (' + (amountUnit === 'IRR' ? message.unitIrr : message.unitToman) + ')'}
                  defaultValue={amountIrrToInput(editing?.creditLimitIrr ?? '0', amountUnit)}
                  min="0"
                />
                <InputField
                  name="paymentTermsDays"
                  label={text.paymentTermsDays}
                  defaultValue={editing?.paymentTermsDays ?? 0}
                  type="number"
                  min="0"
                  max="3650"
                />
                <label className="field full">
                  <span>{text.address}</span>
                  <textarea name="address" defaultValue={editing?.address ?? ''} maxLength={1500} rows={3} />
                </label>
              </div>
              <div className="boolean-grid">
                <BooleanField name="isCustomer" label={text.customer} defaultChecked={editing?.isCustomer ?? true} />
                <BooleanField name="isSupplier" label={text.supplier} defaultChecked={editing?.isSupplier ?? false} />
              </div>
            </div>            <footer className="party-modal-actions">
              <button className="button secondary" disabled={saving} onClick={() => closePartyForm()} type="button">
                {text.cancel}
              </button>
              <button className="button primary" disabled={saving || !formNameValue.trim()} type="submit">
                {saving ? text.saving : text.save}
              </button>
            </footer>
          </form>
        </div>,
        document.body,
      ) : null}
      {statusDialog ? createPortal(
        <div
          className="party-modal-backdrop party-status-modal-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) closeStatusDialog();
          }}
        >
          <form
            aria-describedby={statusDescriptionId}
            aria-labelledby={statusTitleId}
            aria-modal="true"
            className="party-modal party-status-modal"
            onInput={() => setStatusDirty(true)}
            onKeyDown={handleStatusModalKeyDown}
            onSubmit={(event) => void confirmDeactivation(event)}
            ref={statusDialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <header className="party-modal-header">
              <div>
                <p id={statusDescriptionId}>ثبت تغییر وضعیت طرف‌حساب</p>
                <h2 id={statusTitleId}>غیرفعال‌سازی طرف‌حساب</h2>
              </div>
              <button
                aria-label="بستن پنجره غیرفعال‌سازی"
                className="party-modal-close"
                disabled={saving}
                onClick={() => closeStatusDialog()}
                type="button"
              >
                <X aria-hidden />
              </button>
            </header>
            <div className="party-modal-body">
              <p className="party-status-target">طرف‌حساب: <strong>{statusDialog.displayName}</strong></p>
              <ActionFeedback error={statusError} success={null} />
              <label className="field party-status-reason-field">
                <span>دلیل غیرفعال‌سازی{isMainAdmin ? '' : ' *'}</span>
                <textarea
                  aria-invalid={Boolean(statusError)}
                  aria-required={!isMainAdmin}
                  autoComplete="off"
                  maxLength={1000}
                  minLength={5}
                  name="deactivationReason"
                  onChange={(event) => setStatusReason(event.currentTarget.value)}
                  placeholder="دلیل غیرفعال‌سازی را وارد کنید"
                  ref={statusReasonRef}
                  required={!isMainAdmin}
                  rows={5}
                  value={statusReason}
                />
              </label>
              <small className="party-status-hint">این دلیل در سابقه عملیات ثبت می‌شود.</small>
            </div>
            <footer className="party-modal-actions">
              <button className="button secondary" disabled={saving} onClick={() => closeStatusDialog()} type="button">
                انصراف
              </button>
              <button className="button primary" disabled={saving} type="submit">
                {saving ? 'در حال ثبت…' : 'تأیید غیرفعال‌سازی'}
              </button>
            </footer>
          </form>
        </div>,
        document.body,
      ) : null}
    </section>
  );
}

function ContextualFormHelp() {
  const {ContextHelpButton} = requireContextHelp();
  return <ContextHelpButton help={masterDataHelp.partyForm} />;
}

function requireContextHelp() {
  return {ContextHelpButton: (
    ({help}: {help: (typeof masterDataHelp)['partyForm']}) => {
      const HelpButton = lazyHelpButton();
      return <HelpButton help={help} />;
    }
  )};
}

function lazyHelpButton() {
  return requireHelpModule;
}

import {ContextHelpButton as requireHelpModule} from './ContextHelpButton.js';

function RowActions({
  record,
  saving,
  onEdit,
  onStatus,
  onArchive,
}: {
  record: PartyRecord;
  saving: boolean;
  onEdit: (record: PartyRecord, opener?: HTMLButtonElement) => void;
  onStatus: (record: PartyRecord, opener?: HTMLButtonElement) => Promise<void>;
  onArchive: (record: PartyRecord) => Promise<void>;
}) {
  return (
    <div className="master-row-actions">
      <button className="button secondary" disabled={saving} onClick={(event) => onEdit(record, event.currentTarget)} type="button">
        <Edit3 aria-hidden />{text.edit}
      </button>
      <button className="button secondary" disabled={saving} onClick={(event) => void onStatus(record, event.currentTarget)} type="button">
        <Power aria-hidden />{record.isActive ? text.deactivate : text.activate}
      </button>
      <button
        className={'button archive-action' + (record.isArchived ? ' archive-action--restore' : '')}
        disabled={saving}
        onClick={() => void onArchive(record)}
        type="button"
      >
        {record.isArchived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
        {record.isArchived ? 'بازگردانی از بایگانی' : 'بایگانی'}
      </button>
    </div>
  );
}







