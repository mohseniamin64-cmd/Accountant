import {ClipboardList, Eye, KeyRound, LogOut, Pencil, Plus, ShieldCheck, UserCog, UserRoundPlus, X} from 'lucide-react';
import {useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {Link} from 'react-router-dom';
import {api, errorMessage, postJson} from './api.js';
import {ActionFeedback, StatusPill} from './MasterDataUi.js';
import {appHelp} from './help-content.js';
import {ContextHelpButton} from './ContextHelpButton.js';
import './user-management.css';

type Permission = {code: string; module: string; title: string};
type Role = {id: string; code: string; name: string; description: string | null; isSystem: boolean; isActive: boolean; rowVersion: number; permissionCodes: string[]};
type UserRecord = {
  id: string; fullName: string; username: string; preferredAmountUnit: 'IRR' | 'TOMAN';
  isActive: boolean; accountStatus: 'active' | 'inactive' | 'archived'; lastLoginAt: string | null;
  lastSeenAt: string | null; lastIp: string | null; activeSessionCount: number; online: boolean;
  device: string | null; rowVersion: number; roles: Array<{id: string; code: string; name: string}>;
};
type SessionRecord = {
  id: string; createdAt: string; lastSeenAt: string; expiresAt: string; idleExpiresAt: string;
  revokedAt: string | null; ipAddress: string | null; active: boolean; current: boolean; device: string | null;
};
type RolesResponse = {roles: Role[]; permissionCatalog: Permission[]};
type DialogAction = {kind: 'status' | 'revoke-all'; user: UserRecord};

const moduleTitles: Record<string, string> = {
  system: 'سامانه و مدیریت', accounting: 'حسابداری', treasury: 'خزانه', parties: 'طرف‌حساب‌ها',
  inventory: 'انبار و کالا', purchase: 'خرید', sales: 'فروش', production: 'تولید',
  service: 'خدمات و گارانتی', reports: 'گزارش‌ها',
};
function permissionGroups(catalog: Permission[]) {
  return [...new Map(catalog.map((item) => [item.module, catalog.filter((entry) => entry.module === item.module)])).entries()];
}
function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fa-IR', {dateStyle: 'short', timeStyle: 'short'}).format(new Date(value));
}
function accountStatusLabel(user: UserRecord): string {
  if (user.accountStatus === 'archived') return 'بایگانی‌شده';
  return user.isActive ? 'فعال' : 'غیرفعال';
}

