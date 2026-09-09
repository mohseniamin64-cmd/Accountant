import {
  Banknote,
  Building2,
  ChevronDown,
  CirclePlus,
  Landmark,
  RefreshCw,
  WalletCards,
  X,
} from 'lucide-react';
import {FormEvent, useCallback, useEffect, useMemo, useState} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {api, errorMessage, postJson} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {JalaliDateField} from './JalaliDateField.js';
import {formatJalaliDate, jalaliInputToIso} from './jalali-date.js';
import {appHelp} from './help-content.js';
import {
  TreasuryHistory,
  type TreasuryCheque,
} from './TreasuryHistory.js';
import {TreasuryChequeOverview} from './TreasuryChequeOverview.js';
import './treasury.css';

interface TreasuryPageProps {
  amountUnit: AmountUnit;
  permissions: readonly string[];
}

interface Party {
  id: string;
  code: string;
  displayName: string;
  isCustomer: boolean;
  isSupplier: boolean;
}

interface Branch {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface BankAccount {
  id: string;
  bankName: string;
  branchName: string | null;
  accountNumber: string | null;
  iban: string | null;
  cardNumber: string | null;
  isActive: boolean;
  branch: string | null;
}

interface Cashbox {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  branch: string;
}

interface TreasuryAccounts {
  bankAccounts: readonly BankAccount[];
  cashboxes: readonly Cashbox[];
}

interface OpenDocument {
  id: string;
  documentType: 'purchase_invoice' | 'sale_invoice' | 'service_order';
  documentNumber: string;
  documentDate: string;
  totalIrr: string;
  settledIrr: string;
  remainingIrr: string;
}

interface TreasuryTransaction {
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

const paymentMethodTitle: Record<string, string> = {
  cash: '\u0646\u0642\u062f\u06cc',
  bank: '\u0627\u0646\u062a\u0642\u0627\u0644 \u0628\u0627\u0646\u06a9\u06cc',
  card: '\u06a9\u0627\u0631\u062a\u200c\u062e\u0648\u0627\u0646',
  cheque: '\u0686\u06a9',
};

const documentTitle: Record<string, string> = {
  purchase_invoice: '\u0641\u0627\u06a9\u062a\u0648\u0631 \u062e\u0631\u06cc\u062f',
  sale_invoice: '\u0641\u0627\u06a9\u062a\u0648\u0631 \u0641\u0631\u0648\u0634',
  service_order: '\u067e\u0631\u0648\u0646\u062f\u0647 \u062e\u062f\u0645\u0627\u062a',
};

function todayInTehran(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function normalizeDigits(value: string): string {
  const persian = '\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9';
  const arabic = '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669';
  return value
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/[\u0660-\u0669]/g, (digit) => String(arabic.indexOf(digit)))
    .replace(/[\u066c,\s]/g, '')
    .replace('\u066b', '.');
}

function inputToIrr(value: string, unit: AmountUnit): bigint {
  const normalized = normalizeDigits(value.trim());
  if (unit === 'IRR') {
    if (!/^\d+$/.test(normalized)) {
      throw new Error('\u0645\u0628\u0644\u063a \u0631\u06cc\u0627\u0644\u06cc \u0628\u0627\u06cc\u062f \u06cc\u06a9 \u0639\u062f\u062f \u0635\u062d\u06cc\u062d \u0648 \u0645\u062b\u0628\u062a \u0628\u0627\u0634\u062f.');
    }
    return BigInt(normalized);
  }
  if (!/^\d+(\.\d)?$/.test(normalized)) {
    throw new Error('\u0645\u0628\u0644\u063a \u062a\u0648\u0645\u0627\u0646\u06cc \u0628\u0627\u06cc\u062f \u0645\u062b\u0628\u062a \u0648 \u062d\u062f\u0627\u06a9\u062b\u0631 \u06cc\u06a9 \u0631\u0642\u0645 \u0627\u0639\u0634\u0627\u0631 \u062f\u0627\u0634\u062a\u0647 \u0628\u0627\u0634\u062f.');
  }
  const [whole = '0', fraction = '0'] = normalized.split('.');
  return BigInt(whole) * 10n + BigInt(fraction);
}

function irrToInput(value: string, unit: AmountUnit): string {
  const irr = BigInt(value);
  if (unit === 'IRR') return irr.toString();
  const whole = irr / 10n;
  const fraction = irr % 10n;
  return fraction === 0n ? whole.toString() : `${whole}.${fraction}`;
}

function formatAmount(value: string | bigint, unit: AmountUnit): string {
  const irr = typeof value === 'bigint' ? value : BigInt(value);
  if (unit === 'IRR') {
    return `${irr.toLocaleString('fa-IR')} \u0631\u06cc\u0627\u0644`;
  }
  const whole = irr / 10n;
  const fraction = irr % 10n;
  const shown =
    fraction === 0n
      ? whole.toLocaleString('fa-IR')
      : `${whole.toLocaleString('fa-IR')}\u066b${fraction.toLocaleString('fa-IR')}`;
  return `${shown} \u062a\u0648\u0645\u0627\u0646`;
}

function formatDate(value: string): string {
  return formatJalaliDate(value);
}

function Feedback({
  error,
  success,
}: {
  error: string | null;
  success: string | null;
}) {
  if (!error && !success) return null;
  return (
    <div
      className={error ? 'form-message error' : 'form-message success'}
      role={error ? 'alert' : 'status'}
    >
      {error ?? success}
    </div>
  );
}

export function TreasuryPage({
  amountUnit,
  permissions,
}: TreasuryPageProps) {
  const canManage = permissions.includes('treasury.manage');
  const [transactions, setTransactions] =
    useState<readonly TreasuryTransaction[]>([]);
  const [cheques, setCheques] = useState<readonly TreasuryCheque[]>([]);
  const [parties, setParties] = useState<readonly Party[]>([]);
  const [branches, setBranches] = useState<readonly Branch[]>([]);
  const [accounts, setAccounts] = useState<TreasuryAccounts>({
    bankAccounts: [],
    cashboxes: [],
  });
  const [openDocuments, setOpenDocuments] =
    useState<readonly OpenDocument[]>([]);
  const [allocationInputs, setAllocationInputs] =
    useState<Record<string, string>>({});
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [direction, setDirection] = useState<'receipt' | 'payment'>('receipt');
  const [partyId, setPartyId] = useState('');
  const [paymentMethod, setPaymentMethod] =
    useState<'cash' | 'bank' | 'card' | 'cheque'>('cash');
  const [pending, setPending] = useState<string | null>('initial');
  const [documentsPending, setDocumentsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadBase = useCallback(async () => {
    const jobs: [
      Promise<readonly TreasuryTransaction[]>,
      Promise<readonly Party[]>,
      Promise<readonly Branch[]>,
      Promise<TreasuryAccounts>,
      Promise<readonly TreasuryCheque[]>,
    ] = [
      api('/api/treasury/transactions?limit=100'),
      api('/api/treasury/parties'),
      api('/api/organization/branches'),
      api('/api/treasury/accounts'),
      api('/api/treasury/cheques'),
    ];
    const [transactionRows, partyRows, branchRows, accountRows, chequeRows] =
      await Promise.all(jobs);
    setTransactions(transactionRows);
    setCheques(chequeRows);
    setParties(partyRows);
    setBranches(branchRows.filter((branch) => branch.isActive));
    setAccounts({
      bankAccounts: accountRows.bankAccounts.filter((account) => account.isActive),
      cashboxes: accountRows.cashboxes.filter((cashbox) => cashbox.isActive),
    });
  }, []);

  useEffect(() => {
    setPending('initial');
    void loadBase()
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setPending(null));
  }, [loadBase]);

  useEffect(() => {
    setAllocationInputs({});
    setOpenDocuments([]);
    if (!partyId || !canManage) return;
    setDocumentsPending(true);
    setError(null);
    void api<readonly OpenDocument[]>(
      `/api/treasury/open-documents?partyId=${encodeURIComponent(partyId)}&direction=${direction}`,
    )
      .then(setOpenDocuments)
      .catch((caught) => setError(errorMessage(caught)))
      .finally(() => setDocumentsPending(false));
  }, [canManage, direction, partyId]);

  const eligibleParties = useMemo(
    () =>
      parties.filter((party) =>
        direction === 'receipt' ? party.isCustomer : party.isSupplier,
      ),
    [direction, parties],
  );

  const selectedAllocations = useMemo(
    () =>
      openDocuments
        .map((document) => ({
          document,
          input: allocationInputs[document.id],
        }))
        .filter(
          (
            item,
          ): item is {document: OpenDocument; input: string} =>
            item.input !== undefined,
        ),
    [allocationInputs, openDocuments],
  );

  const allocationTotal = useMemo(() => {
    try {
      return selectedAllocations.reduce(
        (sum, allocation) =>
          sum + inputToIrr(allocation.input || '0', amountUnit),
        0n,
      );
    } catch {
      return null;
    }
  }, [amountUnit, selectedAllocations]);

  function resetTransactionForm() {
    setPartyId('');
    setOpenDocuments([]);
    setAllocationInputs({});
    setPaymentMethod('cash');
  }

  function selectDocument(document: OpenDocument, selected: boolean) {
    setAllocationInputs((current) => {
      const next = {...current};
      if (selected) {
        next[document.id] = irrToInput(document.remainingIrr, amountUnit);
      } else {
        delete next[document.id];
      }
      return next;
    });
  }

  async function createTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setSuccess(null);
    try {
      if (!partyId) throw new Error('\u0637\u0631\u0641\u200c\u062d\u0633\u0627\u0628 \u0631\u0627 \u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0646\u06cc\u062f.');
      if (selectedAllocations.length === 0) {
        throw new Error('\u062d\u062f\u0627\u0642\u0644 \u06cc\u06a9 \u0633\u0646\u062f \u0628\u0631\u0627\u06cc \u062a\u0633\u0648\u06cc\u0647 \u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0646\u06cc\u062f.');
      }
      const allocations = selectedAllocations.map(({document, input}) => {
        const amountIrr = inputToIrr(input, amountUnit);
        if (amountIrr <= 0n) {
          throw new Error('\u0645\u0628\u0644\u063a \u062a\u062e\u0635\u06cc\u0635 \u0647\u0631 \u0633\u0646\u062f \u0628\u0627\u06cc\u062f \u0628\u06cc\u0634\u062a\u0631 \u0627\u0632 \u0635\u0641\u0631 \u0628\u0627\u0634\u062f.');
        }
        if (amountIrr > BigInt(document.remainingIrr)) {
          throw new Error('\u0645\u0628\u0644\u063a \u062a\u062e\u0635\u06cc\u0635 \u0646\u0645\u06cc\u200c\u062a\u0648\u0627\u0646\u062f \u0627\u0632 \u0645\u0627\u0646\u062f\u0647 \u0633\u0646\u062f \u0628\u06cc\u0634\u062a\u0631 \u0628\u0627\u0634\u062f.');
        }
        return {
          documentType: document.documentType,
          documentId: document.id,
          amountIrr: amountIrr.toString(),
        };
      });
      const total = allocations.reduce(
        (sum, allocation) => sum + BigInt(allocation.amountIrr),
        0n,
      );
      const form = new FormData(event.currentTarget);
      const branchId = String(form.get('branchId') ?? '');
      const cashboxId = String(form.get('cashboxId') ?? '') || null;
      const bankAccountId =
        String(form.get('bankAccountId') ?? '') || null;
      const cheque =
        paymentMethod === 'cheque'
          ? {
              chequeNumber: String(form.get('chequeNumber') ?? '').trim(),
              bankName: String(form.get('chequeBankName') ?? '').trim() || null,
              branchName:
                String(form.get('chequeBranchName') ?? '').trim() || null,
              dueDate: jalaliInputToIso(String(form.get('chequeDueDate') ?? '')),
              bankAccountId:
                String(form.get('chequeBankAccountId') ?? '') || null,
              currentHolder:
                String(form.get('currentHolder') ?? '').trim() || null,
              description:
                String(form.get('chequeDescription') ?? '').trim() || null,
            }
          : null;

      setPending('transaction');
      const result = await postJson<{id: string; transactionNumber: string}>(
        '/api/treasury/transactions',
        {
          branchId,
          transactionDate: jalaliInputToIso(String(form.get('transactionDate') ?? '')),
          direction,
          paymentMethod,
          cashboxId: paymentMethod === 'cash' ? cashboxId : null,
          bankAccountId:
            paymentMethod === 'bank' || paymentMethod === 'card'
              ? bankAccountId
              : null,
          amountIrr: total.toString(),
          referenceNumber:
            String(form.get('referenceNumber') ?? '').trim() || null,
          description: String(form.get('description') ?? '').trim(),
          allocations,
          cheque,
        },
      );
      event.currentTarget.reset();
      resetTransactionForm();
      setShowTransactionForm(false);
      await loadBase();
      setSuccess(
        `\u062a\u0631\u0627\u06a9\u0646\u0634 \u0634\u0645\u0627\u0631\u0647 ${result.transactionNumber} \u062b\u0628\u062a \u0642\u0637\u0639\u06cc \u0648 \u0633\u0646\u062f \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc \u0622\u0646 \u0635\u0627\u062f\u0631 \u0634\u062f.`,
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(null);
    }
  }

  async function createBankAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending('bank-account');
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    try {
      await postJson('/api/treasury/bank-accounts', {
        branchId: String(form.get('branchId') ?? '') || null,
        bankName: String(form.get('bankName') ?? '').trim(),
        branchName: String(form.get('branchName') ?? '').trim() || null,
        accountNumber:
          String(form.get('accountNumber') ?? '').trim() || null,
        iban: String(form.get('iban') ?? '').trim() || null,
        cardNumber: String(form.get('cardNumber') ?? '').trim() || null,
      });
      event.currentTarget.reset();
      await loadBase();
      setSuccess('\u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc \u0648\u0627\u0642\u0639\u06cc \u0628\u0647 \u062e\u0632\u0627\u0646\u0647 \u0627\u0636\u0627\u0641\u0647 \u0634\u062f.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(null);
    }
  }

  async function createCashbox(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending('cashbox');
    setError(null);
    setSuccess(null);
    const form = new FormData(event.currentTarget);
    try {
      await postJson('/api/treasury/cashboxes', {
        branchId: String(form.get('branchId') ?? ''),
        code: String(form.get('code') ?? '').trim(),
        name: String(form.get('name') ?? '').trim(),
      });
      event.currentTarget.reset();
      await loadBase();
      setSuccess('\u0635\u0646\u062f\u0648\u0642 \u0648\u0627\u0642\u0639\u06cc \u0628\u0647 \u062e\u0632\u0627\u0646\u0647 \u0627\u0636\u0627\u0641\u0647 \u0634\u062f.');
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="content-page">
      <header className="page-heading compact">
        <ContextHelpButton help={appHelp.treasury} />
        <div>
          <p>{'\u062f\u0631\u06cc\u0627\u0641\u062a\u060c \u067e\u0631\u062f\u0627\u062e\u062a\u060c \u0628\u0627\u0646\u06a9\u060c \u0635\u0646\u062f\u0648\u0642 \u0648 \u0686\u06a9 \u0645\u062a\u0635\u0644 \u0628\u0647 \u062d\u0633\u0627\u0628\u062f\u0627\u0631\u06cc'}</p>
          <h1>{'\u062e\u0632\u0627\u0646\u0647'}</h1>
        </div>
        <div className="heading-actions">
          <button
            className="button secondary"
            type="button"
            disabled={Boolean(pending)}
            onClick={() => {
              setError(null);
              void loadBase().catch((caught) => setError(errorMessage(caught)));
            }}
          >
            <RefreshCw aria-hidden />
            {'\u0628\u0627\u0632\u062e\u0648\u0627\u0646\u06cc'}
          </button>
          {canManage ? (
            <button
              className="button primary"
              type="button"
              onClick={() => {
                setShowTransactionForm((current) => !current);
                setError(null);
                setSuccess(null);
              }}
            >
              {showTransactionForm ? <X aria-hidden /> : <CirclePlus aria-hidden />}
              {showTransactionForm ? '\u0628\u0633\u062a\u0646 \u0641\u0631\u0645' : '\u062f\u0631\u06cc\u0627\u0641\u062a \u06cc\u0627 \u067e\u0631\u062f\u0627\u062e\u062a \u062c\u062f\u06cc\u062f'}
            </button>
          ) : null}
        </div>
      </header>

      <Feedback error={error} success={success} />

      <div className="treasury-summary-grid">
        <article className="summary-card blue">
          <WalletCards aria-hidden />
          <div>
            <span>{'\u06af\u0631\u062f\u0634\u200c\u0647\u0627\u06cc \u062b\u0628\u062a\u200c\u0634\u062f\u0647'}</span>
            <strong>{new Intl.NumberFormat('fa-IR').format(transactions.length)}</strong>
          </div>
        </article>
        <article className="summary-card green">
          <Banknote aria-hidden />
          <div>
            <span>{'\u0635\u0646\u062f\u0648\u0642\u200c\u0647\u0627\u06cc \u0641\u0639\u0627\u0644'}</span>
            <strong>{new Intl.NumberFormat('fa-IR').format(accounts.cashboxes.length)}</strong>
          </div>
        </article>
        <article className="summary-card amber">
          <Landmark aria-hidden />
          <div>
            <span>{'\u062d\u0633\u0627\u0628\u200c\u0647\u0627\u06cc \u0628\u0627\u0646\u06a9\u06cc \u0641\u0639\u0627\u0644'}</span>
            <strong>{new Intl.NumberFormat('fa-IR').format(accounts.bankAccounts.length)}</strong>
          </div>
        </article>
      </div>

      {showTransactionForm && canManage ? (
        <form className="form-card" onSubmit={createTransaction}>
          <div className="form-card-heading">
            <ContextHelpButton help={appHelp.treasuryTransaction} />
            <h2>{direction === 'receipt' ? '\u062b\u0628\u062a \u062f\u0631\u06cc\u0627\u0641\u062a' : '\u062b\u0628\u062a \u067e\u0631\u062f\u0627\u062e\u062a'}</h2>
            <p>{'\u0645\u0628\u0644\u063a \u0641\u0642\u0637 \u0628\u0647 \u0627\u0633\u0646\u0627\u062f \u0642\u0637\u0639\u06cc \u0647\u0645\u0627\u0646 \u0637\u0631\u0641\u200c\u062d\u0633\u0627\u0628 \u062a\u062e\u0635\u06cc\u0635 \u062f\u0627\u062f\u0647 \u0645\u06cc\u200c\u0634\u0648\u062f.'}</p>
          </div>

          <div className="direction-switch" role="group" aria-label="\u0646\u0648\u0639 \u062a\u0631\u0627\u06a9\u0646\u0634">
            <button
              type="button"
              className={direction === 'receipt' ? 'active' : ''}
              onClick={() => {
                setDirection('receipt');
                setPartyId('');
              }}
            >
              {'\u062f\u0631\u06cc\u0627\u0641\u062a \u0627\u0632 \u0645\u0634\u062a\u0631\u06cc'}
            </button>
            <button
              type="button"
              className={direction === 'payment' ? 'active' : ''}
              onClick={() => {
                setDirection('payment');
                setPartyId('');
              }}
            >
              {'\u067e\u0631\u062f\u0627\u062e\u062a \u0628\u0647 \u062a\u0623\u0645\u06cc\u0646\u200c\u06a9\u0646\u0646\u062f\u0647'}
            </button>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>{'\u0634\u0639\u0628\u0647 *'}</span>
              <select name="branchId" required defaultValue="">
                <option value="">{'\u0627\u0646\u062a\u062e\u0627\u0628 \u0634\u0639\u0628\u0647'}</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <JalaliDateField
              name="transactionDate"
              label={'\u062a\u0627\u0631\u06cc\u062e \u062a\u0631\u0627\u06a9\u0646\u0634'}
              defaultIsoValue={todayInTehran()}
              required
            />
            <label className="field full">
              <span>{'\u0637\u0631\u0641\u200c\u062d\u0633\u0627\u0628 *'}</span>
              <select
                value={partyId}
                required
                onChange={(event) => setPartyId(event.target.value)}
              >
                <option value="">{'\u0627\u0646\u062a\u062e\u0627\u0628 \u0637\u0631\u0641\u200c\u062d\u0633\u0627\u0628'}</option>
                {eligibleParties.map((party) => (
                  <option key={party.id} value={party.id}>
                    {party.code} \u00b7 {party.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="allocation-panel">
            <div className="allocation-heading">
              <div>
                <strong>{'\u0627\u0633\u0646\u0627\u062f \u0628\u0627\u0632 \u0628\u0631\u0627\u06cc \u062a\u0633\u0648\u06cc\u0647'}</strong>
                <span>{`\u0648\u0627\u062d\u062f \u0648\u0631\u0648\u062f \u0645\u0628\u0644\u063a: ${amountUnit === 'IRR' ? '\u0631\u06cc\u0627\u0644' : '\u062a\u0648\u0645\u0627\u0646'}`}</span>
              </div>
              <strong>
                {'\u062c\u0645\u0639 \u0627\u0646\u062a\u062e\u0627\u0628: '}
                {allocationTotal === null
                  ? '\u0645\u0628\u0644\u063a \u0646\u0627\u0645\u0639\u062a\u0628\u0631'
                  : formatAmount(allocationTotal, amountUnit)}
              </strong>
            </div>
            {!partyId ? (
              <div className="inline-empty">{'\u0627\u0628\u062a\u062f\u0627 \u0637\u0631\u0641\u200c\u062d\u0633\u0627\u0628 \u0631\u0627 \u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0646\u06cc\u062f.'}</div>
            ) : documentsPending ? (
              <div className="inline-empty">{'\u062f\u0631 \u062d\u0627\u0644 \u062f\u0631\u06cc\u0627\u0641\u062a \u0627\u0633\u0646\u0627\u062f \u0628\u0627\u0632\u2026'}</div>
            ) : openDocuments.length === 0 ? (
              <div className="inline-empty">{'\u0633\u0646\u062f \u0642\u0637\u0639\u06cc \u062f\u0627\u0631\u0627\u06cc \u0645\u0627\u0646\u062f\u0647 \u0628\u0631\u0627\u06cc \u0627\u06cc\u0646 \u0637\u0631\u0641\u200c\u062d\u0633\u0627\u0628 \u0648\u062c\u0648\u062f \u0646\u062f\u0627\u0631\u062f.'}</div>
            ) : (
              <div className="document-list">
                {openDocuments.map((document) => {
                  const selected = allocationInputs[document.id] !== undefined;
                  return (
                    <article
                      className={selected ? 'document-row selected' : 'document-row'}
                      key={document.id}
                    >
                      <label>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) =>
                            selectDocument(document, event.target.checked)
                          }
                        />
                        <span>
                          <strong>
                            {documentTitle[document.documentType]} \u0634\u0645\u0627\u0631\u0647 {document.documentNumber}
                          </strong>
                          <small>
                            {formatDate(document.documentDate)} \u00b7 \u0645\u0627\u0646\u062f\u0647{' '}
                            {formatAmount(document.remainingIrr, amountUnit)}
                          </small>
                        </span>
                      </label>
                      {selected ? (
                        <label className="compact-amount">
                          <span>{'\u0645\u0628\u0644\u063a \u062a\u062e\u0635\u06cc\u0635'}</span>
                          <input
                            inputMode="decimal"
                            value={allocationInputs[document.id]}
                            onChange={(event) =>
                              setAllocationInputs((current) => ({
                                ...current,
                                [document.id]: event.target.value,
                              }))
                            }
                            required
                          />
                        </label>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="form-grid">
            <label className="field">
              <span>{'\u0631\u0648\u0634 \u067e\u0631\u062f\u0627\u062e\u062a *'}</span>
              <select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(
                    event.target.value as 'cash' | 'bank' | 'card' | 'cheque',
                  )
                }
              >
                {Object.entries(paymentMethodTitle).map(([value, title]) => (
                  <option value={value} key={value}>{title}</option>
                ))}
              </select>
            </label>

            {paymentMethod === 'cash' ? (
              <label className="field">
                <span>{'\u0635\u0646\u062f\u0648\u0642 *'}</span>
                <select name="cashboxId" required defaultValue="">
                  <option value="">{'\u0627\u0646\u062a\u062e\u0627\u0628 \u0635\u0646\u062f\u0648\u0642'}</option>
                  {accounts.cashboxes.map((cashbox) => (
                    <option value={cashbox.id} key={cashbox.id}>
                      {cashbox.name} \u00b7 {cashbox.branch}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {paymentMethod === 'bank' || paymentMethod === 'card' ? (
              <label className="field">
                <span>{'\u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc *'}</span>
                <select name="bankAccountId" required defaultValue="">
                  <option value="">{'\u0627\u0646\u062a\u062e\u0627\u0628 \u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc'}</option>
                  {accounts.bankAccounts.map((account) => (
                    <option value={account.id} key={account.id}>
                      {account.bankName} \u00b7 {account.accountNumber ?? account.cardNumber ?? '\u0628\u062f\u0648\u0646 \u0634\u0645\u0627\u0631\u0647'}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="field">
              <span>{'\u0634\u0645\u0627\u0631\u0647 \u0627\u0631\u062c\u0627\u0639'}</span>
              <input name="referenceNumber" maxLength={120} />
            </label>
            <label className="field full">
              <span>{'\u0634\u0631\u062d \u062a\u0631\u0627\u06a9\u0646\u0634 *'}</span>
              <textarea name="description" required minLength={2} maxLength={2000} />
            </label>
          </div>

          {paymentMethod === 'cheque' ? (
            <div className="cheque-panel">
              <div className="form-card-heading">
                <ContextHelpButton help={appHelp.treasuryCheque} />
                <h2>{'\u0645\u0634\u062e\u0635\u0627\u062a \u0686\u06a9'}</h2>
                <p>{'\u0628\u0631\u0627\u06cc \u0686\u06a9 \u062f\u0631\u06cc\u0627\u0641\u062a\u06cc \u06cc\u0627 \u067e\u0631\u062f\u0627\u062e\u062a\u06cc\u060c \u0634\u0645\u0627\u0631\u0647 \u0648 \u0633\u0631\u0631\u0633\u06cc\u062f \u0627\u0644\u0632\u0627\u0645\u06cc \u0627\u0633\u062a.'}</p>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>{'\u0634\u0645\u0627\u0631\u0647 \u0686\u06a9 *'}</span>
                  <input name="chequeNumber" required maxLength={80} />
                </label>
                <JalaliDateField
                  name="chequeDueDate"
                  label={'\u062a\u0627\u0631\u06cc\u062e \u0633\u0631\u0631\u0633\u06cc\u062f'}
                  required
                />
                <label className="field">
                  <span>{'\u0646\u0627\u0645 \u0628\u0627\u0646\u06a9 \u0631\u0648\u06cc \u0686\u06a9'}</span>
                  <input name="chequeBankName" maxLength={160} />
                </label>
                <label className="field">
                  <span>{'\u0634\u0639\u0628\u0647 \u0628\u0627\u0646\u06a9 \u0631\u0648\u06cc \u0686\u06a9'}</span>
                  <input name="chequeBranchName" maxLength={160} />
                </label>
                <label className="field">
                  <span>{'\u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc \u0645\u0631\u062a\u0628\u0637'}</span>
                  <select name="chequeBankAccountId" defaultValue="">
                    <option value="">{'\u0628\u062f\u0648\u0646 \u0627\u0646\u062a\u062e\u0627\u0628'}</option>
                    {accounts.bankAccounts.map((account) => (
                      <option value={account.id} key={account.id}>
                        {account.bankName} \u00b7 {account.accountNumber ?? '\u0628\u062f\u0648\u0646 \u0634\u0645\u0627\u0631\u0647'}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{'\u062f\u0627\u0631\u0646\u062f\u0647 \u0641\u0639\u0644\u06cc'}</span>
                  <input name="currentHolder" maxLength={180} />
                </label>
                <label className="field full">
                  <span>{'\u062a\u0648\u0636\u06cc\u062d\u0627\u062a \u0686\u06a9'}</span>
                  <textarea name="chequeDescription" maxLength={2000} />
                </label>
              </div>
            </div>
          ) : null}

          {(paymentMethod === 'cash' && accounts.cashboxes.length === 0) ||
          ((paymentMethod === 'bank' || paymentMethod === 'card') &&
            accounts.bankAccounts.length === 0) ? (
            <div className="form-message error" role="alert">
              {'\u0628\u0631\u0627\u06cc \u0631\u0648\u0634 \u0627\u0646\u062a\u062e\u0627\u0628\u200c\u0634\u062f\u0647 \u0647\u0646\u0648\u0632 \u0635\u0646\u062f\u0648\u0642 \u06cc\u0627 \u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc \u0641\u0639\u0627\u0644\u06cc \u062a\u0639\u0631\u06cc\u0641 \u0646\u0634\u062f\u0647 \u0627\u0633\u062a. \u0627\u0628\u062a\u062f\u0627 \u0627\u0632 \u0628\u062e\u0634 \u0645\u062f\u06cc\u0631\u06cc\u062a \u062d\u0633\u0627\u0628\u200c\u0647\u0627\u06cc \u062e\u0632\u0627\u0646\u0647 \u0622\u0646 \u0631\u0627 \u0628\u0633\u0627\u0632\u06cc\u062f.'}
            </div>
          ) : null}

          <div className="form-actions">
            <button
              className="button primary"
              type="submit"
              disabled={
                Boolean(pending) ||
                allocationTotal === null ||
                allocationTotal <= 0n
              }
            >
              {pending === 'transaction'
                ? '\u062f\u0631 \u062d\u0627\u0644 \u062b\u0628\u062a \u0642\u0637\u0639\u06cc\u2026'
                : direction === 'receipt'
                  ? '\u062b\u0628\u062a \u0642\u0637\u0639\u06cc \u062f\u0631\u06cc\u0627\u0641\u062a'
                  : '\u062b\u0628\u062a \u0642\u0637\u0639\u06cc \u067e\u0631\u062f\u0627\u062e\u062a'}
            </button>
          </div>
        </form>
      ) : null}

      {canManage ? (
        <section className="account-management">
          <button
            className="account-management-toggle"
            type="button"
            onClick={() => setShowAccountForm((current) => !current)}
            aria-expanded={showAccountForm}
          >
            <span>
              <Building2 aria-hidden />
              <strong>{'\u0645\u062f\u06cc\u0631\u06cc\u062a \u0635\u0646\u062f\u0648\u0642 \u0648 \u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc'}</strong>
            </span>
            <ChevronDown aria-hidden />
          </button>
          {showAccountForm ? (
            <div className="account-form-grid">
              <form className="form-card" onSubmit={createCashbox}>
                <div className="form-card-heading">
                  <ContextHelpButton help={appHelp.treasuryCashbox} />
                  <h2>{'\u0627\u0641\u0632\u0648\u062f\u0646 \u0635\u0646\u062f\u0648\u0642'}</h2>
                  <p>{'\u0647\u0631 \u0635\u0646\u062f\u0648\u0642 \u0628\u0647 \u06cc\u06a9 \u0634\u0639\u0628\u0647 \u0648 \u062d\u0633\u0627\u0628 \u062f\u0641\u062a\u0631\u06a9\u0644 \u0645\u062a\u0635\u0644 \u0645\u06cc\u200c\u0634\u0648\u062f.'}</p>
                </div>
                <label className="field">
                  <span>{'\u0634\u0639\u0628\u0647 *'}</span>
                  <select name="branchId" required defaultValue="">
                    <option value="">{'\u0627\u0646\u062a\u062e\u0627\u0628 \u0634\u0639\u0628\u0647'}</option>
                    {branches.map((branch) => (
                      <option value={branch.id} key={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{'\u06a9\u062f \u0635\u0646\u062f\u0648\u0642 *'}</span>
                  <input name="code" required maxLength={40} />
                </label>
                <label className="field">
                  <span>{'\u0646\u0627\u0645 \u0635\u0646\u062f\u0648\u0642 *'}</span>
                  <input name="name" required minLength={2} maxLength={120} />
                </label>
                <div className="form-actions">
                  <button className="button primary" type="submit" disabled={Boolean(pending)}>
                    {pending === 'cashbox' ? '\u062f\u0631 \u062d\u0627\u0644 \u062b\u0628\u062a\u2026' : '\u062b\u0628\u062a \u0635\u0646\u062f\u0648\u0642'}
                  </button>
                </div>
              </form>

              <form className="form-card" onSubmit={createBankAccount}>
                <div className="form-card-heading">
                  <ContextHelpButton help={appHelp.treasuryBankAccount} />
                  <h2>{'\u0627\u0641\u0632\u0648\u062f\u0646 \u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc'}</h2>
                  <p>{'\u0634\u0645\u0627\u0631\u0647 \u062d\u0633\u0627\u0628\u060c \u0634\u0628\u0627 \u0648 \u06a9\u0627\u0631\u062a \u0627\u062e\u062a\u06cc\u0627\u0631\u06cc\u200c\u0627\u0646\u062f \u0648\u0644\u06cc \u0628\u0627\u06cc\u062f \u0648\u0627\u0642\u0639\u06cc \u062b\u0628\u062a \u0634\u0648\u0646\u062f.'}</p>
                </div>
                <label className="field">
                  <span>{'\u0634\u0639\u0628\u0647 \u0634\u0631\u06a9\u062a'}</span>
                  <select name="branchId" defaultValue="">
                    <option value="">{'\u0628\u062f\u0648\u0646 \u0648\u0627\u0628\u0633\u062a\u06af\u06cc \u0628\u0647 \u0634\u0639\u0628\u0647'}</option>
                    {branches.map((branch) => (
                      <option value={branch.id} key={branch.id}>{branch.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{'\u0646\u0627\u0645 \u0628\u0627\u0646\u06a9 *'}</span>
                  <input name="bankName" required minLength={2} maxLength={160} />
                </label>
                <label className="field">
                  <span>{'\u0634\u0639\u0628\u0647 \u0628\u0627\u0646\u06a9'}</span>
                  <input name="branchName" maxLength={160} />
                </label>
                <label className="field">
                  <span>{'\u0634\u0645\u0627\u0631\u0647 \u062d\u0633\u0627\u0628'}</span>
                  <input name="accountNumber" dir="ltr" maxLength={80} />
                </label>
                <label className="field">
                  <span>{'\u0634\u0645\u0627\u0631\u0647 \u0634\u0628\u0627'}</span>
                  <input name="iban" dir="ltr" maxLength={40} />
                </label>
                <label className="field">
                  <span>{'\u0634\u0645\u0627\u0631\u0647 \u06a9\u0627\u0631\u062a'}</span>
                  <input name="cardNumber" dir="ltr" maxLength={30} />
                </label>
                <div className="form-actions">
                  <button className="button primary" type="submit" disabled={Boolean(pending)}>
                    {pending === 'bank-account' ? '\u062f\u0631 \u062d\u0627\u0644 \u062b\u0628\u062a\u2026' : '\u062b\u0628\u062a \u062d\u0633\u0627\u0628 \u0628\u0627\u0646\u06a9\u06cc'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}
        </section>
      ) : null}

      <TreasuryChequeOverview amountUnit={amountUnit} cheques={cheques} />

      <TreasuryHistory
        amountUnit={amountUnit}
        canManage={canManage}
        loading={pending === 'initial'}
        transactions={transactions}
        cheques={cheques}
        bankAccounts={accounts.bankAccounts}
        onChanged={loadBase}
      />
    </section>
  );
}
