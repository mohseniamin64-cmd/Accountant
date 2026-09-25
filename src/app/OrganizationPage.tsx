import {Edit3, Power} from 'lucide-react';
import {useCallback, useEffect, useState, type FormEvent} from 'react';
import {api, errorMessage, postJson} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {masterDataText as text} from './master-data.copy.js';
import {masterDataHelp} from './master-data.help.js';
import {nullableText} from './master-data.helpers.js';
import {
  ActionFeedback,
  BooleanField,
  MasterDataHeader,
  StatusPill,
} from './MasterDataUi.js';

type WarehouseType =
  | 'general'
  | 'raw_material'
  | 'work_in_progress'
  | 'finished_goods'
  | 'service'
  | 'quarantine';

interface BranchRecord {
  id: string;
  code: string;
  name: string;
  phone: string | null;
  address: string | null;
  isHeadOffice: boolean;
  isActive: boolean;
  rowVersion: number;
}

interface WarehouseRecord {
  id: string;
  branchId: string;
  branchName: string;
  code: string;
  name: string;
  warehouseType: WarehouseType;
  allowNegative: boolean;
  isActive: boolean;
  rowVersion: number;
}

interface OrganizationPageProps {
  permissions: readonly string[];
}

const warehouseTypes: ReadonlyArray<{value: WarehouseType; label: string}> = [
  {value: 'general', label: text.generalWarehouse},
  {value: 'raw_material', label: text.rawMaterialWarehouse},
  {value: 'work_in_progress', label: text.wipWarehouse},
  {value: 'finished_goods', label: text.finishedGoodsWarehouse},
  {value: 'service', label: text.serviceWarehouse},
  {value: 'quarantine', label: text.quarantineWarehouse},
];
const message = {
  branchDeactivate: '\u0622\u06cc\u0627 \u0627\u0632 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644\u200c\u0633\u0627\u0632\u06cc \u0627\u06cc\u0646 \u0634\u0639\u0628\u0647 \u0645\u0637\u0645\u0626\u0646 \u0647\u0633\u062a\u06cc\u062f\u061f',
  warehouseDeactivate: '\u0622\u06cc\u0627 \u0627\u0632 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644\u200c\u0633\u0627\u0632\u06cc \u0627\u06cc\u0646 \u0627\u0646\u0628\u0627\u0631 \u0645\u0637\u0645\u0626\u0646 \u0647\u0633\u062a\u06cc\u062f\u061f',
  headOfficeProtected: '\u0634\u0639\u0628\u0647 \u0627\u0635\u0644\u06cc \u0642\u0627\u0628\u0644 \u063a\u06cc\u0631\u0641\u0639\u0627\u0644\u200c\u0633\u0627\u0632\u06cc \u0646\u06cc\u0633\u062a. \u0627\u0628\u062a\u062f\u0627 \u0634\u0639\u0628\u0647 \u0627\u0635\u0644\u06cc \u062f\u06cc\u06af\u0631\u06cc \u062a\u0639\u06cc\u06cc\u0646 \u06a9\u0646\u06cc\u062f.',
  selectBranch: '\u0634\u0639\u0628\u0647 \u0631\u0627 \u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0646\u06cc\u062f',
  headOfficeHint: '\u0628\u0627 \u0627\u0646\u062a\u062e\u0627\u0628 \u0627\u06cc\u0646 \u06af\u0632\u06cc\u0646\u0647\u060c \u0634\u0639\u0628\u0647 \u0627\u0635\u0644\u06cc \u0642\u0628\u0644\u06cc \u0628\u0647 \u0634\u0639\u0628\u0647 \u0639\u0627\u062f\u06cc \u062a\u0628\u062f\u06cc\u0644 \u0645\u06cc\u200c\u0634\u0648\u062f.',
  noActiveBranch: '\u0628\u0631\u0627\u06cc \u062b\u0628\u062a \u0627\u0646\u0628\u0627\u0631\u060c \u062d\u062f\u0627\u0642\u0644 \u06cc\u06a9 \u0634\u0639\u0628\u0647 \u0641\u0639\u0627\u0644 \u0644\u0627\u0632\u0645 \u0627\u0633\u062a.',
} as const;

function warehouseTypeLabel(value: WarehouseType): string {
  return warehouseTypes.find((item) => item.value === value)?.label ?? value;
}

