import {useState, useCallback, type FormEvent} from 'react';
import {postJson, errorMessage} from './api.js';
import {ServiceIntakePrint, type ServiceIntakePrintData} from './ServiceIntakePrint.js';
import type {ServiceOrderDetail, ServiceOptions} from './service.types.js';

export function ServiceExitPanel({order, options, canLocate, canDeliver, onReload}: {order:ServiceOrderDetail; options:ServiceOptions; canLocate:boolean; canDeliver:boolean; onReload:()=>Promise<void>}) {
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);
  const [success,setSuccess]=useState<string|null>(null);
  const [print,setPrint]=useState<ServiceIntakePrintData|null>(null);
  const finishPrint=useCallback(()=>setPrint(null),[]);
  const location=[...order.events].reverse().find(event=>event.eventType==='location_changed')?.description;
  async function submit(event:FormEvent<HTMLFormElement>, exit:boolean) {
    event.preventDefault(); if(busy)return;
    const form=new FormData(event.currentTarget);
    if(exit && !window.confirm('دستگاه بدون تعمیر به تحویل‌گیرنده بازگردانده و پرونده بسته شود؟'))return;
    setBusy(true);setError(null);setSuccess(null);
    try {
      await postJson('/api/service/orders/'+order.id+(exit?'/return-unrepaired':'/location'),exit?{reason:String(form.get('reason')),receiver:String(form.get('receiver')),mobile:String(form.get('mobile')),rowVersion:order.rowVersion}:{location:String(form.get('location')),rowVersion:order.rowVersion});
      await onReload();setSuccess(exit?'خروج بدون تعمیر با مشخصات تحویل‌گیرنده ثبت شد.':'محل دستگاه ثبت شد.');
    }catch(caught){setError(errorMessage(caught))}finally{setBusy(false)}
  }
  function reprint() {
    setPrint({companyName:order.company_name ?? '',branchName:order.branchName,orderNumber:order.orderNumber,trackingCode:order.trackingCode,receivedAt:order.receivedAt,customerName:order.customerName,customerMobile:order.customerMobile,productName:order.productName,serialNumber:order.serialNumber,complaint:order.complaint,intakeCondition:order.intakeCondition,receivedAccessories:order.receivedAccessories,warrantyLabel:order.warrantyDecision==='in_warranty'?'تحت گارانتی':'خارج از گارانتی',paperSize:options.outputSettings?.paperSize??'A4',printReceipt:true,printDeviceLabel:true});
  }
  return <section className="service-action-panel">
    <h3 style={{textAlign:'center'}}>محل دستگاه و خروج</h3>
    <p>محل فعلی: {location??'ثبت نشده'}</p>
    {error?<div className="form-message error" role="alert">{error}</div>:null}
    {success?<div className="form-message success" role="status">{success}</div>:null}
    <button className="button secondary" onClick={reprint} disabled={!!print} type="button">چاپ مجدد رسید و برچسب</button>
    {print?<ServiceIntakePrint data={print} onFinished={finishPrint}/>:null}
    {canLocate&&!['delivered','cancelled'].includes(order.status)?<form onSubmit={e=>void submit(e,false)} className="form-grid"><label className="field"><span>قفسه، میز یا محل نگهداری *</span><input name="location" defaultValue={location??''} minLength={2} maxLength={300} required/></label><div className="form-actions"><button className="button secondary" disabled={busy}>ثبت محل دستگاه</button></div></form>:null}
    {canDeliver&&!order.deliveredAt&&order.status!=='ready_delivery'?<details><summary>خروج بدون تعمیر</summary><form onSubmit={e=>void submit(e,true)} className="form-grid"><label className="field"><span>نام تحویل‌گیرنده *</span><input name="receiver" defaultValue={order.customerName} minLength={2} maxLength={180} required/></label><label className="field"><span>تلفن تحویل‌گیرنده</span><input name="mobile" defaultValue={order.customerMobile??''} maxLength={30}/></label><label className="field full"><span>دلیل خروج: انصراف، عدم تأیید هزینه یا تعمیرناپذیری *</span><textarea name="reason" minLength={3} maxLength={2000} required/></label><button className="button danger" disabled={busy}>ثبت خروج بدون تعمیر</button></form></details>:null}
  </section>;
}
