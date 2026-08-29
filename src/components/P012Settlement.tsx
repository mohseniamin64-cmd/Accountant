import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  User, 
  Cpu, 
  CheckCircle2, 
  Coins, 
  Receipt, 
  Percent, 
  FileText, 
  Printer, 
  ArrowLeft, 
  Check, 
  Info,
  Layers,
  Banknote,
  TrendingDown,
  Calculator,
  UserCheck
} from 'lucide-react';

export default function P012Settlement() {
  // 1. Dossier Specs State
  const [dossier] = useState({
    code: 'D-4091',
    customerName: 'کامران هدایتی',
    deviceName: 'دستگاه اینورتر تک‌فاز دیاکو مدل ۳۰۰A',
    model: 'DI-300-PRO',
    status: 'تکمیل شده'
  });

  // 2. Repair Costs State
  const [wage, setWage] = useState<number>(2450000);
  const [parts, setParts] = useState<number>(1320000);
  const [service, setService] = useState<number>(400000);
  const [extraCost, setExtraCost] = useState<number>(0);

  // 3. Discount State
  const [discountType, setDiscountType] = useState<'percent' | 'cash'>('cash');
  const [discountPercent, setDiscountPercent] = useState<number>(5);
  const [discountCash, setDiscountCash] = useState<number>(200000);

  // 4. Calculations
  const [totalCosts, setTotalCosts] = useState<number>(4170000);
  const [finalDiscount, setFinalDiscount] = useState<number>(200000);
  const [payableAmount, setPayableAmount] = useState<number>(3970000);

  // Recalculate values dynamically when inputs change to make the UI feel alive and premium
  useEffect(() => {
    const sum = wage + parts + service + extraCost;
    setTotalCosts(sum);

    let calculatedDiscount = 0;
    if (discountType === 'percent') {
      calculatedDiscount = Math.round((sum * discountPercent) / 100);
    } else {
      calculatedDiscount = discountCash;
    }
    
    // Ensure discount is not greater than sum
    const actualDiscount = Math.min(calculatedDiscount, sum);
    setFinalDiscount(actualDiscount);
    setPayableAmount(sum - actualDiscount);
  }, [wage, parts, service, extraCost, discountType, discountPercent, discountCash]);

  // 5. Payment Method Selection
  type PaymentMethodType = 'pos' | 'cash' | 'bank' | 'combined';
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodType>('pos');

  // 6. Payment Status Selection
  type PaymentStatusType = 'full' | 'partial' | 'debtor';
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusType>('full');

  // 7. Payment Info (Mock Data)
  const [paymentInfo] = useState({
    invoiceNumber: 'INV-1405-092',
    transactionId: 'TRX-8831092',
    paymentDate: '۱۴۰۵/۰۴/۰۹',
    receiverName: 'مهندس مرادی (بخش صندوق)'
  });

  // 8. Financial Remarks
  const [remarks, setRemarks] = useState<string>(
    'هزینه پس از اعمال تخفیف ویژه دریافت گردید.'
  );

  // Submission Alert State
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Helper to convert English numbers to Persian
  const toPersianNum = (num: number | string) => {
    const pDict = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return num.toString().replace(/[0-9]/g, (w) => pDict[parseInt(w)]);
  };

  // Helper to format currency
  const formatCurrency = (amount: number) => {
    const formatted = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return toPersianNum(formatted);
  };

  return (
    <div className="space-y-6 text-right pb-24" dir="rtl" id="p012-settlement-root">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
              <Receipt className="w-4.5 h-4.5" />
            </div>
            <span>ثبت هزینه و تسویه حساب</span>
          </h3>
          <p className="text-[10px] text-slate-500 font-bold mt-0.5">
            ثبت نهایی هزینه‌های تعمیر و وضعیت پرداخت طرف حساب
          </p>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-between bg-slate-100 border border-slate-200 rounded-2xl py-1.5 px-3.5">
          <span className="text-[10px] text-slate-500 font-bold">وضعیت تسویه:</span>
          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border flex items-center gap-1.5 ${
            isSubmitted 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isSubmitted ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            <span>{isSubmitted ? 'تسویه و سند مالی بسته شد' : 'در انتظار ثبت فاکتور'}</span>
          </span>
        </div>
      </div>

      {/* ۱. خلاصه پرونده */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h4 className="text-sm font-black text-slate-900">۱. خلاصه پرونده تعمیراتی</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs font-bold">
          
          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">کد پرونده</span>
            <span className="text-slate-900 font-black font-mono block text-sm">{toPersianNum(dossier.code)}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">نام طرف حساب</span>
            <span className="text-slate-900 font-black block">{dossier.customerName}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl space-y-1 col-span-1 sm:col-span-1.5">
            <span className="text-[10px] text-slate-400 font-extrabold block">نام دستگاه</span>
            <span className="text-slate-900 font-black block truncate">{dossier.deviceName}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">مدل دستگاه</span>
            <span className="text-slate-900 font-black font-mono block text-xs">{dossier.model}</span>
          </div>

          <div className="bg-emerald-50/50 border border-emerald-100 p-3 rounded-2xl flex flex-col justify-center items-center">
            <span className="text-[9px] text-emerald-500 font-extrabold block">وضعیت تعمیر</span>
            <div className="flex items-center gap-1 mt-0.5 text-emerald-700 font-black text-xs">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{dossier.status}</span>
            </div>
          </div>

        </div>
      </div>

      {/* ۲. هزینه‌های تعمیر */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <Calculator className="w-5 h-5 text-indigo-600" />
          <h4 className="text-sm font-black text-slate-900">۲. ریز هزینه‌های تعمیرات (ریال/تومان)</h4>
        </div>

        <p className="text-[10px] text-slate-400 font-bold leading-normal">
          تغییر مبالغ در صورت نیاز جهت هماهنگی با تخفیف‌ها و شرایط خاص فاکتور:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-extrabold">اجرت تعمیر</label>
            <div className="relative">
              <input 
                type="number"
                value={wage}
                onChange={(e) => setWage(Number(e.target.value))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-left font-mono font-black text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all pl-12"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-extrabold">تومان</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-extrabold">قطعات مصرفی</label>
            <div className="relative">
              <input 
                type="number"
                value={parts}
                onChange={(e) => setParts(Number(e.target.value))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-left font-mono font-black text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all pl-12"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-extrabold">تومان</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-extrabold">هزینه سرویس</label>
            <div className="relative">
              <input 
                type="number"
                value={service}
                onChange={(e) => setService(Number(e.target.value))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-left font-mono font-black text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all pl-12"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-extrabold">تومان</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-extrabold">هزینه جانبی</label>
            <div className="relative">
              <input 
                type="number"
                value={extraCost}
                onChange={(e) => setExtraCost(Number(e.target.value))}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-left font-mono font-black text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all pl-12"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-extrabold">تومان</span>
            </div>
          </div>

        </div>

        {/* Cost breakdown progress preview */}
        <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-600">
          <span>سهم اجرت از کل هزینه‌ها:</span>
          <div className="flex items-center gap-2 w-1/2">
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-300" 
                style={{ width: `${totalCosts > 0 ? (wage / totalCosts) * 100 : 0}%` }}
              />
            </div>
            <span className="font-mono text-xs">{toPersianNum(totalCosts > 0 ? Math.round((wage / totalCosts) * 100) : 0)}٪</span>
          </div>
        </div>
      </div>

      {/* ۳. تخفیف */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <Percent className="w-5 h-5 text-indigo-600" />
          <h4 className="text-sm font-black text-slate-900">۳. محاسبه و اعمال تخفیف</h4>
        </div>

        <p className="text-[10px] text-slate-400 font-bold leading-normal">
          انتخاب مبنای تخفیف بر اساس درصد کل یا کسر مبلغ فیکس نقدی:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Discount type toggle card */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setDiscountType('percent')}
              className={`py-2 px-3 text-xs font-black rounded-xl transition-all cursor-pointer ${
                discountType === 'percent'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              درصد تخفیف (٪)
            </button>
            <button
              type="button"
              onClick={() => setDiscountType('cash')}
              className={`py-2 px-3 text-xs font-black rounded-xl transition-all cursor-pointer ${
                discountType === 'cash'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              مبلغ تخفیف نقدی
            </button>
          </div>

          {/* Discount input field */}
          <div>
            {discountType === 'percent' ? (
              <div className="relative">
                <input 
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-left font-mono font-black text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all pl-10"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono font-black">٪</span>
              </div>
            ) : (
              <div className="relative">
                <input 
                  type="number"
                  value={discountCash}
                  onChange={(e) => setDiscountCash(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-left font-mono font-black text-xs outline-none focus:border-indigo-500 focus:bg-white transition-all pl-12"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-extrabold">تومان</span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ۴. جمع کل */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-3xl p-5 shadow-lg shadow-indigo-100 space-y-4">
        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
          <Coins className="w-5 h-5 text-indigo-200 animate-pulse" />
          <h4 className="text-sm font-black">۴. خلاصه فاکتور نهایی و تراز مالی</h4>
        </div>

        <div className="space-y-3 font-bold text-xs">
          
          <div className="flex justify-between items-center bg-white/5 py-2.5 px-4 rounded-xl border border-white/5">
            <span className="text-indigo-100">جمع هزینه‌ها:</span>
            <div className="flex items-center gap-1.5 font-mono text-sm font-black">
              <span>{formatCurrency(totalCosts)}</span>
              <span className="text-[9px] text-indigo-200">تومان</span>
            </div>
          </div>

          <div className="flex justify-between items-center bg-white/5 py-2.5 px-4 rounded-xl border border-white/5">
            <span className="text-indigo-100 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-indigo-300" />
              <span>تخفیف اعمال شده:</span>
            </span>
            <div className="flex items-center gap-1.5 font-mono text-sm font-black text-amber-200">
              <span>{formatCurrency(finalDiscount)}</span>
              <span className="text-[9px]">تومان</span>
            </div>
          </div>

          <div className="flex justify-between items-center bg-white/10 py-4 px-5 rounded-2xl border border-white/10 shadow-inner">
            <span className="text-white text-sm font-black">مبلغ قابل پرداخت:</span>
            <div className="flex items-baseline gap-1.5 font-mono text-xl font-black text-amber-300">
              <span>{formatCurrency(payableAmount)}</span>
              <span className="text-[10px] font-extrabold text-indigo-200">تومان</span>
            </div>
          </div>

        </div>
      </div>

      {/* ۵. روش پرداخت */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <CreditCard className="w-5 h-5 text-indigo-600" />
          <h4 className="text-sm font-black text-slate-900">۵. روش تسویه حساب و نحوه پرداخت</h4>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {[
            { id: 'pos', label: 'کارتخوان', desc: 'اتصال مستقیم به POS' },
            { id: 'cash', label: 'نقدی', desc: 'دریافت اسکناس صندوق' },
            { id: 'bank', label: 'انتقال بانکی', desc: 'حواله پایا/ساتنا/کارت' },
            { id: 'combined', label: 'پرداخت ترکیبی', desc: 'بخشی نقد، بخشی پوز' }
          ].map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() => setPaymentMethod(method.id as PaymentMethodType)}
              className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2.5 cursor-pointer relative ${
                paymentMethod === method.id
                  ? 'bg-indigo-50/70 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500'
                  : 'bg-slate-50/50 border-slate-150 hover:bg-slate-50 text-slate-600'
              }`}
            >
              <div className="flex justify-between items-center">
                <span className="text-xs font-black">{method.label}</span>
                <span className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  paymentMethod === method.id 
                    ? 'border-indigo-600 bg-indigo-600' 
                    : 'border-slate-350 bg-white'
                }`}>
                  {paymentMethod === method.id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  )}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 font-bold leading-tight">{method.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ۶. وضعیت پرداخت */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <Banknote className="w-5 h-5 text-indigo-600" />
          <h4 className="text-sm font-black text-slate-900">۶. تایید وضعیت و ترخیص فاکتور</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { id: 'full', label: '◉ تسویه کامل', desc: 'وصول قطعی کل مبلغ جهت ترخیص دستگاه', color: 'border-emerald-200 hover:bg-emerald-50/10', activeColor: 'bg-emerald-50/80 border-emerald-500 text-emerald-900' },
            { id: 'partial', label: '○ پرداخت ناقص', desc: 'ثبت بیعانه و ارجاع مانده به حساب بدهی', color: 'border-amber-200 hover:bg-amber-50/10', activeColor: 'bg-amber-50/80 border-amber-500 text-amber-900' },
            { id: 'debtor', label: '○ بدهکار', desc: 'تحویل دستگاه به صورت امانی یا همکار بدهکار', color: 'border-rose-200 hover:bg-rose-50/10', activeColor: 'bg-rose-50/80 border-rose-500 text-rose-900' }
          ].map((status) => (
            <button
              key={status.id}
              type="button"
              onClick={() => setPaymentStatus(status.id as PaymentStatusType)}
              className={`p-3.5 rounded-2xl border text-right transition-all flex flex-col justify-between gap-1 cursor-pointer ${
                paymentStatus === status.id
                  ? status.activeColor
                  : `bg-slate-50/30 border-slate-150 ${status.color} text-slate-600`
              }`}
            >
              <span className="text-xs font-black">{status.label}</span>
              <span className="text-[9px] text-slate-400 font-bold leading-tight mt-0.5">{status.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ۷. اطلاعات پرداخت */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <Layers className="w-5 h-5 text-indigo-600" />
          <h4 className="text-sm font-black text-slate-900">۷. اطلاعات و مشخصات ثبتی تراکنش</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-bold">
          
          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">شماره فاکتور</span>
            <span className="text-slate-800 font-black font-mono block text-xs">{paymentInfo.invoiceNumber}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">شماره تراکنش (POS)</span>
            <span className="text-slate-800 font-black font-mono block text-xs">{paymentInfo.transactionId}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">تاریخ پرداخت</span>
            <span className="text-slate-800 font-black font-mono block text-xs">{paymentInfo.paymentDate}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">دریافت کننده وجه</span>
            <span className="text-slate-800 font-black block text-xs">{paymentInfo.receiverName}</span>
          </div>

        </div>
      </div>

      {/* ۸. توضیحات مالی */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h4 className="text-sm font-black text-slate-900">۸. توضیحات و ملاحظات مالی</h4>
        </div>

        <p className="text-[10px] text-slate-400 font-bold leading-normal">
          یادداشت‌های صندوق مانند مرجع فاکتور، تاییدیه کارت به کارت، کسر مانده یا موارد مرتبط:
        </p>

        <textarea
          rows={3}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className="w-full p-4 bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-2xl text-xs font-bold outline-none leading-relaxed transition-all resize-none shadow-inner"
          placeholder="توضیحات تکمیلی سند مالی..."
        />
      </div>

      {/* ۹. دکمه‌های پایین صفحه */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4">
        
        {/* Print & Back Group */}
        <div className="flex items-center gap-3 order-2 sm:order-1">
          <button
            type="button"
            onClick={() => alert(`پرینتر حرارتی (Bixolon):\n فاکتور ${paymentInfo.invoiceNumber} به مبلغ ${formatCurrency(payableAmount)} تومان ارسال شد.`)}
            className="flex-1 sm:flex-none px-5 py-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-black rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>چاپ فاکتور</span>
          </button>

          <button
            type="button"
            className="px-5 py-3.5 bg-white hover:bg-slate-50 text-slate-500 border border-slate-200 text-xs font-black rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <span>بازگشت</span>
          </button>
        </div>

        {/* Action: ثبت تسویه حساب */}
        <button
          type="button"
          onClick={() => setIsSubmitted(true)}
          className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-200/60 hover:shadow-xl hover:shadow-blue-300/50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 order-1 sm:order-2 group"
        >
          <Check className="w-5 h-5 transition-transform group-hover:scale-110" />
          <span>ثبت تسویه حساب</span>
        </button>

      </div>

      {/* Simulation Feedback Alert */}
      {isSubmitted && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4.5 flex flex-col sm:flex-row items-center gap-4 justify-between animate-fade-in shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm animate-bounce">
              <Check className="w-5 h-5 stroke-[3.5]" />
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-slate-900">پرداخت فاکتور و تسویه با موفقیت تایید گردید</p>
              <p className="text-[10.5px] text-emerald-700 font-bold mt-1 leading-normal">
                سند مالی فاکتور <span className="font-black">{paymentInfo.invoiceNumber}</span> بسته شد. مبلغ پرداخت شده: <span className="underline font-black">{formatCurrency(payableAmount)} تومان</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-emerald-100/50 border border-emerald-200 rounded-xl px-3 py-1.5 text-xs font-black text-emerald-800 tracking-wide font-mono shrink-0">
            <span>تسویه نهایی شد</span>
          </div>
        </div>
      )}

      {/* Footer Text */}
      <p className="text-center text-[10px] text-slate-400 font-bold pt-4 flex items-center justify-center gap-1.5" id="settlement-demo-disclaimer">
        <Info className="w-3.5 h-3.5 text-slate-300 shrink-0" />
        <span>این صفحه صرفاً نسخه نمایشی رابط کاربری است.</span>
      </p>

    </div>
  );
}
