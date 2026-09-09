import {
  CirclePlus,
  Save,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {useMemo, useState, type FormEvent} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {
  formatSignedIrr,
  journalTotals,
  validateAndBuildJournalLines,
} from './accounting.helpers.js';
import type {
  AccountingOptions,
  JournalDraft,
  JournalDraftLine,
  JournalPayload,
} from './accounting.types.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {appHelp} from './help-content.js';
import {JalaliDateField} from './JalaliDateField.js';
import {jalaliInputToIso} from './jalali-date.js';

interface Props {
  amountUnit: AmountUnit;
  canPost: boolean;
  draft: JournalDraft;
  options: AccountingOptions;
  saving: boolean;
  onCancel: () => void;
  onError: (error: unknown) => void;
  onSave: (
    payload: JournalPayload,
    draft: JournalDraft,
  ) => Promise<void>;
}

let lineSequence = 0;

export function newJournalLine(): JournalDraftLine {
  lineSequence += 1;
  return {
    key: 'journal-line-' + lineSequence,
    accountId: '',
    partyId: '',
    branchId: '',
    description: '',
    debit: '0',
    credit: '0',
  };
}

export function AccountingJournalEditor({
  amountUnit,
  canPost,
  draft: initialDraft,
  options,
  saving,
  onCancel,
  onError,
  onSave,
}: Props) {
  const [draft, setDraft] = useState<JournalDraft>(initialDraft);
  const postingAccounts = useMemo(
    () => options.accounts.filter((account) => account.allowsPosting),
    [options.accounts],
  );
  const totals = journalTotals(draft.lines, amountUnit);
  const balanced =
    totals.debitIrr > 0n && totals.debitIrr === totals.creditIrr;

  function changeLine(key: string, changes: Partial<JournalDraftLine>) {
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.key === key ? {...line, ...changes} : line),
    }));
  }

  function changeAccount(key: string, accountId: string) {
    const account = options.accounts.find((item) => item.id === accountId);
    setDraft((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.key === key
          ? {
              ...line,
              accountId,
              partyId: account?.requiresParty ? line.partyId : '',
              branchId: account?.requiresBranch ? line.branchId : '',
            }
          : line),
    }));
  }

  function changeDebit(key: string, value: string) {
    changeLine(key, {debit: value, ...(value && value !== '0' ? {credit: '0'} : {})});
  }

  function changeCredit(key: string, value: string) {
    changeLine(key, {credit: value, ...(value && value !== '0' ? {debit: '0'} : {})});
  }

  function addLine() {
    setDraft((current) => ({
      ...current,
      lines: [...current.lines, newJournalLine()],
    }));
  }

  function removeLine(key: string) {
    setDraft((current) => {
      if (current.lines.length <= 2) return current;
      return {
        ...current,
        lines: current.lines.filter((line) => line.key !== key),
      };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const native = event.nativeEvent as SubmitEvent;
    const submitter = native.submitter as HTMLButtonElement | null;
    const postNow =
      initialDraft.id === null &&
      canPost &&
      submitter?.value === 'post';
    const entryDate = jalaliInputToIso(String(form.get('entryDate') ?? ''));
    const documentDateText = String(form.get('documentDate') ?? '').trim();
    const description = String(form.get('description') ?? '').trim();
    if (description.length < 2) {
      throw new Error('شرح سند باید حداقل دو حرف داشته باشد.');
    }
    const payload: JournalPayload = {
      branchId: String(form.get('branchId') ?? ''),
      entryDate,
      documentDate: documentDateText
        ? jalaliInputToIso(documentDateText)
        : null,
      referenceNumber:
        String(form.get('referenceNumber') ?? '').trim() || null,
      description,
      lines: validateAndBuildJournalLines(
        draft.lines,
        options.accounts,
        amountUnit,
      ),
      postNow,
    };
    await onSave(payload, draft);
  }

  return (
    <form
      className="accounting-form-card journal-editor"
      onSubmit={(event) => {
        void submit(event).catch(onError);
      }}
    >
      <header className="form-section-heading journal-editor-heading">
        <ContextHelpButton help={appHelp.accountingJournalForm} />
        <div>
          <p>
            {initialDraft.id
              ? 'فقط سند پیش‌نویس قابل ویرایش است'
              : 'ثبت دوبل با حداقل دو ردیف بدهکار و بستانکار'}
          </p>
          <h2>
            {initialDraft.id
              ? `ویرایش سند ${initialDraft.id.slice(0, 8)}`
              : 'سند حسابداری جدید'}
          </h2>
        </div>
        <button
          aria-label="بستن فرم سند"
          className="icon-button"
          onClick={onCancel}
          type="button"
        >
          <X aria-hidden />
        </button>
      </header>

      <div className="journal-header-grid">
        <label className="field">
          <span>شعبه سند *</span>
          <select defaultValue={draft.branchId} name="branchId" required>
            <option value="">انتخاب شعبه</option>
            {options.branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.code} — {branch.name}
              </option>
            ))}
          </select>
        </label>
        <JalaliDateField
          defaultIsoValue={draft.entryDate}
          label="تاریخ سند"
          name="entryDate"
          required
        />
        <JalaliDateField
          defaultIsoValue={draft.documentDate || undefined}
          label="تاریخ مدرک"
          name="documentDate"
        />
        <label className="field">
          <span>شماره ارجاع</span>
          <input
            defaultValue={draft.referenceNumber}
            maxLength={120}
            name="referenceNumber"
          />
        </label>
        <label className="field journal-description">
          <span>شرح سند *</span>
          <textarea
            defaultValue={draft.description}
            maxLength={2000}
            name="description"
            required
          />
        </label>
      </div>

      <header className="form-section-heading journal-lines-heading">
        <ContextHelpButton help={appHelp.accountingJournalLines} />
        <div>
          <p>طرف‌حساب و شعبه براساس تنظیم حساب کنترل می‌شوند</p>
          <h3>ردیف‌های سند</h3>
        </div>
        <button className="button secondary" onClick={addLine} type="button">
          <CirclePlus aria-hidden /> افزودن ردیف
        </button>
      </header>

      <div className="journal-lines">
        {draft.lines.map((line, index) => {
          const account = options.accounts.find(
            (item) => item.id === line.accountId,
          );
          return (
            <article className="journal-line-card" key={line.key}>
              <header>
                <strong>ردیف {new Intl.NumberFormat('fa-IR').format(index + 1)}</strong>
                <button
                  aria-label="حذف ردیف"
                  className="button danger compact-button"
                  disabled={draft.lines.length <= 2}
                  onClick={() => removeLine(line.key)}
                  type="button"
                >
                  <Trash2 aria-hidden /> حذف
                </button>
              </header>
              <div className="journal-line-grid">
                <label className="field journal-account-field">
                  <span>حساب *</span>
                  <select
                    onChange={(event) =>
                      changeAccount(line.key, event.target.value)
                    }
                    required
                    value={line.accountId}
                  >
                    <option value="">انتخاب حساب قابل ثبت</option>
                    {postingAccounts.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.code} — {item.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>
                    طرف‌حساب{account?.requiresParty ? ' *' : ''}
                  </span>
                  <select
                    disabled={!account?.requiresParty}
                    onChange={(event) =>
                      changeLine(line.key, {partyId: event.target.value})
                    }
                    required={account?.requiresParty}
                    value={line.partyId}
                  >
                    <option value="">
                      {account?.requiresParty ? 'انتخاب طرف‌حساب' : 'نیاز ندارد'}
                    </option>
                    {options.parties.map((party) => (
                      <option key={party.id} value={party.id}>
                        {party.code} — {party.displayName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>شعبه ردیف{account?.requiresBranch ? ' *' : ''}</span>
                  <select
                    disabled={!account?.requiresBranch}
                    onChange={(event) =>
                      changeLine(line.key, {branchId: event.target.value})
                    }
                    required={account?.requiresBranch}
                    value={line.branchId}
                  >
                    <option value="">
                      {account?.requiresBranch ? 'انتخاب شعبه' : 'شعبه سند'}
                    </option>
                    {options.branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.code} — {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>بدهکار ({amountUnit === 'IRR' ? 'ریال' : 'تومان'}) *</span>
                  <input
                    dir="ltr"
                    inputMode="decimal"
                    onChange={(event) => changeDebit(line.key, event.target.value)}
                    value={line.debit}
                  />
                </label>
                <label className="field">
                  <span>بستانکار ({amountUnit === 'IRR' ? 'ریال' : 'تومان'}) *</span>
                  <input
                    dir="ltr"
                    inputMode="decimal"
                    onChange={(event) => changeCredit(line.key, event.target.value)}
                    value={line.credit}
                  />
                </label>
                <label className="field journal-line-description">
                  <span>شرح ردیف</span>
                  <input
                    maxLength={1000}
                    onChange={(event) =>
                      changeLine(line.key, {description: event.target.value})
                    }
                    value={line.description}
                  />
                </label>
              </div>
            </article>
          );
        })}
      </div>

      <div className={'journal-totals ' + (balanced ? 'balanced' : 'unbalanced')}>
        <div><span>جمع بدهکار</span><strong>{formatSignedIrr(totals.debitIrr, amountUnit)}</strong></div>
        <div><span>جمع بستانکار</span><strong>{formatSignedIrr(totals.creditIrr, amountUnit)}</strong></div>
        <div><span>اختلاف</span><strong>{formatSignedIrr(totals.debitIrr - totals.creditIrr, amountUnit)}</strong></div>
        <p>{balanced ? 'سند تراز است.' : 'سند هنوز تراز نیست.'}</p>
      </div>

      <div className="accounting-form-actions">
        <button className="button secondary" disabled={saving} onClick={onCancel} type="button">
          <X aria-hidden /> انصراف
        </button>
        <button className="button primary" disabled={saving || !balanced} name="intent" type="submit" value="save">
          <Save aria-hidden /> {saving ? 'در حال ذخیره…' : 'ذخیره پیش‌نویس'}
        </button>
        {initialDraft.id === null && canPost ? (
          <button className="button success" disabled={saving || !balanced} name="intent" type="submit" value="post">
            <Send aria-hidden /> ثبت و تأیید
          </button>
        ) : null}
      </div>
    </form>
  );
}
