import {Edit3, Power} from 'lucide-react';
import {useCallback, useEffect, useState, type FormEvent} from 'react';
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
  isActive: boolean;
  rowVersion: number;
}

interface PartiesPageProps {
  permissions: readonly string[];
  amountUnit: AmountUnit;
}

const PAGE_SIZE = 30;
const message = {
  confirmDeactivate: '\u0622\u06cc\u0627 \u0627\u0632 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644\u200c\u0633\u0627\u0632\u06cc \u0627\u06cc\u0646 \u0637\u0631\u0641\u200c\u062d\u0633\u0627\u0628 \u0645\u0637\u0645\u0626\u0646 \u0647\u0633\u062a\u06cc\u062f\u061f',
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
        required={required}
        type={type}
      />
    </label>
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

export function PartiesPage({permissions, amountUnit}: PartiesPageProps) {
  const canManage = permissions.includes('parties.manage');
  const [records, setRecords] = useState<readonly PartyRecord[]>([]);
  const [draftQuery, setDraftQuery] = useState('');
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<ActiveFilter>('true');
  const [offset, setOffset] = useState(0);
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PartyRecord | null>(null);

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

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
    setError(null);
    setSuccess(null);
  }

  function openEdit(record: PartyRecord) {
    setEditing(record);
    setFormOpen(true);
    setError(null);
    setSuccess(null);
  }

  async function saveParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    if (!form.has('isCustomer') && !form.has('isSupplier')) {
      setError(text.partyRoleRequired);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        code: String(form.get('code') ?? '').trim(),
        displayName: String(form.get('displayName') ?? '').trim(),
        legalName: nullableText(form.get('legalName')),
        partyType: String(form.get('partyType')) as PartyRecord['partyType'],
        isCustomer: form.has('isCustomer'),
        isSupplier: form.has('isSupplier'),
        nationalId: nullableText(form.get('nationalId')),
        economicCode: nullableText(form.get('economicCode')),
        registrationNumber: nullableText(form.get('registrationNumber')),
        mobile: nullableText(form.get('mobile')),
        phone: nullableText(form.get('phone')),
        email: nullableText(form.get('email')),
        address: nullableText(form.get('address')),
        postalCode: nullableText(form.get('postalCode')),
        creditLimitIrr: amountInputToIrr(
          String(form.get('creditLimit') || '0'),
          amountUnit,
        ),
        paymentTermsDays: Number(form.get('paymentTermsDays') || 0),
      };
      if (editing) {
        await postJson(
          '/api/parties/' + editing.id,
          {...payload, rowVersion: editing.rowVersion},
          'PATCH',
        );
      } else {
        await postJson('/api/parties', payload);
      }
      setFormOpen(false);
      setEditing(null);
      setSuccess(text.partySaved);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(record: PartyRecord) {
    if (saving) return;
    if (record.isActive && !window.confirm(message.confirmDeactivate)) return;
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

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = draftQuery.trim();
    if (offset === 0 && query === normalized) void load();
    setOffset(0);
    setQuery(normalized);
  }

  return (
    <section className="content-page">
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
        onSearch={submitSearch}
        onRefresh={() => void load()}
        onCreate={openCreate}
      />
      <ActionFeedback error={error} success={success} />

      {formOpen ? (
        <form
          className="card master-form"
          key={editing?.id ?? 'new-party'}
          onSubmit={(event) => void saveParty(event)}
        >
          <div className="section-heading">
            <ContextHelpButton help={masterDataHelp.partyForm} />
            <div>
              <p>{text.partyDescription}</p>
              <h2>{editing ? text.editParty : text.newParty}</h2>
            </div>
          </div>
          <div className="form-grid">
            <InputField name="code" label={text.code} defaultValue={editing?.code} required maxLength={40} />
            <InputField name="displayName" label={text.displayName} defaultValue={editing?.displayName} required maxLength={200} />
            <InputField name="legalName" label={text.legalName} defaultValue={editing?.legalName} maxLength={200} />
            <label className="field">
              <span>{text.partyType} *</span>
              <select name="partyType" defaultValue={editing?.partyType ?? 'person'} required>
                <option value="person">{text.person}</option>
                <option value="company">{text.company}</option>
              </select>
            </label>
            <InputField name="nationalId" label={text.nationalId} defaultValue={editing?.nationalId} maxLength={30} />
            <InputField name="economicCode" label={text.economicCode} defaultValue={editing?.economicCode} maxLength={30} />
            <InputField name="registrationNumber" label={text.registrationNumber} defaultValue={editing?.registrationNumber} maxLength={80} />
            <InputField name="mobile" label={text.mobile} defaultValue={editing?.mobile} maxLength={30} />
            <InputField name="phone" label={text.phone} defaultValue={editing?.phone} maxLength={30} />
            <InputField name="email" label={text.email} defaultValue={editing?.email} type="email" maxLength={180} />
            <InputField name="postalCode" label={text.postalCode} defaultValue={editing?.postalCode} maxLength={20} />
            <InputField
              name="creditLimit"
              label={text.creditLimit + ' (' + (amountUnit === 'IRR' ? message.unitIrr : message.unitToman) + ')'}
              defaultValue={amountIrrToInput(editing?.creditLimitIrr ?? '0', amountUnit)}
              min="0"
              required
            />
            <InputField
              name="paymentTermsDays"
              label={text.paymentTermsDays}
              defaultValue={editing?.paymentTermsDays ?? 0}
              type="number"
              min="0"
              max="3650"
              required
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
          <div className="master-form-actions">
            <button className="button secondary" disabled={saving} onClick={() => setFormOpen(false)} type="button">
              {text.cancel}
            </button>
            <button className="button primary" disabled={saving} type="submit">
              {saving ? text.saving : text.save}
            </button>
          </div>
        </form>
      ) : null}

      <div className="table-card">
        {pending ? (
          <div className="empty-state">{text.loading}</div>
        ) : records.length === 0 ? (
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
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>{record.code}</td>
                      <td>{record.displayName}</td>
                      <td>{partyRole(record)}</td>
                      <td>{record.mobile ?? '\u2014'}</td>
                      <td>{formatCredit(record.creditLimitIrr, amountUnit)}</td>
                      <td><StatusPill active={record.isActive} /></td>
                      {canManage ? <td><RowActions record={record} saving={saving} onEdit={openEdit} onStatus={changeStatus} /></td> : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="master-mobile-list">
              {records.map((record) => (
                <article className="master-mobile-card" key={record.id}>
                  <header><div><small>{record.code}</small><h3>{record.displayName}</h3></div><StatusPill active={record.isActive} /></header>
                  <dl>
                    <dt>{text.partyRoles}</dt><dd>{partyRole(record)}</dd>
                    <dt>{text.mobile}</dt><dd>{record.mobile ?? '\u2014'}</dd>
                    <dt>{text.creditLimit}</dt><dd>{formatCredit(record.creditLimitIrr, amountUnit)}</dd>
                  </dl>
                  {canManage ? <RowActions record={record} saving={saving} onEdit={openEdit} onStatus={changeStatus} /> : null}
                </article>
              ))}
            </div>
          </>
        )}
      </div>
      <Pager
        offset={offset}
        pageSize={PAGE_SIZE}
        returned={records.length}
        pending={pending}
        onPage={setOffset}
      />
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
}: {
  record: PartyRecord;
  saving: boolean;
  onEdit: (record: PartyRecord) => void;
  onStatus: (record: PartyRecord) => Promise<void>;
}) {
  return (
    <div className="master-row-actions">
      <button className="button secondary" disabled={saving} onClick={() => onEdit(record)} type="button">
        <Edit3 aria-hidden />{text.edit}
      </button>
      <button className="button secondary" disabled={saving} onClick={() => void onStatus(record)} type="button">
        <Power aria-hidden />{record.isActive ? text.deactivate : text.activate}
      </button>
    </div>
  );
}

