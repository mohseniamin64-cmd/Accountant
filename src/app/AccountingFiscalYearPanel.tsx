import {
  CalendarPlus,
  LockKeyhole,
  LockOpen,
  ShieldCheck,
} from 'lucide-react';
import {useState, type FormEvent} from 'react';
import {errorMessage, postJson} from './api.js';
import {fiscalYearStatusText} from './accounting.helpers.js';
import type {
  FiscalYear,
  FiscalYearStatus,
} from './accounting.types.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {JalaliDateField} from './JalaliDateField.js';
import {jalaliInputToIso} from './jalali-date.js';
import {ActionFeedback} from './MasterDataUi.js';

interface Props {
  fiscalYears: readonly FiscalYear[];
  canManage: boolean;
  onChanged: () => Promise<void>;
}

export function AccountingFiscalYearPanel({
  fiscalYears,
  canManage,
  onChanged,
}: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function createFiscalYear(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    try {
      await postJson<FiscalYear>('/api/accounting/fiscal-years', {
        title: String(form.get('title') ?? '').trim(),
        startsOn: jalaliInputToIso(String(form.get('startsOn') ?? '')),
        endsOn: jalaliInputToIso(String(form.get('endsOn') ?? '')),
      });
      setSuccess('سال مالی با موفقیت و به‌صورت باز ایجاد شد.');
      setShowCreate(false);
      setFormVersion((value) => value + 1);
      await onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    fiscalYear: FiscalYear,
    status: FiscalYearStatus,
  ) {
    if (pendingId) return;
    if (
      status === 'final_closed' &&
      !window.confirm(
        'بستن نهایی سال مالی قابل بازگشت عادی نیست. آیا از تعیین تکلیف همه اسناد پیش‌نویس و بستن نهایی مطمئن هستید؟',
      )
    ) {
      return;
    }
    setPendingId(fiscalYear.id);
    setError(null);
    setSuccess(null);
    try {
      await postJson<FiscalYear>(
        `/api/accounting/fiscal-years/${fiscalYear.id}/status`,
        {status, rowVersion: fiscalYear.rowVersion},
      );
      setSuccess(
        status === 'open'
          ? 'سال مالی دوباره باز شد.'
          : status === 'soft_closed'
            ? 'سال مالی به‌صورت موقت بسته شد.'
            : 'سال مالی به‌صورت نهایی بسته شد.',
      );
      await onChanged();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="accounting-section">
      <header className="section-heading accounting-section-heading">
        <ContextHelpButton help={appHelp.accountingFiscalYears} />
        <div>
          <p>کنترل بازه ثبت اسناد و بستن دوره با سابقه قابل پیگیری</p>
          <h2>سال‌های مالی</h2>
        </div>
        {canManage ? (
          <button
            className={showCreate ? 'button secondary' : 'button primary'}
            onClick={() => setShowCreate((value) => !value)}
            type="button"
          >
            <CalendarPlus aria-hidden />
            {showCreate ? 'بستن فرم' : 'سال مالی جدید'}
          </button>
        ) : null}
      </header>

      <ActionFeedback error={error} success={success} />

      {showCreate && canManage ? (
        <form
          className="accounting-form-card"
          key={formVersion}
          onSubmit={(event) => void createFiscalYear(event)}
        >
          <header className="form-section-heading">
            <ContextHelpButton help={appHelp.accountingFiscalYearForm} />
            <div>
              <p>بازه‌ها نباید با سال مالی دیگری هم‌پوشانی داشته باشند</p>
              <h3>تعریف سال مالی</h3>
            </div>
          </header>
          <div className="accounting-fiscal-form-grid">
            <label className="field">
              <span>عنوان سال مالی *</span>
              <input
                maxLength={120}
                name="title"
                placeholder="برای نمونه: سال مالی ۱۴۰۵"
                required
              />
            </label>
            <JalaliDateField label="تاریخ شروع" name="startsOn" required />
            <JalaliDateField label="تاریخ پایان" name="endsOn" required />
          </div>
          <div className="accounting-form-actions">
            <button
              className="button secondary"
              disabled={saving}
              onClick={() => setShowCreate(false)}
              type="button"
            >
              انصراف
            </button>
            <button className="button primary" disabled={saving} type="submit">
              <CalendarPlus aria-hidden />
              {saving ? 'در حال ثبت…' : 'ایجاد سال مالی'}
            </button>
          </div>
        </form>
      ) : null}

      {fiscalYears.length === 0 ? (
        <div className="empty-state card">
          هنوز سال مالی واقعی ثبت نشده است.
        </div>
      ) : (
        <div className="accounting-fiscal-list">
          {fiscalYears.map((year) => (
            <article className="accounting-fiscal-card" key={year.id}>
              <header>
                <div>
                  <strong>{year.title}</strong>
                  <span
                    className={
                      'status-pill fiscal-status-' + year.status
                    }
                  >
                    {fiscalYearStatusText(year.status)}
                  </span>
                </div>
              </header>
              <dl>
                <div>
                  <dt>شروع</dt>
                  <dd>{new Intl.DateTimeFormat(
                    'fa-IR-u-ca-persian',
                    {dateStyle: 'medium', timeZone: 'Asia/Tehran'},
                  ).format(new Date(year.startsOn + 'T12:00:00Z'))}</dd>
                </div>
                <div>
                  <dt>پایان</dt>
                  <dd>{new Intl.DateTimeFormat(
                    'fa-IR-u-ca-persian',
                    {dateStyle: 'medium', timeZone: 'Asia/Tehran'},
                  ).format(new Date(year.endsOn + 'T12:00:00Z'))}</dd>
                </div>
              </dl>
              {canManage && year.status !== 'final_closed' ? (
                <div className="accounting-fiscal-actions">
                  {year.status === 'open' ? (
                    <button
                      className="button secondary"
                      disabled={pendingId === year.id}
                      onClick={() =>
                        void changeStatus(year, 'soft_closed')
                      }
                      type="button"
                    >
                      <LockKeyhole aria-hidden /> بستن موقت
                    </button>
                  ) : (
                    <button
                      className="button secondary"
                      disabled={pendingId === year.id}
                      onClick={() => void changeStatus(year, 'open')}
                      type="button"
                    >
                      <LockOpen aria-hidden /> بازگشایی
                    </button>
                  )}
                  <button
                    className="button danger"
                    disabled={pendingId === year.id}
                    onClick={() =>
                      void changeStatus(year, 'final_closed')
                    }
                    type="button"
                  >
                    <ShieldCheck aria-hidden /> بستن نهایی
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
