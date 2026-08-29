import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Clock, 
  User, 
  Cpu, 
  Calendar, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Wrench, 
  Printer, 
  Check, 
  X, 
  Phone, 
  Barcode, 
  Eye, 
  Edit,
  PackageCheck,
  Building,
  MoreVertical
} from 'lucide-react';

interface Dossier {
  id: string; // شماره پرونده
  serial: string; // شماره سریال
  customerName: string; // نام طرف حساب
  customerPhone: string; // شماره تماس
  deviceName: string; // نام دستگاه
  status: 'pending' | 'repairing' | 'ready_test' | 'ready_delivery' | 'delivered';
  receptionDate: string; // تاریخ پذیرش
  technician: string; // تکنسین
  defectDescription: string; // عیب اعلامی
  notes: string; // توضیحات فنی
  totalCost: number; // هزینه تعمیرات (ریال)
}

const INITIAL_DOSSIERS: Dossier[] = [
  {
    id: '1042',
    serial: 'SN-9082',
    customerName: 'صنایع فولاد پاسارگاد (اکبری)',
    customerPhone: '09121112233',
    deviceName: 'اینورتر جوشکاری الکترو اسپرینگ ۳۰۰ آمپر',
    status: 'repairing',
    receptionDate: '۱۴۰۵/۰۴/۰۵',
    technician: 'مهندس سهراب مرادی',
    defectDescription: 'عدم خروجی ولتاژ و روشن شدن چراغ قرمز خطا (O.C) بلافاصله پس از روشن شدن دستگاه.',
    notes: 'آیسی‌های درایور ماسفت تغذیه و گیت‌درایور تعویض شدند. در حال حاضر اتصالی رفع شده و نیاز به تست توان نهایی است.',
    totalCost: 18500000
  },
  {
    id: '1043',
    serial: 'SN-4402',
    customerName: 'فناوران داده رایان (کریمی)',
    customerPhone: '09351112233',
    deviceName: 'پاور سوئیچینگ سوپر فلاور ۲۰۰۰ وات صنعتی',
    status: 'pending',
    receptionDate: '۱۴۰۵/۰۴/۰۷',
    technician: 'مهندس احمدی',
    defectDescription: 'صدای بوق شدید ممتد و قطع شدن ریل ۱۲ ولت در بار بالای ۵۰ آمپر.',
    notes: 'در صف بررسی اولیه کارگاه قرار دارد. تست اولیه نشان‌دهنده نوسان پایداری خازن‌های فیلتر خروجی است.',
    totalCost: 0
  },
  {
    id: '1044',
    serial: 'SN-1234',
    customerName: 'مرتضی قاسمی (طرف حساب همکار)',
    customerPhone: '09198765432',
    deviceName: 'برد کنترلر پمپ آب هوشمند Wilo آلمان',
    status: 'ready_test',
    receptionDate: '۱۴۰۵/۰۴/۰۶',
    technician: 'مهندس حسینی',
    defectDescription: 'عدم استارت پمپ سه فاز و سوختگی ظاهری و قطعات پودر شده در مسیر فیدبک جریان.',
    notes: 'اپتوکوپلرها و مقاومت‌های شنت تعویض شدند. برنامه‌ریزی میکروکنترلر مجدداً انجام شد. آماده برای تست در میز هیدرولیک کارگاه.',
    totalCost: 12000000
  },
  {
    id: '1045',
    serial: 'SN-5001',
    customerName: 'زهرا صادقی (خانگی)',
    customerPhone: '09120004455',
    deviceName: 'برد اصلی مایکروویو ال‌جی Solardom',
    status: 'ready_delivery',
    receptionDate: '۱۴۰۵/۰۴/۰۲',
    technician: 'مهندس سهراب مرادی',
    defectDescription: 'جرقه زدن شدید حین کارکرد و خاموش شدن ناگهانی نمایشگر جلویی.',
    notes: 'ترانس تغذیه کنترلر و خازن مایکای محفظه تعویض شدند. دستگاه به مدت ۲ ساعت تست کامل حرارتی شد و بی‌نقص است.',
    totalCost: 6500000
  },
  {
    id: '1046',
    serial: 'SN-8821',
    customerName: 'کلینیک دندانپزشکی آراد (دکتر ناصری)',
    customerPhone: '09139998877',
    deviceName: 'منبع تغذیه یونیت دندانپزشکی کستلینی',
    status: 'delivered',
    receptionDate: '۱۴۰۵/۰۳/۲۸',
    technician: 'مهندس احمدی',
    defectDescription: 'افت شدید ولتاژ ۲۴ ولت به ۱۲ ولت در زمان فعال‌سازی کمپرسور باد.',
    notes: 'رگولاتور جریان تعویض شد و خازن‌های فرسوده نوسان‌گیر تعویض گردیدند. دستگاه تحویل دکتر ناصری شد و تسویه حساب کامل انجام گرفت.',
    totalCost: 9800000
  },
  {
    id: '1047',
    serial: 'SN-3392',
    customerName: 'صنایع چوب البرز (هاشمی)',
    customerPhone: '09127773344',
    deviceName: 'برد کنترلر دستگاه لبه‌چسبان پی‌وی‌سی لایزر',
    status: 'pending',
    receptionDate: '۱۴۰۵/۰۴/۰۹',
    technician: 'مهندس حسینی',
    defectDescription: 'کار نکردن المنت پیش‌گرمکن و نمایش خطای کالیبراسیون سنسور دما روی نمایشگر.',
    notes: 'بررسی فیزیکی کانکتورها و سیم‌کشی‌های حسگر دما نشان داد که مسیر آنالوگ برد آسیب دیده است.',
    totalCost: 0
  }
];

