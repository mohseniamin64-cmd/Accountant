import {FormEvent, useState} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {errorMessage, postJson} from './api.js';
import {JalaliDateField} from './JalaliDateField.js';
import {formatJalaliDate, jalaliInputToIso} from './jalali-date.js';
import {TreasuryChequeEventHistory} from './TreasuryChequeEventHistory.js';
import './treasury-history.css';

export interface TreasuryHistoryTransaction {
  id: string;
  transactionNumber: string;
  transactionDate: string;
  direction: 'receipt' | 'payment';
  paymentMethod: 'cash' | 'bank' | 'card' | 'cheque';
  amountIrr: string;
  referenceNumber: string | null;
  description: string;
  status: string;
  partyName: string | null;
  branchName: string;
}

export interface TreasuryCheque {
  id: string;
  chequeNumber: string;
  bankName: string | null;
  dueDate: string;
  amountIrr: string;
  direction: 'receivable' | 'payable';
  status: string;
  currentHolder: string | null;
  partyName: string | null;
  latestEventId: string | null;
  latestEventType: string | null;
}

export interface TreasuryHistoryBankAccount {
  id: string;
  bankName: string;
  accountNumber: string | null;
}

interface TreasuryHistoryProps {
  amountUnit: AmountUnit;
  canManage: boolean;
  loading: boolean;
  transactions: readonly TreasuryHistoryTransaction[];
  cheques: readonly TreasuryCheque[];
  bankAccounts: readonly TreasuryHistoryBankAccount[];
  onChanged: () => Promise<void>;
}

const paymentMethodTitle: Record<string, string> = {
  cash: '\u0646\u0642\u062f\u06cc',
  bank: '\u0627\u0646\u062a\u0642\u0627\u0644 \u0628\u0627\u0646\u06a9\u06cc',
  card: '\u06a9\u0627\u0631\u062a\u200c\u062e\u0648\u0627\u0646',
  cheque: '\u0686\u06a9',
};

const transactionStatus: Record<string, string> = {
  posted: '\u0642\u0637\u0639\u06cc',
  reversed: '\u0628\u0631\u06af\u0634\u062a\u200c\u0634\u062f\u0647',
};

const chequeStatus: Record<string, string> = {
  received: '\u062f\u0631\u06cc\u0627\u0641\u062a\u200c\u0634\u062f\u0647',
  issued: '\u0635\u0627\u062f\u0631\u0634\u062f\u0647',
  deposited: '\u0648\u0627\u06af\u0630\u0627\u0631\u0634\u062f\u0647 \u0628\u0647 \u0628\u0627\u0646\u06a9',
  cleared: '\u0648\u0635\u0648\u0644\u200c\u0634\u062f\u0647',
  bounced: '\u0628\u0631\u06af\u0634\u062a\u06cc',
  returned: '\u0628\u0627\u0632\u06af\u0634\u062a\u200c\u062f\u0627\u062f\u0647\u200c\u0634\u062f\u0647',
  cancelled: '\u0644\u063a\u0648\u0634\u062f\u0647',
};

function formatDate(value: string): string {
  return formatJalaliDate(value);
}

function formatAmount(value: string, unit: AmountUnit): string {
  const irr = BigInt(value);
  if (unit === 'IRR') return `${irr.toLocaleString('fa-IR')} \u0631\u06cc\u0627\u0644`;
  const whole = irr / 10n;
  const fraction = irr % 10n;
  const shown =
    fraction === 0n
      ? whole.toLocaleString('fa-IR')
      : `${whole.toLocaleString('fa-IR')}\u066b${fraction.toLocaleString('fa-IR')}`;
  return `${shown} \u062a\u0648\u0645\u0627\u0646`;
}

