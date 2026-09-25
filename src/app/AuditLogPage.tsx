import {RefreshCw, X} from 'lucide-react';
import {useCallback, useEffect, useState} from 'react';
import {api, errorMessage} from './api.js';
import {ActionFeedback} from './MasterDataUi.js';
import {appHelp} from './help-content.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import './user-management.css';

type AuditItem = {
  id: string; userId: string | null; userName: string | null; username: string | null;
  action: string; module: string; entityType: string; entityId: string | null;
  outcome: 'success' | 'failure'; errorCode: string | null; ipAddress: string | null;
  createdAt: string; device: string | null;
};
type AuditResponse = {items: AuditItem[]; page: number; pageSize: number; total: number; totalPages: number};

const moduleTitles: Record<string, string> = {
  system: 'سامانه و مدیریت', auth: 'ورود و امنیت', accounting: 'حسابداری', treasury: 'خزانه',
  parties: 'طرف‌حساب‌ها', inventory: 'انبار و کالا', purchase: 'خرید', sales: 'فروش',
  production: 'تولید', service: 'خدمات و گارانتی', reports: 'گزارش‌ها',
};
function formatDate(value: string): string {
  return new Intl.DateTimeFormat('fa-IR', {dateStyle: 'short', timeStyle: 'medium'}).format(new Date(value));
}
function actionLabel(action: string, errorCode: string | null): string {
  if (errorCode === 'ACCOUNT_TEMPORARILY_LOCKED') return 'قفل موقت ورود';
  if (errorCode === 'ACCOUNT_INACTIVE') return 'ورود حساب غیرفعال';
  const labels: Record<string, string> = {
    'user.activate': 'رفع قفل / فعال‌سازی کاربر', 'user.deactivate': 'غیرفعال‌سازی کاربر',
    'session.revoke': 'بستن نشست', 'session.revoke_all': 'خروج از همه دستگاه‌ها',
    'user.profile.update': 'ویرایش حساب کاربر', 'auth.login': 'ورود', 'auth.logout': 'خروج',
  };
  return labels[action] ?? action;
}

export function AuditLogPage({permissions}: {permissions: readonly string[]}) {
  const canView = permissions.includes('system.audit.view');
  const [data, setData] = useState<AuditResponse>({items: [], page: 1, pageSize: 30, total: 0, totalPages: 0});
  const [filters, setFilters] = useState({from: '', to: '', userId: '', ip: '', action: '', module: 'all', outcome: 'all'});
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView) return;
    setPending(true); setError(null);
    try {
      const params = new URLSearchParams({page: String(page), pageSize: '30'});
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.userId.trim()) params.set('userId', filters.userId.trim());
      if (filters.ip.trim()) params.set('ip', filters.ip.trim());
      if (filters.action.trim()) params.set('action', filters.action.trim());
      if (filters.module !== 'all') params.set('module', filters.module);
      if (filters.outcome !== 'all') params.set('outcome', filters.outcome);
      setData(await api<AuditResponse>('/api/audit?' + params.toString()));
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setPending(false); }
  }, [canView, filters, page]);
  useEffect(() => { void load(); }, [load]);

  if (!canView) return <section className="content-page"><div className="empty-state">مجوز مشاهده سابقه عملیات برای شما فعال نیست.</div></section>;
  return <section className="content-page user-management-page audit-page">
    <header className="page-heading compact"><ContextHelpButton help={appHelp.auditLog} /><div><p>ثبت append-only تغییرات مهم سامانه با حذف اطلاعات حساس</p><h1>گزارش سابقه عملیات</h1></div></header>
    <ActionFeedback error={error} success={null} />
    <div className="audit-filter-card">
      <label className="field"><span>از زمان</span><input type="datetime-local" value={filters.from} onChange={(event) => setFilters({...filters, from: event.currentTarget.value})} /></label>
      <label className="field"><span>تا زمان</span><input type="datetime-local" value={filters.to} onChange={(event) => setFilters({...filters, to: event.currentTarget.value})} /></label>
      <label className="field"><span>شناسه کاربر</span><input dir="ltr" value={filters.userId} onChange={(event) => setFilters({...filters, userId: event.currentTarget.value})} /></label>
      <label className="field"><span>IP</span><input dir="ltr" value={filters.ip} onChange={(event) => setFilters({...filters, ip: event.currentTarget.value})} /></label>
      <label className="field"><span>عملیات</span><input value={filters.action} onChange={(event) => setFilters({...filters, action: event.currentTarget.value})} /></label>
      <label className="field"><span>بخش</span><select value={filters.module} onChange={(event) => setFilters({...filters, module: event.currentTarget.value})}><option value="all">همه بخش‌ها</option>{Object.entries(moduleTitles).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="field"><span>نتیجه</span><select value={filters.outcome} onChange={(event) => setFilters({...filters, outcome: event.currentTarget.value})}><option value="all">همه نتایج</option><option value="success">موفق</option><option value="failure">ناموفق</option></select></label>
      <button className="button primary audit-filter-button" onClick={() => setPage(1)} type="button"><RefreshCw aria-hidden /> اعمال فیلتر</button>
    </div>
    <div className="table-card user-table audit-table">{pending ? <div className="empty-state">در حال دریافت سابقه…</div> : data.items.length === 0 ? <div className="empty-state">در حال حاضر داده‌ای برای نمایش وجود ندارد.</div> : <div className="table-scroll"><table><thead><tr><th>زمان</th><th>کاربر</th><th>عملیات</th><th>بخش</th><th>رکورد</th><th>IP</th><th>دستگاه</th><th>نتیجه</th></tr></thead><tbody>{data.items.map((item) => <tr key={item.id}><td>{formatDate(item.createdAt)}</td><td><span className="device-cell">{item.userName ?? 'سیستم'}<small dir="ltr">{item.username ?? '—'}</small></span></td><td>{actionLabel(item.action, item.errorCode)}</td><td>{moduleTitles[item.module] ?? item.module}</td><td dir="ltr">{item.entityType + (item.entityId ? ' / ' + item.entityId.slice(0, 8) : '')}</td><td dir="ltr">{item.ipAddress ?? '—'}</td><td>{item.device ?? 'دستگاه نامشخص'}</td><td><span className={'audit-outcome ' + item.outcome}>{item.outcome === 'success' ? 'موفق' : 'ناموفق'}</span></td></tr>)}</tbody></table></div>}</div>
    <div className="audit-pagination"><button className="button secondary" disabled={pending || page <= 1} onClick={() => setPage((value) => value - 1)} type="button">صفحه قبل</button><span>صفحه {data.page} از {Math.max(data.totalPages, 1)} · {data.total.toLocaleString('fa-IR')} رویداد</span><button className="button secondary" disabled={pending || page >= data.totalPages} onClick={() => setPage((value) => value + 1)} type="button">صفحه بعد</button></div>
  </section>;
}
