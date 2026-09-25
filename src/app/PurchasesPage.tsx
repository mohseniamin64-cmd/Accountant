import {
  CirclePlus,
  Eye,
  Plus,
  RotateCcw,
  Save,
  Search,
  X,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {api, errorMessage, postJson} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {JalaliDateField} from './JalaliDateField.js';
import {formatJalaliDate, jalaliInputToIso} from './jalali-date.js';
import {ActionFeedback, Pager} from './MasterDataUi.js';
import {
  amountInputToIrr,
  amountIrrToInput,
} from './master-data.helpers.js';
import {partyOptionText} from './party-option.js';
import {PurchaseDetailPanel} from './PurchaseDetailPanel.js';
import {PurchaseLineEditor} from './PurchaseLineEditor.js';
import {
  assertUniqueInvoiceSerials,
  calculatePurchaseLineAmounts,
  formatIrrAmount,
  parseSerialNumbers,
  positivePurchaseQuantity,
  validateSerialNumbers,
} from './purchase.helpers.js';
import type {
  PurchaseCreated,
  PurchaseDetail,
  PurchaseDraft,
  PurchaseDraftLine,
  PurchaseOptions,
  PurchaseStatus,
  PurchaseSummary,
} from './purchase.types.js';
import type {
  TradeReturnCreated,
  TradeReturnSelection,
} from './trade-return.types.js';
import './purchases.css';

interface PurchasesPageProps {
  amountUnit: AmountUnit;
  permissions: readonly string[];
}

type PurchaseStatusFilter = PurchaseStatus | 'all';

const PAGE_SIZE = 25;
let lineSequence = 0;

function newLine(warehouseId = ''): PurchaseDraftLine {
  lineSequence += 1;
  return {
    key: 'purchase-line-' + lineSequence,
    productId: '',
    warehouseId,
    quantity: '1',
    unitPrice: '0',
    discount: '0',
    tax: '0',
    description: '',
    serialText: '',
  };
}

function todayInTehran(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function statusText(status: PurchaseStatus): string {
  if (status === 'draft') return '\u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633';
  if (status === 'posted') return '\u0642\u0637\u0639\u06cc';
  return 'لغو/برگشت‌شده';
}

function paymentText(status: PurchaseSummary['paymentStatus']): string {
  if (status === 'paid') return '\u062a\u0633\u0648\u06cc\u0647\u200c\u0634\u062f\u0647';
  if (status === 'partial') return '\u067e\u0631\u062f\u0627\u062e\u062a \u0646\u0627\u0642\u0635';
  return '\u062a\u0633\u0648\u06cc\u0647\u200c\u0646\u0634\u062f\u0647';
}

function nullable(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function draftPreviewTotal(
  draft: PurchaseDraft,
  amountUnit: AmountUnit,
): bigint {
  let total = 0n;
  for (const line of draft.lines) {
    try {
      total += calculatePurchaseLineAmounts(
        line.quantity,
        line.unitPrice,
        line.discount,
        line.tax,
        amountUnit,
      ).totalIrr;
    } catch {
      // Invalid incomplete rows are shown as zero until submit validation.
    }
  }
  try {
    total += BigInt(amountInputToIrr(draft.otherCosts, amountUnit));
  } catch {
    // Invalid incomplete other costs are shown as zero until submit validation.
  }
  return total;
}

export function PurchasesPage({
  amountUnit,
  permissions,
}: PurchasesPageProps) {
  const canCreate = permissions.includes('purchase.create');
  const canPost = permissions.includes('purchase.post');
  const canCancel = permissions.includes('purchase.void');
  const [records, setRecords] = useState<PurchaseSummary[]>([]);
  const [options, setOptions] = useState<PurchaseOptions>({
    suppliers: [],
    products: [],
    branches: [],
    warehouses: [],
  });
  const [statusFilter, setStatusFilter] = useState<PurchaseStatusFilter>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [offset, setOffset] = useState(0);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [pending, setPending] = useState(true);
  const [optionsPending, setOptionsPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [draft, setDraft] = useState<PurchaseDraft | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const [filterVersion, setFilterVersion] = useState(0);
  const [selected, setSelected] = useState<PurchaseSummary | null>(null);
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [detailPending, setDetailPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      setRecords(await api<PurchaseSummary[]>('/api/purchases?' + params.toString()));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, [fromDate, offset, statusFilter, toDate]);

  const loadOptions = useCallback(async () => {
    setOptionsPending(true);
    try {
      setOptions(await api<PurchaseOptions>('/api/purchases/options'));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setOptionsPending(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords, reloadVersion]);

  useEffect(() => {
    void loadOptions();
  }, [loadOptions]);

  const branchWarehouses = useMemo(
    () => options.warehouses.filter((item) => item.branchId === draft?.branchId),
    [draft?.branchId, options.warehouses],
  );

  const previewTotal = draft ? draftPreviewTotal(draft, amountUnit) : 0n;

  function startNewInvoice(): void {
    setError(null);
    setSuccess(null);
    if (optionsPending) {
      setError('\u0627\u0637\u0644\u0627\u0639\u0627\u062a \u0644\u0627\u0632\u0645 \u0641\u0631\u0645 \u0647\u0646\u0648\u0632 \u062f\u0631 \u062d\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u0627\u0633\u062a\u061b \u0686\u0646\u062f \u0644\u062d\u0638\u0647 \u062f\u06cc\u06af\u0631 \u062f\u0648\u0628\u0627\u0631\u0647 \u062a\u0644\u0627\u0634 \u06a9\u0646\u06cc\u062f.');
      return;
    }
    if (options.suppliers.length === 0) {
      setError('برای ثبت خرید، ابتدا یک طرف‌حساب فعال تعریف کنید.');
      return;
    }
    if (options.products.length === 0) {
      setError('\u0628\u0631\u0627\u06cc \u062b\u0628\u062a \u062e\u0631\u06cc\u062f\u060c \u0627\u0628\u062a\u062f\u0627 \u06cc\u06a9 \u06a9\u0627\u0644\u0627\u06cc \u0641\u0639\u0627\u0644 \u0648 \u0642\u0627\u0628\u0644 \u062e\u0631\u06cc\u062f \u062a\u0639\u0631\u06cc\u0641 \u06a9\u0646\u06cc\u062f.');
      return;
    }
    const branch = options.branches.find((item) => item.isHeadOffice) ??
      options.branches[0];
    if (!branch) {
      setError('\u0628\u0631\u0627\u06cc \u062b\u0628\u062a \u062e\u0631\u06cc\u062f\u060c \u0627\u0628\u062a\u062f\u0627 \u06cc\u06a9 \u0634\u0639\u0628\u0647 \u0641\u0639\u0627\u0644 \u062a\u0639\u0631\u06cc\u0641 \u06a9\u0646\u06cc\u062f.');
      return;
    }
    const warehouse = options.warehouses.find(
      (item) => item.branchId === branch.id,
    );
    if (!warehouse) {
      setError('\u0634\u0639\u0628\u0647 \u0627\u0646\u062a\u062e\u0627\u0628\u06cc \u0628\u0627\u06cc\u062f \u062d\u062f\u0627\u0642\u0644 \u06cc\u06a9 \u0627\u0646\u0628\u0627\u0631 \u0641\u0639\u0627\u0644 \u062f\u0627\u0634\u062a\u0647 \u0628\u0627\u0634\u062f.');
      return;
    }
    setSelected(null);
    setDetail(null);
    setFormVersion((current) => current + 1);
    setDraft({
      branchId: branch.id,
      supplierId: '',
      supplierInvoiceNumber: '',
      otherCosts: '0',
      description: '',
      lines: [newLine(warehouse.id)],
    });
  }

  function changeBranch(branchId: string): void {
    setDraft((current) => {
      if (!current) return current;
      const firstWarehouse = options.warehouses.find(
        (item) => item.branchId === branchId,
      );
      const allowed = new Set(
        options.warehouses
          .filter((item) => item.branchId === branchId)
          .map((item) => item.id),
      );
      return {
        ...current,
        branchId,
        lines: current.lines.map((line) => ({
          ...line,
          warehouseId: allowed.has(line.warehouseId)
            ? line.warehouseId
            : firstWarehouse?.id ?? '',
        })),
      };
    });
  }

  function changeLine(
    key: string,
    changes: Partial<PurchaseDraftLine>,
  ): void {
    setDraft((current) => current ? {
      ...current,
      lines: current.lines.map((line) =>
        line.key === key ? {...line, ...changes} : line),
    } : current);
  }

  function changeLineProduct(key: string, productId: string): void {
    const product = options.products.find((item) => item.id === productId);
    changeLine(key, {
      productId,
      unitPrice: product
        ? amountIrrToInput(product.defaultPurchasePriceIrr, amountUnit)
        : '0',
      serialText: product?.trackingType === 'serial' ? '' : '',
    });
  }

  function addLine(): void {
    const warehouseId = branchWarehouses[0]?.id ?? '';
    setDraft((current) => current ? {
      ...current,
      lines: [...current.lines, newLine(warehouseId)],
    } : current);
  }

  function removeLine(key: string): void {
    setDraft((current) => current && current.lines.length > 1 ? {
      ...current,
      lines: current.lines.filter((line) => line.key !== key),
    } : current);
  }

  async function savePurchase(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!draft.branchId) throw new Error('\u0627\u0646\u062a\u062e\u0627\u0628 \u0634\u0639\u0628\u0647 \u0627\u0644\u0632\u0627\u0645\u06cc \u0627\u0633\u062a.');
      if (!draft.supplierId) throw new Error('انتخاب طرف‌حساب خرید الزامی است.');
      const dateValue = String(
        new FormData(event.currentTarget).get('invoiceDate') ?? '',
      );
      const invoiceDate = jalaliInputToIso(dateValue);
      const serialGroups: string[][] = [];
      let invoiceLinesTotal = 0n;
      const lines = draft.lines.map((line, index) => {
        const product = options.products.find(
          (item) => item.id === line.productId,
        );
        if (!product) {
          throw new Error('\u06a9\u0627\u0644\u0627\u06cc \u0631\u062f\u06cc\u0641 ' + (index + 1) + ' \u0627\u0646\u062a\u062e\u0627\u0628 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.');
        }
        const warehouse = options.warehouses.find(
          (item) =>
            item.id === line.warehouseId &&
            item.branchId === draft.branchId,
        );
        if (!warehouse) {
          throw new Error('\u0627\u0646\u0628\u0627\u0631 \u0645\u0639\u062a\u0628\u0631 \u0631\u062f\u06cc\u0641 ' + (index + 1) + ' \u0627\u0646\u062a\u062e\u0627\u0628 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.');
        }
        const quantity = positivePurchaseQuantity(line.quantity);
        const amounts = calculatePurchaseLineAmounts(
          quantity,
          line.unitPrice,
          line.discount,
          line.tax,
          amountUnit,
        );
        invoiceLinesTotal += amounts.totalIrr;
        const serialNumbers = parseSerialNumbers(line.serialText);
        validateSerialNumbers(product.trackingType, quantity, serialNumbers);
        serialGroups.push(serialNumbers);
        return {
          productId: product.id,
          warehouseId: warehouse.id,
          quantity,
          unitPriceIrr: amountInputToIrr(line.unitPrice, amountUnit),
          discountIrr: amounts.discountIrr.toString(),
          taxIrr: amounts.taxIrr.toString(),
          description: nullable(line.description),
          serialNumbers,
        };
      });
      assertUniqueInvoiceSerials(serialGroups);
      const otherCostsIrr = amountInputToIrr(draft.otherCosts, amountUnit);
      const total = invoiceLinesTotal + BigInt(otherCostsIrr);
      if (total <= 0n) {
        throw new Error('\u0645\u0628\u0644\u063a \u0646\u0647\u0627\u06cc\u06cc \u0641\u0627\u06a9\u062a\u0648\u0631 \u062e\u0631\u06cc\u062f \u0628\u0627\u06cc\u062f \u0628\u06cc\u0634\u062a\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062f.');
      }
      const created = await postJson<PurchaseCreated>('/api/purchases', {
        branchId: draft.branchId,
        supplierId: draft.supplierId,
        invoiceDate,
        supplierInvoiceNumber: nullable(draft.supplierInvoiceNumber),
        otherCostsIrr,
        description: nullable(draft.description),
        lines,
      });
      setDraft(null);
      setOffset(0);
      setSuccess(
        '\u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633 \u062e\u0631\u06cc\u062f \u0634\u0645\u0627\u0631\u0647 ' + created.invoiceNumber +
        ' \u0630\u062e\u06cc\u0631\u0647 \u0634\u062f\u061b \u0628\u0631\u0627\u06cc \u0627\u062b\u0631\u06af\u0630\u0627\u0631\u06cc \u0628\u0631 \u0627\u0646\u0628\u0627\u0631 \u0648 \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc \u0622\u0646 \u0631\u0627 \u0642\u0637\u0639\u06cc \u06a9\u0646\u06cc\u062f.',
      );
      setReloadVersion((current) => current + 1);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  function applyFilters(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setError(null);
    try {
      const form = new FormData(event.currentTarget);
      const fromInput = String(form.get('fromDate') ?? '').trim();
      const toInput = String(form.get('toDate') ?? '').trim();
      const nextFrom = fromInput ? jalaliInputToIso(fromInput) : '';
      const nextTo = toInput ? jalaliInputToIso(toInput) : '';
      if (nextFrom && nextTo && nextFrom > nextTo) {
        throw new Error('\u062a\u0627\u0631\u06cc\u062e \u0634\u0631\u0648\u0639 \u0628\u0627\u0632\u0647 \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u062f \u0628\u0639\u062f \u0627\u0632 \u062a\u0627\u0631\u06cc\u062e \u067e\u0627\u06cc\u0627\u0646 \u0628\u0627\u0634\u062f.');
      }
      setStatusFilter(String(form.get('status') ?? 'all') as PurchaseStatusFilter);
      setFromDate(nextFrom);
      setToDate(nextTo);
      setOffset(0);
      setReloadVersion((current) => current + 1);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  function clearFilters(): void {
    setStatusFilter('all');
    setFromDate('');
    setToDate('');
    setOffset(0);
    setFilterVersion((current) => current + 1);
    setReloadVersion((current) => current + 1);
  }

  async function openDetail(record: PurchaseSummary): Promise<void> {
    setSelected(record);
    setDetail(null);
    setDetailPending(true);
    setError(null);
    try {
      setDetail(await api<PurchaseDetail>('/api/purchases/' + record.id));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setDetailPending(false);
    }
  }

  async function postSelected(): Promise<void> {
    if (!selected || acting) return;
    if (!window.confirm(
      '\u0628\u0627 \u0642\u0637\u0639\u06cc\u200c\u06a9\u0631\u062f\u0646 \u0627\u06cc\u0646 \u0641\u0627\u06a9\u062a\u0648\u0631\u060c \u0645\u0648\u062c\u0648\u062f\u06cc \u0627\u0646\u0628\u0627\u0631 \u0627\u0641\u0632\u0627\u06cc\u0634 \u0645\u06cc\u200c\u06cc\u0627\u0628\u062f \u0648 \u0633\u0646\u062f \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc \u0627\u06cc\u062c\u0627\u062f \u0645\u06cc\u200c\u0634\u0648\u062f. \u0627\u062f\u0627\u0645\u0647 \u0645\u06cc\u200c\u062f\u0647\u06cc\u062f\u061f',
    )) return;
    setActing(true);
    setError(null);
    setSuccess(null);
    try {
      await postJson('/api/purchases/' + selected.id + '/post', {});
      setSelected(null);
      setDetail(null);
      setSuccess('\u0641\u0627\u06a9\u062a\u0648\u0631 \u062e\u0631\u06cc\u062f \u0642\u0637\u0639\u06cc \u0634\u062f\u061b \u0645\u0648\u062c\u0648\u062f\u06cc \u0648 \u0633\u0646\u062f \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc \u0628\u0627 \u0645\u0648\u0641\u0642\u06cc\u062a \u062b\u0628\u062a \u0634\u062f\u0646\u062f.');
      setReloadVersion((current) => current + 1);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setActing(false);
    }
  }

  async function cancelSelected(reason: string): Promise<void> {
    if (!selected || acting) return;
    if (reason.length < 5) {
      setError('\u062f\u0644\u06cc\u0644 \u0644\u063a\u0648 \u0628\u0627\u06cc\u062f \u062d\u062f\u0627\u0642\u0644 \u067e\u0646\u062c \u0646\u0648\u06cc\u0633\u0647 \u062f\u0627\u0634\u062a\u0647 \u0628\u0627\u0634\u062f.');
      return;
    }
    setActing(true);
    setError(null);
    setSuccess(null);
    try {
      await postJson(
        '/api/purchases/' + selected.id + '/cancel-draft',
        {reason},
      );
      setSelected(null);
      setDetail(null);
      setSuccess('\u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633 \u062e\u0631\u06cc\u062f \u0628\u0627 \u062b\u0628\u062a \u062f\u0644\u06cc\u0644 \u0644\u063a\u0648 \u0634\u062f.');
      setReloadVersion((current) => current + 1);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setActing(false);
    }
  }

  async function returnSelected(
    returnDate: string,
    reason: string,
    lines: TradeReturnSelection[],
  ): Promise<void> {
    if (!selected || acting) return;
    if (reason.length < 5) {
      setError('دلیل مرجوعی باید حداقل پنج نویسه داشته باشد.');
      return;
    }
    if (!window.confirm(
      `مرجوعی ${lines.length.toLocaleString('fa-IR')} ردیف انتخاب‌شده، موجودی و سند مالی را اصلاح می‌کند. ادامه می‌دهید؟`,
    )) return;
    setActing(true);
    setError(null);
    setSuccess(null);
    try {
      const returned = await postJson<TradeReturnCreated>(
        '/api/purchases/' + selected.id + '/return',
        {returnDate, reason, rowVersion: selected.rowVersion, lines},
      );
      setSelected(null);
      setDetail(null);
      setSuccess(
        'مرجوعی ' + (returned.originalStatus === 'reversed' ? 'کامل' : 'جزئی') +
        ' خرید با شماره ' + returned.invoiceNumber +
        ' ثبت شد؛ موجودی، سریال، مانده و سند مالی به‌روزرسانی شدند.',
      );
      setReloadVersion((current) => current + 1);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setActing(false);
    }
  }

  return (
    <section className="content-page purchases-page purchase-workspace">
      <header className="page-heading compact">
        <ContextHelpButton help={appHelp.purchases} />
        <div>
          <p>{'\u062e\u0631\u06cc\u062f \u0648\u0627\u0642\u0639\u06cc \u0645\u062a\u0635\u0644 \u0628\u0647 \u0627\u0646\u0628\u0627\u0631\u060c \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc \u0648 \u062a\u0623\u0645\u06cc\u0646\u200c\u06a9\u0646\u0646\u062f\u0647'}</p>
          <h1>{'\u0641\u0627\u06a9\u062a\u0648\u0631\u0647\u0627\u06cc \u062e\u0631\u06cc\u062f'}</h1>
        </div>
        <div className="heading-actions">
          {canCreate ? (
            <button className="button primary" onClick={startNewInvoice} type="button">
              <CirclePlus aria-hidden />{'\u0641\u0627\u06a9\u062a\u0648\u0631 \u062e\u0631\u06cc\u062f \u062c\u062f\u06cc\u062f'}
            </button>
          ) : null}
        </div>
      </header>

      <ActionFeedback error={error} success={success} />

      {draft && canCreate ? (
        <form
          className="form-card purchase-form"
          key={'purchase-form-' + formVersion}
          onSubmit={(event) => void savePurchase(event)}
        >
          <div className="form-card-heading">
            <ContextHelpButton help={appHelp.purchaseForm} />
            <h2>{'\u062b\u0628\u062a \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633 \u0641\u0627\u06a9\u062a\u0648\u0631 \u062e\u0631\u06cc\u062f'}</h2>
            <p>{'\u0627\u0637\u0644\u0627\u0639\u0627\u062a \u067e\u0627\u06cc\u0647 \u0631\u0627 \u0648\u0627\u0631\u062f \u06a9\u0646\u06cc\u062f\u061b \u062b\u0628\u062a \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633 \u0647\u0646\u0648\u0632 \u0645\u0648\u062c\u0648\u062f\u06cc \u0648 \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc \u0631\u0627 \u062a\u063a\u06cc\u06cc\u0631 \u0646\u0645\u06cc\u200c\u062f\u0647\u062f.'}</p>
          </div>

          <div className="purchase-header-grid">
            <label className="field">
              <span>{'\u0634\u0639\u0628\u0647 \u062e\u0631\u06cc\u062f\u0627\u0631 *'}</span>
              <select
                onChange={(event) => changeBranch(event.target.value)}
                required
                value={draft.branchId}
              >
                {options.branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.code}{' \u2014 '}{branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>طرف‌حساب خرید *</span>
              <select
                onChange={(event) => setDraft({...draft, supplierId: event.target.value})}
                required
                value={draft.supplierId}
              >
                <option value="">انتخاب طرف‌حساب</option>
                {options.suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {partyOptionText(supplier)}
                  </option>
                ))}
              </select>
            </label>
            <JalaliDateField
              defaultIsoValue={todayInTehran()}
              label={'\u062a\u0627\u0631\u06cc\u062e \u0641\u0627\u06a9\u062a\u0648\u0631'}
              name="invoiceDate"
              required
            />
            <label className="field">
              <span>{'\u0634\u0645\u0627\u0631\u0647 \u0641\u0627\u06a9\u062a\u0648\u0631 \u062a\u0623\u0645\u06cc\u0646\u200c\u06a9\u0646\u0646\u062f\u0647'}</span>
              <input
                maxLength={120}
                onChange={(event) => setDraft({...draft, supplierInvoiceNumber: event.target.value})}
                value={draft.supplierInvoiceNumber}
              />
            </label>
            <label className="field">
              <span>{'\u0647\u0632\u06cc\u0646\u0647\u200c\u0647\u0627\u06cc \u062c\u0627\u0646\u0628\u06cc ('}{amountUnit === 'IRR' ? '\u0631\u06cc\u0627\u0644' : '\u062a\u0648\u0645\u0627\u0646'}{') *'}</span>
              <input
                dir="ltr"
                inputMode="decimal"
                maxLength={30}
                onChange={(event) => setDraft({...draft, otherCosts: event.target.value})}
                required
                value={draft.otherCosts}
              />
            </label>
            <label className="field purchase-header-description">
              <span>{'\u062a\u0648\u0636\u06cc\u062d\u0627\u062a \u0641\u0627\u06a9\u062a\u0648\u0631'}</span>
              <textarea
                maxLength={2000}
                onChange={(event) => setDraft({...draft, description: event.target.value})}
                rows={3}
                value={draft.description}
              />
            </label>
          </div>

          <div className="form-section-heading purchase-lines-heading">
            <ContextHelpButton help={appHelp.purchaseLines} />
            <h2>اقلام فاکتور خرید</h2>
            <button className="button secondary" onClick={addLine} type="button">
              <Plus aria-hidden />{'\u0627\u0641\u0632\u0648\u062f\u0646 \u0631\u062f\u06cc\u0641'}
            </button>
          </div>

          <div className="purchase-draft-table table-scroll">
            <table>
              <thead>
                <tr>
                  <th>ردیف</th><th>کد کالا</th><th>نام کالا یا خدمت</th><th>انبار</th><th>تعداد</th><th>واحد</th><th>فی</th><th>تخفیف</th><th>مالیات</th><th>جمع</th><th>حذف</th>
                </tr>
              </thead>
              <tbody>
                {draft.lines.map((line, index) => (
                  <PurchaseLineEditor
                    amountUnit={amountUnit}
                    canRemove={draft.lines.length > 1}
                    index={index}
                    key={line.key}
                    line={line}
                    onChange={(changes) => changeLine(line.key, changes)}
                    onProductChange={(productId) => changeLineProduct(line.key, productId)}
                    onRemove={() => removeLine(line.key)}
                    products={options.products}
                    warehouses={branchWarehouses}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="purchase-form-total">
            <span>{'\u062c\u0645\u0639 \u0628\u0631\u0622\u0648\u0631\u062f\u06cc \u0641\u0627\u06a9\u062a\u0648\u0631 \u0628\u0627 \u0647\u0632\u06cc\u0646\u0647 \u062c\u0627\u0646\u0628\u06cc'}</span>
            <strong>{formatIrrAmount(previewTotal, amountUnit)}</strong>
            <small>{'\u0645\u0628\u0644\u063a \u0642\u0637\u0639\u06cc \u067e\u0633 \u0627\u0632 \u0627\u0639\u062a\u0628\u0627\u0631\u0633\u0646\u062c\u06cc \u0633\u0631\u0648\u0631 \u0630\u062e\u06cc\u0631\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f.'}</small>
          </div>

          <div className="purchase-form-actions">
            <button className="button primary" disabled={saving} type="submit">
              <Save aria-hidden />
              {saving ? '\u062f\u0631 \u062d\u0627\u0644 \u0630\u062e\u06cc\u0631\u0647\u2026' : '\u0630\u062e\u06cc\u0631\u0647 \u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633'}
            </button>
            <button
              className="button secondary"
              disabled={saving}
              onClick={() => setDraft(null)}
              type="button"
            >
              <X aria-hidden />{'\u0627\u0646\u0635\u0631\u0627\u0641'}
            </button>
          </div>
        </form>
      ) : null}

      {selected ? (
        <PurchaseDetailPanel
          acting={acting}
          key={selected.id}
          amountUnit={amountUnit}
          canCancel={canCancel}
          canPost={canPost}
          detail={detail}
          help={appHelp.purchasePosting}
          onCancel={(reason) => void cancelSelected(reason)}
          onClose={() => {
            setSelected(null);
            setDetail(null);
          }}
          onPost={() => void postSelected()}
          onReturn={(returnDate, reason, lines) =>
            void returnSelected(returnDate, reason, lines)}
          pending={detailPending}
          summary={selected}
        />
      ) : null}

      <form
        className="purchase-filter-card"
        key={'purchase-filter-' + filterVersion}
        onSubmit={applyFilters}
      >
        <div className="form-section-heading">
          <ContextHelpButton help={appHelp.purchaseFilters} />
          <h2>{'\u0641\u06cc\u0644\u062a\u0631 \u0641\u0627\u06a9\u062a\u0648\u0631\u0647\u0627\u06cc \u062e\u0631\u06cc\u062f'}</h2>
        </div>
        <div className="purchase-filter-grid">
          <label className="field">
            <span>{'\u0648\u0636\u0639\u06cc\u062a \u0641\u0627\u06a9\u062a\u0648\u0631'}</span>
            <select defaultValue={statusFilter} name="status">
              <option value="all">{'\u0647\u0645\u0647 \u0648\u0636\u0639\u06cc\u062a\u200c\u0647\u0627'}</option>
              <option value="draft">{'\u067e\u06cc\u0634\u200c\u0646\u0648\u06cc\u0633'}</option>
              <option value="posted">{'\u0642\u0637\u0639\u06cc'}</option>
              <option value="reversed">{'لغو/برگشت‌شده'}</option>
            </select>
          </label>
          <JalaliDateField defaultIsoValue={fromDate} label={'\u0627\u0632 \u062a\u0627\u0631\u06cc\u062e'} name="fromDate" />
          <JalaliDateField defaultIsoValue={toDate} label={'\u062a\u0627 \u062a\u0627\u0631\u06cc\u062e'} name="toDate" />
          <div className="purchase-filter-actions">
            <button className="button primary" disabled={pending} type="submit">
              <Search aria-hidden />{'\u0627\u0639\u0645\u0627\u0644 \u0641\u06cc\u0644\u062a\u0631'}
            </button>
            <button className="button secondary" disabled={pending} onClick={clearFilters} type="button">
              <RotateCcw aria-hidden />{'\u067e\u0627\u06a9\u200c\u06a9\u0631\u062f\u0646'}
            </button>
          </div>
        </div>
      </form>

      {pending ? (
        <div className="empty-state card">{'\u062f\u0631 \u062d\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u0641\u0627\u06a9\u062a\u0648\u0631\u0647\u0627\u06cc \u062e\u0631\u06cc\u062f\u2026'}</div>
      ) : records.length === 0 ? (
        <div className="empty-state card">{'\u0641\u0627\u06a9\u062a\u0648\u0631 \u062e\u0631\u06cc\u062f\u06cc \u0645\u0637\u0627\u0628\u0642 \u0641\u06cc\u0644\u062a\u0631 \u0641\u0639\u0644\u06cc \u0648\u062c\u0648\u062f \u0646\u062f\u0627\u0631\u062f.'}</div>
      ) : (
        <>
          <div className="table-card purchase-list-desktop">
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{'\u0634\u0645\u0627\u0631\u0647'}</th>
                    <th>{'\u062a\u0627\u0631\u06cc\u062e'}</th>
                    <th>{'\u062a\u0623\u0645\u06cc\u0646\u200c\u06a9\u0646\u0646\u062f\u0647'}</th>
                    <th>{'\u0634\u0645\u0627\u0631\u0647 \u062a\u0623\u0645\u06cc\u0646\u200c\u06a9\u0646\u0646\u062f\u0647'}</th>
                    <th>{'\u0645\u0628\u0644\u063a \u06a9\u0644'}</th>
                    <th>{'\u067e\u0631\u062f\u0627\u062e\u062a'}</th>
                    <th>{'\u0648\u0636\u0639\u06cc\u062a'}</th>
                    <th>{'\u0639\u0645\u0644\u06cc\u0627\u062a'}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td><strong>{record.invoiceNumber}</strong></td>
                      <td>{formatJalaliDate(record.invoiceDate)}</td>
                      <td>{record.supplierName}</td>
                      <td>{record.supplierInvoiceNumber ?? '\u2014'}</td>
                      <td>{formatIrrAmount(record.totalIrr, amountUnit)}</td>
                      <td>{paymentText(record.paymentStatus)}</td>
                      <td>
                        <span className={'status-pill status-' + record.status}>
                          {record.invoiceType === 'return' ? 'مرجوعی قطعی' : statusText(record.status)}
                        </span>
                      </td>
                      <td>
                        <button className="button secondary purchase-view-button" onClick={() => void openDetail(record)} type="button">
                          <Eye aria-hidden />{'\u062c\u0632\u0626\u06cc\u0627\u062a'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="purchase-list-mobile">
            {records.map((record) => (
              <article className="purchase-mobile-card" key={record.id}>
                <header>
                  <div>
                    <span>{'\u0641\u0627\u06a9\u062a\u0648\u0631 \u062e\u0631\u06cc\u062f'}</span>
                    <h3>{record.invoiceNumber}</h3>
                  </div>
                  <span className={'status-pill status-' + record.status}>
                    {record.invoiceType === 'return' ? 'مرجوعی قطعی' : statusText(record.status)}
                  </span>
                </header>
                <dl>
                  <dt>{'\u062a\u0627\u0631\u06cc\u062e'}</dt><dd>{formatJalaliDate(record.invoiceDate)}</dd>
                  <dt>{'\u062a\u0623\u0645\u06cc\u0646\u200c\u06a9\u0646\u0646\u062f\u0647'}</dt><dd>{record.supplierName}</dd>
                  <dt>{'\u0645\u0628\u0644\u063a \u06a9\u0644'}</dt><dd>{formatIrrAmount(record.totalIrr, amountUnit)}</dd>
                  <dt>{'\u067e\u0631\u062f\u0627\u062e\u062a'}</dt><dd>{paymentText(record.paymentStatus)}</dd>
                </dl>
                <button className="button secondary" onClick={() => void openDetail(record)} type="button">
                  <Eye aria-hidden />{'\u0645\u0634\u0627\u0647\u062f\u0647 \u062c\u0632\u0626\u06cc\u0627\u062a'}
                </button>
              </article>
            ))}
          </div>
        </>
      )}

      <Pager
        offset={offset}
        onPage={setOffset}
        pageSize={PAGE_SIZE}
        pending={pending}
        returned={records.length}
      />
    </section>
  );
}