export function UserManagementPage({permissions}: {permissions: readonly string[]}) {
  const canManageUsers = permissions.includes('system.users.manage');
  const canManageRoles = permissions.includes('system.roles.manage');
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [catalog, setCatalog] = useState<Permission[]>([]);
  const [mode, setMode] = useState<'users' | 'roles'>('users');
  const [showUserForm, setShowUserForm] = useState(false);
  const [userFormDirty, setUserFormDirty] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const userFormRef = useRef<HTMLFormElement>(null);
  const userFormReturnFocusRef = useRef<HTMLElement | null>(null);
  const userModalTitleId = useId();
  const userModalDescriptionId = useId();
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [resetUser, setResetUser] = useState<UserRecord | null>(null);
  const [actionDialog, setActionDialog] = useState<DialogAction | null>(null);
  const [sessionsUser, setSessionsUser] = useState<UserRecord | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [sessionsPending, setSessionsPending] = useState(false);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlineFilter, setOnlineFilter] = useState('all');
  const [pending, setPending] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [fullNameWarning, setFullNameWarning] = useState<string | null>(null);
  const groups = useMemo(() => permissionGroups(catalog), [catalog]);

  const load = useCallback(async () => {
    setPending(true); setError(null);
    try {
      const jobs: Promise<unknown>[] = [
        canManageUsers ? api<UserRecord[]>('/api/users') : Promise.resolve([]),
        canManageRoles ? api<RolesResponse>('/api/roles') : Promise.resolve({roles: [], permissionCatalog: []}),
      ];
      const [nextUsers, roleData] = await Promise.all(jobs) as [UserRecord[], RolesResponse];
      setUsers(nextUsers.map((user) => ({
        ...user,
        accountStatus: user.accountStatus === 'archived'
          ? 'archived'
          : user.isActive
            ? 'active'
            : 'inactive',
        activeSessionCount: Number(user.activeSessionCount ?? 0),
        online: user.online === true,
      })));
      setRoles(roleData.roles); setCatalog(roleData.permissionCatalog);
    } catch (caught) { setError(errorMessage(caught)); }
    finally { setPending(false); }
  }, [canManageRoles, canManageUsers]);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!canManageUsers || mode !== 'users') return undefined;
    const refreshUsers = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const interval = window.setInterval(refreshUsers, 30_000);
    document.addEventListener('visibilitychange', refreshUsers);
    window.addEventListener('focus', refreshUsers);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshUsers);
      window.removeEventListener('focus', refreshUsers);
    };
  }, [canManageUsers, load, mode]);

  useEffect(() => {
    if (!showUserForm && !discardDialogOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const opener = userFormReturnFocusRef.current;
    document.body.style.overflow = 'hidden';
    const focusFrame = window.requestAnimationFrame(() => {
      userFormRef.current?.querySelector<HTMLInputElement>('input[name="fullName"]')?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || saving) return;
      event.preventDefault();
      if (discardDialogOpen) setDiscardDialogOpen(false);
      else closeUserForm();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
      if (!showUserForm && !discardDialogOpen) window.requestAnimationFrame(() => opener?.focus());
    };
  }, [discardDialogOpen, saving, showUserForm]);
  useEffect(() => {
    const hasModal = Boolean(actionDialog || sessionsUser || resetUser);
    if (!hasModal) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || saving) return;
      setActionDialog(null); setSessionsUser(null); setResetUser(null); setModalError(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); };
  }, [actionDialog, resetUser, saving, sessionsUser]);

  function openUserForm(): void {
    userFormReturnFocusRef.current = document.activeElement as HTMLElement | null;
    setFullNameWarning(null);
    setModalError(null);
    setUserFormDirty(false);
    setDiscardDialogOpen(false);
    setShowUserForm(true);
  }

  function closeUserForm(force = false): void {
    if (saving) return;
    if (!force && userFormDirty) {
      setDiscardDialogOpen(true);
      return;
    }
    setDiscardDialogOpen(false);
    setShowUserForm(false);
    setUserFormDirty(false);
    setFullNameWarning(null);
    setModalError(null);
  }

  function discardUserForm(): void {
    setDiscardDialogOpen(false);
    setShowUserForm(false);
    setUserFormDirty(false);
    setFullNameWarning(null);
    setModalError(null);
  }

  function handleUserModalKeyDown(event: ReactKeyboardEvent<HTMLFormElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeUserForm();
    }
  }
  async function checkFullNameAvailability(fullName: string): Promise<boolean> {
    const trimmed = fullName.trim();
    if (trimmed.length < 2) return true;
    try {
      const result = await api<{available: boolean}>('/api/users/name-availability?fullName=' + encodeURIComponent(trimmed));
      setFullNameWarning(result.available ? null : 'این نام از قبل برای کاربر دیگری ثبت شده است.');
      return result.available;
    } catch { return true; }
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const roleIds = form.getAll('roleId').map(String);
    if (!roleIds.length) { setError('حداقل یک نقش برای کاربر انتخاب کنید.'); return; }
    if (!(await checkFullNameAvailability(String(form.get('fullName') ?? '')))) { setError('نام کاربر تکراری است.'); return; }
    setSaving(true); setError(null); setSuccess(null);
    try {
      await postJson('/api/users', {fullName: form.get('fullName'), username: form.get('username'), password: form.get('password'), preferredAmountUnit: form.get('amountUnit'), roleIds});
      formElement.reset(); setShowUserForm(false); setDiscardDialogOpen(false); setUserFormDirty(false); setSuccess('کاربر ساخته شد؛ در نخستین ورود باید رمز شخصی خود را تغییر دهد.'); await load();
    } catch (caught) { setError(errorMessage(caught)); } finally { setSaving(false); }
  }

  async function saveRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving || !canManageRoles) return;
    const form = new FormData(event.currentTarget);
    const roleData = {name: String(form.get('name') ?? ''), description: String(form.get('description') ?? '') || null, permissionCodes: form.getAll('permissionCode').map(String), isActive: form.get('isActive') === 'on', ...(editingRole?.isSystem ? {} : {code: String(form.get('code') ?? '')})};
    setSaving(true); setError(null); setSuccess(null);
    try {
      if (editingRole?.id) await postJson('/api/roles/' + editingRole.id, {...roleData, rowVersion: editingRole.rowVersion}, 'PATCH');
      else await postJson('/api/roles', roleData);
      setEditingRole(null); setSuccess('نقش و مجوزهای آن ذخیره شد.'); await load();
    } catch (caught) { setError(errorMessage(caught)); } finally { setSaving(false); }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!resetUser || saving) return;
    const password = String(new FormData(event.currentTarget).get('password') ?? '');
    setSaving(true); setModalError(null);
    try { await postJson('/api/users/' + resetUser.id + '/reset-password', {password}); setResetUser(null); setSuccess('رمز موقت جدید تعیین شد.'); }
    catch (caught) { setModalError(errorMessage(caught)); } finally { setSaving(false); }
  }

  async function submitAction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!actionDialog || saving) return;
    const reason = String(new FormData(event.currentTarget).get('reason') ?? '').trim();
    setSaving(true); setModalError(null); setError(null); setSuccess(null);
    try {
      if (actionDialog.kind === 'status') {
        await postJson('/api/users/' + actionDialog.user.id + '/status', {
          status: actionDialog.user.isActive ? 'inactive' : 'active',
          ...(reason ? {reason} : {}), rowVersion: actionDialog.user.rowVersion,
        }, 'PATCH');
        setSuccess(actionDialog.user.isActive ? 'کاربر غیرفعال شد.' : 'کاربر فعال شد.');
      } else {
        const result = await postJson<{revokedSessions: number}>('/api/users/' + actionDialog.user.id + '/sessions/revoke-all', {reason: reason || 'خروج توسط مدیر'});
        setSuccess(String(result.revokedSessions) + ' نشست کاربر بسته شد.');
      }
      setActionDialog(null); await load();
    } catch (caught) { setModalError(errorMessage(caught)); } finally { setSaving(false); }
  }

  async function openSessions(user: UserRecord) {
    setSessionsUser(user); setSessions([]); setModalError(null); setSessionsPending(true);
    try { setSessions(await api<SessionRecord[]>('/api/users/' + user.id + '/sessions')); }
    catch (caught) { setModalError(errorMessage(caught)); }
    finally { setSessionsPending(false); }
  }

  async function revokeSession(session: SessionRecord) {
    if (!sessionsUser || saving || !session.active) return;
    setSaving(true); setModalError(null);
    try {
      await postJson('/api/users/' + sessionsUser.id + '/sessions/' + session.id + '/revoke', {reason: 'خروج توسط مدیر'});
      setSuccess('نشست انتخاب‌شده بسته شد.'); await openSessions(sessionsUser); await load();
    } catch (caught) { setModalError(errorMessage(caught)); } finally { setSaving(false); }
  }

  const filteredUsers = users.filter((user) => {
    const haystack = (user.fullName + ' ' + user.username + ' ' + (user.lastIp ?? '')).toLocaleLowerCase();
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLocaleLowerCase());
    const matchesRole = roleFilter === 'all' || user.roles.some((role) => role.id === roleFilter);
    const matchesStatus = statusFilter === 'all' || user.accountStatus === statusFilter;
    const matchesOnline = onlineFilter === 'all' || (onlineFilter === 'online' ? user.online : !user.online);
    return matchesQuery && matchesRole && matchesStatus && matchesOnline;
  });

  if (!canManageUsers && !canManageRoles) return <section className="content-page"><div className="empty-state">مجوز مدیریت کاربران یا نقش‌ها برای شما فعال نیست.</div></section>;
  const selectedPermissions = new Set(editingRole?.permissionCodes ?? []);
  return <section className="content-page user-management-page">
    <header className="page-heading compact"><ContextHelpButton help={appHelp.userManagement} /><div><p>حساب‌های ورود، نشست‌های فعال و محدوده عملیات هر نقش</p><h1>کاربران و سطح دسترسی</h1></div></header>
    <ActionFeedback error={error} success={success} />
    <div className="user-management-tabs">
      {canManageUsers && <button className={mode === 'users' ? 'active' : ''} onClick={() => setMode('users')} type="button"><UserCog aria-hidden /> کاربران</button>}
      {canManageRoles && <button className={mode === 'roles' ? 'active' : ''} onClick={() => setMode('roles')} type="button"><ShieldCheck aria-hidden /> نقش‌ها و مجوزها</button>}
    </div>
    {mode === 'users' && canManageUsers ? <>
      <div className="user-page-actions">
        <div className="user-management-actions" aria-label="کلیدهای مدیریتی">
          <button className="button primary management-action management-action--new" onClick={openUserForm} type="button"><UserRoundPlus aria-hidden /> کاربر جدید</button>
          {permissions.includes('system.audit.view') ? (
            <Link className="button secondary management-action management-action--audit" to="/audit"><ClipboardList aria-hidden /> گزارش لاگ امنیتی</Link>
          ) : (
            <button className="button secondary management-action" disabled title="مجوز مشاهده گزارش لاگ امنیتی را ندارید" type="button"><ClipboardList aria-hidden /> گزارش لاگ امنیتی</button>
          )}
          <button className="button secondary management-action management-action--sessions management-action--disabled" disabled title="نشست‌های فعال از داخل هر ردیف کاربر قابل مشاهده است" type="button"><Eye aria-hidden /> نشست‌های فعال <small>از جدول کاربران</small></button>
          {permissions.includes('system.settings.manage') ? (
            <Link className="button secondary management-action management-action--security" to="/settings"><KeyRound aria-hidden /> تنظیمات امنیتی</Link>
          ) : (
            <button className="button secondary management-action" disabled title="مجوز مدیریت تنظیمات امنیتی را ندارید" type="button"><KeyRound aria-hidden /> تنظیمات امنیتی</button>
          )}
        </div>
      </div>
      <div className="user-filter-card">
        <label className="field"><span>جستجوی نام، نام کاربری یا IP</span><input value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="جستجو کنید…" /></label>
        <label className="field"><span>نقش</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.currentTarget.value)}><option value="all">همه نقش‌ها</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
        <label className="field"><span>وضعیت حساب</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.currentTarget.value)}><option value="all">همه وضعیت‌ها</option><option value="active">فعال</option><option value="inactive">غیرفعال</option><option value="archived">بایگانی‌شده</option></select></label>
        <label className="field"><span>وضعیت اتصال</span><select value={onlineFilter} onChange={(event) => setOnlineFilter(event.currentTarget.value)}><option value="all">همه</option><option value="online">آنلاین</option><option value="offline">آفلاین</option></select></label>
      </div>
      <div className="table-card user-table">{pending ? <div className="empty-state">در حال دریافت کاربران…</div> : filteredUsers.length === 0 ? <div className="empty-state">کاربری مطابق فیلترها پیدا نشد.</div> : <div className="table-scroll"><table><thead><tr><th>نام</th><th>نام کاربری</th><th>نقش</th><th>وضعیت</th><th>اتصال</th><th>آخرین فعالیت</th><th>IP / دستگاه</th><th>نشست‌ها</th><th>عملیات</th></tr></thead><tbody>{filteredUsers.map((user) => <tr key={user.id}><td>{user.fullName}</td><td dir="ltr">{user.username}</td><td><div className="role-badges">{user.roles.map((role) => <span key={role.id}>{role.name}</span>)}</div></td><td><span className={'account-status account-status-' + user.accountStatus}>{accountStatusLabel(user)}</span></td><td><span className={'online-state ' + (user.online ? 'online' : 'offline')}><i />{user.online ? 'آنلاین' : 'آفلاین'}</span></td><td>{formatDate(user.lastSeenAt ?? user.lastLoginAt)}</td><td><span className="device-cell">{user.lastIp ?? '—'}<small>{user.device ?? 'دستگاه نامشخص'}</small></span></td><td>{user.activeSessionCount}</td><td><div className="row-actions"><button className={'button user-action ' + (user.isActive ? 'user-action--deactivate' : 'user-action--activate')} onClick={() => setActionDialog({kind: 'status', user})} type="button">{user.isActive ? 'غیرفعال' : 'فعال'}</button><button className="button user-action user-action--revoke" onClick={() => setActionDialog({kind: 'revoke-all', user})} type="button"><LogOut aria-hidden /> خروج همه نشست‌ها</button><button className="button user-action user-action--sessions" onClick={() => void openSessions(user)} type="button"><Eye aria-hidden /> نشست‌ها</button><button className="button user-action user-action--password" onClick={() => setResetUser(user)} type="button"><KeyRound aria-hidden /> رمز موقت</button></div></td></tr>)}</tbody></table></div>}</div>
    </> : null}
    {mode === 'roles' && canManageRoles ? <>
      <div className="user-page-actions"><button className="button primary" onClick={() => setEditingRole({id: '', code: '', name: '', description: '', isSystem: false, isActive: true, rowVersion: 1, permissionCodes: []})} type="button"><Plus aria-hidden /> نقش جدید</button></div>
      <div className="role-list">{roles.map((role) => <button className={editingRole?.id === role.id ? 'selected' : ''} key={role.id} onClick={() => setEditingRole(role)} type="button"><strong>{role.name}</strong><small>{role.description ?? 'بدون توضیح'}</small><span>{role.permissionCodes.length} مجوز</span></button>)}</div>
      {editingRole && <form className="form-card role-editor" key={editingRole.id || 'new'} onSubmit={(event) => void saveRole(event)}><div className="form-card-heading"><h2>{editingRole.id ? 'ویرایش نقش' : 'تعریف نقش جدید'}</h2><p>فقط کارهایی را انتخاب کنید که این نقش باید انجام دهد.</p></div><div className="user-form-grid"><label className="field"><span>کد انگلیسی نقش *</span><input defaultValue={editingRole.code} disabled={editingRole.isSystem} dir="ltr" name="code" pattern="[a-z][a-z0-9_]*" required /></label><label className="field"><span>نام نقش *</span><input defaultValue={editingRole.name} name="name" required /></label><label className="field"><span>توضیح نقش</span><input defaultValue={editingRole.description ?? ''} name="description" /></label><label className="check-field"><input defaultChecked={editingRole.isActive} name="isActive" type="checkbox" /><span>نقش فعال است</span></label></div><div className="permission-groups">{groups.map(([module, items]) => <fieldset key={module}><legend>{moduleTitles[module] ?? module}</legend>{items.map((permission) => <label key={permission.code}><input defaultChecked={selectedPermissions.has(permission.code)} name="permissionCode" type="checkbox" value={permission.code} /> {permission.title}</label>)}</fieldset>)}</div><div className="form-actions"><button className="button primary" disabled={saving} type="submit"><Pencil aria-hidden /> ذخیره نقش و مجوزها</button></div></form>}
    </> : null}
    {showUserForm ? createPortal(
      <div className="security-modal-backdrop user-form-modal-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) closeUserForm(); }}>
        <form aria-describedby={userModalDescriptionId} aria-labelledby={userModalTitleId} aria-modal="true" className="security-modal user-form-modal" onChange={() => setUserFormDirty(true)} onInput={() => setUserFormDirty(true)} onKeyDown={handleUserModalKeyDown} onSubmit={(event) => void createUser(event)} ref={userFormRef} role="dialog" tabIndex={-1}>
          <header>
            <div><span id={userModalDescriptionId}>حساب ورود، نقش و سطح دسترسی</span><h2 id={userModalTitleId}>تعریف کاربر جدید</h2></div>
            <button aria-label="بستن فرم کاربر" disabled={saving} onClick={() => closeUserForm()} type="button"><X /></button>
          </header>
          <div className="security-modal-body">
            <ActionFeedback error={modalError ?? error} success={null} />
            <p className="user-modal-intro">رمز موقت فقط برای ورود نخست است و کاربر پس از ورود رمز شخصی تعیین می‌کند.</p>
            <div className="user-form-grid">
              <label className="field"><span>نام و نام خانوادگی *</span><input name="fullName" minLength={2} maxLength={160} onBlur={(event) => void checkFullNameAvailability(event.currentTarget.value)} required />{fullNameWarning ? <small className="field-warning">{fullNameWarning}</small> : null}</label>
              <label className="field"><span>نام کاربری انگلیسی *</span><input dir="ltr" name="username" minLength={3} maxLength={80} pattern="[A-Za-z0-9._-]+" required /></label>
              <label className="field"><span>رمز موقت *</span><input dir="ltr" name="password" minLength={10} type="password" required /></label>
              <label className="field"><span>واحد نمایش مبلغ</span><select defaultValue="IRR" name="amountUnit"><option value="IRR">ریال</option><option value="TOMAN">تومان</option></select></label>
            </div>
            <fieldset className="role-choice"><legend>نقش‌های کاربر *</legend>{roles.filter((role) => role.isActive).map((role) => <label key={role.id}><input name="roleId" type="checkbox" value={role.id} /> <span>{role.name}</span><small>{role.description}</small></label>)}</fieldset>
          </div>
          <footer><button className="button secondary" disabled={saving} onClick={() => closeUserForm()} type="button">انصراف</button><button className="button primary" disabled={saving} type="submit">{saving ? 'در حال ذخیره…' : 'ذخیره کاربر'}</button></footer>
        </form>
      </div>, document.body) : null}
    {discardDialogOpen ? createPortal(
      <div className="security-modal-backdrop user-discard-backdrop">
        <section aria-modal="true" className="security-modal user-discard-modal" role="dialog">
          <header><div><span>تأیید خروج</span><h2>تغییرات ذخیره نشده</h2></div><button aria-label="بازگشت به فرم" onClick={() => setDiscardDialogOpen(false)} type="button"><X /></button></header>
          <div className="security-modal-body"><p className="modal-question">تغییرات واردشده ذخیره نشده است. آیا بدون ذخیره از فرم خارج می‌شوید؟</p></div>
          <footer><button className="button danger" onClick={discardUserForm} type="button">خروج بدون ذخیره</button><button className="button secondary" onClick={() => setDiscardDialogOpen(false)} type="button">ادامه ویرایش</button></footer>
        </section>
      </div>, document.body) : null}    {resetUser ? createPortal(<div className="security-modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && setResetUser(null)}><form className="security-modal" onSubmit={(event) => void resetPassword(event)}><header><div><span>امنیت حساب</span><h2>رمز موقت برای {resetUser.fullName}</h2></div><button aria-label="بستن" onClick={() => setResetUser(null)} type="button"><X /></button></header><div className="security-modal-body"><ActionFeedback error={modalError} success={null} /><label className="field"><span>رمز موقت جدید *</span><input autoFocus dir="ltr" minLength={10} name="password" type="password" required /></label></div><footer><button className="button secondary" onClick={() => setResetUser(null)} type="button">انصراف</button><button className="button primary" disabled={saving} type="submit">ثبت رمز موقت</button></footer></form></div>, document.body) : null}
    {actionDialog ? createPortal(<div className="security-modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && setActionDialog(null)}><form className="security-modal security-action-modal" onSubmit={(event) => void submitAction(event)}><header><div><span>عملیات امنیتی</span><h2>{actionDialog.kind === 'status' ? (actionDialog.user.isActive ? 'غیرفعال‌سازی کاربر' : 'فعال‌سازی کاربر') : 'خروج از همه دستگاه‌ها'}</h2></div><button aria-label="بستن" onClick={() => setActionDialog(null)} type="button"><X /></button></header><div className="security-modal-body"><ActionFeedback error={modalError} success={null} /><p className="modal-question">{actionDialog.kind === 'status' ? 'وضعیت حساب «' + actionDialog.user.fullName + '» تغییر کند؟' : 'همه نشست‌های فعال «' + actionDialog.user.fullName + '» بسته شوند؟'}</p>{actionDialog.kind === 'status' && actionDialog.user.isActive ? <label className="field"><span>دلیل غیرفعال‌سازی</span><textarea name="reason" rows={3} /></label> : null}</div><footer><button className="button secondary" onClick={() => setActionDialog(null)} type="button">انصراف</button><button className={'button ' + (actionDialog.kind === 'status' && actionDialog.user.isActive ? 'danger' : 'primary')} disabled={saving} type="submit">تأیید عملیات</button></footer></form></div>, document.body) : null}
    {sessionsUser ? createPortal(<div className="security-modal-backdrop" onMouseDown={(event) => event.currentTarget === event.target && setSessionsUser(null)}><section className="security-modal sessions-modal"><header><div><span>کنترل نشست‌ها</span><h2>نشست‌های {sessionsUser.fullName}</h2></div><button aria-label="بستن" onClick={() => setSessionsUser(null)} type="button"><X /></button></header><div className="security-modal-body"><ActionFeedback error={modalError} success={null} />{sessionsPending ? <div className="empty-state">در حال دریافت نشست‌ها…</div> : sessions.length === 0 ? <div className="empty-state">نشست فعالی برای این کاربر وجود ندارد.</div> : <div className="sessions-list">{sessions.map((session) => <article className={session.active ? 'session-item active' : 'session-item'} key={session.id}><div><strong>{session.device ?? 'دستگاه نامشخص'}</strong><span>{session.ipAddress ?? 'IP نامشخص'}</span></div><dl><dt>ایجاد</dt><dd>{formatDate(session.createdAt)}</dd><dt>آخرین فعالیت</dt><dd>{formatDate(session.lastSeenAt)}</dd><dt>انقضا</dt><dd>{formatDate(session.expiresAt)}</dd></dl><button className="button secondary" disabled={!session.active || saving} onClick={() => void revokeSession(session)} type="button">{session.current ? 'نشست فعلی' : session.active ? 'خروج از نشست' : 'بسته‌شده'}</button></article>)}</div>}</div><footer><button className="button secondary" onClick={() => setSessionsUser(null)} type="button">بستن</button></footer></section></div>, document.body) : null}
  </section>;
}