function todayInTehran(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

type ChequeEventType = 'deposit' | 'clear' | 'bounce';
type ChequeActionType = ChequeEventType | 'reverse';

const chequeEventTitle: Record<ChequeActionType, string> = {
  deposit: '\u0648\u0627\u06af\u0630\u0627\u0631\u06cc \u0628\u0647 \u0628\u0627\u0646\u06a9',
  clear: '\u0648\u0635\u0648\u0644 / \u067e\u0627\u0633 \u0686\u06a9',
  bounce: '\u0628\u0631\u06af\u0634\u062a \u0627\u0632 \u0628\u0627\u0646\u06a9',
  reverse: '\u0628\u0631\u06af\u0634\u062a \u0622\u062e\u0631\u06cc\u0646 \u0639\u0645\u0644\u06cc\u0627\u062a \u0686\u06a9',
};

function availableChequeEvents(
  cheque: TreasuryCheque,
): readonly ChequeEventType[] {
  if (cheque.direction === 'payable') {
    return cheque.status === 'issued' ? ['clear'] : [];
  }
  if (cheque.status === 'received' || cheque.status === 'bounced') {
    return ['deposit', 'clear'];
  }
  if (cheque.status === 'deposited') {
    return ['clear', 'bounce'];
  }
  return [];
}

function actionTitle(
  eventType: ChequeEventType,
  direction: TreasuryCheque['direction'],
): string {
  if (eventType === 'clear') {
    return direction === 'receivable'
      ? '\u0648\u0635\u0648\u0644'
      : '\u067e\u0627\u0633 \u0634\u062f\u0646';
  }
  return eventType === 'deposit'
    ? '\u0648\u0627\u06af\u0630\u0627\u0631\u06cc'
    : '\u0628\u0631\u06af\u0634\u062a\u06cc';
}


export function TreasuryHistory({
  amountUnit,
  canManage,
  loading,
  transactions,
  cheques,
  bankAccounts,
  onChanged,
}: TreasuryHistoryProps) {
  const [selectedTransactionId, setSelectedTransactionId] =
    useState<string | null>(null);
  const [expandedChequeId, setExpandedChequeId] =
    useState<string | null>(null);
  const [chequeAction, setChequeAction] = useState<{
    chequeId: string;
    eventType: ChequeActionType;
    eventId: string | null;
  } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const selectedCheque = chequeAction
    ? cheques.find((cheque) => cheque.id === chequeAction.chequeId) ?? null
    : null;
  const selectedHistoryCheque = expandedChequeId
    ? cheques.find((cheque) => cheque.id === expandedChequeId) ?? null
    : null;

  async function reverseTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTransactionId || pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      await postJson(
        `/api/treasury/transactions/${selectedTransactionId}/reverse`,
        {
          reversalDate: jalaliInputToIso(String(form.get('reversalDate') ?? '')),
          reason: String(form.get('reason') ?? '').trim(),
        },
      );
      await onChanged();
      setSelectedTransactionId(null);
      setSuccess('\u062a\u0631\u0627\u06a9\u0646\u0634 \u0628\u0631\u06af\u0634\u062a \u062e\u0648\u0631\u062f\u060c \u0645\u0627\u0646\u062f\u0647 \u0633\u0646\u062f \u0627\u0635\u0644\u0627\u062d \u0634\u062f \u0648 \u0633\u0646\u062f \u0645\u0639\u06a9\u0648\u0633 \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc \u062b\u0628\u062a \u06af\u0631\u062f\u06cc\u062f.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }

  async function submitChequeEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!chequeAction || pending) return;
    const form = new FormData(event.currentTarget);
    const notes = String(form.get('notes') ?? '').trim();
    setPending(true);
    setError(null);
    setSuccess(null);
    try {
      const eventDate = jalaliInputToIso(String(form.get('eventDate') ?? ''));
      if (chequeAction.eventType === 'reverse') {
        if (!chequeAction.eventId) {
          throw new Error('Cheque event id is missing');
        }
        await postJson(
          `/api/treasury/cheques/${chequeAction.chequeId}/events/${chequeAction.eventId}/reverse`,
          {
            reversalDate: eventDate,
            reason: notes,
          },
        );
      } else {
        await postJson(
          `/api/treasury/cheques/${chequeAction.chequeId}/events`,
          {
            eventType: chequeAction.eventType,
            eventDate,
            bankAccountId:
              chequeAction.eventType === 'bounce'
                ? null
                : String(form.get('bankAccountId') ?? '') || null,
            notes: notes || null,
          },
        );
      }
      await onChanged();
      setExpandedChequeId(null);
      const completedTitle = chequeEventTitle[chequeAction.eventType];
      const completionMessage =
        chequeAction.eventType === 'reverse'
          ? '\u0622\u062e\u0631\u06cc\u0646 \u0639\u0645\u0644\u06cc\u0627\u062a \u0686\u06a9 \u0628\u0627 \u0633\u0627\u0628\u0642\u0647 \u06a9\u0627\u0645\u0644 \u0628\u0631\u06af\u0634\u062a \u062f\u0627\u062f\u0647 \u0634\u062f.'
          : `${completedTitle} \u0686\u06a9 \u0628\u0627 \u0645\u0648\u0641\u0642\u06cc\u062a \u062b\u0628\u062a \u0634\u062f${chequeAction.eventType === 'clear' ? ' \u0648 \u0633\u0646\u062f \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc \u0622\u0646 \u0646\u06cc\u0632 \u0642\u0637\u0639\u06cc \u0634\u062f.' : '.'}`;
      setChequeAction(null);
      setSuccess(completionMessage);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }


  return (
    <div className="treasury-history-stack">
      {error || success ? (
        <div
          className={error ? 'form-message error' : 'form-message success'}
          role={error ? 'alert' : 'status'}
        >
          {error ?? success}
        </div>
      ) : null}

      {selectedTransactionId ? (
        <form className="reverse-panel" onSubmit={reverseTransaction}>
          <div>
            <strong>{'\u0628\u0631\u06af\u0634\u062a \u062a\u0631\u0627\u06a9\u0646\u0634 \u0642\u0637\u0639\u06cc'}</strong>
            <p>{'\u0627\u06cc\u0646 \u0639\u0645\u0644\u06cc\u0627\u062a \u0645\u0627\u0646\u062f\u0647 \u0633\u0646\u062f \u0648 \u0633\u0646\u062f \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc \u0631\u0627 \u0628\u0627 \u0633\u0627\u0628\u0642\u0647 \u06a9\u0627\u0645\u0644 \u0628\u0631\u0645\u06cc\u200c\u06af\u0631\u062f\u0627\u0646\u062f.'}</p>
          </div>
          <JalaliDateField
            name="reversalDate"
            label={'\u062a\u0627\u0631\u06cc\u062e \u0628\u0631\u06af\u0634\u062a'}
            defaultIsoValue={todayInTehran()}
            required
          />
          <label className="field reverse-reason">
            <span>{'\u062f\u0644\u06cc\u0644 \u0628\u0631\u06af\u0634\u062a *'}</span>
            <textarea name="reason" required minLength={3} maxLength={2000} />
          </label>
          <div className="form-actions">
            <button
              className="button secondary"
              type="button"
              disabled={pending}
              onClick={() => setSelectedTransactionId(null)}
            >
              {'\u0627\u0646\u0635\u0631\u0627\u0641'}
            </button>
            <button className="button danger" type="submit" disabled={pending}>
              {pending ? '\u062f\u0631 \u062d\u0627\u0644 \u0628\u0631\u06af\u0634\u062a\u2026' : '\u062a\u0623\u06cc\u06cc\u062f \u0628\u0631\u06af\u0634\u062a \u062a\u0631\u0627\u06a9\u0646\u0634'}
            </button>
          </div>
        </form>
      ) : null}

      {chequeAction && selectedCheque ? (
        <form className="cheque-event-panel" onSubmit={submitChequeEvent}>
          <div className="cheque-event-heading">
            <strong>{chequeEventTitle[chequeAction.eventType]}</strong>
            <p>
              {'\u0686\u06a9 \u0634\u0645\u0627\u0631\u0647 '}
              <b dir="ltr">{selectedCheque.chequeNumber}</b>
              {' \u0645\u062a\u0639\u0644\u0642 \u0628\u0647 '}
              {selectedCheque.partyName ?? '\u0637\u0631\u0641\u200c\u062d\u0633\u0627\u0628 \u0646\u0627\u0645\u0634\u062e\u0635'}
            </p>
          </div>
          <JalaliDateField
            name="eventDate"
            label={'\u062a\u0627\u0631\u06cc\u062e \u0639\u0645\u0644\u06cc\u0627\u062a'}
            defaultIsoValue={todayInTehran()}
            required
          />
          {(chequeAction.eventType === 'deposit' ||
            chequeAction.eventType === 'clear') ? (
            <label className="field">
              <span>{'\u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc *'}</span>
              <select name="bankAccountId" defaultValue="" required>
                <option value="" disabled>
                  {bankAccounts.length
                    ? '\u0627\u0646\u062a\u062e\u0627\u0628 \u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc'
                    : '\u0627\u0628\u062a\u062f\u0627 \u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc \u062a\u0639\u0631\u06cc\u0641 \u06a9\u0646\u06cc\u062f'}
                </option>
                {bankAccounts.map((account) => (
                  <option value={account.id} key={account.id}>
                    {account.bankName}
                    {account.accountNumber ? ` - ${account.accountNumber}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field cheque-event-notes">
            <span>
              {chequeAction.eventType === 'bounce' ||
              chequeAction.eventType === 'reverse'
                ? '\u062f\u0644\u06cc\u0644 \u0628\u0631\u06af\u0634\u062a *'
                : '\u062a\u0648\u0636\u06cc\u062d\u0627\u062a'}
            </span>
            <textarea
              name="notes"
              required={
                chequeAction.eventType === 'bounce' ||
                chequeAction.eventType === 'reverse'
              }
              minLength={
                chequeAction.eventType === 'bounce' ||
                chequeAction.eventType === 'reverse'
                  ? 3
                  : undefined
              }
              maxLength={2000}
            />
          </label>
          <div className="form-actions">
            <button
              className="button secondary"
              type="button"
              disabled={pending}
              onClick={() => setChequeAction(null)}
            >
              {'\u0627\u0646\u0635\u0631\u0627\u0641'}
            </button>
            <button
              className={
                chequeAction.eventType === 'reverse'
                  ? 'button danger'
                  : 'button primary'
              }
              type="submit"
              disabled={
                pending ||
                ((chequeAction.eventType === 'deposit' ||
                  chequeAction.eventType === 'clear') &&
                  bankAccounts.length === 0)
              }
            >
              {pending
                ? '\u062f\u0631 \u062d\u0627\u0644 \u062b\u0628\u062a\u2026'
                : chequeAction.eventType === 'reverse'
                  ? '\u062a\u0623\u06cc\u06cc\u062f \u0628\u0631\u06af\u0634\u062a \u0639\u0645\u0644\u06cc\u0627\u062a'
                  : '\u062b\u0628\u062a \u0639\u0645\u0644\u06cc\u0627\u062a \u0686\u06a9'}
            </button>
          </div>
        </form>
      ) : null}


      <div className="table-card">
        <div className="card-table-heading">
          <div>
            <strong>{'\u06af\u0631\u062f\u0634 \u062f\u0631\u06cc\u0627\u0641\u062a \u0648 \u067e\u0631\u062f\u0627\u062e\u062a'}</strong>
            <span>{'\u0647\u0631 \u0631\u062f\u06cc\u0641 \u0627\u0632 \u062a\u0631\u0627\u06a9\u0646\u0634 \u0642\u0637\u0639\u06cc \u0648 \u0633\u0646\u062f \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc \u0648\u0627\u0642\u0639\u06cc \u062e\u0648\u0627\u0646\u062f\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f.'}</span>
          </div>
        </div>
        {loading ? (
          <div className="empty-state">{'\u062f\u0631 \u062d\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u06af\u0631\u062f\u0634 \u062e\u0632\u0627\u0646\u0647\u2026'}</div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">{'\u0647\u0646\u0648\u0632 \u062f\u0631\u06cc\u0627\u0641\u062a \u06cc\u0627 \u067e\u0631\u062f\u0627\u062e\u062a\u06cc \u062b\u0628\u062a \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.'}</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{'\u0634\u0645\u0627\u0631\u0647'}</th>
                  <th>{'\u062a\u0627\u0631\u06cc\u062e'}</th>
                  <th>{'\u0646\u0648\u0639'}</th>
                  <th>{'\u0637\u0631\u0641\u200c\u062d\u0633\u0627\u0628'}</th>
                  <th>{'\u0631\u0648\u0634'}</th>
                  <th>{'\u0645\u0628\u0644\u063a'}</th>
                  <th>{'\u0634\u0639\u0628\u0647'}</th>
                  <th>{'\u0648\u0636\u0639\u06cc\u062a'}</th>
                  {canManage ? <th>{'\u0639\u0645\u0644\u06cc\u0627\u062a'}</th> : null}
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.transactionNumber}</td>
                    <td>{formatDate(transaction.transactionDate)}</td>
                    <td>
                      {transaction.direction === 'receipt' ? '\u062f\u0631\u06cc\u0627\u0641\u062a' : '\u067e\u0631\u062f\u0627\u062e\u062a'}
                    </td>
                    <td>{transaction.partyName ?? '\u2014'}</td>
                    <td>{paymentMethodTitle[transaction.paymentMethod]}</td>
                    <td>{formatAmount(transaction.amountIrr, amountUnit)}</td>
                    <td>{transaction.branchName}</td>
                    <td>
                      <span className={`status-pill status-${transaction.status}`}>
                        {transactionStatus[transaction.status] ?? transaction.status}
                      </span>
                    </td>
                    {canManage ? (
                      <td>
                        {transaction.status === 'posted' ? (
                          <button
                            className="table-action danger-action"
                            type="button"
                            disabled={pending}
                            onClick={() => {
                              setError(null);
                              setSuccess(null);
                              setChequeAction(null);
                              setSelectedTransactionId(transaction.id);
                            }}
                          >
                            {'\u0628\u0631\u06af\u0634\u062a'}
                          </button>
                        ) : (
                          '\u2014'
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="table-card">
        <div className="card-table-heading">
          <div>
            <strong>{'\u0686\u06a9\u200c\u0647\u0627\u06cc \u062f\u0631\u06cc\u0627\u0641\u062a\u0646\u06cc \u0648 \u067e\u0631\u062f\u0627\u062e\u062a\u0646\u06cc'}</strong>
            <span>{'\u0627\u06cc\u0646 \u0641\u0647\u0631\u0633\u062a \u0641\u0642\u0637 \u0686\u06a9\u200c\u0647\u0627\u06cc \u062b\u0628\u062a\u200c\u0634\u062f\u0647 \u0648\u0627\u0642\u0639\u06cc \u0631\u0627 \u0646\u0645\u0627\u06cc\u0634 \u0645\u06cc\u200c\u062f\u0647\u062f.'}</span>
          </div>
        </div>
        {loading ? (
          <div className="empty-state">{'\u062f\u0631 \u062d\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u0641\u0647\u0631\u0633\u062a \u0686\u06a9\u200c\u0647\u0627\u2026'}</div>
        ) : cheques.length === 0 ? (
          <div className="empty-state">{'\u0647\u0646\u0648\u0632 \u0686\u06a9\u06cc \u062b\u0628\u062a \u0646\u0634\u062f\u0647 \u0627\u0633\u062a.'}</div>
        ) : (
          <>
            <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{'\u0634\u0645\u0627\u0631\u0647 \u0686\u06a9'}</th>
                  <th>{'\u0646\u0648\u0639'}</th>
                  <th>{'\u0637\u0631\u0641\u200c\u062d\u0633\u0627\u0628'}</th>
                  <th>{'\u0628\u0627\u0646\u06a9'}</th>
                  <th>{'\u0633\u0631\u0631\u0633\u06cc\u062f'}</th>
                  <th>{'\u0645\u0628\u0644\u063a'}</th>
                  <th>{'\u062f\u0627\u0631\u0646\u062f\u0647 \u0641\u0639\u0644\u06cc'}</th>
                  <th>{'\u0648\u0636\u0639\u06cc\u062a'}</th>
                  <th>{'\u0633\u0627\u0628\u0642\u0647'}</th>
                  {canManage ? <th>{'\u0639\u0645\u0644\u06cc\u0627\u062a'}</th> : null}
                </tr>
              </thead>
              <tbody>
                {cheques.map((cheque) => (
                  <tr key={cheque.id}>
                    <td dir="ltr">{cheque.chequeNumber}</td>
                    <td>
                      {cheque.direction === 'receivable' ? '\u062f\u0631\u06cc\u0627\u0641\u062a\u0646\u06cc' : '\u067e\u0631\u062f\u0627\u062e\u062a\u0646\u06cc'}
                    </td>
                    <td>{cheque.partyName ?? '\u2014'}</td>
                    <td>{cheque.bankName ?? '\u2014'}</td>
                    <td>{formatDate(cheque.dueDate)}</td>
                    <td>{formatAmount(cheque.amountIrr, amountUnit)}</td>
                    <td>{cheque.currentHolder ?? '\u2014'}</td>
                    <td>
                      <span className={`status-pill status-${cheque.status}`}>
                        {chequeStatus[cheque.status] ?? cheque.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="table-action"
                        type="button"
                        aria-expanded={expandedChequeId === cheque.id}
                        onClick={() =>
                          setExpandedChequeId((current) =>
                            current === cheque.id ? null : cheque.id,
                          )
                        }
                      >
                        {expandedChequeId === cheque.id
                          ? '\u0628\u0633\u062a\u0646 \u0633\u0627\u0628\u0642\u0647'
                          : '\u0645\u0634\u0627\u0647\u062f\u0647 \u0633\u0627\u0628\u0642\u0647'}
                      </button>
                    </td>
                    {canManage ? (
                      <td>
                        {availableChequeEvents(cheque).length ||
                        cheque.latestEventId ? (
                          <div className="cheque-action-list">
                            {availableChequeEvents(cheque).map((eventType) => (
                              <button
                                key={eventType}
                                className={
                                  eventType === 'bounce'
                                    ? 'table-action danger-action'
                                    : 'table-action'
                                }
                                type="button"
                                disabled={pending}
                                onClick={() => {
                                  setError(null);
                                  setSuccess(null);
                                  setSelectedTransactionId(null);
                                  setChequeAction({
                                    chequeId: cheque.id,
                                    eventType,
                                    eventId: null,
                                  });
                                }}
                              >
                                {actionTitle(eventType, cheque.direction)}
                              </button>
                            ))}
                            {cheque.latestEventId ? (
                              <button
                                className="table-action danger-action"
                                type="button"
                                disabled={pending}
                                onClick={() => {
                                  setError(null);
                                  setSuccess(null);
                                  setSelectedTransactionId(null);
                                  setChequeAction({
                                    chequeId: cheque.id,
                                    eventType: 'reverse',
                                    eventId: cheque.latestEventId,
                                  });
                                }}
                              >
                                {'\u0628\u0631\u06af\u0634\u062a \u0622\u062e\u0631\u06cc\u0646 \u0639\u0645\u0644\u06cc\u0627\u062a'}
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          '\u2014'
                        )}
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {selectedHistoryCheque ? (
              <TreasuryChequeEventHistory
                chequeId={selectedHistoryCheque.id}
                chequeNumber={selectedHistoryCheque.chequeNumber}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
