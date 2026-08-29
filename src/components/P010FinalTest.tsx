import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  User, 
  Cpu, 
  Hash, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  Save, 
  Check, 
  FileText,
  TrendingUp,
  Thermometer,
  Zap,
  CheckCircle,
  ArrowLeft
} from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export default function P010FinalTest() {
  // 1. Device Info State (Sample Mock Data)
  const [deviceInfo] = useState({
    receptionId: 'W-9082',
    customerName: 'علیرضا شمس‌آبادی',
    deviceName: 'پاور سوئیچینگ مخابراتی دیاکو',
    serialNumber: 'DK-77821-X',
    warrantyStatus: 'گارانتی فعال دیاکو (باقیمانده: ۹ ماه)',
    priority: 'فوری / VIP'
  });

  // 2. Checklist items (۸ مورد تعیین شده در درخواست)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { id: '1', label: 'روشن شدن دستگاه', checked: true },
    { id: '2', label: 'تست کامل عملکرد', checked: true },
    { id: '3', label: 'تست خروجی', checked: true },
    { id: '4', label: 'تست ورودی', checked: true },
    { id: '5', label: 'تست شارژ', checked: false },
    { id: '6', label: 'تست ارتباط', checked: false },
    { id: '7', label: 'تست دمای کاری', checked: true },
    { id: '8', label: 'تست نهایی', checked: false }
  ]);

  // Toggle checklist check state
  const handleToggleCheck = (id: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item));
  };

  // 3. Test Outcome State (۳ گزینه تعیین شده)
  type TestOutcome = 'passed' | 'recheck' | 'failed';
  const [outcome, setOutcome] = useState<TestOutcome>('passed');

  // 4. Technician Comments State
  const [techComments, setTechComments] = useState<string>(
    'دستگاه به مدت ۲ ساعت زیر بار کامل صنعتی ۱۰ آمپر قرار گرفت. نرخ نوسان خروجی کمتر از ۰.۲ درصد بوده و پایداری ولتاژ کاملاً رضایت‌بخش است. دمای هیت‌سینک اصلی ماسفت‌ها در دمای محیط ۲۵ درجه، به حداکثر ۵۴ درجه رسید که در محدوده استاندارد کاتالوگ قطعه است.'
  );

  // Status simulation after submission
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Helper for Persian digits
  const toPersianNum = (numStr: string | number) => {
    const pDict = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return numStr.toString().replace(/[0-9]/g, (w) => pDict[parseInt(w)]);
  };

  const handleRegisterResult = () => {
    setIsSubmitted(true);
  };

  return (
    <div className="space-y-6 text-right pb-24" dir="rtl">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
              <ClipboardCheck className="w-4.5 h-4.5" />
            </div>
            <span>تست نهایی الکترونیکی دستگاه</span>
          </h3>
          <p className="text-[10px] text-slate-500 font-bold mt-0.5">
            کنترل کیفی نهایی، ارزیابی پایداری ولتاژ تحت بارگذاری و تایید خروج برای ترخیص کارگاه
          </p>
        </div>

        {/* Device Status Live Badge */}
        <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-between bg-slate-100 border border-slate-200 rounded-2xl py-1.5 px-3.5">
          <span className="text-[10px] text-slate-500 font-bold">وضعیت کنونی پرونده:</span>
          <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black border flex items-center gap-1.5 ${
            isSubmitted 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse' 
              : 'bg-blue-50 text-blue-700 border-blue-200'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isSubmitted ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
            <span>{isSubmitted ? 'آماده تحویل' : 'در حال تست نهایی'}</span>
          </span>
        </div>
      </div>

      {/* 1- کارت اطلاعات دستگاه */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <Cpu className="w-5 h-5 text-blue-600" />
          <h4 className="text-sm font-black text-slate-900">۱. مشخصات فنی قطعه تحت تست</h4>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-bold">
          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">شماره پذیرش</span>
            <span className="text-slate-900 font-black font-mono block text-sm">{toPersianNum(deviceInfo.receptionId)}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">نام طرف حساب</span>
            <span className="text-slate-900 font-black block">{deviceInfo.customerName}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">نام دستگاه</span>
            <span className="text-slate-900 font-black block truncate">{deviceInfo.deviceName}</span>
          </div>

          <div className="bg-slate-50 p-3 rounded-2xl space-y-1">
            <span className="text-[10px] text-slate-400 font-extrabold block">شماره سریال</span>
            <span className="text-slate-900 font-black font-mono block">{deviceInfo.serialNumber}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between gap-2 pt-1.5 text-[10px] text-slate-400 font-extrabold">
          <span>🛡️ {deviceInfo.warrantyStatus}</span>
          <span>🚨 اولویت گردشکار تعمیرگاهی: {deviceInfo.priority}</span>
        </div>
      </div>

      {/* 2- چک‌لیست تست */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-blue-600" />
            <h4 className="text-sm font-black text-slate-900">۲. چک‌لیست و استانداردهای تایید کیفیت نهایی</h4>
          </div>
          <span className="text-[10px] text-slate-400 font-extrabold bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-150">
            تایید شده: {toPersianNum(checklist.filter(item => item.checked).length)} از {toPersianNum(checklist.length)}
          </span>
        </div>

        <p className="text-[10px] text-slate-400 font-bold leading-normal">
          تکنسین مربوطه موظف است تمام مراحل آزمایشگاهی زیر را به ترتیب تست عینی یا سیگنالی نموده و علامت بزند:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {checklist.map((item) => (
            <label 
              key={item.id}
              className={`flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer select-none ${
                item.checked 
                  ? 'bg-blue-50/40 border-blue-100 text-slate-900 font-extrabold' 
                  : 'bg-slate-50/50 border-slate-100 text-slate-500 font-medium hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input 
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => handleToggleCheck(item.id)}
                  className="w-4.5 h-4.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <span className="text-xs">{item.label}</span>
              </div>
              {item.checked ? (
                <Check className="w-4 h-4 text-blue-600 stroke-[3.5] shrink-0" />
              ) : (
                <span className="w-4 h-4 rounded-full border border-slate-300 shrink-0"></span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* 3- نتیجه تست */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          <h4 className="text-sm font-black text-slate-900">۳. ارزیابی نهایی و تعیین نتیجه تست کیفیت</h4>
        </div>

        <p className="text-[10px] text-slate-400 font-bold leading-normal">
          تعیین وضعیت قطعه جهت شروع بسته‌بندی، ارجاع مجدد به تکنسین، یا اعلام نهایی عدم قابلیت خروج سالم:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Passed */}
          <button
            type="button"
            onClick={() => setOutcome('passed')}
            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between gap-4 cursor-pointer relative overflow-hidden group ${
              outcome === 'passed'
                ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <CheckCircle2 className={`w-6 h-6 ${outcome === 'passed' ? 'text-white' : 'text-emerald-500'}`} />
              {outcome === 'passed' && <Check className="w-4 h-4 text-white stroke-[3.5]" />}
            </div>
            <div>
              <span className="text-xs font-black block">قبول شد</span>
              <span className={`text-[9px] font-bold mt-1 block leading-tight ${outcome === 'passed' ? 'text-emerald-100' : 'text-slate-400'}`}>
                بورد از همه تست‌های بارگذاری سرفراز بیرون آمد
              </span>
            </div>
          </button>

          {/* Needs check again */}
          <button
            type="button"
            onClick={() => setOutcome('recheck')}
            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between gap-4 cursor-pointer relative overflow-hidden group ${
              outcome === 'recheck'
                ? 'bg-amber-600 border-amber-600 text-white shadow-md shadow-amber-100'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <AlertTriangle className={`w-6 h-6 ${outcome === 'recheck' ? 'text-white' : 'text-amber-500'}`} />
              {outcome === 'recheck' && <Check className="w-4 h-4 text-white stroke-[3.5]" />}
            </div>
            <div>
              <span className="text-xs font-black block">نیاز به بررسی مجدد</span>
              <span className={`text-[9px] font-bold mt-1 block leading-tight ${outcome === 'recheck' ? 'text-amber-100' : 'text-slate-400'}`}>
                برخی رفتارها مشکوک است و مجدد چک شود
              </span>
            </div>
          </button>

          {/* Failed / Rejected */}
          <button
            type="button"
            onClick={() => setOutcome('failed')}
            className={`p-4 rounded-2xl border text-right transition-all flex flex-col justify-between gap-4 cursor-pointer relative overflow-hidden group ${
              outcome === 'failed'
                ? 'bg-rose-600 border-rose-600 text-white shadow-md shadow-rose-100'
                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
            }`}
          >
            <div className="flex justify-between items-center w-full">
              <XCircle className={`w-6 h-6 ${outcome === 'failed' ? 'text-white' : 'text-rose-500'}`} />
              {outcome === 'failed' && <Check className="w-4 h-4 text-white stroke-[3.5]" />}
            </div>
            <div>
              <span className="text-xs font-black block">مردود</span>
              <span className={`text-[9px] font-bold mt-1 block leading-tight ${outcome === 'failed' ? 'text-rose-100' : 'text-slate-400'}`}>
                بورد در یکی از فاکتورهای حرارتی یا جریانی رد شد
              </span>
            </div>
          </button>

        </div>
      </div>

      {/* 4- توضیحات تعمیرکار */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
          <FileText className="w-5 h-5 text-blue-600" />
          <h4 className="text-sm font-black text-slate-900">۴. توضیحات نهایی و گزارش عیوب کنترل کیفیت</h4>
        </div>

        <p className="text-[10px] text-slate-400 font-bold leading-normal">
          هرگونه رفتار متناوب ولتاژ، دمای کاری تحت آزمایش بار، و نکات تکمیلی جهت مراجع بعدی ثبت شود:
        </p>

        <textarea
          rows={4}
          value={techComments}
          onChange={(e) => setTechComments(e.target.value)}
          className="w-full p-4 bg-slate-50/50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-2xl text-xs font-bold outline-none leading-relaxed transition-all resize-none shadow-inner"
          placeholder="شرح نهایی نتایج آزمایشگاهی تست بورد..."
        />
      </div>

      {/* 5- دکمه بزرگ ثبت نتیجه تست */}
      <div className="flex flex-col items-center gap-4 pt-2">
        <button
          type="button"
          onClick={handleRegisterResult}
          className="w-full sm:max-w-md py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-200/60 hover:shadow-xl hover:shadow-blue-300/50 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-98 group"
        >
          <Save className="w-5 h-5 transition-transform group-hover:scale-110" />
          <span>ثبت نتیجه تست کارگاه</span>
        </button>

        {/* Live Result display: وضعیت آماده تحویل */}
        {isSubmitted && (
          <div className="w-full sm:max-w-xl bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl p-4.5 flex flex-col sm:flex-row items-center gap-4.5 justify-between animate-fade-in shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center animate-bounce shrink-0 shadow-sm">
                <Check className="w-5 h-5 stroke-[3.5]" />
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-slate-900">نتیجه با موفقیت ذخیره شد!</p>
                <p className="text-[10.5px] text-emerald-700 font-bold mt-1 leading-normal">
                  سند پرونده با موفقیت ذخیره شد. وضعیت گردشکار دستگاه به <span className="underline font-black">«آماده تحویل»</span> تغییر یافت.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-emerald-100/50 border border-emerald-200 rounded-xl px-3 py-1.5 text-xs font-black text-emerald-800 font-mono tracking-wide shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>آماده تحویل</span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
