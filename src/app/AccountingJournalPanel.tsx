import {
  CirclePlus,
  Eye,
  Pencil,
  RotateCcw,
  Search,
  Send,
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
import {
  formatSignedIrr,
  journalStatusText,
  selectedFiscalRange,
  todayInTehran,
} from './accounting.helpers.js';
import type {
  AccountingOptions,
  JournalCreated,
  JournalDetail,
  JournalDraft,
  JournalPayload,
  JournalStatus,
  JournalSummary,
  JournalUpdated,
} from './accounting.types.js';
import {
  AccountingJournalEditor,
  newJournalLine,
} from './AccountingJournalEditor.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {JalaliDateField} from './JalaliDateField.js';
import {formatJalaliDate, jalaliInputToIso} from './jalali-date.js';
import {amountIrrToInput} from './master-data.helpers.js';
import {ActionFeedback, Pager} from './MasterDataUi.js';

interface Props {
  amountUnit: AmountUnit;
  options: AccountingOptions;
  permissions: readonly string[];
}

type StatusFilter = JournalStatus | 'all';
const PAGE_SIZE = 25;

export function AccountingJournalPanel({
  amountUnit,
  options,
  permissions,
}: Props) {
  const defaultRange = useMemo(
    () => selectedFiscalRange(options.fiscalYears),
    [options.fiscalYears],
  );
  const [records, setRecords] = useState<JournalSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [fromIso, setFromIso] = useState(defaultRange?.from ?? '');
  const [toIso, setToIso] = useState(defaultRange?.to ?? '');
  const [filterVersion, setFilterVersion] = useState(0);
  const [offset, setOffset] = useState(0);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [editor, setEditor] = useState<JournalDraft | null>(null);
  const [detail, setDetail] = useState<JournalDetail | null>(null);
  const [detailPending, setDetailPending] = useState(false);
  const [showReverse, setShowReverse] = useState(false);
  const [reverseVersion, setReverseVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const canCreate = permissions.includes('accounting.create');
  const canEdit = permissions.includes('accounting.edit');
  const canPost = permissions.includes('accounting.post');
  const canReverse = permissions.includes('accounting.void');

  const loadRecords = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (fromIso) params.set('from', fromIso);
      if (toIso) params.set('to', toIso);
      setRecords(
        await api<JournalSummary[]>(
          '/api/accounting/journals?' + params.toString(),
        ),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, [fromIso, offset, statusFilter, toIso]);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords, reloadVersion]);

  async function loadDetail(id: string) {
    setDetailPending(true);
    setError(null);
    setEditor(null);
    setShowReverse(false);
    try {
      setDetail(await api<JournalDetail>(`/api/accounting/journals/${id}`));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setDetailPending(false);
    }
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    try {
      const nextFrom = jalaliInputToIso(String(form.get('from') ?? ''));
      const nextTo = jalaliInputToIso(String(form.get('to') ?? ''));
      if (nextFrom > nextTo) {
        throw new Error('تاریخ پایان باید بعد از تاریخ شروع باشد.');
      }
      setFromIso(nextFrom);
      setToIso(nextTo);
      setOffset(0);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  function startNew() {
    setError(null);
    setSuccess(null);
    const openYear = options.fiscalYears.find(
      (year) => year.status === 'open',
    );
    if (!openYear) {
      setError('برای ثبت سند باید دست‌کم یک سال مالی باز وجود داشته باشد.');
      return;
    }
    if (!options.accounts.some((account) => account.allowsPosting)) {
      setError('هیچ حساب فعال و قابل ثبتی در کدینگ حساب‌ها وجود ندارد.');
      return;
    }
    const branch =
      options.branches.find((item) => item.isHeadOffice) ??
      options.branches[0];
    if (!branch) {
      setError('برای ثبت سند باید یک شعبه فعال وجود داشته باشد.');
      return;
    }
    const today = todayInTehran();
    const entryDate =
      today >= openYear.startsOn && today <= openYear.endsOn
        ? today
        : openYear.startsOn;
    setDetail(null);
    setEditor({
      id: null,
      rowVersion: null,
      branchId: branch.id,
      entryDate,
      documentDate: '',
      referenceNumber: '',
      description: '',
      lines: [newJournalLine(), newJournalLine()],
    });
  }

  function editDetail() {
    if (!detail || detail.status !== 'draft') return;
    setEditor({
      id: detail.id,
      rowVersion: detail.rowVersion,
      branchId: detail.branchId,
      entryDate: detail.entryDate,
      documentDate: detail.documentDate ?? '',
      referenceNumber: detail.referenceNumber ?? '',
      description: detail.description,
      lines: detail.lines.map((line) => ({
        key: 'existing-' + line.id,
        accountId: line.accountId,
        partyId: line.partyId ?? '',
        branchId: line.branchId ?? '',
        description: line.description ?? '',
        debit: amountIrrToInput(line.debitIrr, amountUnit),
        credit: amountIrrToInput(line.creditIrr, amountUnit),
      })),
    });
  }

  async function saveJournal(payload: JournalPayload, draft: JournalDraft) {
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (draft.id) {
        if (!draft.rowVersion) {
          throw new Error('نسخه سند برای ویرایش معتبر نیست.');
        }
        await postJson<JournalUpdated>(
          `/api/accounting/journals/${draft.id}`,
          {
            branchId: payload.branchId,
            entryDate: payload.entryDate,
            documentDate: payload.documentDate,
            referenceNumber: payload.referenceNumber,
            description: payload.description,
            lines: payload.lines,
            rowVersion: draft.rowVersion,
          },
          'PUT',
        );
        setSuccess('تغییرات سند پیش‌نویس با موفقیت ذخیره شد.');
        setEditor(null);
        await loadDetail(draft.id);
      } else {
        const created = await postJson<JournalCreated>(
          '/api/accounting/journals',
          payload,
        );
        setSuccess(
          payload.postNow
            ? `سند شماره ${created.entryNumber} ثبت و قطعی شد.`
            : `سند شماره ${created.entryNumber} به‌صورت پیش‌نویس ذخیره شد.`,
        );
        setEditor(null);
        await loadDetail(created.id);
      }
      setReloadVersion((value) => value + 1);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function postDetail() {
    if (!detail || detail.status !== 'draft' || acting) return;
    if (!window.confirm('پس از تأیید، سند قابل ویرایش مستقیم نیست. ادامه می‌دهید؟')) {
      return;
    }
    setActing(true);
    setError(null);
    setSuccess(null);
    try {
      await postJson<JournalUpdated>(
        `/api/accounting/journals/${detail.id}/post`,
        {rowVersion: detail.rowVersion},
      );
      setSuccess(`سند شماره ${detail.entryNumber} قطعی شد.`);
      await loadDetail(detail.id);
      setReloadVersion((value) => value + 1);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setActing(false);
    }
  }

  async function reverseDetail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!detail || detail.status !== 'posted' || acting) return;
    const form = new FormData(event.currentTarget);
    const reason = String(form.get('reason') ?? '').trim();
    if (!window.confirm('برای اصلاح سند قطعی، یک سند معکوس جدید ایجاد می‌شود. ادامه می‌دهید؟')) {
      return;
    }
    setActing(true);
    setError(null);
    setSuccess(null);
    try {
      const reversed = await postJson<JournalCreated>(
        `/api/accounting/journals/${detail.id}/reverse`,
        {
          reversalDate: jalaliInputToIso(
            String(form.get('reversalDate') ?? ''),
          ),
          reason,
        },
      );
      setSuccess(
        `سند برگشتی شماره ${reversed.entryNumber} ایجاد و قطعی شد.`,
      );
      setShowReverse(false);
      setReverseVersion((value) => value + 1);
      await loadDetail(detail.id);
      setReloadVersion((value) => value + 1);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setActing(false);
    }
  }

  return (
    <section className="accounting-section">
      <header className="section-heading accounting-section-heading">
        <ContextHelpButton help={appHelp.accountingJournals} />
        <div>
          <p>ثبت، ویرایش پیش‌نویس، تأیید و اصلاح با سند معکوس</p>
          <h2>اسناد حسابداری</h2>
        </div>
        <div className="heading-actions">
          {canCreate ? (
            <button className="button primary" onClick={startNew} type="button">
              <CirclePlus aria-hidden /> سند جدید
            </button>
          ) : null}
        </div>
      </header>

      <ActionFeedback error={error} success={success} />

      {editor ? (
        <AccountingJournalEditor
          amountUnit={amountUnit}
          canPost={canPost}
          draft={editor}
          key={editor.id ?? 'new'}
          onCancel={() => setEditor(null)}
          onError={(caught) => setError(errorMessage(caught))}
          onSave={saveJournal}
          options={options}
          saving={saving}
        />
      ) : null}

      <form
        className="accounting-filter-card"
        key={filterVersion}
        onSubmit={search}
      >
        <label className="field">
          <span>وضعیت سند</span>
          <select
            onChange={(event) => {
              setStatusFilter(event.target.value as StatusFilter);
              setOffset(0);
            }}
            value={statusFilter}
          >
            <option value="all">همه وضعیت‌ها</option>
            <option value="draft">پیش‌نویس</option>
            <option value="posted">قطعی</option>
            <option value="reversed">برگشت‌شده</option>
          </select>
        </label>
        <JalaliDateField
          defaultIsoValue={fromIso}
          label="از تاریخ"
          name="from"
          required
        />
        <JalaliDateField
          defaultIsoValue={toIso}
          label="تا تاریخ"
          name="to"
          required
        />
        <div className="accounting-filter-actions">
          <button className="button secondary" disabled={pending} type="submit">
            <Search aria-hidden /> اعمال فیلتر
          </button>
          <button
            className="button secondary"
            disabled={pending}
            onClick={() => {
              setFromIso(defaultRange?.from ?? '');
              setToIso(defaultRange?.to ?? '');
              setStatusFilter('all');
              setOffset(0);
              setFilterVersion((value) => value + 1);
            }}
            type="button"
          >
            <RotateCcw aria-hidden /> پاک‌کردن
          </button>
        </div>
      </form>

      {pending && records.length === 0 ? (
        <div className="empty-state card">در حال دریافت اسناد واقعی…</div>
      ) : records.length === 0 ? (
        <div className="empty-state card">
          سندی مطابق فیلتر انتخاب‌شده وجود ندارد.
        </div>
      ) : (
        <>
          <div className="accounting-table-desktop table-card table-scroll">
            <table>
              <thead>
                <tr>
                  <th>شماره</th><th>تاریخ</th><th>شرح</th><th>وضعیت</th>
                  <th>بدهکار</th><th>بستانکار</th><th>عملیات</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.entryNumber}</td>
                    <td>{formatJalaliDate(record.entryDate)}</td>
                    <td><strong>{record.description}</strong><small>{record.referenceNumber ?? 'بدون ارجاع'}</small></td>
                    <td><span className={'status-pill status-' + record.status}>{journalStatusText(record.status)}</span></td>
                    <td>{formatSignedIrr(record.debitIrr, amountUnit)}</td>
                    <td>{formatSignedIrr(record.creditIrr, amountUnit)}</td>
                    <td>
                      <button className="button secondary compact-button" onClick={() => void loadDetail(record.id)} type="button">
                        <Eye aria-hidden /> مشاهده
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="accounting-cards-mobile">
            {records.map((record) => (
              <article className="accounting-journal-card" key={record.id}>
                <header>
                  <div><strong>سند {record.entryNumber}</strong><span>{formatJalaliDate(record.entryDate)}</span></div>
                  <span className={'status-pill status-' + record.status}>{journalStatusText(record.status)}</span>
                </header>
                <p>{record.description}</p>
                <dl>
                  <div><dt>بدهکار</dt><dd>{formatSignedIrr(record.debitIrr, amountUnit)}</dd></div>
                  <div><dt>بستانکار</dt><dd>{formatSignedIrr(record.creditIrr, amountUnit)}</dd></div>
                </dl>
                <button className="button secondary wide" onClick={() => void loadDetail(record.id)} type="button">
                  <Eye aria-hidden /> مشاهده سند
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

      {detailPending ? (
        <div className="empty-state card">در حال دریافت جزئیات سند…</div>
      ) : detail ? (
        <section className="accounting-detail-card">
          <header className="form-section-heading accounting-detail-heading">
            <ContextHelpButton help={appHelp.accountingJournalDetail} />
            <div>
              <p>سند {journalStatusText(detail.status)} • {detail.sourceType === 'manual' ? 'ثبت دستی' : 'ایجادشده توسط سامانه'}</p>
              <h2>سند شماره {detail.entryNumber}</h2>
            </div>
            <button aria-label="بستن جزئیات" className="icon-button" onClick={() => setDetail(null)} type="button"><X aria-hidden /></button>
          </header>
          <div className="accounting-detail-summary">
            <div><span>تاریخ سند</span><strong>{formatJalaliDate(detail.entryDate)}</strong></div>
            <div><span>شماره ارجاع</span><strong>{detail.referenceNumber ?? '—'}</strong></div>
            <div><span>وضعیت</span><strong>{journalStatusText(detail.status)}</strong></div>
            <div className="wide-summary"><span>شرح</span><strong>{detail.description}</strong></div>
          </div>
          <div className="accounting-table-desktop table-scroll">
            <table>
              <thead><tr><th>ردیف</th><th>حساب</th><th>طرف‌حساب</th><th>شرح</th><th>بدهکار</th><th>بستانکار</th></tr></thead>
              <tbody>
                {detail.lines.map((line) => (
                  <tr key={line.id}>
                    <td>{new Intl.NumberFormat('fa-IR').format(line.lineNumber)}</td>
                    <td><strong>{line.accountCode}</strong><small>{line.accountName}</small></td>
                    <td>{line.partyName ?? '—'}</td>
                    <td>{line.description ?? '—'}</td>
                    <td>{formatSignedIrr(line.debitIrr, amountUnit)}</td>
                    <td>{formatSignedIrr(line.creditIrr, amountUnit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="accounting-cards-mobile">
            {detail.lines.map((line) => (
              <article className="accounting-report-card" key={line.id}>
                <header><strong>{line.accountCode} — {line.accountName}</strong><span>ردیف {new Intl.NumberFormat('fa-IR').format(line.lineNumber)}</span></header>
                <dl>
                  <div><dt>طرف‌حساب</dt><dd>{line.partyName ?? '—'}</dd></div>
                  <div><dt>بدهکار</dt><dd>{formatSignedIrr(line.debitIrr, amountUnit)}</dd></div>
                  <div><dt>بستانکار</dt><dd>{formatSignedIrr(line.creditIrr, amountUnit)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <div className="accounting-detail-actions">
            {detail.status === 'draft' && canEdit ? (
              <button className="button secondary" onClick={editDetail} type="button"><Pencil aria-hidden /> ویرایش</button>
            ) : null}
            {detail.status === 'draft' && canPost ? (
              <button className="button success" disabled={acting} onClick={() => void postDetail()} type="button"><Send aria-hidden /> تأیید سند</button>
            ) : null}
            {detail.status === 'posted' && canReverse ? (
              <button className="button danger" onClick={() => setShowReverse((value) => !value)} type="button"><RotateCcw aria-hidden /> اصلاح با سند معکوس</button>
            ) : null}
          </div>
          {showReverse && detail.status === 'posted' ? (
            <form className="accounting-reverse-form" key={reverseVersion} onSubmit={(event) => void reverseDetail(event)}>
              <JalaliDateField defaultIsoValue={todayInTehran()} label="تاریخ سند برگشتی" name="reversalDate" required />
              <label className="field">
                <span>دلیل اصلاح *</span>
                <textarea maxLength={1000} minLength={5} name="reason" required />
              </label>
              <button className="button danger" disabled={acting} type="submit"><RotateCcw aria-hidden /> {acting ? 'در حال ثبت…' : 'ایجاد سند معکوس'}</button>
            </form>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}
