import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Building, 
  Receipt, 
  Wrench, 
  Monitor, 
  Check, 
  ArrowLeft, 
  Save, 
  User, 
  Phone, 
  MapPin, 
  FileText, 
  ShieldCheck, 
  Clock, 
  AlertTriangle,
  Sparkles,
  Sun,
  Moon,
  Type,
  Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface P014WorkshopSettingsProps {
  onReturn?: () => void;
}

export default function P014WorkshopSettings({ onReturn }: P014WorkshopSettingsProps) {
  // Conversion utility for English to Persian numbers
  const toPersianNum = (numStr: string | number) => {
    const pDict = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return numStr.toString().replace(/[0-9]/g, (w) => pDict[parseInt(w)]);
  };

  // --- States ---
  // 1. Workshop Info
  const [workshopName, setWorkshopName] = useState('کارگاه تخصصی الکترونیک دیاکو');
  const [workshopPhone, setWorkshopPhone] = useState('۰۲۱-۶۶۷۷۸۸۹۹');
  const [workshopAddress, setWorkshopAddress] = useState('تهران، خیابان جمهوری، پاساژ عباسی، طبقه دوم، واحد ۲۱۴');
  const [workshopManager, setWorkshopManager] = useState('مهندس کامران هدایتی');

  // 2. Receipt Settings
  const [receiptTitle, setReceiptTitle] = useState('رسید پذیرش رسمی دیاکو رسید');
  const [receiptFooter, setReceiptFooter] = useState('ارائه این رسید جهت تحویل دستگاه الزامی است. کارگاه هیچ مسئولیتی در قبال اطلاعات شخصی دستگاه ندارد. مهلت تست پس از تحویل ۳ روز می‌باشد.');
  const [receiptPhone, setReceiptPhone] = useState('۰۹۱۲-۳۴۵۶۷۸۹');
  const [showAddressOnReceipt, setShowAddressOnReceipt] = useState(true);

  // 3. Admission Defaults
  const [defaultWarranty, setDefaultWarranty] = useState('90'); // 90 days
  const [defaultPriority, setDefaultPriority] = useState('normal'); // normal, urgent, critical
  const [defaultStatus, setDefaultStatus] = useState('pending'); // pending, repairing

  // 4. Simple Appearance Settings
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('diaco_theme_mode') as 'light' | 'dark') || 'light';
  });
  const [fontSize, setFontSize] = useState<'normal' | 'large'>(() => {
    return (localStorage.getItem('diaco_font_size') as 'normal' | 'large') || 'normal';
  });

  // Sync theme changes to document root
  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      localStorage.setItem('diaco_theme_mode', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      localStorage.setItem('diaco_theme_mode', 'light');
    }
  }, [themeMode]);

  // Sync font size changes to document root
  useEffect(() => {
    if (fontSize === 'large') {
      document.documentElement.classList.add('font-large');
      document.body.classList.add('font-large');
      localStorage.setItem('diaco_font_size', 'large');
    } else {
      document.documentElement.classList.remove('font-large');
      document.body.classList.remove('font-large');
      localStorage.setItem('diaco_font_size', 'normal');
    }
  }, [fontSize]);

  // 5. Camera Image Quality Settings
  const [cameraQuality, setCameraQuality] = useState<'low' | 'medium' | 'high'>(() => {
    return (localStorage.getItem('diaco_camera_quality') as 'low' | 'medium' | 'high') || 'medium';
  });

  // Interactive flow states
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Handle Save Trigger
  const handleSave = () => {
    setIsSaving(true);
    localStorage.setItem('diaco_camera_quality', cameraQuality);
    localStorage.setItem('diaco_font_size', fontSize);
    localStorage.setItem('diaco_theme_mode', themeMode);
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccessToast(true);
      setTimeout(() => {
        setShowSuccessToast(false);
        if (onReturn) {
          onReturn();
        }
      }, 2000);
    }, 800);
  };

  return (
    <div className="space-y-6 select-none animate-fade-in pb-12" dir="rtl">
      {/* Toast Notification */}
      <AnimatePresence>
        {showSuccessToast && (
          <motion.div 
            initial={{ opacity: 0, y: -50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 left-4 right-4 md:left-auto md:right-6 z-50 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-emerald-500/30 flex items-center gap-3 max-w-sm mx-auto"
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="text-xs font-black">تنظیمات با موفقیت ذخیره شد</h4>
              <p className="text-[10px] text-emerald-100 font-bold mt-0.5">پیکربندی کارگاه با جدیدترین تغییرات بروزرسانی شد.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header section with clean layout */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-600/10 rounded-full blur-2xl" />
        
        <div className="relative flex justify-between items-center">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-blue-400" />
              <h2 className="text-base md:text-lg font-black tracking-tight">تنظیمات کارگاه (P014)</h2>
            </div>
            <p className="text-[11px] text-slate-400 font-bold max-w-md">
              پیکربندی هویت کارگاه، قالب رسیدهای پذیرش چاپی، پارامترهای پیش‌فرض و ظاهر نرم‌افزار.
            </p>
          </div>
          <span className="bg-blue-500/10 text-blue-400 text-[9px] font-mono px-2.5 py-1 rounded-full border border-blue-500/20">
            SYSTEM_CONFIG
          </span>
        </div>
      </div>

      {/* Form sections */}
      <div className={`space-y-5 transition-all duration-300 ${fontSize === 'large' ? 'text-lg' : ''}`}>
        
        {/* SECTION 1: WORKSHOP INFO */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Building className="w-5 h-5 text-blue-600 shrink-0" />
            <h3 className="text-xs font-black text-slate-900">۱. اطلاعات پایه کارگاه</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-500 block">نام کارگاه</label>
              <div className="relative">
                <input 
                  type="text"
                  value={workshopName}
                  onChange={(e) => setWorkshopName(e.target.value)}
                  placeholder="مثال: کارگاه الکترونیک دیاکو"
                  className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-xs font-black text-slate-800 transition-all"
                />
                <Building className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-500 block">نام مسئول کارگاه</label>
              <div className="relative">
                <input 
                  type="text"
                  value={workshopManager}
                  onChange={(e) => setWorkshopManager(e.target.value)}
                  placeholder="نام و نام خانوادگی مدیر فنی"
                  className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-xs font-black text-slate-800 transition-all"
                />
                <User className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-500 block">شماره تماس ثابت</label>
              <div className="relative">
                <input 
                  type="text"
                  value={workshopPhone}
                  onChange={(e) => setWorkshopPhone(e.target.value)}
                  placeholder="شماره تماس با پیش‌شماره شهر"
                  className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-xs font-mono font-black text-slate-800 transition-all"
                  dir="ltr"
                />
                <Phone className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10.5px] font-black text-slate-500 block">آدرس دقیق فیزیکی</label>
              <div className="relative">
                <textarea 
                  rows={2}
                  value={workshopAddress}
                  onChange={(e) => setWorkshopAddress(e.target.value)}
                  placeholder="آدرس کارگاه جهت مراجعه حضوری طرف حساب"
                  className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-xs font-bold text-slate-800 transition-all resize-none"
                />
                <MapPin className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: RECEIPT SETTINGS */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Receipt className="w-5 h-5 text-blue-600 shrink-0" />
            <h3 className="text-xs font-black text-slate-900">۲. تنظیمات رسید پذیرش طرف حساب</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-500 block">عنوان رسید چاپی</label>
              <div className="relative">
                <input 
                  type="text"
                  value={receiptTitle}
                  onChange={(e) => setReceiptTitle(e.target.value)}
                  placeholder="مثال: برگه رسید پذیرش قطعه کارگاه"
                  className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-xs font-black text-slate-800 transition-all"
                />
                <FileText className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-500 block">شماره تماس درج شده روی رسید</label>
              <div className="relative">
                <input 
                  type="text"
                  value={receiptPhone}
                  onChange={(e) => setReceiptPhone(e.target.value)}
                  placeholder="شماره مستقیم پیگیری طرف حساب"
                  className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-xs font-mono font-black text-slate-800 transition-all"
                  dir="ltr"
                />
                <Phone className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <label className="text-[10.5px] font-black text-slate-500 block">متن قوانین و شرایط ته برگ رسید (پاورقی)</label>
              <div className="relative">
                <textarea 
                  rows={3}
                  value={receiptFooter}
                  onChange={(e) => setReceiptFooter(e.target.value)}
                  placeholder="قوانین پذیرش، سلب مسئولیت اطلاعات، حداکثر مهلت نگهداری و..."
                  className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-xs font-bold text-slate-800 transition-all resize-none"
                />
                <FileText className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              </div>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100 md:col-span-2">
              <div className="space-y-0.5">
                <span className="text-[11px] font-black text-slate-800 block">نمایش آدرس کارگاه روی برگه رسید پذیرش</span>
                <span className="text-[9.5px] text-slate-400 font-bold block">در صورت فعال بودن، آدرس ثبت شده در پاورقی رسید چاپ خواهد شد.</span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddressOnReceipt(!showAddressOnReceipt)}
                className={`w-12 h-6.5 rounded-full p-0.5 transition-colors cursor-pointer shrink-0 ${
                  showAddressOnReceipt ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <div className={`w-5.5 h-5.5 rounded-full bg-white transition-transform duration-200 ${
                  showAddressOnReceipt ? '-translate-x-5.5' : 'translate-x-0'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* SECTION 3: DEFAULT ADMISSION SETTINGS */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Wrench className="w-5 h-5 text-blue-600 shrink-0" />
            <h3 className="text-xs font-black text-slate-900">۳. پارامترهای پیش‌فرض پذیرش قطعات</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-500 block">مدت پیش‌فرض گارانتی تعمیر</label>
              <div className="relative">
                <select 
                  value={defaultWarranty}
                  onChange={(e) => setDefaultWarranty(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-xs font-black text-slate-800 transition-all cursor-pointer appearance-none"
                >
                  <option value="0">بدون گارانتی</option>
                  <option value="30">۳۰ روز (یک ماه)</option>
                  <option value="90">۹۰ روز (سه ماه)</option>
                  <option value="180">۱۸۰ روز (شش ماه)</option>
                  <option value="365">۳۶۵ روز (یک سال)</option>
                </select>
                <ShieldCheck className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-500 block">اولویت اولیه پذیرش</label>
              <div className="relative">
                <select 
                  value={defaultPriority}
                  onChange={(e) => setDefaultPriority(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-xs font-black text-slate-800 transition-all cursor-pointer appearance-none"
                >
                  <option value="normal">عادی (روال عادی کارگاه)</option>
                  <option value="urgent">فوری (بخش ویژه)</option>
                  <option value="critical">خیلی فوری (حیاتی)</option>
                </select>
                <AlertTriangle className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10.5px] font-black text-slate-500 block">وضعیت دستگاه جدید</label>
              <div className="relative">
                <select 
                  value={defaultStatus}
                  onChange={(e) => setDefaultStatus(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-blue-500 focus:bg-white text-xs font-black text-slate-800 transition-all cursor-pointer appearance-none"
                >
                  <option value="pending">در انتظار تعمیر (پنل صف)</option>
                  <option value="repairing">در حال تعمیر (ارجاع به تکنسین)</option>
                </select>
                <Clock className="absolute right-3 top-3.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: VISUAL APPEARANCE */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Monitor className="w-5 h-5 text-blue-600 shrink-0" />
            <h3 className="text-xs font-black text-slate-900">۴. تنظیمات ظاهری ساده نرم‌افزار</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Visual Theme Mode */}
            <div className="space-y-2">
              <span className="text-[10.5px] font-black text-slate-500 block">پوسته کاربری (تم)</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setThemeMode('light')}
                  className={`py-3 px-4 rounded-2xl border flex items-center justify-center gap-2 text-xs font-black transition-all cursor-pointer ${
                    themeMode === 'light'
                      ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Sun className={`w-4 h-4 ${themeMode === 'light' ? 'text-amber-500' : 'text-slate-400'}`} />
                  <span>حالت روشن</span>
                </button>
                <button
                  type="button"
                  onClick={() => setThemeMode('dark')}
                  className={`py-3 px-4 rounded-2xl border flex items-center justify-center gap-2 text-xs font-black transition-all cursor-pointer ${
                    themeMode === 'dark'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Moon className={`w-4 h-4 ${themeMode === 'dark' ? 'text-white' : 'text-slate-400'}`} />
                  <span>حالت تیره</span>
                </button>
              </div>
            </div>

            {/* Font Size Selector */}
            <div className="space-y-2">
              <span className="text-[10.5px] font-black text-slate-500 block">اندازه متون سامانه</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFontSize('normal')}
                  className={`py-3 px-4 rounded-2xl border flex items-center justify-center gap-2 text-xs font-black transition-all cursor-pointer ${
                    fontSize === 'normal'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Type className={`w-4 h-4 ${fontSize === 'normal' ? 'text-white' : 'text-slate-500'}`} />
                  <span>معمولی (استاندارد)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFontSize('large')}
                  className={`py-3 px-4 rounded-2xl border flex items-center justify-center gap-2 text-xs font-black transition-all cursor-pointer ${
                    fontSize === 'large'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Type className={`w-5.5 h-5.5 ${fontSize === 'large' ? 'text-white' : 'text-slate-500'}`} />
                  <span>اندازه بزرگ (خوانا)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 5: CAMERA IMAGE QUALITY (OPTIMIZATION) */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Camera className="w-5 h-5 text-blue-600 shrink-0" />
            <h3 className="text-xs font-black text-slate-900">۵. کیفیت تصاویر دوربین و بهینه‌سازی همگام‌سازی</h3>
          </div>

          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200/60 rounded-2xl p-4 text-xs text-amber-900 leading-relaxed font-bold flex items-start gap-3">
              <span className="text-base select-none shrink-0 mt-0.5">⚠️</span>
              <p>
                در کارگاه‌هایی که سرعت اینترنت نوسان دارد یا ضعیف است، کاهش کیفیت تصاویر پذیرش موجب فشرده‌سازی حداکثری تصاویر شده و سرعت همگام‌سازی و ذخیره‌سازی اطلاعات روی سرور مرکزی ابری را تا <span className="text-blue-700 font-black">۱۰ برابر</span> سریع‌تر می‌کند.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Quality Low */}
              <button
                type="button"
                onClick={() => setCameraQuality('low')}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between h-full ${
                  cameraQuality === 'low'
                    ? 'bg-emerald-50/70 border-emerald-500 text-emerald-950 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">حجم اقتصادی (سرعت فوق‌العاده)</span>
                    {cameraQuality === 'low' && <Check className="w-4 h-4 text-emerald-600" />}
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                    فشرده‌سازی بسیار بالا (حدود ۵۰ کیلوبایت). مناسب برای اینترنت همراه نسل دوم/سوم یا شرایطی که همگام‌سازی مدام با شکست مواجه می‌شود.
                  </p>
                </div>
                <div className="mt-4 pt-2.5 border-t border-slate-200/50 flex items-center justify-between text-[10px] font-mono font-bold text-slate-400">
                  <span>میانگین سایز فایل:</span>
                  <span className={cameraQuality === 'low' ? 'text-emerald-700 font-black' : ''}>~۵۰ KB</span>
                </div>
              </button>

              {/* Quality Medium */}
              <button
                type="button"
                onClick={() => setCameraQuality('medium')}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between h-full ${
                  cameraQuality === 'medium'
                    ? 'bg-blue-50/70 border-blue-500 text-blue-950 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">پیش‌فرض (کیفیت متعادل)</span>
                    {cameraQuality === 'medium' && <Check className="w-4 h-4 text-blue-600" />}
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                    وضوح مطلوب همراه با فشرده‌سازی استاندارد (حدود ۱۵۰ کیلوبایت). موازنه ایده‌آل بین خوانایی نوشته‌های دستگاه و سرعت همگام‌سازی عمومی.
                  </p>
                </div>
                <div className="mt-4 pt-2.5 border-t border-slate-200/50 flex items-center justify-between text-[10px] font-mono font-bold text-slate-400">
                  <span>میانگین سایز فایل:</span>
                  <span className={cameraQuality === 'medium' ? 'text-blue-700 font-black' : ''}>~۱۵۰ KB</span>
                </div>
              </button>

              {/* Quality High */}
              <button
                type="button"
                onClick={() => setCameraQuality('high')}
                className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between h-full ${
                  cameraQuality === 'high'
                    ? 'bg-purple-50/70 border-purple-500 text-purple-950 shadow-xs'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black">کیفیت اصلی (حداکثر وضوح)</span>
                    {cameraQuality === 'high' && <Check className="w-4 h-4 text-purple-600" />}
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold leading-relaxed">
                    حداقل فشرده‌سازی برای ثبت جزئیات دقیق قطعه (حدود ۵۰۰ کیلوبایت). مناسب برای شبکه‌های با سرعت بالا (وای‌فای کارگاه) و فیبر نوری.
                  </p>
                </div>
                <div className="mt-4 pt-2.5 border-t border-slate-200/50 flex items-center justify-between text-[10px] font-mono font-bold text-slate-400">
                  <span>میانگین سایز فایل:</span>
                  <span className={cameraQuality === 'high' ? 'text-purple-700 font-black' : ''}>~۵۰۰ KB</span>
                </div>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* SECTION 5: FOOTER BUTTONS */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-black text-xs rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-[0.99]"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>ذخیره تنظیمات کارگاه</span>
        </button>

        {onReturn && (
          <button
            type="button"
            onClick={onReturn}
            className="py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>انصراف و بازگشت</span>
          </button>
        )}
      </div>
    </div>
  );
}
