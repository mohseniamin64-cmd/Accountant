import {useEffect, useState, type FormEvent} from 'react';
import type {AmountUnit} from '../../shared/contracts.js';
import {api, errorMessage, postJson} from './api.js';
import {JalaliDateField} from './JalaliDateField.js';
import {jalaliInputToIso, formatJalaliDateTime} from './jalali-date.js';
import {amountInputToIrr} from './master-data.helpers.js';
import {formatIrrAmount} from './purchase.helpers.js';
import type {ServiceOptions, ServiceOrderDetail} from './service.types.js';

interface Props {order: ServiceOrderDetail; options: ServiceOptions; amountUnit: AmountUnit; onReload: () => Promise<void>}
const priorities = {low: 'کم', normal: 'عادی', high: 'بالا', urgent: 'فوری'} as const;
const costNames = {labor: 'دستمزد', outsourcing: 'خدمات بیرونی', transport: 'حمل‌ونقل', other: 'سایر'} as const;

export function ServiceWorkflowPanel({order, options, amountUnit, onReload}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [replacementWarehouse, setReplacementWarehouse] = useState('');
  const [replacementSerials, setReplacementSerials] = useState<Array<{id: string; serialNumber: string}>>([]);
  useEffect(() => {
    if (!replacementWarehouse || order.replacement) { setReplacementSerials([]); return; }
    let live = true;
    void api<Array<{id: string; serialNumber: string}>>('/api/service/orders/' + order.id + '/replacement-serials?warehouseId=' + encodeURIComponent(replacementWarehouse))
      .then(rows => { if (live) setReplacementSerials(rows); })
      .catch(caught => { if (live) setError(errorMessage(caught)); });
    return () => { live = false; };
  }, [order.id, order.replacement, replacementWarehouse]);
  async function submit(path: string, body: unknown, message: string) {
    if (busy) return;
    setBusy(true); setError(null); setSuccess(null);
    try {await postJson('/api/service/orders/' + order.id + path, body); await onReload(); setSuccess(message)}
    catch (caught) {setError(errorMessage(caught))} finally {setBusy(false)}
  }
  function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const due = String(form.get('dueAt') ?? '');
    void submit('/assignment', {technicianId: String(form.get('technicianId')), priority: String(form.get('priority')), dueAt: due ? jalaliInputToIso(due) + 'T12:00:00.000Z' : null, note: String(form.get('note') ?? '').trim() || null, rowVersion: order.rowVersion}, 'مسئول و اولویت پرونده ثبت شد.');
  }
  function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void submit('/inspections', {inspectionType: String(form.get('inspectionType')), resultStatus: String(form.get('resultStatus')), observedFault: String(form.get('observedFault')).trim(), faultCause: String(form.get('faultCause')).trim() || null, actionTaken: String(form.get('actionTaken')).trim() || null, testResult: String(form.get('testResult')).trim() || null, checklist: {}, rowVersion: order.rowVersion}, 'بررسی فنی در سابقه پرونده ثبت شد.');
  }
  function cost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {void submit('/costs', {costType: String(form.get('costType')), amountIrr: amountInputToIrr(String(form.get('amount')), amountUnit), description: String(form.get('description')).trim()}, 'هزینه واقعی خدمات ثبت شد.')} catch (caught) {setError(errorMessage(caught))}
  }
  const active = !['ready_delivery', 'delivered', 'cancelled'].includes(order.status);
  function replaceDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void submit('/replacement', {newSerialId: String(form.get('newSerialId')), warehouseId: replacementWarehouse, oldSerialDisposition: String(form.get('oldSerialDisposition')), reason: String(form.get('reason')).trim(), rowVersion: order.rowVersion}, 'تعویض دستگاه با حفظ پایان پوشش و سابقه سریال ثبت شد.');
  }
  const inspectionType = ['repairing', 'final_test'].includes(order.status) ? 'final_test' : 'diagnosis';
  return <section className="service-case-workflow">
    <header><h3>کنترل و اجرای پرونده</h3><p>مسئول، بررسی فنی و هزینه‌ها با سابقه واقعی ثبت می‌شوند.</p></header>
    {error ? <div className="form-message error">{error}</div> : null}
    {success ? <div className="form-message success">{success}</div> : null}
    {active ? <div className="service-workflow-forms">
      <form onSubmit={assign}><h4>تخصیص پرونده</h4><label className="field"><span>تعمیرکار *</span><select defaultValue={order.assignedTo ?? ''} name="technicianId" required><option value="">انتخاب تعمیرکار</option>{(options.technicians ?? []).map(t => <option key={t.id} value={t.id}>{t.fullName} ({t.activeCount} پرونده فعال)</option>)}</select></label><label className="field"><span>اولویت *</span><select defaultValue={order.priority ?? 'normal'} name="priority">{Object.entries(priorities).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label><JalaliDateField label="موعد انجام" name="dueAt" /><label className="field"><span>یادداشت</span><input maxLength={2000} name="note" /></label><button className="button secondary" disabled={busy}>ثبت تخصیص</button></form>
      <form onSubmit={inspect}><h4>{inspectionType === 'final_test' ? 'آزمون نهایی' : 'بررسی فنی'}</h4><input name="inspectionType" type="hidden" value={inspectionType}/><label className="field"><span>نتیجه *</span><select name="resultStatus"><option value="passed">موفق</option><option value="conditional">مشروط</option><option value="failed">ناموفق</option></select></label><label className="field"><span>عیب مشاهده‌شده یا موضوع آزمون *</span><textarea minLength={2} maxLength={4000} name="observedFault" required /></label><label className="field"><span>علت عیب</span><textarea maxLength={4000} name="faultCause" /></label><label className="field"><span>اقدام انجام‌شده</span><textarea maxLength={4000} name="actionTaken" /></label><label className="field"><span>شرح نتیجه آزمون</span><textarea maxLength={4000} name="testResult" /></label><button className="button secondary" disabled={busy}>ثبت بررسی</button></form>
      <form onSubmit={cost}><h4>هزینه واقعی</h4><label className="field"><span>نوع هزینه *</span><select name="costType">{Object.entries(costNames).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select></label><label className="field"><span>مبلغ ({amountUnit === 'IRR' ? 'ریال' : 'تومان'}) *</span><input inputMode="numeric" min="1" name="amount" required /></label><label className="field"><span>شرح *</span><textarea minLength={2} maxLength={2000} name="description" required /></label><button className="button secondary" disabled={busy}>ثبت هزینه</button></form>
      {!order.replacement && ['diagnosis','waiting_part','repairing','final_test'].includes(order.status) ? <form onSubmit={replaceDevice}><h4>تعویض دستگاه</h4><label className="field"><span>انبار دستگاه جایگزین *</span><select onChange={event => setReplacementWarehouse(event.target.value)} required value={replacementWarehouse}><option value="">انتخاب انبار</option>{options.warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label><label className="field"><span>سریال جایگزین *</span><select disabled={!replacementWarehouse} name="newSerialId" required><option value="">{replacementWarehouse ? 'انتخاب سریال موجود همان محصول' : 'ابتدا انبار را انتخاب کنید'}</option>{replacementSerials.map(s => <option key={s.id} value={s.id}>{s.serialNumber}</option>)}</select></label><label className="field"><span>وضعیت دستگاه قبلی *</span><select name="oldSerialDisposition"><option value="returned">برگشتی</option><option value="scrapped">اسقاط</option></select></label><label className="field"><span>دلیل تعویض *</span><textarea minLength={3} maxLength={3000} name="reason" required /></label><button className="button danger" disabled={busy}>ثبت تعویض قطعی</button></form> : null}
    </div> : null}
    {order.replacement ? <div className="form-message success">دستگاه {order.replacement.oldSerialNumber} با {order.replacement.newSerialNumber} جایگزین شده است؛ پایان پوشش قبلی حفظ شده است.</div> : null}
    <div className="service-workflow-history">
      <article><h4>سوابق تخصیص</h4>{(order.assignments ?? []).length ? (order.assignments ?? []).map(a => <p key={a.id}><strong>{a.assignedToName}</strong> · {priorities[a.priority as keyof typeof priorities] ?? a.priority}<small>{formatJalaliDateTime(a.createdAt)}</small></p>) : <span>تخصیصی ثبت نشده است.</span>}</article>
      <article><h4>سوابق بررسی فنی</h4>{(order.inspections ?? []).length ? (order.inspections ?? []).map(i => <p key={i.id}><strong>{i.inspectionType === 'final_test' ? 'آزمون نهایی' : 'بررسی فنی'}: {i.resultStatus === 'passed' ? 'موفق' : i.resultStatus === 'failed' ? 'ناموفق' : 'مشروط'}</strong> · {i.observedFault}<small>{i.recordedByName} · {formatJalaliDateTime(i.createdAt)}</small></p>) : <span>بررسی ساختاریافته‌ای ثبت نشده است.</span>}</article>
      <article><h4>هزینه‌های واقعی</h4>{(order.costs ?? []).length ? (order.costs ?? []).map(c => <p key={c.id}><strong>{costNames[c.costType]}: {formatIrrAmount(c.amountIrr, amountUnit)}</strong> · {c.description}<small>{c.recordedByName} · {formatJalaliDateTime(c.createdAt)}</small></p>) : <span>هزینه مستقیمی ثبت نشده است.</span>}</article>
    </div>
  </section>
}
