import {Eye, Search} from 'lucide-react';
import {useCallback, useEffect, useState, type FormEvent} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {api, errorMessage} from './api.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import {formatJalaliDateTime} from './jalali-date.js';
import {appHelp} from './help-content.js';
import {ActionFeedback, Pager} from './MasterDataUi.js';
import {
  serviceStatusOrder,
  serviceStatusText,
  warrantyDecisionText,
} from './service.helpers.js';
import {ServiceOrderDetailPanel} from './ServiceOrderDetailPanel.js';
import type {
  ServiceOptions,
  ServiceOrderDetail,
  ServiceOrderSummary,
  ServiceStatus,
} from './service.types.js';

export type ServiceOrderStatusFilter = ServiceStatus | 'all' | 'archive';

interface Props {
  options: ServiceOptions;
  amountUnit: AmountUnit;
  permissions: readonly string[];
  refreshVersion: number;
  statusFilter: ServiceOrderStatusFilter;
  onStatusFilterChange: (status: ServiceOrderStatusFilter) => void;
  onChanged: () => Promise<void>;
}

const PAGE_SIZE = 25;

export function ServiceOrderPanel({
  options,
  amountUnit,
  permissions,
  refreshVersion,
  statusFilter,
  onStatusFilterChange,
  onChanged,
}: Props) {
  const [records, setRecords] = useState<ServiceOrderSummary[]>([]);
  const [selected, setSelected] = useState<ServiceOrderDetail | null>(null);
  const [queryInput, setQueryInput] = useState('');
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [reloadVersion, setReloadVersion] = useState(0);
  const [pending, setPending] = useState(true);
  const [detailPending, setDetailPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRepair = permissions.includes('service.repair');
  const canRejectWarranty = permissions.includes('service.reject_warranty');
  const canDeliver = permissions.includes('service.deliver');
  const canUseTreasury = permissions.includes('treasury.view');
  const canAttach = permissions.includes('service.reception') || canRepair;

  const loadRecords = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        search,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      setRecords(
        await api<ServiceOrderSummary[]>(
          '/api/service/orders?' + params.toString(),
        ),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setPending(false);
    }
  }, [offset, search, statusFilter]);

  const loadDetail = useCallback(async (id: string) => {
    setDetailPending(true);
    setError(null);
    try {
      setSelected(
        await api<ServiceOrderDetail>('/api/service/orders/' + id),
      );
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setDetailPending(false);
    }
  }, []);

  useEffect(() => {
    void loadRecords();
  }, [loadRecords, reloadVersion, refreshVersion]);

  useEffect(() => {
    setOffset(0);
  }, [statusFilter]);

  function submitSearch(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setOffset(0);
    setSearch(queryInput.trim());
  }

  async function reloadSelected(): Promise<void> {
    if (!selected) return;
    await Promise.all([loadDetail(selected.id), onChanged()]);
    setReloadVersion((value) => value + 1);
  }

  return (
    <div className="service-order-panel" id="service-queue">
      <section className="service-queue-card">
        <div className="service-panel-heading">
          <ContextHelpButton help={appHelp.serviceQueue} />
          <div>
            <h2>صف پرونده‌های خدمات</h2>
            <p>جست‌وجو با سریال، کد پیگیری یا نام مشتری انجام می‌شود.</p>
          </div>
        </div>
        <form className="service-toolbar" onSubmit={submitSearch}>
          <label className="field">
            <span>جست‌وجو</span>
            <span className="service-search-input">
              <Search aria-hidden />
              <input
                maxLength={160}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="سریال، کد پیگیری یا مشتری"
                value={queryInput}
              />
            </span>
          </label>
          <label className="field">
            <span>وضعیت پرونده</span>
            <select
              onChange={(event) => {
                onStatusFilterChange(event.target.value as ServiceOrderStatusFilter);
              }}
              value={statusFilter}
            >
              <option value="all">همه وضعیت‌ها</option>
              <option value="archive">بایگانی: تحویل‌شده و لغوشده</option>
              {serviceStatusOrder.map((status) => (
                <option key={status} value={status}>{serviceStatusText(status)}</option>
              ))}
            </select>
          </label>
          <div className="service-toolbar-actions">
            <button className="button secondary" disabled={pending} type="submit">
              <Search aria-hidden /> جست‌وجو
            </button>
          </div>
        </form>
        <ActionFeedback error={error} success={null} />
        {pending ? (
          <div className="empty-state">در حال دریافت پرونده‌های واقعی…</div>
        ) : records.length === 0 ? (
          <div className="empty-state">پرونده‌ای مطابق فیلتر انتخابی وجود ندارد.</div>
        ) : (
          <>
            <div className="table-scroll service-desktop-list">
              <table>
                <thead>
                  <tr>
                    <th>پرونده</th>
                    <th>سریال و محصول</th>
                    <th>مشتری</th>
                    <th>گارانتی</th>
                    <th>وضعیت</th>
                   <th>پذیرش</th>
                    <th>مسئول و اولویت</th>
                    <th>عملیات</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((record) => (
                    <tr key={record.id}>
                      <td>
                        <strong>{record.orderNumber}</strong>
                        <small className="service-cell-note">{record.trackingCode}</small>
                      </td>
                      <td>
                        <strong>{record.productName}</strong>
                        <small className="service-cell-note">{record.serialNumber}</small>
                      </td>
                      <td>
                        {record.customerName}
                        <small className="service-cell-note">{record.customerMobile || 'بدون تلفن'}</small>
                      </td>
                      <td>{warrantyDecisionText(record.warrantyDecision)}</td>
                      <td>
                        <span className={'status-pill service-status-' + record.status}>
                          {serviceStatusText(record.status)}
                        </span>
                      </td>
                     <td>{formatJalaliDateTime(record.receivedAt)}</td>
                      <td><strong>{record.assignedToName ?? 'بدون مسئول'}</strong><small className="service-cell-note">{record.priority === 'urgent' ? 'فوری' : record.priority === 'high' ? 'بالا' : record.priority === 'low' ? 'کم' : 'عادی'}{record.dueAt ? ' · موعد ' + formatJalaliDateTime(record.dueAt) : ''}</small></td>
                      <td>
                        <button
                          className="button secondary"
                          disabled={detailPending}
                          onClick={() => void loadDetail(record.id)}
                          type="button"
                        >
                          <Eye aria-hidden /> مشاهده
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="service-mobile-list">
              {records.map((record) => (
                <article key={record.id}>
                  <header>
                    <div>
                      <strong>پرونده {record.orderNumber}</strong>
                      <span>{record.productName}</span>
                    </div>
                    <span className={'status-pill service-status-' + record.status}>
                      {serviceStatusText(record.status)}
                    </span>
                  </header>
                  <dl>
                    <div><dt>سریال</dt><dd>{record.serialNumber}</dd></div>
                    <div><dt>مشتری</dt><dd>{record.customerName}</dd></div>
                    <div><dt>گارانتی</dt><dd>{warrantyDecisionText(record.warrantyDecision)}</dd></div>
                   <div><dt>پذیرش</dt><dd>{formatJalaliDateTime(record.receivedAt)}</dd></div>
                    <div><dt>مسئول</dt><dd>{record.assignedToName ?? 'بدون مسئول'}</dd></div>
                    <div><dt>اولویت</dt><dd>{record.priority === 'urgent' ? 'فوری' : record.priority === 'high' ? 'بالا' : record.priority === 'low' ? 'کم' : 'عادی'}</dd></div>
                  </dl>
                  <button
                    className="button secondary"
                    disabled={detailPending}
                    onClick={() => void loadDetail(record.id)}
                    type="button"
                  >
                    <Eye aria-hidden /> مشاهده پرونده
                  </button>
                </article>
              ))}
            </div>
            <Pager
              offset={offset}
              onPage={setOffset}
              pageSize={PAGE_SIZE}
              pending={pending}
              returned={records.length}
            />
          </>
        )}
      </section>

      {detailPending && !selected ? (
        <div className="table-card"><div className="empty-state">در حال دریافت جزئیات پرونده…</div></div>
      ) : selected ? (
        <ServiceOrderDetailPanel
          amountUnit={amountUnit}
          canAttach={canAttach}
          canDeliver={canDeliver}
          canRejectWarranty={canRejectWarranty}
          canRepair={canRepair}
          canUseTreasury={canUseTreasury}
          key={selected.id}
          onClose={() => setSelected(null)}
          onReload={reloadSelected}
          options={options}
          order={selected}
        />
      ) : null}
    </div>
  );
}
