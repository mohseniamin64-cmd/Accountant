import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, 
  MessageSquare, 
  Maximize2, 
  Minimize2, 
  RotateCw, 
  ArrowRight, 
  ShieldAlert, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Layers, 
  Cpu, 
  User, 
  Activity, 
  Sparkles,
  Camera,
  Hammer,
  HelpCircle,
  Check,
  ChevronLeft,
  X
} from 'lucide-react';
import { WarrantyItem, ActiveTab } from '../types';

interface P006RepairDossierProps {
  devFileSerial: string;
  setDevFileSerial: (serial: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  warrantyDb: WarrantyItem[];
}

export default function P006RepairDossier({
  devFileSerial,
  setDevFileSerial,
  setActiveTab,
  warrantyDb = []
}: P006RepairDossierProps) {
  // Finds the target item based on serial
  const currentItem = useMemo(() => {
    const found = warrantyDb.find(item => item.serial.toUpperCase() === devFileSerial.toUpperCase());
    return found || warrantyDb[0] || {
      serial: devFileSerial || 'W-TEMP',
      itemName: 'دستگاه تعریف نشده در بانک پذیرش',
      customerName: 'طرف حساب آزمایشی',
      customerPhone: '۰۹۱۲۰۰۰۰۰۰۰',
      defectType: 'ایراد نامشخص سخت‌افزاری',
      status: 'pending',
      expiryDate: 'بدون گارانتی',
      registeredAt: 'امروز',
    };
  }, [warrantyDb, devFileSerial]);

  // Calculate stable fallback values for metadata
  const itemMeta = useMemo(() => {
    const index = warrantyDb.findIndex(item => item.serial === currentItem.serial);
    const safeIndex = index >= 0 ? index : 4;
    
    const intakeNo = `DEC-1405${100 + safeIndex}`;
    
    let model = 'DEC-CH-12';
    if (currentItem.itemName.includes('DU')) model = 'DU-PWR-24';
    else if (currentItem.itemName.includes('DEC')) model = 'DEC-MD-08';
    else if (currentItem.itemName.includes('برد')) model = 'W-BRD-01';
    else if (currentItem.itemName.includes('آداپتور')) model = 'TS-ADP-05';
    else if (currentItem.itemName.includes('باتری')) model = 'PL-BAT-12';
    else if (currentItem.itemName.includes('ASUS') || currentItem.itemName.includes('کارت')) model = 'ROG-RTX-4070';
    else if (currentItem.itemName.includes('MSI') || currentItem.itemName.includes('مادربورد')) model = 'MAG-Z790-D5';

    let warrantyStatus = 'گارانتی معتبر دیاکو';
    let isExpired = false;
    if (currentItem.expiryDate === 'بدون گارانتی' || currentItem.expiryDate === 'فاقد گارانتی') {
      warrantyStatus = 'تعمیرات آزاد (بدون گارانتی)';
    } else if (safeIndex % 3 === 1) {
      warrantyStatus = 'نزدیک پایان گارانتی';
    } else if (safeIndex % 5 === 0) {
      warrantyStatus = 'گارانتی منقضی شده';
      isExpired = true;
    }

    let priority: 'عادی' | 'فوری' | 'خیلی فوری' = 'عادی';
    if (safeIndex % 4 === 1 || currentItem.defectType?.includes('فوری')) {
      priority = 'فوری';
    } else if (safeIndex % 6 === 0) {
      priority = 'خیلی فوری';
    }

    let waitingDays = 3;
    if (currentItem.status === 'pending' || currentItem.status === 'under_repair' || safeIndex === 2) {
      if (safeIndex % 3 === 0) {
        waitingDays = 1;
      } else if (safeIndex % 3 === 1) {
        waitingDays = 3;
      } else {
        waitingDays = 7 + (safeIndex % 5);
      }
    } else {
      waitingDays = 0;
    }

    const defaultImage = 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=500&auto=format&fit=crop&q=80';
    const imageToUse = currentItem.photoUrl || defaultImage;

    return {
      intakeNo,
      model,
      warrantyStatus,
      isExpired,
      priority,
      waitingDays,
      imageToUse
    };
  }, [currentItem, warrantyDb]);

  // Stepper state - Stage 1 is designed, clicking continue will show step 2 simulator
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [imageRotation, setImageRotation] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const handleCallCustomer = () => {
    showToast(`برقراری تماس مستقیم با طرف حساب (${currentItem.customerName}) به شماره ${currentItem.customerPhone}...`, 'success');
  };

  const handleSmsCustomer = () => {
    showToast(`پیش‌نویس پیامک وضعیت پذیرش به شماره ${currentItem.customerPhone} ارسال شد.`, 'info');
  };

  const handleContinueToDefect = () => {
    showToast('در این نسخه آزمایشی، فقط گام اول (مشخصات دستگاه) طراحی شده است. به زودی گام ثبت خرابی فعال خواهد شد!', 'info');
    setActiveStep(2);
  };

  // Status mapping for visual styles
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'pending':
        return { label: 'در انتظار بررسی', bg: 'bg-blue-50 text-blue-700 border-blue-200/60', dot: 'bg-blue-500' };
      case 'under_repair':
        return { label: 'در حال تعمیر', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200/60', dot: 'bg-indigo-500' };
      case 'waiting_parts':
        return { label: 'منتظر قطعه', bg: 'bg-amber-50 text-amber-700 border-amber-200/60', dot: 'bg-amber-500' };
      case 'replaced':
      case 'active':
        return { label: 'آماده تحویل', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', dot: 'bg-emerald-500' };
      case 'rejected':
        return { label: 'غیرقابل تعمیر', bg: 'bg-rose-50 text-rose-700 border-rose-200/60', dot: 'bg-rose-500' };
      default:
        return { label: 'در انتظار بررسی', bg: 'bg-blue-50 text-blue-700 border-blue-200/60', dot: 'bg-blue-500' };
    }
  };

  const statusStyle = getStatusDisplay(currentItem.status);

  // Steps definition
  const steps = [
    { num: 1, title: 'اطلاعات دستگاه', icon: Cpu },
    { num: 2, title: 'ثبت خرابی', icon: ShieldAlert },
    { num: 3, title: 'لوازم همراه', icon: Layers },
    { num: 4, title: 'عملیات تعمیر', icon: Hammer },
    { num: 5, title: 'تست نهایی و تحویل', icon: CheckCircle2 }
  ];

  return (
    <div className="space-y-4 text-right animate-fade-in" dir="rtl">
      
      {/* HEADER BAR */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full filter blur-xl"></div>
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setActiveTab('queue')}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              title="بازگشت به صف"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-1">
              <span>پرونده تعمیر دستگاه</span>
              <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg border border-blue-100 font-extrabold mr-1">
                P006
              </span>
            </h3>
          </div>
          <p className="text-[10px] text-slate-500 font-bold pr-7">مدیریت گام‌به‌گام چرخه سرویس فنی و نظارت بر قطعه معیوب کارگاه</p>
        </div>
        
        {/* Quick select back shortcut */}
        <button
          onClick={() => setActiveTab('queue')}
          className="text-[10px] font-black text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all cursor-pointer flex items-center gap-1 active:scale-95"
        >
          <span>بازگشت به صف تعمیرات</span>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* QUICK VIEW SUMMARY MODULE */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-md relative overflow-hidden">
        {/* Absolute Glowing background patterns */}
        <div className="absolute -left-12 -top-12 w-40 h-40 bg-blue-600/20 rounded-full filter blur-2xl pointer-events-none"></div>
        <div className="absolute -right-12 -bottom-12 w-40 h-40 bg-indigo-600/10 rounded-full filter blur-2xl pointer-events-none"></div>

        <div className="flex items-center justify-between gap-3 relative z-10">
          {/* Information list */}
          <div className="space-y-2.5 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-black text-white">{currentItem.itemName}</h2>
              <span className={`text-[9px] font-black px-2 py-0.5 rounded-md border ${
                itemMeta.isExpired 
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' 
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
              }`}>
                {itemMeta.warrantyStatus}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] text-slate-300 font-medium">
              <div>
                <span className="text-slate-400 font-bold">طرف حساب: </span>
                <span className="text-white font-black">{currentItem.customerName}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold">شماره پذیرش: </span>
                <span className="text-white font-mono font-black bg-white/10 px-1.5 py-0.5 rounded text-[10.5px]">{itemMeta.intakeNo}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold">سریال: </span>
                <span className="text-white font-mono font-black" dir="ltr">{currentItem.serial}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold">مدل: </span>
                <span className="text-white font-mono font-bold">{itemMeta.model}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold">اولویت: </span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border inline-flex items-center gap-1 ${
                  itemMeta.priority === 'خیلی فوری' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                  itemMeta.priority === 'فوری' ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' : 'bg-white/5 text-slate-300 border-white/10'
                }`}>
                  <span className={`w-1 h-1 rounded-full ${
                    itemMeta.priority === 'خیلی فوری' ? 'bg-rose-400' :
                    itemMeta.priority === 'فوری' ? 'bg-orange-400' : 'bg-slate-400'
                  }`}></span>
                  <span>{itemMeta.priority}</span>
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold">مدت انتظار: </span>
                <span className="text-white font-black">
                  {itemMeta.waitingDays === 0 ? 'آماده تحویل' : `${itemMeta.waitingDays} روز در صف`}
                </span>
              </div>
            </div>
          </div>

          {/* Device thumbnail directly on the right */}
          <div className="w-20 h-20 rounded-xl overflow-hidden border-2 border-white/20 shadow-md relative group shrink-0 bg-slate-800">
            <img 
              src={itemMeta.imageToUse} 
              alt={currentItem.itemName} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <button
              onClick={() => setIsZoomed(true)}
              className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              title="بزرگنمایی تصویر"
            >
              <Maximize2 className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* HORIZONTAL STEPPER */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black text-slate-400">مراحل فرآیند تعمیر دستگاه</span>
          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-black">گام فعلی: اطلاعات اولیه</span>
        </div>
        
        {/* Horizontal Stepper UI */}
        <div className="mt-4 flex items-center justify-between relative">
          {/* Stepper bar background */}
          <div className="absolute top-4 right-0 left-0 h-0.5 bg-slate-100 -z-10"></div>
          {/* Completed / Active bar progress */}
          <div className="absolute top-4 right-0 h-0.5 bg-blue-600 -z-10 transition-all duration-300" style={{ width: `${((activeStep - 1) / 4) * 100}%` }}></div>

          {steps.map((st) => {
            const isCompleted = st.num < activeStep;
            const isActive = st.num === activeStep;
            
            return (
              <button
                key={st.num}
                onClick={() => {
                  if (st.num === 1) {
                    setActiveStep(1);
                  } else {
                    showToast(`جهت مشاهده، لطفاً روی دکمه بزرگ پایین صفحه برای ادامه مراحل کلیک کنید.`, 'info');
                  }
                }}
                className="flex flex-col items-center gap-1.5 focus:outline-none group cursor-pointer relative"
                style={{ width: '18%' }}
              >
                {/* Step Circle Bubble */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 shadow-xs ${
                  isCompleted 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : isActive 
                      ? 'bg-white border-blue-600 text-blue-600 ring-4 ring-blue-50' 
                      : 'bg-white border-slate-200 text-slate-400'
                }`}>
                  {isCompleted ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                  ) : (
                    <st.icon className="w-3.5 h-3.5" />
                  )}
                </div>

                {/* Step Text Label */}
                <span className={`text-[9px] font-black text-center leading-normal transition-colors duration-300 hidden sm:block ${
                  isActive ? 'text-blue-600 font-extrabold' : 'text-slate-400 font-semibold'
                }`}>
                  مرحله {st.num}
                  <span className="block font-bold text-[8px] text-slate-500">{st.title}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* STEP 1: DEVICE SPECIFICATIONS CARD */}
      {activeStep === 1 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2.5 flex items-center gap-1.5">
            <Cpu className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-black text-slate-900">کارت کامل مشخصات فنی و مالکیتی دستگاه</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Main technical parameters list */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block">نام دستگاه</span>
                  <span className="text-slate-800 font-black text-[11px]">{currentItem.itemName}</span>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block">مدل تجاری</span>
                  <span className="text-slate-800 font-mono font-black text-[11px]">{itemMeta.model}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block">شماره سریال</span>
                  <span className="text-slate-800 font-mono font-black text-[11px]" dir="ltr">{currentItem.serial}</span>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block">شماره پذیرش</span>
                  <span className="text-slate-800 font-mono font-black text-[11px]">{itemMeta.intakeNo}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block">وضعیت گارانتی</span>
                  <span className="text-emerald-700 font-black text-[11px]">{itemMeta.warrantyStatus}</span>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block">اولویت کارگاهی</span>
                  <span className="text-orange-700 font-black text-[11px]">{itemMeta.priority}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block">تاریخ پذیرش کارگاه</span>
                  <span className="text-slate-800 font-black text-[11px]">{currentItem.registeredAt}</span>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl space-y-0.5">
                  <span className="text-[10px] text-slate-400 font-bold block">مدت انتظار فعلی</span>
                  <span className="text-rose-700 font-black text-[11px]">
                    {itemMeta.waitingDays === 0 ? 'ترخیص شده' : `${itemMeta.waitingDays} روز در صف بررسی`}
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Details & Image Block */}
            <div className="space-y-3">
              {/* Customer Box with Quick Action Buttons */}
              <div className="bg-blue-50/50 border border-blue-100 p-3 rounded-2xl space-y-3">
                <div className="flex items-center gap-1.5 border-b border-blue-100/50 pb-1.5">
                  <User className="w-4 h-4 text-blue-600" />
                  <span className="text-[10px] font-black text-blue-800">اطلاعات مالک و تماس مستقیم</span>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[9px] text-slate-400 block font-bold">نام تحویل‌دهنده / طرف حساب</span>
                    <span className="font-black text-slate-800 text-[11.5px]">{currentItem.customerName}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-[9px] text-slate-400 block font-bold">تلفن همراه</span>
                    <span className="font-mono font-black text-slate-800 text-[11.5px]">{currentItem.customerPhone}</span>
                  </div>
                </div>

                {/* Call and SMS triggers side-by-side */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCallCustomer}
                    className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>تماس مستقیم</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSmsCustomer}
                    className="py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[10px] font-black rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                    <span>ارسال پیامک</span>
                  </button>
                </div>
              </div>

              {/* Display High-Contrast Hardware Photo with Zoom click */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden relative group h-36 bg-slate-50 flex items-center justify-center">
                <img 
                  src={itemMeta.imageToUse} 
                  alt={currentItem.itemName} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-2.5 right-2.5 bg-black/60 backdrop-blur-xs text-white px-2 py-0.5 rounded-lg text-[9px] font-black">
                  عکس پذیرش فیزیکی قطعه
                </div>
                
                {/* Maximize Trigger Layer */}
                <button
                  type="button"
                  onClick={() => setIsZoomed(true)}
                  className="absolute bottom-2.5 left-2.5 p-2 bg-white/95 hover:bg-white rounded-xl shadow-md transition-all active:scale-95 cursor-pointer text-slate-800 hover:text-blue-600 flex items-center gap-1 text-[9px] font-extrabold"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                  <span>بزرگنمایی و معاینه فیزیکی</span>
                </button>
              </div>
            </div>
          </div>

          {/* Core Repair Status Banner */}
          <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-xl flex items-center justify-between text-xs font-bold">
            <span className="text-slate-500">وضعیت فعلی در صف تعمیرات:</span>
            <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black border flex items-center gap-1.5 ${statusStyle.bg}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`}></span>
              <span>{statusStyle.label}</span>
            </span>
          </div>

          {/* LARGE BOTTOM PROGRESS ACTION BUTTON */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleContinueToDefect}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl shadow-md cursor-pointer transition-all active:scale-98 text-xs flex items-center justify-center gap-2"
            >
              <span>ادامه به مرحله ثبت خرابی (گام ۲)</span>
              <ChevronLeft className="w-4 h-4 stroke-[3]" />
            </button>
          </div>
        </div>
      ) : (
        /* SIMULATOR COMPONENT FOR OTHER STAGES (SINCE ONLY STEP 1 DESIGNED IN THIS VERSION) */
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 text-center shadow-xs space-y-4">
          <HelpCircle className="w-12 h-12 text-blue-500 mx-auto animate-bounce" />
          <div className="space-y-1.5 max-w-sm mx-auto">
            <h4 className="text-sm font-black text-slate-800">شبیه‌ساز مراحل تکمیلی پرونده</h4>
            <p className="text-[11px] text-slate-500 leading-relaxed font-bold">
              شما هم‌اکنون گام آزمایشی {activeStep} را مشاهده می‌کنید. بر اساس توصیف پروژه، فرآیند کامل شامل ثبت عیب یابی تفصیلی، بررسی لوازم همراه و تایید نهایی خواهد بود.
            </p>
          </div>

          <div className="flex gap-2 justify-center pt-2">
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl cursor-pointer transition-colors"
            >
              بازگشت به اطلاعات دستگاه (گام ۱)
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveStep(1);
                showToast('درخواست ادامه ارسال شد.', 'success');
              }}
              className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl cursor-pointer transition-colors"
            >
              شروع مجدد فرآیند
            </button>
          </div>
        </div>
      )}

      {/* FLOAT NOTIFICATION TOAST */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 z-50 max-w-sm bg-slate-900 border border-slate-800 text-white p-3.5 rounded-2xl shadow-2xl flex items-start gap-2.5 text-right"
            dir="rtl"
          >
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-spin-slow" />
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 font-black block">اعلان سیستم خدمات پس از فروش</span>
              <p className="text-[11px] font-black leading-relaxed">{toastMessage.text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* IMAGE MAXIMIZE MODAL WITH FULL CONTROL CONTROLS */}
      <AnimatePresence>
        {isZoomed && (
          <div 
            className="fixed inset-0 z-50 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
            onClick={() => setIsZoomed(false)}
          >
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-950/80 rounded-3xl p-4 border border-slate-800/80 shadow-2xl max-w-lg w-full flex flex-col space-y-4 relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-slate-400">
                <span className="text-[10px] font-black text-slate-300">معاینه فیزیکی و بازرسی صدمات ظاهری قطعه</span>
                <button
                  type="button"
                  onClick={() => setIsZoomed(false)}
                  className="p-1.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Image View */}
              <div className="overflow-hidden rounded-2xl bg-slate-900 flex items-center justify-center relative aspect-video">
                <motion.img 
                  animate={{ rotate: imageRotation }}
                  transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                  src={itemMeta.imageToUse} 
                  alt={currentItem.itemName} 
                  className="max-h-[350px] max-w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Image Controls */}
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[10px] text-slate-500 font-bold">بزرگنمایی به کمک حسگر لمسی یا ماوس</span>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setImageRotation(prev => prev + 90)}
                    className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                    title="چرخش تصویر"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>چرخش ۹۰ درجه</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageRotation(0)}
                    className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    <span>بازنشانی</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