export function OrganizationPage({permissions}: OrganizationPageProps) {
  const canManageBranches = permissions.includes('system.branches.manage');
  const canManageWarehouses = permissions.includes('system.warehouses.manage');
  const [branches, setBranches] = useState<readonly BranchRecord[]>([]);
  const [warehouses, setWarehouses] = useState<readonly WarehouseRecord[]>([]);
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [branchFormOpen, setBranchFormOpen] = useState(false);
  const [warehouseFormOpen, setWarehouseFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchRecord | null>(null);
  const [editingWarehouse, setEditingWarehouse] = useState<WarehouseRecord | null>(null);

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const [nextBranches, nextWarehouses] = await Promise.all([
        api<BranchRecord[]>('/api/organization/branches'),
        api<WarehouseRecord[]>('/api/organization/warehouses'),
      ]);
      setBranches(nextBranches);
      setWarehouses(nextWarehouses);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openBranch(record: BranchRecord | null) {
    setEditingBranch(record);
    setBranchFormOpen(true);
    setWarehouseFormOpen(false);
    setError(null);
    setSuccess(null);
  }

  function openWarehouse(record: WarehouseRecord | null) {
    if (!record && !branches.some((branch) => branch.isActive)) {
      setError(message.noActiveBranch);
      return;
    }
    setEditingWarehouse(record);
    setWarehouseFormOpen(true);
    setBranchFormOpen(false);
    setError(null);
    setSuccess(null);
  }

  async function saveBranch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        name: String(form.get('name') ?? '').trim(),
        phone: nullableText(form.get('phone')),
        address: nullableText(form.get('address')),
        isHeadOffice: editingBranch?.isHeadOffice || form.has('isHeadOffice'),
      };
      if (editingBranch) {
        await postJson(
          '/api/organization/branches/' + editingBranch.id,
          {...payload, rowVersion: editingBranch.rowVersion},
          'PATCH',
        );
      } else {
        await postJson('/api/organization/branches', payload);
      }
      setBranchFormOpen(false);
      setEditingBranch(null);
      setSuccess(text.branchSaved);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function saveWarehouse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        branchId: String(form.get('branchId') ?? ''),
        name: String(form.get('name') ?? '').trim(),
        warehouseType: String(form.get('warehouseType')) as WarehouseType,
        allowNegative: form.has('allowNegative'),
      };
      if (editingWarehouse) {
        await postJson(
          '/api/organization/warehouses/' + editingWarehouse.id,
          {...payload, rowVersion: editingWarehouse.rowVersion},
          'PATCH',
        );
      } else {
        await postJson('/api/organization/warehouses', payload);
      }
      setWarehouseFormOpen(false);
      setEditingWarehouse(null);
      setSuccess(text.warehouseSaved);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function changeBranchStatus(record: BranchRecord) {
    if (saving) return;
    if (record.isActive && record.isHeadOffice) {
      setError(message.headOfficeProtected);
      return;
    }
    if (record.isActive && !window.confirm(message.branchDeactivate)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await postJson(
        '/api/organization/branches/' + record.id,
        {isActive: !record.isActive, rowVersion: record.rowVersion},
        'PATCH',
      );
      setSuccess(text.branchStatusChanged);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function changeWarehouseStatus(record: WarehouseRecord) {
    if (saving) return;
    if (record.isActive && !window.confirm(message.warehouseDeactivate)) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await postJson(
        '/api/organization/warehouses/' + record.id,
        {isActive: !record.isActive, rowVersion: record.rowVersion},
        'PATCH',
      );
      setSuccess(text.warehouseStatusChanged);
      await load();
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="content-page organization-page business-forms">
      <MasterDataHeader
        title={text.organizationTitle}
        description={text.organizationDescription}
        help={masterDataHelp.organization}
      />
      <ActionFeedback error={error} success={success} />

      {branchFormOpen ? (
        <form className="card master-form" key={editingBranch?.id ?? 'new-branch'} onSubmit={(event) => void saveBranch(event)}>
          <div className="section-heading">
            <ContextHelpButton help={masterDataHelp.branchForm} />
            <div><p>{text.branches}</p><h2>{editingBranch ? text.editBranch : text.newBranch}</h2></div>
          </div>
          <div className="form-grid">
            <label className="field"><span>{text.name} *</span><input name="name" defaultValue={editingBranch?.name ?? ''} maxLength={160} required /></label>
            <label className="field"><span>{text.phone}</span><input name="phone" defaultValue={editingBranch?.phone ?? ''} maxLength={30} /></label>
            <label className="field full"><span>{text.address}</span><textarea name="address" defaultValue={editingBranch?.address ?? ''} maxLength={1000} rows={3} /></label>
          </div>
          <div className="boolean-grid">
            <BooleanField name="isHeadOffice" label={text.headOffice} hint={message.headOfficeHint} defaultChecked={editingBranch?.isHeadOffice ?? false} disabled={editingBranch?.isHeadOffice ?? false} />
          </div>
          <div className="master-form-actions">
            <button className="button secondary" disabled={saving} onClick={() => setBranchFormOpen(false)} type="button">{text.cancel}</button>
            <button className="button primary" disabled={saving} type="submit">{saving ? text.saving : text.save}</button>
          </div>
        </form>
      ) : null}

      {warehouseFormOpen ? (
        <form className="card master-form" key={editingWarehouse?.id ?? 'new-warehouse'} onSubmit={(event) => void saveWarehouse(event)}>
          <div className="section-heading">
            <ContextHelpButton help={masterDataHelp.warehouseForm} />
            <div><p>{text.warehouses}</p><h2>{editingWarehouse ? text.editWarehouse : text.newWarehouse}</h2></div>
          </div>
          <div className="form-grid">
            <label className="field">
              <span>{text.branch} *</span>
              <select name="branchId" defaultValue={editingWarehouse?.branchId ?? ''} required>
                <option value="" disabled>{message.selectBranch}</option>
                {branches.filter((branch) => branch.isActive || branch.id === editingWarehouse?.branchId).map((branch) => <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>)}
              </select>
            </label>
            <label className="field"><span>{text.name} *</span><input name="name" defaultValue={editingWarehouse?.name ?? ''} maxLength={160} required /></label>
            <label className="field">
              <span>{text.warehouseType} *</span>
              <select name="warehouseType" defaultValue={editingWarehouse?.warehouseType ?? 'general'} required>
                {warehouseTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
          </div>
          <div className="boolean-grid">
            <BooleanField name="allowNegative" label={text.allowNegative} hint={text.negativeStockWarning} defaultChecked={editingWarehouse?.allowNegative ?? false} />
          </div>
          <div className="master-form-actions">
            <button className="button secondary" disabled={saving} onClick={() => setWarehouseFormOpen(false)} type="button">{text.cancel}</button>
            <button className="button primary" disabled={saving} type="submit">{saving ? text.saving : text.save}</button>
          </div>
        </form>
      ) : null}

      <OrganizationSection
        title={text.branches}
        help={masterDataHelp.branchForm}
        canCreate={canManageBranches}
        createLabel={text.newBranch}
        onCreate={() => openBranch(null)}
      >
        <BranchList branches={branches} pending={pending} saving={saving} canManage={canManageBranches} onEdit={openBranch} onStatus={changeBranchStatus} />
      </OrganizationSection>

      <OrganizationSection
        title={text.warehouses}
        help={masterDataHelp.warehouseForm}
        canCreate={canManageWarehouses}
        createLabel={text.newWarehouse}
        onCreate={() => openWarehouse(null)}
      >
        <WarehouseList warehouses={warehouses} pending={pending} saving={saving} canManage={canManageWarehouses} onEdit={openWarehouse} onStatus={changeWarehouseStatus} />
      </OrganizationSection>
    </section>
  );
}

function OrganizationSection({title, help, canCreate, createLabel, onCreate, children}: {
  title: string;
  help: (typeof masterDataHelp)['branchForm'] | (typeof masterDataHelp)['warehouseForm'];
  canCreate: boolean;
  createLabel: string;
  onCreate: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="organization-section">
      <div className="section-heading">
        <ContextHelpButton help={help} />
        <div><p>{text.organizationDescription}</p><h2>{title}</h2></div>
        {canCreate ? <button className="button primary" onClick={onCreate} type="button">{createLabel}</button> : null}
      </div>
      <div className="table-card">{children}</div>
    </section>
  );
}

function BranchList({branches, pending, saving, canManage, onEdit, onStatus}: {
  branches: readonly BranchRecord[];
  pending: boolean;
  saving: boolean;
  canManage: boolean;
  onEdit: (record: BranchRecord) => void;
  onStatus: (record: BranchRecord) => Promise<void>;
}) {
  if (pending) return <div className="empty-state">{text.loading}</div>;
  if (branches.length === 0) return <div className="empty-state">{text.noRecords}</div>;
  return <><div className="table-scroll master-desktop-table"><table className="master-table">
    <thead><tr><th>{text.code}</th><th>{text.name}</th><th>{text.phone}</th><th>{text.headOffice}</th><th>{text.status}</th>{canManage ? <th>{text.actions}</th> : null}</tr></thead>
    <tbody>{branches.map((branch) => <tr key={branch.id}>
      <td className="organization-code" dir="ltr">{branch.code}</td><td>{branch.name}</td><td>{branch.phone ?? '\u2014'}</td><td>{branch.isHeadOffice ? text.yes : text.no}</td><td><StatusPill active={branch.isActive} /></td>
      {canManage ? <td><BranchActions branch={branch} saving={saving} onEdit={onEdit} onStatus={onStatus} /></td> : null}
    </tr>)}</tbody>
  </table></div><div className="master-mobile-list">{branches.map((branch) => <article className="master-mobile-card" key={branch.id}>
    <header><div><small className="organization-code" dir="ltr">{branch.code}</small><h3>{branch.name}</h3></div><StatusPill active={branch.isActive} /></header>
    <dl><dt>{text.phone}</dt><dd>{branch.phone ?? '\u2014'}</dd><dt>{text.headOffice}</dt><dd>{branch.isHeadOffice ? text.yes : text.no}</dd></dl>
    {canManage ? <BranchActions branch={branch} saving={saving} onEdit={onEdit} onStatus={onStatus} /> : null}
  </article>)}</div></>;
}

function BranchActions({branch, saving, onEdit, onStatus}: {branch: BranchRecord; saving: boolean; onEdit: (record: BranchRecord) => void; onStatus: (record: BranchRecord) => Promise<void>}) {
  return <div className="master-row-actions">
    <button className="button secondary" disabled={saving} onClick={() => onEdit(branch)} type="button"><Edit3 aria-hidden />{text.edit}</button>
    <button className="button secondary" disabled={saving || (branch.isActive && branch.isHeadOffice)} onClick={() => void onStatus(branch)} type="button"><Power aria-hidden />{branch.isActive ? text.deactivate : text.activate}</button>
  </div>;
}

function WarehouseList({warehouses, pending, saving, canManage, onEdit, onStatus}: {
  warehouses: readonly WarehouseRecord[];
  pending: boolean;
  saving: boolean;
  canManage: boolean;
  onEdit: (record: WarehouseRecord) => void;
  onStatus: (record: WarehouseRecord) => Promise<void>;
}) {
  if (pending) return <div className="empty-state">{text.loading}</div>;
  if (warehouses.length === 0) return <div className="empty-state">{text.noRecords}</div>;
  return <><div className="table-scroll master-desktop-table"><table className="master-table">
    <thead><tr><th>{text.code}</th><th>{text.name}</th><th>{text.branch}</th><th>{text.warehouseType}</th><th>{text.allowNegative}</th><th>{text.status}</th>{canManage ? <th>{text.actions}</th> : null}</tr></thead>
    <tbody>{warehouses.map((warehouse) => <tr key={warehouse.id}>
      <td className="organization-code" dir="ltr">{warehouse.code}</td><td>{warehouse.name}</td><td>{warehouse.branchName}</td><td>{warehouseTypeLabel(warehouse.warehouseType)}</td><td>{warehouse.allowNegative ? text.yes : text.no}</td><td><StatusPill active={warehouse.isActive} /></td>
      {canManage ? <td><WarehouseActions warehouse={warehouse} saving={saving} onEdit={onEdit} onStatus={onStatus} /></td> : null}
    </tr>)}</tbody>
  </table></div><div className="master-mobile-list">{warehouses.map((warehouse) => <article className="master-mobile-card" key={warehouse.id}>
    <header><div><small className="organization-code" dir="ltr">{warehouse.code}</small><h3>{warehouse.name}</h3></div><StatusPill active={warehouse.isActive} /></header>
    <dl><dt>{text.branch}</dt><dd>{warehouse.branchName}</dd><dt>{text.warehouseType}</dt><dd>{warehouseTypeLabel(warehouse.warehouseType)}</dd><dt>{text.allowNegative}</dt><dd>{warehouse.allowNegative ? text.yes : text.no}</dd></dl>
    {canManage ? <WarehouseActions warehouse={warehouse} saving={saving} onEdit={onEdit} onStatus={onStatus} /> : null}
  </article>)}</div></>;
}

function WarehouseActions({warehouse, saving, onEdit, onStatus}: {warehouse: WarehouseRecord; saving: boolean; onEdit: (record: WarehouseRecord) => void; onStatus: (record: WarehouseRecord) => Promise<void>}) {
  return <div className="master-row-actions">
    <button className="button secondary" disabled={saving} onClick={() => onEdit(warehouse)} type="button"><Edit3 aria-hidden />{text.edit}</button>
    <button className="button secondary" disabled={saving} onClick={() => void onStatus(warehouse)} type="button"><Power aria-hidden />{warehouse.isActive ? text.deactivate : text.activate}</button>
  </div>;
}

