import React, { useState } from 'react';
import { 
  Truck, 
  User, 
  Phone, 
  Cpu, 
  Layers, 
  Hash, 
  UserCheck, 
  Wrench, 
  FileText, 
  Check, 
  Printer, 
  ArrowLeft, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  PenTool,
  Info
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

interface ItemDelivered {
  id: string;
  label: string;
  checked: boolean;
}

export default function P011DeviceHandover() {
  // 1. Dossier Specs Mock Data
  const [dossier] = useState({
    code: 'D-4091',
    customerName: 'کامران هدایتی',
    phone: '۰۹۱۲۳۴۵۶۷۸۹',
    deviceName: 'دستگاه اینورتر تک‌فاز دیاکو مدل ۳۰۰A',
    model: 'DI-300-PRO',
    serialNumber: 'SN-99812-IN',
    receptionist: 'مهندس سهرابی (بخش پذیرش)',
    technician: 'استاد کریمی (ارشد کارگاه کار با فرکانس بالا)',
    outcome: 'موفق - تعویض ماسفت‌های گیت درایور و خازن‌های صافی'
  });

  // 2. Repair Status Option Selection (Green, Yellow, Red)
  type RepairStatusType = 'green' | 'yellow' | 'red';
  const [selectedStatus, setSelectedStatus] = useState<RepairStatusType>('green');

  // 3. Pre-handover Checklist (۶ مورد خواسته شده)
  const [preChecklist, setPreChecklist] = useState<ChecklistItem[]>([
    { id: '1', label: 'تمیزکاری دستگاه انجام شد', checked: true },
    { id: '2', label: 'تمامی پیچها بسته شدند', checked: true },
    { id: '3', label: 'تست نهایی انجام شد', checked: true },
    { id: '4', label: 'قطعات اضافه داخل دستگاه باقی نمانده', checked: true },
    { id: '5', label: 'تمامی لوازم همراه تحویل میشود', checked: false },
    { id: '6', label: 'برچسب گارانتی نصب شد', checked: true }
  ]);

  // 4. Handed over items (۸ مورد خواسته شده)
  const [deliveredItems, setDeliveredItems] = useState<ItemDelivered[]>([
    { id: '1', label: 'آداپتور', checked: false },
    { id: '2', label: 'کابل برق', checked: true },
    { id: '3', label: 'کابل HDMI', checked: false },
    { id: '4', label: 'ریموت', checked: false },
    { id: '5', label: 'باتری', checked: false },
    { id: '6', label: 'دفترچه', checked: true },
    { id: '7', label: 'جعبه', checked: true },
    { id: '8', label: 'سایر', checked: false }
  ]);

  // 5. Handover Remarks state
  const [remarks, setRemarks] = useState<string>(
    'دستگاه پس از تعمیر کامل تست شد و بدون مشکل به طرف حساب تحویل گردید.'
  );

  // Status simulation after submission
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  const handleTogglePreCheck = (id: string) => {
    setPreChecklist(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  const handleToggleDeliveredItem = (id: string) => {
    setDeliveredItems(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  // Helper to convert English digits to Persian in string
  const toPersianNum = (numStr: string | number) => {
    const pDict = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return numStr.toString().replace(/[0-9]/g, (w) => pDict[parseInt(w)]);
  };

  return (
    <div className="space-y-6 text-right pb-24" dir="rtl">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
              <Truck className="w-4.5 h-4.5" />
            </div>
            <span>تحویل دستگاه به طرف حساب</span>
          </h3>
          <p className="text-[10px] text-slate-500 font-bold mt-0.5">
            ثبت نهایی تحویل و بستن پرونده تعمیر
          </p>
        </div>

        {/* Live Badge Status */}
        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-between bg-slate-100 border border-slate-200 rounded-2xl py-1.5 px-3.5">
          <span className="text-[10px] text-slate-500 font-bold">آخرین وضعیت:</span>
          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border flex items-center gap-1.5 ${
            isSubmitted 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-indigo-50 text-indigo-700 border-indigo-200 animate-pulse'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isSubmitted ? 'bg-emerald-500' : 'bg-indigo-500'}`}></span>
            <span>{isSubmitted ? 'تحویل قطعی و بایگانی پرونده' : 'در انتظار تحویل نهایی'}</span>
          </span>
        </div>
      </div>

      {/* بخش اول: مشخصات پرونده */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h4 className="text-sm font-black text-slate-900">۱. مشخصات پرونده پذیرش و گارانتی</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-bold">
          
          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">کد پرونده</span>
            <span className="text-slate-900 font-black font-mono block text-sm">{toPersianNum(dossier.code)}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">نام طرف حساب</span>
            <span className="text-slate-900 font-black block">{dossier.customerName}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">شماره تماس</span>
            <span className="text-slate-900 font-black font-mono block text-sm">{toPersianNum(dossier.phone)}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">نام دستگاه</span>
            <span className="text-slate-900 font-black block">{dossier.deviceName}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">مدل دستگاه</span>
            <span className="text-slate-900 font-black block font-mono">{dossier.model}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">شماره سریال</span>
            <span className="text-slate-900 font-black block font-mono">{dossier.serialNumber}</span>
          </div>

          <div className="bg-indigo-50/30 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-indigo-500/80 font-extrabold block">پذیرش کننده</span>
            <span className="text-slate-800 font-black block">{dossier.receptionist}</span>
          </div>

          <div className="bg-indigo-50/30 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-indigo-500/80 font-extrabold block">تکنسین تعمیر</span>
            <span className="text-slate-800 font-black block">{dossier.technician}</span>
          </div>

          <div className="bg-emerald-50/30 p-3 rounded-2xl space-y-1 col-span-1 sm:col-span-1">
            <span className="text-[10px] text-emerald-600 font-extrabold block">نتیجه تعمیر کارگاه</span>
            <span className="text-emerald-700 font-black block truncate">{dossier.outcome}</span>
          </div>

        </div>
      </div>

      {/* بخش دوم: وضعیت تعمیر (کارت سبز، کارت زرد، کارت قرمز) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <Layers className="w-5 h-5 text-indigo-600" />
          <h4 className="text-sm font-black text-slate-900">۲. تعیین وضعیت فنی زمان تحویل</h4>
        </div>

        <p className="text-[10px] text-slate-400 font-bold leading-normal">
          انتخاب وضعیت فاکتور و نوع خروج دستگاه جهت بروزرسانی فیلدهای آرشیو سامانه:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Green Card - تعمیر کامل انجام شد */}
          <button
            type="button"
            onClick={() => setSelectedStatus('green')}
            className={`p-4.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-4 cursor-pointer relative overflow-hidden group ${
              selectedStatus === 'green'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <CheckCircle2 className={`w-6 h-6 ${selectedStatus === 'green' ? 'text-white' : 'text-emerald-500'}`} />
              {selectedStatus === 'green' && <Check className="w-4 h-4 text-white stroke-[3.5]" />}
            </div>
            <div>
              <span className="text-xs font-black block">✓ تعمیر کامل انجام شد</span>
              <span className={`text-[9px] font-bold mt-1 block leading-tight ${selectedStatus === 'green' ? 'text-emerald-100' : 'text-slate-400'}`}>
                بورد با موفقیت احیا و رفع عیب کامل شد
              </span>
            </div>
          </button>

          {/* Yellow Card - تحویل با توضیحات */}
          <button
            type="button"
            onClick={() => setSelectedStatus('yellow')}
            className={`p-4.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-4 cursor-pointer relative overflow-hidden group ${
              selectedStatus === 'yellow'
                ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-100'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <AlertTriangle className={`w-6 h-6 ${selectedStatus === 'yellow' ? 'text-white' : 'text-amber-500'}`} />
              {selectedStatus === 'yellow' && <Check className="w-4 h-4 text-white stroke-[3.5]" />}
            </div>
            <div>
              <span className="text-xs font-black block">تحویل با توضیحات</span>
              <span className={`text-[9px] font-bold mt-1 block leading-tight ${selectedStatus === 'yellow' ? 'text-amber-100' : 'text-slate-400'}`}>
                به صورت نیمه‌کاره یا با شروط فنی خاص تحویل می‌گردد
              </span>
            </div>
          </button>

          {/* Red Card - تحویل بدون تعمیر */}
          <button
            type="button"
            onClick={() => setSelectedStatus('red')}
            className={`p-4.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-4 cursor-pointer relative overflow-hidden group ${
              selectedStatus === 'red'
                ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-100'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <XCircle className={`w-6 h-6 ${selectedStatus === 'red' ? 'text-white' : 'text-rose-500'}`} />
              {selectedStatus === 'red' && <Check className="w-4 h-4 text-white stroke-[3.5]" />}
            </div>
            <div>
              <span className="text-xs font-black block">تحویل بدون تعمیر</span>
              <span className={`text-[9px] font-bold mt-1 block leading-tight ${selectedStatus === 'red' ? 'text-rose-100' : 'text-slate-400'}`}>
                غیرقابل تعمیر یا عدم موافقت طرف حساب با هزینه تعمیر
              </span>
            </div>
          </button>

        </div>
      </div>

      {/* بخش سوم: چک لیست قبل از تحویل */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-indigo-600" />
            <h4 className="text-sm font-black text-slate-900">۳. چک لیست بررسی‌های قبل از تحویل قطعه</h4>
          </div>
          <span className="text-[10px] text-slate-400 font-extrabold bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-150">
            تایید شده: {toPersianNum(preChecklist.filter(item => item.checked).length)} از {toPersianNum(preChecklist.length)}
          </span>
        </div>

        <p className="text-[10px] text-slate-400 font-bold leading-normal">
          اقدامات کنترلی الزامی کارگاه قبل از جاسازی قطعه در جعبه و قرار دادن در پیشخوان تحویل:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {preChecklist.map((item) => (
            <label 
              key={item.id}
              className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                item.checked 
                  ? 'bg-indigo-50/40 border-indigo-100 text-slate-900 font-extrabold' 
                  : 'bg-slate-50/50 border-slate-100 text-slate-500 font-medium hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input 
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleTogglePreCheck(item.id)}
                  className="w-4.5 h-4.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs">{item.label}</span>
              </div>
              {item.checked ? (
                <Check className="w-4 h-4 text-indigo-600 stroke-[3.5] shrink-0" />
              ) : (
                <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0"></span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* بخش چهارم: اقلام تحویلی */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h4 className="text-sm font-black text-slate-900">۴. اقلام و لوازم جانبی همراه تحویلی</h4>
          </div>
          <span className="text-[10px] text-slate-400 font-extrabold bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-150">
            تعداد لوازم: {toPersianNum(deliveredItems.filter(item => item.checked).length)} مورد
          </span>
        </div>

        <p className="text-[10px] text-slate-400 font-bold leading-normal">
          تیک زدن کلیه متعلقاتی که به همراه شاسی اصلی تحویل طرف حساب می‌شود تا از مفقودی جلوگیری گردد:
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {deliveredItems.map((item) => (
            <label 
              key={item.id}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                item.checked 
                  ? 'bg-indigo-50/20 border-indigo-100 text-slate-900 font-extrabold' 
                  : 'bg-slate-50/30 border-slate-150 text-slate-400 font-medium hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleToggleDeliveredItem(item.id)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span className="text-xs">{item.label}</span>
              </div>
              {item.checked && (
                <Check className="w-3.5 h-3.5 text-indigo-600 stroke-[3]" />
              )}
            </label>
          ))}
        </div>
      </div>

      {/* بخش پنجم: توضیح هنگام تحویل */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h4 className="text-sm font-black text-slate-900">۵. توضیحات و ملاحظات تحویل قطعه</h4>
        </div>

        <p className="text-[10px] text-slate-400 font-bold leading-normal">
          ثبت اظهارات یا تذکرات لازم مانند شرایط استفاده بهینه از منبع تغذیه، بازه زمانی گارانتی ماسفت جدید و غیره:
        </p>

        <textarea
          rows={4}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="w-full p-4 bg-slate-50/50 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-2xl text-xs font-bold outline-none leading-relaxed transition-all resize-none shadow-inner"
          placeholder="شرح و توضیحات نهایی تحویل به طرف حساب..."
        />
      </div>

      {/* بخش ششم: امضای طرف حساب */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <PenTool className="w-5 h-5 text-indigo-600" />
          <h4 className="text-sm font-black text-slate-900">۶. تایید دریافت فیزیکی و امضای الکترونیک طرف حساب</h4>
        </div>

        <p className="text-[10px] text-slate-400 font-bold leading-normal">
          محل ترسیم امضا روی صفحه نمایش لمسی با قلم نوری یا ثبت اثر انگشت در سیستم پذیرش:
        </p>

        {/* Signature Box (Placeholder) */}
        <div className="w-full h-40 bg-slate-50/70 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-slate-600 transition-colors p-4 relative group cursor-crosshair overflow-hidden">
          <PenTool className="w-8 h-8 text-slate-300 group-hover:scale-110 transition-transform" />
          <span className="text-xs font-black text-slate-700">محل امضای طرف حساب</span>
          <span className="text-[10px] font-bold text-slate-400">کادر خالی ترسیم امضا جهت بستن قطعی سند در پایگاه دیاکو</span>

          {/* Aesthetic grid grid-pattern for realistic touch area */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px] pointer-events-none" />
        </div>
      </div>

      {/* بخش هفتم: دکمه‌های پایین صفحه */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4">
        
        {/* Print & Back (Secondary Action Group) */}
        <div className="flex items-center gap-3 order-2 sm:order-1">
          <button
            type="button"
            onClick={() => alert('پیش‌نمایش چاپ فیش تحویل آماده شد. ارسال به پرینتر کارگاه حرارتی (Bixolon)')}
            className="flex-1 sm:flex-none px-5 py-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-black rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>چاپ رسید تحویل</span>
          </button>

          <button
            type="button"
            className="px-5 py-3.5 bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 text-xs font-black rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <span>بازگشت</span>
          </button>
        </div>

        {/* Main action: ثبت تحویل دستگاه */}
        <button
          type="button"
          onClick={() => setIsSubmitted(true)}
          className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-200/60 hover:shadow-xl hover:shadow-blue-300/50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 order-1 sm:order-2 group"
        >
          <Check className="w-5 h-5 transition-transform group-hover:scale-110" />
          <span>ثبت تحویل دستگاه</span>
        </button>

      </div>

      {/* Submission simulation alert display */}
      {isSubmitted && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4.5 flex flex-col sm:flex-row items-center gap-4 justify-between animate-fade-in shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-bounce">
              <Check className="w-5 h-5 stroke-[3.5]" />
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-slate-900">سند تحویل با موفقیت در پایانه ثبت شد</p>
              <p className="text-[10.5px] text-emerald-700 font-bold mt-1 leading-normal">
                پرونده گارانتی کد <span className="font-black">{toPersianNum(dossier.code)}</span> به آرشیو انتقالات قطعی کارگاه پیوست. وضعیت به <span className="underline font-black">تحویل شده</span> تغییر یافت.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-emerald-100/50 border border-emerald-200 rounded-xl px-3 py-1.5 text-xs font-black text-emerald-800 tracking-wide font-mono shrink-0">
            <span>تحویل قطعی شد</span>
          </div>
        </div>
      )}

      {/* انتهای صفحه: پیام کوچک خاکستری */}
      <p className="text-center text-[10px] text-slate-400 font-bold pt-4 flex items-center justify-center gap-1.5" id="delivery-demo-disclaimer">
        <Info className="w-3.5 h-3.5 text-slate-300 shrink-0" />
        <span>این صفحه صرفاً نسخه نمایشی رابط کاربری است.</span>
      </p>

    </div>
  );
}