type SearchType = 'id' | 'serial' | 'customerName' | 'customerPhone';

export default function P013DossierSearch() {
  const [dossiers, setDossiers] = useState<Dossier[]>(INITIAL_DOSSIERS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchType, setSearchType] = useState<SearchType>('serial');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modal control states
  const [selectedDossier, setSelectedDossier] = useState<Dossier | null>(null);
  const [activeModal, setActiveModal] = useState<'view' | 'edit' | 'print' | 'deliver' | 'print_label' | null>(null);

  // Sorting & Menu States
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Edit form states
  const [editStatus, setEditStatus] = useState<Dossier['status']>('pending');
  const [editTechnician, setEditTechnician] = useState<string>('');
  const [editReceptionDate, setEditReceptionDate] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editCost, setEditCost] = useState<number>(0);
  const [dossierToDeleteId, setDossierToDeleteId] = useState<string | null>(null);

  // Conversion utility for English to Persian numbers
  const toPersianNum = (numStr: string | number) => {
    const pDict = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
    return numStr.toString().replace(/[0-9]/g, (w) => pDict[parseInt(w)]);
  };

  const getStatusInfo = (status: Dossier['status']) => {
    switch (status) {
      case 'pending':
        return { label: '🔵 در انتظار تعمیر', color: 'bg-blue-100 text-blue-800 border-blue-300 font-extrabold shadow-sm' };
      case 'repairing':
        return { label: '🟠 در حال تعمیر', color: 'bg-orange-100 text-orange-800 border-orange-300 font-extrabold shadow-sm' };
      case 'ready_test':
        return { label: '🟢 آماده تست', color: 'bg-green-100 text-green-800 border-green-300 font-extrabold shadow-sm' };
      case 'ready_delivery':
        return { label: '🟣 آماده تحویل', color: 'bg-purple-100 text-purple-800 border-purple-300 font-extrabold shadow-sm' };
      case 'delivered':
        return { label: '⚫ تحویل شده', color: 'bg-slate-200 text-slate-800 border-slate-400 font-extrabold shadow-sm' };
    }
  };

  const handleDeleteDossier = (id: string) => {
    setDossierToDeleteId(id);
  };

  // Search logic
  const filteredDossiers = dossiers.filter(dossier => {
    // 1. Filter by status
    if (statusFilter !== 'all') {
      if (statusFilter === 'pending' && dossier.status !== 'pending') return false;
      if (statusFilter === 'under_repair' && dossier.status !== 'repairing') return false;
      if (statusFilter === 'ready_test' && dossier.status !== 'ready_test') return false;
      if (statusFilter === 'ready_delivery' && dossier.status !== 'ready_delivery') return false;
      if (statusFilter === 'delivered' && dossier.status !== 'delivered') return false;
    }

    // 2. Filter by search query
    if (!searchQuery.trim()) return true;
    const query = searchQuery.trim().toLowerCase();

    if (searchType === 'id') {
      return dossier.id.toLowerCase().includes(query);
    } else if (searchType === 'serial') {
      return dossier.serial.toLowerCase().includes(query);
    } else if (searchType === 'customerName') {
      return dossier.customerName.toLowerCase().includes(query);
    } else if (searchType === 'customerPhone') {
      return dossier.customerPhone.toLowerCase().includes(query);
    }
    return true;
  });

  // Sort logic (newest / oldest based on ID sequence)
  const sortedDossiers = [...filteredDossiers].sort((a, b) => {
    if (sortBy === 'newest') {
      return parseInt(b.id) - parseInt(a.id);
    } else {
      return parseInt(a.id) - parseInt(b.id);
    }
  });

  // Action Triggers
  const openActionModal = (dossier: Dossier, action: 'view' | 'edit' | 'print' | 'deliver' | 'print_label') => {
    setSelectedDossier(dossier);
    setActiveModal(action);

    if (action === 'edit') {
      setEditStatus(dossier.status);
      setEditTechnician(dossier.technician);
      setEditReceptionDate(dossier.receptionDate);
      setEditNotes(dossier.notes);
      setEditCost(dossier.totalCost);
    }
  };

  const handleSaveEdit = () => {
    if (!selectedDossier) return;
    setDossiers(prev => prev.map(d => {
      if (d.id === selectedDossier.id) {
        return {
          ...d,
          status: editStatus,
          technician: editTechnician,
          receptionDate: editReceptionDate,
          notes: editNotes,
          totalCost: editCost
        };
      }
      return d;
    }));
    setActiveModal(null);
    setSelectedDossier(null);
  };

  const handleDeliverDossier = () => {
    if (!selectedDossier) return;
    setDossiers(prev => prev.map(d => {
      if (d.id === selectedDossier.id) {
        return {
          ...d,
          status: 'delivered'
        };
      }
      return d;
    }));
    setActiveModal(null);
    setSelectedDossier(null);
  };

  return (
    <div className="space-y-6 text-right pb-24" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center">
              <Search className="w-4.5 h-4.5" />
            </div>
            <span>جستجو و مدیریت پرونده کارگاه</span>
          </h3>
          <p className="text-[10px] text-slate-500 font-bold mt-0.5">
            سیستم داخلی کارگاه الکترونیک برای ردیابی زنده وضعیت تعمیرات، چاپ فاکتور و ترخیص سریع دستگاه‌ها
          </p>
        </div>
        <div className="bg-slate-100 text-slate-600 rounded-full px-3 py-1 text-[10px] font-black">
          محیط کاربری داخلی کارگاه
        </div>
      </div>

      {/* ۱. کادر جستجوی بزرگ در بالای صفحه */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              searchType === 'id' ? "شماره پرونده مورد نظر را وارد کنید... (مثلا: 1042)" :
              searchType === 'serial' ? "شماره سریال دستگاه را وارد کنید... (مثلا: SN-9082)" :
              searchType === 'customerName' ? "نام طرف حساب یا شرکت را بنویسید..." :
              "شماره تماس طرف حساب را جستجو کنید..."
            }
            className="w-full pl-4 pr-11 py-3.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-slate-800 rounded-2xl text-xs font-black outline-none transition-all shadow-inner"
          />
        </div>

        {/* ۲. گزینه‌های انتخاب معیار جستجو */}
        <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
          <span className="text-[11px] text-slate-400 font-bold ml-1">جستجو بر اساس:</span>
          
          <button
            type="button"
            onClick={() => setSearchType('id')}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-black transition-all cursor-pointer ${
              searchType === 'id'
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            شماره پرونده
          </button>

          <button
            type="button"
            onClick={() => setSearchType('serial')}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-black transition-all cursor-pointer ${
              searchType === 'serial'
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            شماره سریال
          </button>

          <button
            type="button"
            onClick={() => setSearchType('customerName')}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-black transition-all cursor-pointer ${
              searchType === 'customerName'
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            نام طرف حساب
          </button>

          <button
            type="button"
            onClick={() => setSearchType('customerPhone')}
            className={`px-3 py-1.5 rounded-lg border text-[11px] font-black transition-all cursor-pointer ${
              searchType === 'customerPhone'
                ? 'bg-slate-900 border-slate-900 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            شماره تماس
          </button>
        </div>
      </div>

      {/* ۳. فیلترهای سریع */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
        <span className="text-[11px] text-slate-400 font-bold shrink-0">فیلتر وضعیت:</span>
        <div className="flex gap-1.5 shrink-0">
          {[
            { id: 'all', label: 'همه پرونده‌ها' },
            { id: 'pending', label: 'در انتظار تعمیر' },
            { id: 'under_repair', label: 'در حال تعمیر' },
            { id: 'ready_test', label: 'آماده تست' },
            { id: 'ready_delivery', label: 'آماده تحویل' },
            { id: 'delivered', label: 'تحویل شده' }
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-[10.5px] font-black transition-all cursor-pointer border ${
                statusFilter === f.id
                  ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ۴. نمایش نتایج به صورت کارت یا لیست */}
      <div className="space-y-3.5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 text-[10.5px] text-slate-500 font-bold px-1 bg-slate-50 p-3 rounded-2xl border border-slate-200/60">
          <div className="flex items-center gap-2">
            <span>تعداد پرونده‌های یافت شده: {toPersianNum(filteredDossiers.length)} مورد</span>
            {searchQuery && <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[9px]">فیلتر فعال</span>}
          </div>
          <div className="flex items-center gap-1.5">
            <span>مرتب‌سازی:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
              className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-700 font-black cursor-pointer focus:outline-none text-[10.5px]"
            >
              <option value="newest">جدیدترین</option>
              <option value="oldest">قدیمی‌ترین</option>
            </select>
          </div>
        </div>

        {sortedDossiers.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center text-slate-400 space-y-2">
            <Search className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
            <h4 className="text-xs font-black text-slate-800">هیچ پرونده‌ای یافت نشد</h4>
            <p className="text-[10px] text-slate-400 font-bold max-w-xs mx-auto leading-relaxed">
              با تغییر عبارت جستجو یا تغییر فیلتر وضعیت، مجدداً تلاش کنید. اطلاعات ورودی را بررسی نمایید.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3.5">
            {sortedDossiers.map((dossier) => {
              const status = getStatusInfo(dossier.status);
              return (
                <div 
                  key={dossier.id}
                  className="bg-white border border-slate-200 hover:border-slate-300 rounded-3xl p-5 shadow-xs transition-all hover:shadow-xs flex flex-col justify-between gap-4 relative overflow-hidden"
                >
                  {/* Top row: Dossier ID & Status & Action Menu */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-base md:text-lg font-black text-slate-900">
                        پرونده شماره: {toPersianNum(dossier.id)}
                      </span>
                      <span className={`px-2.5 py-1 rounded-full border text-[10px] font-black w-fit ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    {/* Operations dropdown menu */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenMenuId(openMenuId === dossier.id ? null : dossier.id)}
                        className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-all cursor-pointer border border-slate-100 hover:border-slate-300"
                        title="عملیات پرونده"
                      >
                        <MoreVertical className="w-4.5 h-4.5" />
                      </button>
                      
                      {openMenuId === dossier.id && (
                        <>
                          {/* Invisible full-screen overlay to close menu on click outside */}
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                          
                          <div className="absolute left-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 w-44 z-50 text-right animate-fade-in">
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                openActionModal(dossier, 'view');
                              }}
                              className="w-full text-right px-4 py-2 hover:bg-slate-50 text-[11px] font-black text-slate-700 flex items-center gap-2 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-blue-500" />
                              <span>مشاهده پرونده</span>
                            </button>
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                openActionModal(dossier, 'edit');
                              }}
                              className="w-full text-right px-4 py-2 hover:bg-slate-50 text-[11px] font-black text-slate-700 flex items-center gap-2 cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5 text-orange-500" />
                              <span>ویرایش</span>
                            </button>
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                openActionModal(dossier, 'print');
                              }}
                              className="w-full text-right px-4 py-2 hover:bg-slate-50 text-[11px] font-black text-slate-700 flex items-center gap-2 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5 text-green-500" />
                              <span>چاپ رسید</span>
                            </button>
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                setSelectedDossier(dossier);
                                setActiveModal('print_label');
                              }}
                              className="w-full text-right px-4 py-2 hover:bg-slate-50 text-[11px] font-black text-slate-700 flex items-center gap-2 cursor-pointer"
                            >
                              <Barcode className="w-3.5 h-3.5 text-purple-500" />
                              <span>چاپ برچسب</span>
                            </button>
                            
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                openActionModal(dossier, 'deliver');
                              }}
                              disabled={dossier.status === 'delivered'}
                              className={`w-full text-right px-4 py-2 hover:bg-slate-50 text-[11px] font-black flex items-center gap-2 cursor-pointer ${
                                dossier.status === 'delivered' ? 'text-slate-300 cursor-not-allowed' : 'text-emerald-600'
                              }`}
                            >
                              <PackageCheck className="w-3.5 h-3.5" />
                              <span>تحویل دستگاه</span>
                            </button>

                            <div className="border-t border-slate-100 my-1" />
                            
                            <button
                              onClick={() => {
                                setOpenMenuId(null);
                                handleDeleteDossier(dossier.id);
                              }}
                              className="w-full text-right px-4 py-2 hover:bg-red-50 text-[11px] font-black text-red-600 flex items-center gap-2 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5 text-red-500" />
                              <span>حذف (فقط مدیر)</span>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Details block */}
                  <div className="space-y-3 flex-1">
                    {/* Device row */}
                    <div className="flex items-center gap-1.5 text-[12px] font-black text-slate-900">
                      <Cpu className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>{dossier.deviceName}</span>
                    </div>

                    {/* Serial Number Row (Required as a clear row) */}
                    <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100 max-w-sm">
                      <Barcode className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-500 text-[11px] font-bold">شماره سریال:</span>
                      <span className="text-slate-900 font-mono font-black text-xs tracking-wider" dir="ltr">{dossier.serial}</span>
                    </div>

                    {/* Metadata: Customer, Date, Tech */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] font-bold text-slate-600 border-t border-slate-100/60">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-400">طرف حساب:</span>
                        <span className="text-slate-900">{dossier.customerName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-400">تاریخ پذیرش:</span>
                        <span className="text-slate-900 font-mono">{dossier.receptionDate}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-400">تکنسین:</span>
                        <span className="text-slate-900">{dossier.technician || 'نامشخص'}</span>
                      </div>
                    </div>

                    {/* Defect preview */}
                    <p className="text-[10px] text-slate-400 leading-relaxed font-semibold bg-slate-50/50 p-2.5 rounded-xl border border-slate-100">
                      <strong className="text-slate-500">عیب اعلامی:</strong> {dossier.defectDescription}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ================= MODAL: VIEW DOSSIER (مشاهده) ================= */}
      {activeModal === 'view' && selectedDossier && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-3xl w-full max-w-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <div>
                  <h4 className="text-xs font-black">جزئیات پرونده تعمیرات شماره {toPersianNum(selectedDossier.id)}</h4>
                  <p className="text-[9px] text-slate-400 font-bold">نمایش کامل مستندات فنی و سوابق دستگاه</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
              {/* Main specifications */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">نام دستگاه و مدل:</span>
                  <span className="text-xs font-black text-slate-900">{selectedDossier.deviceName}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">شماره سریال سخت‌افزاری:</span>
                  <span className="text-xs font-black text-slate-900 font-mono" dir="ltr">{selectedDossier.serial}</span>
                </div>
                <div className="space-y-1 border-t border-slate-200/60 pt-2.5">
                  <span className="text-[10px] text-slate-400 font-bold block">نام طرف حساب پذیرش:</span>
                  <span className="text-xs font-black text-slate-900">{selectedDossier.customerName}</span>
                </div>
                <div className="space-y-1 border-t border-slate-200/60 pt-2.5">
                  <span className="text-[10px] text-slate-400 font-bold block">تلفن تماس:</span>
                  <span className="text-xs font-black text-slate-900 font-mono">{toPersianNum(selectedDossier.customerPhone)}</span>
                </div>
              </div>

              {/* Status and dates */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                  <span className="text-[9px] text-slate-400 font-bold block">وضعیت فعلی:</span>
                  <span className="text-[10px] font-black text-blue-700 mt-1 block">
                    {getStatusInfo(selectedDossier.status).label}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                  <span className="text-[9px] text-slate-400 font-bold block">تاریخ پذیرش:</span>
                  <span className="text-[10px] font-black text-slate-800 mt-1 block font-mono">
                    {selectedDossier.receptionDate}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                  <span className="text-[9px] text-slate-400 font-bold block">تکنسین مربوطه:</span>
                  <span className="text-[10px] font-black text-slate-800 mt-1 block">
                    {selectedDossier.technician || 'تعیین نشده'}
                  </span>
                </div>
              </div>

              {/* Descriptions */}
              <div className="space-y-2.5">
                <div className="bg-amber-50/50 border border-amber-100 p-3 rounded-xl space-y-1">
                  <span className="text-[10px] text-amber-800 font-black block">ایراد ثبت شده زمان پذیرش:</span>
                  <p className="text-[11px] text-slate-700 leading-relaxed font-semibold">{selectedDossier.defectDescription}</p>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-500 font-black block">توضیحات فنی تکنسین کارگاه:</span>
                  <p className="text-[11px] text-slate-700 leading-relaxed font-semibold">{selectedDossier.notes || 'توضیحات ثبت نشده است.'}</p>
                </div>
              </div>

              {/* Cost */}
              <div className="border-t border-slate-100 pt-3 flex justify-between items-center bg-slate-900 text-white p-4 rounded-2xl">
                <span className="text-xs font-bold text-slate-300">برآورد هزینه نهایی تعمیرات:</span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  {selectedDossier.totalCost > 0 ? `${toPersianNum(selectedDossier.totalCost.toLocaleString())} ریال` : 'در انتظار اعلام عیب'}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black rounded-xl transition-all cursor-pointer">
                بستن پنجره
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: EDIT DOSSIER (ویرایش) ================= */}
      {activeModal === 'edit' && selectedDossier && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-3xl w-full max-w-xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-900 text-white px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-400" />
                <div>
                  <h4 className="text-xs font-black">ویرایش پرونده شماره {toPersianNum(selectedDossier.id)}</h4>
                  <p className="text-[9px] text-slate-400 font-bold">تغییر وضعیت، تخصیص تکنسین و ثبت گزارشات فنی کارگاه</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
              {/* Status Select */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 font-extrabold block">وضعیت پرونده الکترونیک:</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as Dossier['status'])}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none focus:bg-white focus:border-slate-800"
                >
                  <option value="pending">در انتظار تعمیر (صف انتظار)</option>
                  <option value="under_repair">در حال عیب‌یابی و تعمیر کارگاهی</option>
                  <option value="ready_test">آماده تست نهایی سخت‌افزاری</option>
                  <option value="ready_delivery">آماده تحویل به طرف حساب</option>
                  <option value="delivered">تحویل شده و تسویه حساب نهایی</option>
                </select>
              </div>

              {/* Technician and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 font-extrabold block">تکنسین مسئول تعمیر:</label>
                  <input
                    type="text"
                    value={editTechnician}
                    onChange={(e) => setEditTechnician(e.target.value)}
                    placeholder="نام مهندس مربوطه"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none focus:bg-white focus:border-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-500 font-extrabold block">تاریخ پذیرش قطعه:</label>
                  <input
                    type="text"
                    value={editReceptionDate}
                    onChange={(e) => setEditReceptionDate(e.target.value)}
                    placeholder="مثال: ۱۴۰۵/۰۴/۰۵"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none focus:bg-white focus:border-slate-800 font-mono"
                  />
                </div>
              </div>

              {/* Cost */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 font-extrabold block">هزینه نهایی خدمات و قطعات (ریال):</label>
                <input
                  type="number"
                  value={editCost}
                  onChange={(e) => setEditCost(parseInt(e.target.value) || 0)}
                  placeholder="مبلغ به ریال"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black outline-none focus:bg-white focus:border-slate-800 font-mono text-left"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] text-slate-500 font-extrabold block">یادداشت فنی و گزارش اقدامات تکنسین:</label>
                <textarea
                  rows={4}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="جزئیات تعویض قطعه، محل خرابی برد و تست‌های بارگذاری..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-slate-800 leading-relaxed resize-none"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-4 border-t border-slate-100 flex justify-end gap-2.5">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black rounded-xl transition-all cursor-pointer">
                لغو تغییرات
              </button>
              <button onClick={handleSaveEdit} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs">
                ذخیره تغییرات پرونده
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: PRINT RECEIPT (چاپ رسید) ================= */}
      {activeModal === 'print' && selectedDossier && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-100 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-slate-700" />
                <div>
                  <h4 className="text-xs font-black">صدور رسید و فیش حرارتی پذیرش</h4>
                  <p className="text-[9px] text-slate-500 font-bold">نسخه چاپی طرف حساب و فیش الصاقی روی جعبه دستگاه</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Simulated Thermal Receipt Frame */}
            <div className="p-5 flex-1 overflow-y-auto max-h-[60vh] bg-slate-50 flex justify-center">
              <div className="bg-white border border-slate-300 w-72 p-4 shadow-sm text-[10.5px] font-bold text-slate-800 space-y-4 font-mono leading-relaxed" style={{ fontFamily: 'monospace, sans-serif' }}>
                {/* Header */}
                <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
                  <div className="flex justify-center mb-1">
                    <Building className="w-7 h-7 text-slate-800" />
                  </div>
                  <span className="text-xs font-black block">کارگاه الکترونیک دیاکو</span>
                  <span className="text-[8px] text-slate-500 block">رسید پذیرش موقت و رهگیری دستگاه</span>
                </div>

                {/* Receipt fields */}
                <div className="space-y-1.5 text-right">
                  <div className="flex justify-between">
                    <span className="text-slate-500">شماره پرونده:</span>
                    <span className="font-black">{toPersianNum(selectedDossier.id)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">سریال سخت‌افزار:</span>
                    <span className="font-black">{selectedDossier.serial}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">طرف حساب:</span>
                    <span className="font-black">{selectedDossier.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">تلفن:</span>
                    <span className="font-black">{toPersianNum(selectedDossier.customerPhone)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">تاریخ ورود:</span>
                    <span className="font-black">{selectedDossier.receptionDate}</span>
                  </div>
                </div>

                {/* Product block */}
                <div className="border-t border-b border-dashed border-slate-300 py-2.5 text-right">
                  <span className="text-slate-500 block mb-1">نام دستگاه تحویلی:</span>
                  <span className="font-black text-xs block leading-normal">{selectedDossier.deviceName}</span>
                </div>

                {/* Disclaimers */}
                <div className="text-[8px] text-slate-500 space-y-1 text-justify leading-relaxed border-b border-dashed border-slate-300 pb-3">
                  <p>۱. تحویل دستگاه صرفاً در قبال ارائه این رسید انجام خواهد گرفت.</p>
                  <p>۲. مهلت تست دستگاه‌های تعمیر شده ۴۸ ساعت از زمان ترخیص می‌باشد.</p>
                  <p>۳. قطعات تعویض شده به مدت یک ماه گارانتی کارگاهی می‌باشند.</p>
                </div>

                {/* Barcode representation */}
                <div className="flex flex-col items-center justify-center pt-1 gap-1">
                  <div className="h-6 w-44 bg-slate-900 flex items-center justify-center text-white text-[8px] tracking-widest font-mono">
                    ||||||| | || |||| | ||| || {selectedDossier.id}
                  </div>
                  <span className="text-[8px] text-slate-400">سیستم مدیریت متمرکز کارگاهی دیاکو</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black rounded-xl transition-all cursor-pointer">
                لغو و خروج
              </button>
              <button 
                onClick={() => {
                  window.print();
                }} 
                className="px-5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>ارسال به چاپگر حرارتی</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: DELIVER DOSSIER (تحویل) ================= */}
      {activeModal === 'deliver' && selectedDossier && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-emerald-900 text-white px-5 py-4 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-emerald-300" />
                <div>
                  <h4 className="text-xs font-black">ترخیص و تحویل نهایی دستگاه</h4>
                  <p className="text-[9px] text-emerald-200 font-bold">پرونده تعمیراتی {toPersianNum(selectedDossier.id)}</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg text-emerald-400 hover:text-white hover:bg-white/10">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-start gap-3 text-emerald-900">
                <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-xs font-black block">آماده ترخیص و ثبت امضای دریافت</span>
                  <p className="text-[10.5px] leading-relaxed font-semibold">
                    با کلیک روی گزینه ترخیص، دستگاه از وضعیت فعال خارج شده و وضعیت پرونده به <strong className="underline">«تحویل شده»</strong> تغییر می‌یابد. هم‌چنین ثبت امضا و فاکتور تسویه صادر می‌گردد.
                  </p>
                </div>
              </div>

              {/* Cost summary */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl space-y-2.5">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-bold">دستگاه:</span>
                  <span className="font-black text-slate-900">{selectedDossier.deviceName}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-bold">نام تحویل‌گیرنده (طرف حساب):</span>
                  <span className="font-black text-slate-900">{selectedDossier.customerName}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-2.5 text-slate-800">
                  <span className="font-black text-xs">جمع کل فاکتور جهت تسویه:</span>
                  <span className="font-black text-sm text-emerald-700 font-mono">
                    {selectedDossier.totalCost > 0 ? `${toPersianNum(selectedDossier.totalCost.toLocaleString())} ریال` : 'رایگان (تحت گارانتی)'}
                  </span>
                </div>
              </div>

              {/* Checkboxes */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-emerald-600 cursor-pointer" />
                  <span className="text-[10.5px] font-bold text-slate-700">دستگاه تست کامل شد و در حضور طرف حساب سالم روشن گردید.</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl cursor-pointer">
                  <input type="checkbox" defaultChecked className="w-4 h-4 rounded border-slate-300 text-emerald-600 cursor-pointer" />
                  <span className="text-[10.5px] font-bold text-slate-700">برچسب گارانتی طلایی خدمات روی پیچ بدنه چسبانده شد.</span>
                </label>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-4 border-t border-slate-100 flex justify-end gap-2.5">
              <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black rounded-xl transition-all cursor-pointer">
                لغو عملیات
              </button>
              <button onClick={handleDeliverDossier} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-xs">
                تایید ترخیص و تسویه حساب نهایی
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: PRINT LABEL (چاپ برچسب) ================= */}
      {activeModal === 'print_label' && selectedDossier && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in" onClick={() => setActiveModal(null)}>
          <div className="bg-white rounded-3xl w-full max-w-xs border border-slate-200 shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="bg-slate-100 px-4 py-3.5 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Barcode className="w-5 h-5 text-slate-700" />
                <div>
                  <h4 className="text-xs font-black">چاپ برچسب بارکد کارگاه</h4>
                  <p className="text-[9px] text-slate-500 font-bold">جهت الصاق مستقیم روی بدنه دستگاه</p>
                </div>
              </div>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 flex justify-center">
              <div className="bg-white border-2 border-slate-800 w-64 p-3 rounded-xl text-center space-y-2 text-[10px] font-bold text-slate-900 font-mono">
                <div className="border-b border-slate-200 pb-1.5 flex justify-between text-[11px] font-black">
                  <span>کارگاه دیاکو</span>
                  <span>{toPersianNum(selectedDossier.id)}#</span>
                </div>
                <div className="text-right space-y-1 text-[9px] font-sans">
                  <div><span className="text-slate-500 font-bold">دستگاه:</span> {selectedDossier.deviceName}</div>
                  <div><span className="text-slate-500 font-bold">سریال:</span> <span className="font-mono font-black">{selectedDossier.serial}</span></div>
                  <div><span className="text-slate-500 font-bold">طرف حساب:</span> {selectedDossier.customerName}</div>
                  <div><span className="text-slate-500 font-bold">پذیرش:</span> {selectedDossier.receptionDate}</div>
                </div>
                <div className="flex flex-col items-center pt-1 border-t border-slate-100">
                  <div className="h-8 w-44 bg-slate-900 flex items-center justify-center text-white text-[9px] tracking-wider font-mono">
                    |||| || |||| || ||| {selectedDossier.serial}
                  </div>
                  <span className="text-[7px] text-slate-400 mt-1 font-sans">Barcode Label - Diaco Service</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-4 py-2.5 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setActiveModal(null)} className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-black rounded-lg transition-all cursor-pointer">
                انصراف
              </button>
              <button 
                onClick={() => window.print()} 
                className="px-4 py-1.5 bg-slate-900 hover:bg-black text-white text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1"
              >
                <Printer className="w-3 h-3" />
                <span>چاپ لیبل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION DIALOG FOR DOSSIER DELETION */}
      {dossierToDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setDossierToDeleteId(null)} />
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-sm overflow-hidden shadow-2xl relative z-10 text-right p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertCircle className="w-8 h-8 shrink-0" />
              <h3 className="text-sm font-black">حذف پرونده فنی</h3>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed" dir="rtl">
              آیا از حذف پرونده فنی شماره <span className="font-black text-slate-900">«{toPersianNum(dossierToDeleteId)}»</span> اطمینان دارید؟ این عمل غیرقابل بازگشت است.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setDossiers(prev => prev.filter(d => d.id !== dossierToDeleteId));
                  setDossierToDeleteId(null);
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-colors cursor-pointer text-center"
              >
                بله، حذف شود
              </button>
              <button
                type="button"
                onClick={() => setDossierToDeleteId(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
              >
                انصراف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
