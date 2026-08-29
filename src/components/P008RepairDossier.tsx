import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Phone, 
  MessageSquare, 
  Maximize2, 
  RotateCw, 
  ArrowRight, 
  ShieldCheck, 
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
  X,
  Coins,
  Plus,
  Wrench,
  FileText,
  PlusCircle,
  CheckCircle,
  FileCode,
  History,
  AlertTriangle,
  Plug,
  Wifi,
  BookOpen,
  Box,
  Zap
} from 'lucide-react';
import { WarrantyItem, ActiveTab } from '../types';

interface P008RepairDossierProps {
  devFileSerial: string;
  setDevFileSerial: (serial: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  warrantyDb: WarrantyItem[];
  setWarrantyDb?: React.Dispatch<React.SetStateAction<WarrantyItem[]>>;
}

interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  icon: any;
  iconBg: string;
  iconColor: string;
}

interface TechnicalNote {
  id: string;
  content: string;
  author: string;
  timestamp: string;
}

interface RequiredPart {
  id: string;
  name: string;
  code: string;
  status: 'requested' | 'approved' | 'received';
  timestamp: string;
}

interface CostItem {
  id: string;
  title: string;
  amount: string;
  type: 'service' | 'part' | 'other';
  timestamp: string;
}

export default function P008RepairDossier({
  devFileSerial,
  setDevFileSerial,
  setActiveTab,
  warrantyDb = [],
  setWarrantyDb
}: P008RepairDossierProps) {
  
  // Find current item based on the active serial
  const currentItem = useMemo(() => {
    const found = warrantyDb.find(item => item.serial.toUpperCase() === devFileSerial.toUpperCase());
    return found || warrantyDb[0] || {
      serial: devFileSerial || 'W-X208-Y9041',
      itemName: 'برد مادربورد کامپیوتر',
      customerName: 'کامپیوتر آریا (رضایی)',
      customerPhone: '09123456789',
      defectType: 'روشن نمی‌شود / بوق ممتد می‌زند',
      status: 'pending',
      expiryDate: 'گارانتی معتبر دیاکو',
      registeredAt: 'امروز',
    };
  }, [warrantyDb, devFileSerial]);

  // Derived state stable values
  const itemMeta = useMemo(() => {
    const index = warrantyDb.findIndex(item => item.serial === currentItem.serial);
    const safeIndex = index >= 0 ? index : 1;
    
    const intakeNo = currentItem.intakeNo || `DEC-1405${100 + safeIndex}`;
    
    let model = currentItem.model || 'ASUS ROG STRIX B760-G';
    if (!currentItem.model) {
      if (currentItem.itemName.includes('DU')) model = 'DU-PWR-24';
      else if (currentItem.itemName.includes('DEC')) model = 'DEC-MD-08';
      else if (currentItem.itemName.includes('برد')) model = 'ASUS ROG STRIX B760-G';
      else if (currentItem.itemName.includes('آداپتور')) model = 'TS-ADP-05';
      else if (currentItem.itemName.includes('باتری')) model = 'PL-BAT-12';
    }

    let warrantyStatus = currentItem.warrantyStatus || 'گارانتی معتبر دیاکو';
    if (!currentItem.warrantyStatus) {
      if (currentItem.expiryDate === 'بدون گارانتی' || currentItem.expiryDate === 'فاقد گارانتی') {
        warrantyStatus = 'تعمیرات آزاد';
      } else if (safeIndex % 3 === 1) {
        warrantyStatus = 'نزدیک پایان گارانتی';
      } else if (safeIndex % 5 === 0) {
        warrantyStatus = 'گارانتی منقضی شده';
      }
    }

    let priority: 'عادی' | 'فوری' | 'خیلی فوری' = currentItem.priority || 'فوری';
    if (!currentItem.priority) {
      if (safeIndex % 4 === 1 || currentItem.defectType?.includes('فوری')) {
        priority = 'فوری';
      } else if (safeIndex % 6 === 0) {
        priority = 'خیلی فوری';
      } else if (safeIndex % 3 === 0) {
        priority = 'عادی';
      }
    }

    let waitingDays = currentItem.waitingDaysCount !== undefined ? `${currentItem.waitingDaysCount} روز` : '۳ روز';
    if (currentItem.waitingDaysCount === undefined) {
      if (currentItem.status === 'pending') {
        waitingDays = '۳ روز';
      } else if (currentItem.status === 'under_repair') {
        waitingDays = '۵ روز';
      } else if (currentItem.status === 'waiting_parts') {
        waitingDays = '۷ روز';
      } else {
        waitingDays = '۱ روز';
      }
    }

    return {
      intakeNo,
      model,
      warrantyStatus,
      priority,
      waitingDays
    };
  }, [currentItem, warrantyDb]);

  // Tab state
  const [activeSubTab, setActiveSubTab] = useState<'info' | 'diagnose' | 'parts' | 'costs' | 'images' | 'history'>('info');

  // Interactive local simulated lists (hydrated deterministically based on serial)
  const [timeline, setTimeline] = useState<TimelineEvent[]>([
    {
      id: '5',
      title: 'توسط تعمیرکار باز شد',
      description: 'پرونده تعمیراتی دستگاه جهت شروع بررسی فنی و عیب‌یابی الکترونیکی توسط تعمیرکار شیفت باز گردید.',
      timestamp: 'امروز - ۱۰:۴۰',
      icon: CheckCircle,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600'
    },
    {
      id: '4',
      title: 'منتظر شروع عیب‌یابی',
      description: 'دستگاه در قفسه مربوطه چیدمان شده و در وضعیت انتظار برای تست ولتاژ و عیب‌یابی قرار گرفت.',
      timestamp: '۱۴۰۵/۰۴/۰۵ - ۱۲:۱۵',
      icon: Clock,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600'
    },
    {
      id: '3',
      title: 'پرونده وارد صف تعمیرات شد',
      description: 'دستور کارگاه صادر گردید و دستگاه به بخش تعمیر بردهای الکترونیکی انتقال یافت.',
      timestamp: '۱۴۰۵/۰۴/۰۵ - ۱۱:۳۰',
      icon: Layers,
      iconBg: 'bg-indigo-500/10',
      iconColor: 'text-indigo-600'
    },
    {
      id: '2',
      title: 'رسید پذیرش صادر شد',
      description: 'قبض چاپی پذیرش به همراه بارکد وضعیت ترخیص صادر و تحویل طرف حساب گردید.',
      timestamp: '۱۴۰۵/۰۴/۰۵ - ۱۰:۴۵',
      icon: FileText,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600'
    },
    {
      id: '1',
      title: 'پذیرش ثبت شد',
      description: 'اطلاعات اولیه دستگاه، علائم خرابی و گارانتی توسط مریم حیدری ثبت فیزیکی شد.',
      timestamp: '۱۴۰۵/۰۴/۰۵ - ۱۰:۳۰',
      icon: CheckCircle,
      iconBg: 'bg-slate-500/10',
      iconColor: 'text-slate-600'
    }
  ]);

  const [notes, setNotes] = useState<TechnicalNote[]>([
    {
      id: 'n1',
      content: 'تست ولتاژ ریل ۵ ولت استندبای انجام شد. ولتاژ ۵.۱ ولت و پایدار است. دستگاه واکنش فیزیکی به دکمه پاور ندارد.',
      author: 'مهندس رضایی (بخش بردهای کامپیوتری)',
      timestamp: 'امروز - ۱۰:۴۵'
    }
  ]);

  const [parts, setParts] = useState<RequiredPart[]>([
    {
      id: 'p1',
      name: 'آی‌سی کنترلر تغذیه PWM مدل RT8205',
      code: 'IC-RT8205-PWM',
      status: 'approved',
      timestamp: '۱۴۰۵/۰۴/۰۶ - ۰۹:۱۵'
    }
  ]);

  const [costs, setCosts] = useState<CostItem[]>([
    {
      id: 'c1',
      title: 'اجرت عیب‌یابی و عیب‌زدایی تخصصی برد',
      amount: '۴۵۰,۰۰۰ تومان',
      type: 'service',
      timestamp: 'امروز - ۱۱:۰۰'
    }
  ]);

  const [repairPhotos, setRepairPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1601524909162-be87252be298?w=500&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=500&auto=format&fit=crop&q=80'
  ]);

  // Modal controls
  const [activeModal, setActiveModal] = useState<'note' | 'part' | 'cost' | 'photo' | 'zoom' | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string>('');
  const [imageRotation, setImageRotation] = useState<number>(0);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Form states for modals
  const [noteText, setNoteText] = useState('');
  const [partName, setPartName] = useState('');
  const [partCode, setPartCode] = useState('');
  const [costTitle, setCostTitle] = useState('');
  const [costAmount, setCostAmount] = useState('');
  const [costType, setCostType] = useState<'service' | 'part' | 'other'>('service');

  // Trigger toast alert
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Helper to sync global state back to App's DB if possible
  const updateGlobalStatus = (newStatus: 'pending' | 'under_repair' | 'waiting_parts' | 'replaced' | 'rejected') => {
    if (setWarrantyDb) {
      setWarrantyDb(prev => prev.map(item => {
        if (item.serial === currentItem.serial) {
          return { ...item, status: newStatus };
        }
        return item;
      }));
    }
  };

  // 1. Action: Start Troubleshooting
  const handleStartTroubleshooting = () => {
    if (currentItem.status === 'under_repair') {
      showToast('دستگاه در حال حاضر در وضعیت عیب‌یابی و تعمیر قرار دارد.', 'info');
      return;
    }
    
    updateGlobalStatus('under_repair');
    
    // Add event to timeline
    const newEvent: TimelineEvent = {
      id: Math.random().toString(),
      title: 'شروع فرآیند عیب‌یابی تخصصی',
      description: 'تعمیرکار بررسی‌های فنی و عیب‌یابی الکترونیکی قطعه را رسماً آغاز کرد.',
      timestamp: 'امروز - هم‌اکنون',
      icon: Hammer,
      iconBg: 'bg-blue-600/10',
      iconColor: 'text-blue-600'
    };
    setTimeline(prev => [newEvent, ...prev]);
    showToast('وضعیت دستگاه به «در حال تعمیر / عیب‌یابی» تغییر یافت.', 'success');
  };

  // 2. Action: Save Technical Note
  const handleSaveNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;

    const newNote: TechnicalNote = {
      id: Math.random().toString(),
      content: noteText,
      author: 'تعمیرکار شیفت (کارگاه فنی دیاکو)',
      timestamp: 'امروز - هم‌اکنون'
    };

    setNotes(prev => [newNote, ...prev]);

    // Log to timeline
    const newEvent: TimelineEvent = {
      id: Math.random().toString(),
      title: 'ثبت یادداشت فنی جدید',
      description: noteText,
      timestamp: 'امروز - هم‌اکنون',
      icon: FileText,
      iconBg: 'bg-slate-900/10',
      iconColor: 'text-slate-900'
    };
    setTimeline(prev => [newEvent, ...prev]);

    setNoteText('');
    setActiveModal(null);
    showToast('یادداشت فنی با موفقیت در پرونده ذخیره شد.', 'success');
  };

  // 3. Action: Request Part
  const handleSavePartRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partName.trim()) return;

    const newPart: RequiredPart = {
      id: Math.random().toString(),
      name: partName,
      code: partCode || 'P-GENERIC',
      status: 'requested',
      timestamp: 'امروز - هم‌اکنون'
    };

    setParts(prev => [newPart, ...prev]);
    updateGlobalStatus('waiting_parts');

    // Log to timeline
    const newEvent: TimelineEvent = {
      id: Math.random().toString(),
      title: 'درخواست تأمین قطعه جدید',
      description: `درخواست تأمین قطعه "${partName}" صادر شد. وضعیت پرونده به "منتظر قطعه" تغییر یافت.`,
      timestamp: 'امروز - هم‌اکنون',
      icon: Cpu,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600'
    };
    setTimeline(prev => [newEvent, ...prev]);

    setPartName('');
    setPartCode('');
    setActiveModal(null);
    showToast('درخواست قطعه ثبت شد. وضعیت کاربری قطعه به «منتظر قطعه» منتقل گردید.', 'success');
  };

  // 4. Action: Save Cost
  const handleSaveCost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!costTitle.trim() || !costAmount.trim()) return;

    const newCost: CostItem = {
      id: Math.random().toString(),
      title: costTitle,
      amount: costAmount + ' تومان',
      type: costType,
      timestamp: 'امروز - هم‌اکنون'
    };

    setCosts(prev => [newCost, ...prev]);

    // Log to timeline
    const newEvent: TimelineEvent = {
      id: Math.random().toString(),
      title: 'ثبت برآورد هزینه کارگاه',
      description: `هزینه "${costTitle}" به ارزش ${costAmount} تومان ثبت گردید.`,
      timestamp: 'امروز - هم‌اکنون',
      icon: Coins,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600'
    };
    setTimeline(prev => [newEvent, ...prev]);

    setCostTitle('');
    setCostAmount('');
    setActiveModal(null);
    showToast('هزینه جدید با موفقیت به صورت حساب کارگاه اضافه شد.', 'success');
  };

  // 5. Action: Simulate Uploading Repair Photo
  const handleAddRepairPhoto = () => {
    const urls = [
      'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1555664424-778a1e5e1b48?w=500&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1563770660941-20978e870e26?w=500&auto=format&fit=crop&q=80'
    ];
    const pickedUrl = urls[Math.floor(Math.random() * urls.length)];
    
    setRepairPhotos(prev => [pickedUrl, ...prev]);

    // Log to timeline
    const newEvent: TimelineEvent = {
      id: Math.random().toString(),
      title: 'افزودن عکس مستندسازی حین تعمیر',
      description: 'یک تصویر جدید از بردهای قطعه تحت لوپ لوپ عیب‌یابی پیوست پرونده گردید.',
      timestamp: 'امروز - هم‌اکنون',
      icon: Camera,
      iconBg: 'bg-indigo-500/10',
      iconColor: 'text-indigo-600'
    };
    setTimeline(prev => [newEvent, ...prev]);

    showToast('عکس مستندسازی تعمیر با موفقیت آپلود و گالری اضافه شد.', 'success');
  };

  // Map database status to visual steps on progress bar
  // Steps: پذیرش -> عیب‌یابی -> منتظر قطعه -> در حال تعمیر -> تست نهایی -> آماده تحویل -> تحویل شده
  const currentStepIndex = useMemo(() => {
    switch (currentItem.status) {
      case 'pending':
        return 1; // عیب‌یابی
      case 'waiting_parts':
        return 2; // منتظر قطعه
      case 'under_repair':
        return 3; // در حال تعمیر
      case 'testing':
        return 4; // تست نهایی
      case 'replaced':
      case 'active':
        return 5; // آماده تحویل
      case 'delivered':
        return 6; // تحویل شده
      default:
        return 1;
    }
  }, [currentItem.status]);

  const stages = [
    { label: 'پذیرش', desc: 'ثبت فیزیکی دستگاه' },
    { label: 'عیب‌یابی', desc: 'تست ولتاژ و عیب‌یابی' },
    { label: 'منتظر قطعه', desc: 'تأمین آی‌سی و قطعات' },
    { label: 'در حال تعمیر', desc: 'تعویض المان معیوب' },
    { label: 'تست نهایی', desc: 'تست زیر بار الکتریکی' },
    { label: 'آماده تحویل', desc: 'ترخیص و بسته‌بندی' },
    { label: 'تحویل شده', desc: 'تحویل نهایی به طرف حساب' }
  ];

  // Colors based on priority
  const priorityStyles = useMemo(() => {
    switch (itemMeta.priority) {
      case 'خیلی فوری':
        return 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse font-black';
      case 'فوری':
        return 'bg-orange-50 text-orange-700 border-orange-200 font-black';
      case 'عادی':
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  }, [itemMeta.priority]);

  // Color code based on status
  const statusStyles = useMemo(() => {
    switch (currentItem.status) {
      case 'pending':
        return { label: 'در انتظار بررسی', bg: 'bg-blue-50 text-blue-700 border-blue-200/60', dot: 'bg-blue-500' };
      case 'under_repair':
        return { label: 'در حال تعمیر', bg: 'bg-blue-50 text-blue-700 border-blue-200/60', dot: 'bg-blue-500' };
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
  }, [currentItem.status]);

  const warrantyColor = useMemo(() => {
    if (itemMeta.warrantyStatus.includes('معتبر')) {
      return 'text-emerald-700 bg-emerald-50 border-emerald-100';
    } else if (itemMeta.warrantyStatus.includes('منقضی')) {
      return 'text-rose-700 bg-rose-50 border-rose-100';
    } else {
      return 'text-slate-700 bg-slate-50 border-slate-200';
    }
  }, [itemMeta.warrantyStatus]);

  return (
    <div className="space-y-4 text-right animate-fade-in pb-16" dir="rtl">
      
      {/* HEADER ACTION BAR */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex justify-between items-center relative overflow-hidden">
        <div className="absolute top-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full filter blur-xl"></div>
        
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => setActiveTab('queue')}
              className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              title="بازگشت به کارتابل"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
            <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
              <span>پرونده الکترونیکی تعمیر دستگاه</span>
              <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-lg font-black font-mono">
                P008
              </span>
            </h3>
          </div>
          <p className="text-[10px] text-slate-500 font-bold pr-7">میز کار تخصصی نظارت فنی، ثبت عیب‌یابی و تأمین قطعات کارگاه دیاکو</p>
        </div>
        
        <button
          onClick={() => setActiveTab('queue')}
          className="text-[10px] font-black text-blue-600 hover:text-blue-700 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 rounded-xl transition-all cursor-pointer flex items-center gap-1 active:scale-95"
        >
          <span>بازگشت به صف تعمیرات</span>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 1. FIXED SUMMARY CARD (کارت اطلاعات اصلی دستگاه) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm relative overflow-hidden">
        {/* Glowing top-right accent */}
        <div className="absolute top-0 right-0 left-0 h-1.5 bg-blue-600"></div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Intake Highlight Column */}
          <div className="lg:col-span-3 flex flex-col items-center lg:items-start space-y-2 lg:border-l lg:border-slate-150 lg:pl-6 pb-4 lg:pb-0 border-b lg:border-b-0 border-slate-100">
            <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase">شماره پذیرش دیجیتال</span>
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight bg-slate-900 text-white px-4 py-2 rounded-2xl shadow-sm">
              {itemMeta.intakeNo}
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl border ${statusStyles.bg} flex items-center gap-1.5 shadow-2xs`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusStyles.dot} animate-pulse`}></span>
                <span>{statusStyles.label}</span>
              </span>
              <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl border ${priorityStyles} shadow-2xs`}>
                اولویت: {itemMeta.priority}
              </span>
            </div>
          </div>

          {/* Central Grid with 8 Core Fields */}
          <div className="lg:col-span-6 grid grid-cols-2 md:grid-cols-2 gap-y-3.5 gap-x-6">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold block">نام طرف حساب</span>
              <span className="text-slate-900 font-black text-xs sm:text-sm flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {currentItem.customerName}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold block">شماره موبایل</span>
              <span className="text-slate-900 font-mono font-black text-xs sm:text-sm flex items-center gap-1.5" dir="ltr">
                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {currentItem.customerPhone}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold block">نام دستگاه</span>
              <span className="text-slate-900 font-black text-xs sm:text-sm flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {currentItem.itemName}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold block">مدل دستگاه</span>
              <span className="text-slate-900 font-mono font-bold text-xs sm:text-sm flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {itemMeta.model}
              </span>
            </div>

            <div className="space-y-1 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 font-bold block">شماره سریال دستگاه</span>
              <span className="text-slate-900 font-mono font-black text-xs select-all bg-slate-50 border border-slate-100 px-2 py-1 rounded-lg inline-block" dir="ltr">
                {currentItem.serial}
              </span>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold block">وضعیت گارانتی</span>
              <span className={`inline-block px-2.5 py-1 rounded-xl text-[10px] font-black border ${warrantyColor}`}>
                {itemMeta.warrantyStatus}
              </span>
            </div>

            <div className="space-y-1 col-span-2">
              <span className="text-[10px] text-slate-400 font-bold block">مدت حضور در تعمیرگاه (زمان سپری شده)</span>
              <span className="text-rose-600 font-black text-xs flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-rose-500 animate-pulse" />
                <span>{itemMeta.waitingDays} (پذیرش شده در {currentItem.registeredAt || '۳ روز قبل'})</span>
              </span>
            </div>
          </div>

          {/* Quick Contact & Info Actions */}
          <div className="lg:col-span-3 bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between space-y-3 lg:h-full">
            <div className="text-[10px] text-slate-500 font-bold flex items-center justify-between">
              <span className="flex items-center gap-1 text-slate-600">
                <User className="w-3 h-3" />
                <span>پذیرشگر: مریم حیدری</span>
              </span>
              <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded text-[9px] font-black border border-emerald-100">تایید گارانتی</span>
            </div>
            
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => showToast(`برقراری تماس مخابراتی با شماره ${currentItem.customerPhone}...`, 'info')}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 shadow-sm shadow-blue-100"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>تماس مستقیم</span>
              </button>
              <button
                type="button"
                onClick={() => showToast(`ارسال لینک وضعیت ترخیص به شماره ${currentItem.customerPhone} صادر شد.`, 'success')}
                className="flex-1 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-black rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95"
              >
                <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>ارسال لینک</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. VISUAL PROCESS PROGRESS BAR (نوار وضعیت مراحل تعمیر بصری) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs overflow-x-auto">
        <span className="text-[10px] font-black text-slate-400 block mb-3">نمودار پیشرفت چرخه تعمیر کارگاه</span>
        
        <div className="flex items-center justify-between min-w-[650px] relative px-2 py-1">
          {/* Stepper connectors */}
          <div className="absolute top-5 right-6 left-6 h-0.5 bg-slate-100 -z-10"></div>
          <div 
            className="absolute top-5 right-6 h-0.5 bg-blue-600 -z-10 transition-all duration-500"
            style={{ width: `${(currentStepIndex / (stages.length - 1)) * 100}%` }}
          ></div>

          {stages.map((st, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isActive = idx === currentStepIndex;
            const isUpcoming = idx > currentStepIndex;
            
            return (
              <div key={idx} className="flex flex-col items-center space-y-1.5 relative z-10 select-none">
                {/* Stage Indicator Bubble */}
                <div 
                  className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-all duration-300 shadow-xs ${
                    isCompleted 
                      ? 'bg-emerald-50 border-emerald-500 text-emerald-600' 
                      : isActive 
                        ? 'bg-blue-600 border-blue-600 text-white font-black ring-4 ring-blue-50 scale-105 shadow-md shadow-blue-100' 
                        : 'bg-white border-slate-200 text-slate-400'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4.5 h-4.5 stroke-[3.5]" />
                  ) : (
                    <span className="text-xs font-black font-mono">{idx + 1}</span>
                  )}
                </div>

                {/* Stage Text Labels */}
                <div className="text-center">
                  <span className={`text-[10px] font-black block transition-colors ${
                    isActive ? 'text-blue-600 font-extrabold' : isCompleted ? 'text-emerald-700 font-bold' : 'text-slate-500'
                  }`}>
                    {st.label}
                  </span>
                  <span className="text-[8px] text-slate-400 font-bold block leading-none">
                    {st.desc}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. DOSSIER TABS (تب‌های کنترل پرونده) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-1 shadow-xs flex gap-1 overflow-x-auto select-none">
        {[
          { id: 'info', label: '۱. اطلاعات کلی', icon: FileText },
          { id: 'diagnose', label: '۲. عیب‌یابی', icon: Wrench },
          { id: 'parts', label: '۳. قطعات مصرفی', icon: Cpu },
          { id: 'costs', label: '۴. هزینه‌ها', icon: Coins },
          { id: 'images', label: '۵. گالری تصاویر', icon: Camera },
          { id: 'history', label: '۶. سوابق پرونده', icon: History }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={`flex items-center gap-1 py-2 px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap active:scale-95 ${
              activeSubTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm shadow-blue-100'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5 shrink-0" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB CONTENT HOUSINGS */}
      <div className="min-h-[300px]">
        <AnimatePresence mode="wait">
          {/* TAB 1: INFORMATION (اطلاعات کلی - تفصیلی و کامل) */}
          {activeSubTab === 'info' && (
            <motion.div
              key="tab-info"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Reported Defect (ایراد اعلام‌شده توسط طرف حساب) */}
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <AlertCircle className="w-5 h-5 text-rose-500" />
                      <h4 className="text-sm font-black text-slate-900">۱. ایراد اعلام‌شده توسط طرف حساب</h4>
                    </div>
                    
                    <div className="space-y-3.5 text-xs leading-relaxed">
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold block mb-1">عنوان خرابی اظهارشده</span>
                        <p className="bg-rose-50 border border-rose-100 p-3 rounded-xl font-black text-rose-800 flex items-center gap-2">
                          <span className="text-rose-500 shrink-0">⚠️</span>
                          <span>{currentItem.defectType || 'روشن نمی‌شود / بوق ممتد می‌زند'}</span>
                        </p>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold block mb-1">علائم انتخاب‌شده</span>
                        <div className="flex flex-wrap gap-2 pt-0.5">
                          <span className="px-3 py-1 bg-rose-500/5 text-rose-700 border border-rose-100/60 rounded-xl text-[10px] font-black flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                            <span>علائم: خاموشی کامل دستگاه</span>
                          </span>
                          <span className="px-3 py-1 bg-amber-500/5 text-amber-700 border border-amber-100/60 rounded-xl text-[10px] font-black flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            <span>علائم: بوی سوختگی ضعیف</span>
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <span className="text-[10px] text-slate-400 font-extrabold block mb-1">شرح طرف حساب</span>
                        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-[11px] leading-relaxed font-bold text-slate-600">
                          به گفته طرف حساب، هنگام بازی کردن ناگهان صفحه سیاه شده و صدای بوووق ممتد به گوش رسیده است. بعد از ری‌استارت کردن، دیگر چراغ‌های مادربرد روشن نمی‌شود و هیچ واکنشی به کلید پاور ندارد. بوی قطعه سوخته ضعیفی نیز به مشام می‌رسد.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 1B. Initial Expert Diagnosis (تشخیص اولیه کارشناس) */}
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                      <HelpCircle className="w-5 h-5 text-blue-600" />
                      <h4 className="text-sm font-black text-slate-900">تشخیص اولیه کارشناس</h4>
                    </div>
                    <div className="bg-blue-50/50 border border-blue-100 text-blue-700 p-4 rounded-2xl flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping shrink-0"></span>
                      <span className="text-xs font-black">در انتظار بررسی تعمیرکار</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold leading-normal px-1">
                      بررسی اولیه در غرفه پذیرش ظاهری نشان‌دهنده نوسان ولتاژ ورودی است. تشخیص قطعی پس از تست اهمی ریل‌ها توسط تکنسین شیفت ثبت خواهد شد.
                    </p>
                  </div>
                </div>

                {/* 2. Appearance Status (وضعیت ظاهری دستگاه) */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <Layers className="w-5 h-5 text-blue-600" />
                    <h4 className="text-sm font-black text-slate-900">۲. وضعیت ظاهری فیزیکی قطعه</h4>
                  </div>

                  <div className="space-y-3">
                    <span className="text-[10px] text-slate-400 font-extrabold block">چک‌لیست بررسی وضعیت ظاهری:</span>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {[
                        { label: 'قاب و شاسی بیرونی', status: 'healthy', detail: 'سالم بدون ضربه‌خوردگی' },
                        { label: 'پورت‌های ورودی و خروجی', status: 'healthy', detail: 'سالم و بدون شکستگی داخلی' },
                        { label: 'خازن‌های برد اصلی', status: 'defective', detail: 'خازن مسیر تغذیه متورم است' },
                        { label: 'سوکت اصلی پردازنده', status: 'healthy', detail: 'بدون پین‌های خم‌شده یا آسیب‌دیده' },
                        { label: 'اسلات‌های حافظه RAM', status: 'not_checked', detail: 'هنوز ارزیابی فرکانسی نشده' },
                        { label: 'سیستم خنک‌کننده و هیت‌سینک', status: 'not_checked', detail: 'نیازمند بررسی زیر بار' }
                      ].map((item, idx) => {
                        let statusColor = '';
                        let statusIcon = null;
                        let statusLabel = '';

                        if (item.status === 'healthy') {
                          statusColor = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                          statusIcon = <Check className="w-3.5 h-3.5 stroke-[3.5]" />;
                          statusLabel = 'سالم ✔';
                        } else if (item.status === 'defective') {
                          statusColor = 'text-rose-700 bg-rose-50 border-rose-100';
                          statusIcon = <X className="w-3.5 h-3.5 stroke-[3.5]" />;
                          statusLabel = 'دارای ایراد ✖';
                        } else {
                          statusColor = 'text-slate-500 bg-slate-50 border-slate-200';
                          statusIcon = <Clock className="w-3 h-3 text-slate-400" />;
                          statusLabel = 'بررسی نشده';
                        }

                        return (
                          <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50/50 border border-slate-100 rounded-xl">
                            <div className="space-y-0.5">
                              <span className="text-slate-800 font-bold text-[11px] block">{item.label}</span>
                              <span className="text-[9.5px] text-slate-500 font-semibold">{item.detail}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border flex items-center gap-1 ${statusColor}`}>
                              {statusIcon}
                              <span>{statusLabel}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. Accessories (لوازم همراه دستگاه) */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3.5">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <Box className="w-5 h-5 text-blue-600" />
                    <h4 className="text-sm font-black text-slate-900">۳. لوازم همراه دستگاه پذیرش شده</h4>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-400 font-bold leading-normal">
                      لوازم و اقلام جانبی ثبت شده در رسید پذیرش طرف حساب:
                    </p>

                    <div className="flex flex-wrap gap-2.5">
                      {[
                        { name: 'کابل برق اورجینال', icon: Plug, color: 'bg-blue-50 text-blue-700 border-blue-200/50' },
                        { name: 'جعبه کارتن اصلی', icon: Box, color: 'bg-indigo-50 text-indigo-700 border-indigo-200/50' },
                        { name: 'آداپتور تغذیه صنعتی', icon: Zap, color: 'bg-amber-50 text-amber-700 border-amber-200/50' },
                        { name: 'دفترچه راهنمای گارانتی', icon: BookOpen, color: 'bg-slate-50 text-slate-700 border-slate-200' },
                        { name: 'آنتن وای‌فای اکسترنال', icon: Wifi, color: 'bg-emerald-50 text-emerald-700 border-emerald-200/50' }
                      ].map((acc, i) => (
                        <span key={i} className={`px-3 py-1.5 rounded-xl text-[10.5px] font-black border flex items-center gap-1.5 ${acc.color} transition-all hover:scale-102`}>
                          <acc.icon className="w-3.5 h-3.5 shrink-0" />
                          <span>{acc.name}</span>
                        </span>
                      ))}
                    </div>

                    <div className="bg-blue-500/5 p-3 rounded-xl border border-blue-600/10 text-[10px] text-blue-800 leading-normal font-bold">
                      🛡️ تمامی اقلام فوق با بارکد بارگذاری شده متصل به قفسه نگهداری شماره ۳ انبار دیاکو مطابقت داده شده‌اند.
                    </div>
                  </div>
                </div>

                {/* 4. Reception Photos (عکس‌های زمان پذیرش) */}
                <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <Camera className="w-5 h-5 text-blue-600" />
                    <h4 className="text-sm font-black text-slate-900">۴. تصاویر زمان پذیرش فیزیکی</h4>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-400 font-bold leading-normal">
                      تصاویر گرفته‌شده در دوربین غرفه پذیرش جهت مستندسازی وضعیت فیزیکی دستگاه:
                    </p>

                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=500&auto=format&fit=crop&q=80', label: 'نمای کلی' },
                        { url: 'https://images.unsplash.com/photo-1618042164219-62c820f10723?w=500&auto=format&fit=crop&q=80', label: 'محل آسیب' },
                        { url: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=500&auto=format&fit=crop&q=80', label: 'داخل دستگاه' }
                      ].map((photo, idx) => (
                        <div 
                          key={idx} 
                          className="border border-slate-200 hover:border-blue-500 rounded-2xl overflow-hidden relative group aspect-square bg-slate-50 flex items-center justify-center shadow-xs cursor-pointer transition-all duration-300 hover:shadow-md"
                          onClick={() => {
                            setZoomedImage(photo.url);
                            setImageRotation(0);
                            setActiveModal('zoom');
                          }}
                        >
                          <img 
                            src={photo.url} 
                            alt={photo.label} 
                            className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Maximize2 className="w-4 h-4 text-white" />
                          </div>
                          <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] font-black py-1 text-center leading-none">
                            {photo.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

              {/* 5. QUICK ACTION BUTTONS (دکمه‌های اقدام سریع) */}
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  <h4 className="text-sm font-black text-slate-900">۵. کلیدهای اقدام سریع تعمیرکار (شبیه‌ساز کارگاهی)</h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {/* Action 1 */}
                  <button
                    type="button"
                    onClick={handleStartTroubleshooting}
                    className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
                  >
                    <Wrench className="w-5 h-5" />
                    <span className="text-[10px] font-black">شروع عیب‌یابی</span>
                  </button>

                  {/* Action 2 */}
                  <button
                    type="button"
                    onClick={() => setActiveModal('note')}
                    className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
                  >
                    <FileText className="w-5 h-5 text-blue-600" />
                    <span className="text-[10px] font-black">ثبت یادداشت فنی</span>
                  </button>

                  {/* Action 3 */}
                  <button
                    type="button"
                    onClick={() => setActiveModal('part')}
                    className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
                  >
                    <Cpu className="w-5 h-5 text-amber-500" />
                    <span className="text-[10px] font-black">درخواست قطعه یدکی</span>
                  </button>

                  {/* Action 4 */}
                  <button
                    type="button"
                    onClick={() => setActiveModal('cost')}
                    className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 shadow-sm"
                  >
                    <Coins className="w-5 h-5 text-emerald-600" />
                    <span className="text-[10px] font-black">ثبت هزینه جدید</span>
                  </button>

                  {/* Action 5 */}
                  <button
                    type="button"
                    onClick={handleAddRepairPhoto}
                    className="p-3 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-center flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95 col-span-2 sm:col-span-1 shadow-sm"
                  >
                    <Camera className="w-5 h-5 text-indigo-500" />
                    <span className="text-[10px] font-black">پیوست عکس تعمیر</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: DIAGNOSE (عیب‌یابی) */}
          {activeSubTab === 'diagnose' && (
            <motion.div
              key="tab-diagnose"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4.5 h-4.5 text-blue-600" />
                  <h4 className="text-xs font-black text-slate-900">دفترچه لاگ یادداشت‌های فنی و عیب‌یابی الکترونیکی</h4>
                </div>
                <button
                  onClick={() => setActiveModal('note')}
                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ثبت یادداشت جدید</span>
                </button>
              </div>

              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 text-xs space-y-2">
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                      <span>ثبت کننده: {note.author}</span>
                      <span>{note.timestamp}</span>
                    </div>
                    <p className="text-slate-800 leading-relaxed font-semibold">
                      {note.content}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 3: PARTS (قطعات مصرفی) */}
          {activeSubTab === 'parts' && (
            <motion.div
              key="tab-parts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4.5 h-4.5 text-blue-600" />
                  <h4 className="text-xs font-black text-slate-900">برگه درخواست و تامین قطعات یدکی</h4>
                </div>
                <button
                  onClick={() => setActiveModal('part')}
                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>درخواست قطعه یدکی</span>
                </button>
              </div>

              <div className="space-y-3">
                {parts.map((p) => {
                  let statusLabel = 'در انتظار تأیید';
                  let statusColor = 'bg-amber-50 text-amber-700 border-amber-200/60';
                  if (p.status === 'approved') {
                    statusLabel = 'تأیید شده / آماده تحویل از انبار';
                    statusColor = 'bg-blue-50 text-blue-700 border-blue-200/60';
                  } else if (p.status === 'received') {
                    statusLabel = 'تحویل داده شده و نصب شد';
                    statusColor = 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
                  }

                  return (
                    <div key={p.id} className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 flex justify-between items-center text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] text-slate-400 font-bold block">{p.timestamp}</span>
                        <h5 className="font-black text-slate-800">{p.name}</h5>
                        <p className="text-[10px] font-mono text-slate-500">کد انبار: {p.code}</p>
                      </div>

                      <span className={`px-2 py-1 rounded-lg text-[10px] font-black border ${statusColor}`}>
                        {statusLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* TAB 4: COSTS (هزینه‌ها) */}
          {activeSubTab === 'costs' && (
            <motion.div
              key="tab-costs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Coins className="w-4.5 h-4.5 text-blue-600" />
                  <h4 className="text-xs font-black text-slate-900">برگه ریز هزینه‌های خدمات و قطعات کارگاه</h4>
                </div>
                <button
                  onClick={() => setActiveModal('cost')}
                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>ثبت هزینه جدید</span>
                </button>
              </div>

              <div className="space-y-3">
                {costs.map((c) => (
                  <div key={c.id} className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 flex justify-between items-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">{c.timestamp}</span>
                      <h5 className="font-black text-slate-800">{c.title}</h5>
                      <span className="text-[9px] text-slate-500 font-bold">دسته‌بندی: {c.type === 'service' ? 'اجرت تعمیرات' : 'هزینه قطعه'}</span>
                    </div>

                    <span className="font-mono font-black text-slate-900 text-sm">{c.amount}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 5: IMAGES (تصاویر) */}
          {activeSubTab === 'images' && (
            <motion.div
              key="tab-images"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Camera className="w-4.5 h-4.5 text-blue-600" />
                  <h4 className="text-xs font-black text-slate-900">مستندسازی تصویری فنی قطعه</h4>
                </div>
                <button
                  onClick={handleAddRepairPhoto}
                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>افزودن عکس حین تعمیر</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {repairPhotos.map((imgUrl, idx) => (
                  <div 
                    key={idx} 
                    className="border border-slate-200 hover:border-blue-500 rounded-xl overflow-hidden relative group aspect-square bg-slate-50 flex items-center justify-center shadow-xs cursor-pointer"
                    onClick={() => {
                      setZoomedImage(imgUrl);
                      setImageRotation(0);
                      setActiveModal('zoom');
                    }}
                  >
                    <img 
                      src={imgUrl} 
                      alt={`تصویر تعمیر ${idx + 1}`} 
                      className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-200"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Maximize2 className="w-4 h-4 text-white" />
                    </div>
                    <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[8px] font-black py-0.5 text-center leading-none">
                      تصویر تعمیر {idx + 1}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* TAB 6: HISTORY (سوابق پرونده) */}
          {activeSubTab === 'history' && (
            <motion.div
              key="tab-history"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <History className="w-4.5 h-4.5 text-blue-600" />
                <h4 className="text-xs font-black text-slate-900">ریز سوابق و تاریخچه رویدادهای این پرونده</h4>
              </div>

              {/* Vertical Timeline */}
              <div className="relative border-r-2 border-slate-100 pr-5 mr-3 space-y-6 text-right">
                {timeline.map((event) => {
                  const EventIcon = event.icon || Cpu;
                  return (
                    <div key={event.id} className="relative">
                      {/* Timeline dot */}
                      <span className={`absolute -right-[27px] top-1 flex items-center justify-center w-7.5 h-7.5 rounded-full border border-white shadow-xs ${event.iconBg} ${event.iconColor}`}>
                        <EventIcon className="w-3.5 h-3.5" />
                      </span>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <h5 className="text-xs font-black text-slate-900">{event.title}</h5>
                          <span className="text-[10px] text-slate-400 font-bold font-mono">{event.timestamp}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-bold leading-relaxed">{event.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. FOOTER STATS SUMMARY TIMELINE (تایم‌لاین خلاصه سوابق انتهای صفحه) */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-lg relative overflow-hidden">
        <div className="absolute -left-12 -bottom-12 w-32 h-32 bg-blue-500/10 rounded-full filter blur-xl"></div>
        
        <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-2.5">
          <History className="w-5 h-5 text-blue-400" />
          <h4 className="text-xs font-black text-slate-100">سیر زمانی گام‌به‌گام پرونده تعمیر</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 text-[10.5px] text-slate-300 font-bold">
          <div className="space-y-1 bg-white/5 p-3 rounded-2xl border border-white/5">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <p className="font-black text-white">۱. پذیرش ثبت شد</p>
            </div>
            <p className="text-[9px] text-slate-400 font-mono">۱۴۰۵/۰۴/۰۵ - ۱۰:۳۰</p>
            <p className="text-[9px] text-slate-500 mt-0.5 font-medium leading-normal">دستگاه در سیستم ثبت شد.</p>
          </div>

          <div className="space-y-1 bg-white/5 p-3 rounded-2xl border border-white/5">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <p className="font-black text-white">۲. رسید صادر شد</p>
            </div>
            <p className="text-[9px] text-slate-400 font-mono">۱۴۰۵/۰۴/۰۵ - ۱۰:۴۵</p>
            <p className="text-[9px] text-slate-500 mt-0.5 font-medium leading-normal">رسید پذیرش به طرف حساب تحویل شد.</p>
          </div>

          <div className="space-y-1 bg-white/5 p-3 rounded-2xl border border-white/5">
            <div className="flex items-center gap-1.5 text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-400"></span>
              <p className="font-black text-white">۳. ورود به صف کارگاه</p>
            </div>
            <p className="text-[9px] text-slate-400 font-mono">۱۴۰۵/۰۴/۰۵ - ۱۱:۳۰</p>
            <p className="text-[9px] text-slate-500 mt-0.5 font-medium leading-normal">وارد صف تعمیرات بردی شد.</p>
          </div>

          <div className="space-y-1 bg-white/5 p-3 rounded-2xl border border-white/5">
            <div className="flex items-center gap-1.5 text-amber-400 animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <p className="font-black text-white">۴. منتظر شروع عیب‌یابی</p>
            </div>
            <p className="text-[9px] text-slate-400 font-mono">۱۴۰۵/۰۴/۰۵ - ۱۲:۱۵</p>
            <p className="text-[9px] text-slate-500 mt-0.5 font-medium leading-normal">چیدمان در قفسه تست‌های فنی.</p>
          </div>

          <div className="space-y-1 bg-blue-600/20 p-3 rounded-2xl border border-blue-500/30">
            <div className="flex items-center gap-1.5 text-blue-400 font-black">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>
              <p className="font-black text-white text-[11px]">۵. توسط تعمیرکار باز شد</p>
            </div>
            <p className="text-[9px] text-blue-300 font-mono">امروز - ۱۰:۴۰</p>
            <p className="text-[9px] text-blue-400 mt-0.5 font-black leading-normal">بررسی الکترونیکی فعال است.</p>
          </div>
        </div>
      </div>

      {/* DIALOGS AND MODAL SIMULATORS */}
      <AnimatePresence>
        {/* Modal 1: Note */}
        {activeModal === 'note' && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200/85 flex justify-between items-center text-slate-950">
                <h3 className="text-xs font-black flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>ثبت یادداشت فنی کارگاه</span>
                </h3>
                <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveNote} className="p-5 space-y-4">
                <div className="space-y-1.5 text-right">
                  <label className="text-[11px] font-black text-slate-700 block">شرح بررسی فنی و الکترونیکی المان‌ها <span className="text-rose-500">*</span></label>
                  <textarea
                    required
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="نتیجه عیب‌یابی چشمی، اندازه‌گیری فرکانس، اندازه‌گیری تست اهمی، ولتاژ ریل‌ها..."
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-2xl text-xs font-bold outline-none transition-all h-28 resize-none text-right font-medium"
                  />
                </div>

                <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer transition-all active:scale-98">
                  ثبت یادداشت و بروزرسانی پرونده
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal 2: Part */}
        {activeModal === 'part' && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200/85 flex justify-between items-center text-slate-950">
                <h3 className="text-xs font-black flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-amber-500" />
                  <span>درخواست تأمین قطعه معیوب از انبار کارگاه</span>
                </h3>
                <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePartRequest} className="p-5 space-y-4">
                <div className="space-y-1.5 text-right">
                  <label className="text-[11px] font-black text-slate-700 block">نام دقیق قطعه / آی‌سی / خازن <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={partName}
                    onChange={(e) => setPartName(e.target.value)}
                    placeholder="مانند: آی‌سی پاور رگولاتور TPS51225"
                    className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all"
                  />
                </div>

                <div className="space-y-1.5 text-right">
                  <label className="text-[11px] font-black text-slate-700 block">کد فنی قطعه معیوب / سریال انبار</label>
                  <input
                    type="text"
                    value={partCode}
                    onChange={(e) => setPartCode(e.target.value)}
                    placeholder="مانند: IC-TPS51225-PWM (اختیاری)"
                    className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all font-mono"
                    dir="ltr"
                  />
                </div>

                <div className="bg-amber-50 p-3 rounded-xl border border-amber-200/50 text-[10px] text-amber-800 leading-normal font-bold flex gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>توجه: ثبت این درخواست به طور خودکار فاز کارگاه را به "منتظر قطعه" تغییر داده و به انباردار ابلاغ می‌گردد.</span>
                </div>

                <button type="submit" className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl shadow-md cursor-pointer transition-all active:scale-98">
                  ارسال درخواست به انبارداری دیاکو
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal 3: Cost */}
        {activeModal === 'cost' && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setActiveModal(null)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-md border border-slate-200 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200/85 flex justify-between items-center text-slate-950">
                <h3 className="text-xs font-black flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  <span>ثبت و برآورد هزینه خدمات کارگاه</span>
                </h3>
                <button onClick={() => setActiveModal(null)} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCost} className="p-5 space-y-4">
                <div className="space-y-1.5 text-right">
                  <label className="text-[11px] font-black text-slate-700 block">عنوان هزینه یا اجرت خدمت الکترونیکی <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={costTitle}
                    onChange={(e) => setCostTitle(e.target.value)}
                    placeholder="مانند: اجرت هیت و لحیم‌کاری چیپست اصلی"
                    className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 text-right">
                    <label className="text-[11px] font-black text-slate-700 block">مبلغ برآورد (تومان) <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={costAmount}
                      onChange={(e) => setCostAmount(e.target.value)}
                      placeholder="مانند: ۳۵۰,۰۰۰"
                      className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all font-mono"
                      dir="ltr"
                    />
                  </div>

                  <div className="space-y-1.5 text-right">
                    <label className="text-[11px] font-black text-slate-700 block">نوع فاکتور کارگاه <span className="text-rose-500">*</span></label>
                    <select
                      value={costType}
                      onChange={(e) => setCostType(e.target.value as any)}
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="service">اجرت فنی کارگاه</option>
                      <option value="part">خرید قطعه مصرفی</option>
                      <option value="other">سایر خدمات جنبی</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md cursor-pointer transition-all active:scale-98">
                  ثبت هزینه در ریز فاکتور فنی دستگاه
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal 4: Interactive Photo Zoom with rotate and zoom controls */}
        {activeModal === 'zoom' && zoomedImage && (
          <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4" onClick={() => setActiveModal(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 rounded-3xl p-4 border border-slate-800 shadow-2xl max-w-lg w-full flex flex-col space-y-4 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-800 text-slate-400">
                <span className="text-[10px] font-black text-slate-300">نمای ذره‌بینی بازرسی فیزیکی و ظاهری قطعه</span>
                <button onClick={() => setActiveModal(null)} className="p-1.5 hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl bg-slate-950 flex items-center justify-center relative aspect-video">
                <motion.img 
                  animate={{ rotate: imageRotation }}
                  transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                  src={zoomedImage} 
                  alt="مادربرد زوم شده" 
                  className="max-h-[350px] max-w-full object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[10px] text-slate-500 font-bold">چرخش چشمی قطعه جهت بررسی اتصال کوتاه‌ها</span>
                
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setImageRotation(prev => prev + 90)}
                    className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    <RotateCw className="w-3.5 h-3.5 text-blue-400" />
                    <span>چرخش ۹۰ درجه</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageRotation(0)}
                    className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-black rounded-lg transition-all cursor-pointer flex items-center gap-1 active:scale-95"
                  >
                    <span>بازنشانی جهت</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING NOTIFICATION TOAST */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 z-50 max-w-sm bg-slate-900 border border-slate-800 text-white p-3.5 rounded-2xl shadow-2xl flex items-start gap-2.5 text-right"
            dir="rtl"
          >
            <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-0.5">
              <span className="text-[10px] text-slate-400 font-black block">سامانه هوشمند کارگاه دیاکو</span>
              <p className="text-[11px] font-black leading-relaxed">{toastMessage.text}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
