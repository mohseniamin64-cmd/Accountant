import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Wrench, 
  Clock, 
  ArrowLeft, 
  AlertCircle, 
  ShieldCheck, 
  FileText, 
  SlidersHorizontal, 
  Filter, 
  CheckCircle, 
  TrendingUp, 
  User, 
  Cpu, 
  Layers, 
  Activity, 
  ArrowRight,
  LogIn
} from 'lucide-react';
import { WarrantyItem, ActiveTab } from '../types';

interface P007RepairsQueueProps {
  warrantyDb: WarrantyItem[];
  setDevFileSerial: (serial: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export default function P007RepairsQueue({
  warrantyDb,
  setDevFileSerial,
  setActiveTab
}: P007RepairsQueueProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Active chip filter state: 'all' | 'pending' | 'under_repair' | 'waiting_parts' | 'replaced' | 'urgent'
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Convert status back and forth to Persian label and styles
  const getStatusMeta = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          label: 'در انتظار بررسی',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/60',
          dotClass: 'bg-blue-500'
        };
      case 'under_repair':
        return {
          label: 'در حال تعمیر',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/60',
          dotClass: 'bg-blue-500'
        };
      case 'waiting_parts':
        return {
          label: 'منتظر قطعه',
          badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/60',
          dotClass: 'bg-amber-500'
        };
      case 'replaced':
        return {
          label: 'آماده تحویل',
          badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
          dotClass: 'bg-emerald-500'
        };
      case 'rejected':
        return {
          label: 'غیرقابل تعمیر',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/60',
          dotClass: 'bg-rose-500'
        };
      default:
        return {
          label: 'در انتظار بررسی',
          badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/60',
          dotClass: 'bg-blue-500'
        };
    }
  };

  // Helper to enrich db items with realistic stable mockup data for the queue list
  const enrichedQueue = useMemo(() => {
    return warrantyDb
      .filter(item => item.status !== 'active')
      .map((item, index) => {
      // 1. Generate stable intake number based on index/serial
      const stableIntakeNo = item.intakeNo || `DEC-1405${100 + index}`;
      
      // 2. Generate model name from product name or index
      let model = item.model || 'DEC-CH-12';
      if (!item.model) {
        if (item.itemName.includes('DU')) model = 'DU-PWR-24';
        else if (item.itemName.includes('DEC')) model = 'DEC-MD-08';
        else if (item.itemName.includes(' برد')) model = 'W-BRD-01';
        else if (item.itemName.includes('آداپتور')) model = 'TS-ADP-05';
        else if (item.itemName.includes('باتری')) model = 'PL-BAT-12';
      }

      // 3. Generate a stable warranty status string
      let warrantyStatus = item.warrantyStatus || 'گارانتی معتبر';
      if (!item.warrantyStatus) {
        if (item.expiryDate === 'بدون گارانتی' || item.expiryDate === 'فاقد گارانتی') {
          warrantyStatus = 'تعمیرات آزاد';
        } else if (index % 3 === 1) {
          warrantyStatus = 'نزدیک پایان گارانتی';
        } else if (index % 5 === 0) {
          warrantyStatus = 'گارانتی منقضی شده';
        }
      }

      // 4. Generate stable priority
      let priority: 'عادی' | 'فوری' | 'خیلی فوری' = item.priority || 'عادی';
      if (!item.priority) {
        if (index % 4 === 1 || item.defectType?.includes('فوری')) {
          priority = 'فوری';
        } else if (index % 6 === 0) {
          priority = 'خیلی فوری';
        }
      }

      // 5. Generate stable waiting time (days)
      let waitingDaysCount = item.waitingDaysCount !== undefined ? item.waitingDaysCount : 3;
      if (item.waitingDaysCount === undefined) {
        if (item.status === 'pending' || item.status === 'under_repair' || index === 2) {
          if (index % 3 === 0) {
            waitingDaysCount = 1;
          } else if (index % 3 === 1) {
            waitingDaysCount = 3;
          } else {
            waitingDaysCount = 7 + (index % 5);
          }
        } else {
          waitingDaysCount = 0; // ready
        }
      }

      // 6. Map status to waiting_parts for testing if not set
      // Let's make some items under "waiting_parts" stably based on index
      let status = item.status;
      if (index === 2 && status !== 'replaced' && !item.isRealReception) {
        status = 'waiting_parts' as any;
      }

      return {
        ...item,
        status,
        intakeNo: stableIntakeNo,
        model,
        warrantyStatus,
        priority,
        waitingDaysCount,
      };
    });
  }, [warrantyDb]);

  // Handle Search and Filter logic
  const filteredQueue = useMemo(() => {
    return enrichedQueue.filter(item => {
      // Apply status/chip filter
      if (activeFilter === 'pending' && item.status !== 'pending') return false;
      if (activeFilter === 'under_repair' && item.status !== 'under_repair') return false;
      if (activeFilter === 'waiting_parts' && item.status !== 'waiting_parts') return false;
      if (activeFilter === 'replaced' && item.status !== 'replaced') return false;
      if (activeFilter === 'urgent' && item.priority !== 'فوری' && item.priority !== 'خیلی فوری') return false;

      // Apply Search Query
      if (searchQuery.trim() !== '') {
        const query = searchQuery.trim().toLowerCase();
        const matchesSerial = item.serial.toLowerCase().includes(query);
        const matchesIntake = item.intakeNo.toLowerCase().includes(query);
        const matchesName = item.customerName.toLowerCase().includes(query);
        const matchesPhone = item.customerPhone.toLowerCase().includes(query);
        const matchesItem = item.itemName.toLowerCase().includes(query);
        
        return matchesSerial || matchesIntake || matchesName || matchesPhone || matchesItem;
      }

      return true;
    });
  }, [enrichedQueue, activeFilter, searchQuery]);

  // Count helper for badge in chips
  const counts = useMemo(() => {
    return {
      all: enrichedQueue.length,
      pending: enrichedQueue.filter(i => i.status === 'pending').length,
      under_repair: enrichedQueue.filter(i => i.status === 'under_repair').length,
      waiting_parts: enrichedQueue.filter(i => i.status === 'waiting_parts').length,
      replaced: enrichedQueue.filter(i => i.status === 'replaced').length,
      urgent: enrichedQueue.filter(i => i.priority === 'فوری' || i.priority === 'خیلی فوری').length,
    };
  }, [enrichedQueue]);

  // Navigate to dossier (P012)
  const handleOpenDossier = (serial: string) => {
    setDevFileSerial(serial);
    setActiveTab('dossier');
  };

  return (
    <div className="space-y-4 text-right animate-fade-in" dir="rtl">
      {/* HEADER SECTION */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs flex justify-between items-center relative overflow-hidden">
        {/* Soft abstract background glow */}
        <div className="absolute top-0 left-0 w-24 h-24 bg-blue-500/5 rounded-full filter blur-xl"></div>
        
        <div className="space-y-1 relative z-10">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
            <Wrench className="text-blue-600 w-5 h-5" />
            <span>صف تعمیرات</span>
          </h3>
          <p className="text-[11px] text-slate-500 font-bold">دستگاه‌های پذیرش‌شده در انتظار بررسی و تعمیر</p>
        </div>

        <div className="bg-blue-50/80 border border-blue-100 rounded-xl px-3 py-2 text-center shrink-0">
          <span className="text-[9px] font-black text-blue-500 block">مشاهده زنده وضعیت</span>
          <span className="text-xs font-black text-blue-700">کارگاه تعمیرات</span>
        </div>
      </div>

      {/* SUMMARY STATS WIDGETS */}
      <div className="grid grid-cols-3 gap-3">
        {/* Card 1: Total Devices */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/30 border border-blue-100/80 rounded-2xl p-3.5 relative overflow-hidden shadow-xs">
          <div className="absolute -left-1 -bottom-2 text-blue-100/40 pointer-events-none">
            <Layers className="w-12 h-12" />
          </div>
          <div className="flex flex-col justify-between h-full relative z-10">
            <span className="text-[10px] font-black text-slate-500">کل پرونده‌های فعال</span>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-lg font-black font-mono text-blue-700">{counts.all}</span>
              <span className="text-[8px] font-bold text-blue-500">دستگاه</span>
            </div>
          </div>
        </div>

        {/* Card 2: Urgent Devices */}
        <div className="bg-gradient-to-br from-rose-50 to-orange-50/30 border border-rose-100/80 rounded-2xl p-3.5 relative overflow-hidden shadow-xs">
          {counts.urgent > 0 && (
            <span className="absolute top-2 left-2 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
          )}
          <div className="absolute -left-1 -bottom-2 text-rose-100/40 pointer-events-none">
            <AlertCircle className="w-12 h-12" />
          </div>
          <div className="flex flex-col justify-between h-full relative z-10">
            <span className="text-[10px] font-black text-slate-500">دستگاه‌های فوری</span>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-lg font-black font-mono text-rose-700">{counts.urgent}</span>
              <span className="text-[8px] font-bold text-rose-500">مورد حاد</span>
            </div>
          </div>
        </div>

        {/* Card 3: Waiting Parts */}
        <div className="bg-gradient-to-br from-amber-50 to-yellow-50/30 border border-amber-100/80 rounded-2xl p-3.5 relative overflow-hidden shadow-xs">
          <div className="absolute -left-1 -bottom-2 text-amber-100/40 pointer-events-none">
            <Cpu className="w-12 h-12" />
          </div>
          <div className="flex flex-col justify-between h-full relative z-10">
            <span className="text-[10px] font-black text-slate-500">در انتظار قطعه</span>
            <div className="flex items-baseline gap-1 mt-1.5">
              <span className="text-lg font-black font-mono text-amber-700">{counts.waiting_parts}</span>
              <span className="text-[8px] font-bold text-amber-500">تأمین قطعات</span>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH BAR */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-xs">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="جستجو بر اساس شماره پذیرش، سریال، نام طرف حساب یا موبایل..."
            className="w-full pr-10 pl-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all placeholder:text-slate-400"
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>

      {/* COMPACT STATUS FILTER GRID */}
      <div className="grid grid-cols-3 gap-2 select-none" dir="rtl">
        {/* ALL */}
        <button
          onClick={() => setActiveFilter('all')}
          className={`p-2.5 rounded-2xl text-[10.5px] font-black transition-all border cursor-pointer flex flex-col justify-between items-start h-[68px] relative overflow-hidden ${
            activeFilter === 'all' 
              ? 'bg-blue-600 text-white border-blue-700 shadow-sm shadow-blue-100' 
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex justify-between items-center w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            <span className={`text-[10px] font-mono font-black ${activeFilter === 'all' ? 'text-blue-100' : 'text-slate-400'}`}>
              {counts.all}
            </span>
          </div>
          <span className="mt-1">همه دستگاه‌ها</span>
        </button>

        {/* PENDING */}
        <button
          onClick={() => setActiveFilter('pending')}
          className={`p-2.5 rounded-2xl text-[10.5px] font-black transition-all border cursor-pointer flex flex-col justify-between items-start h-[68px] relative overflow-hidden ${
            activeFilter === 'pending' 
              ? 'bg-amber-500 text-white border-amber-600 shadow-sm shadow-amber-100' 
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex justify-between items-center w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span className={`text-[10px] font-mono font-black ${activeFilter === 'pending' ? 'text-amber-100' : 'text-slate-400'}`}>
              {counts.pending}
            </span>
          </div>
          <span className="mt-1">در انتظار بررسی</span>
        </button>

        {/* UNDER REPAIR */}
        <button
          onClick={() => setActiveFilter('under_repair')}
          className={`p-2.5 rounded-2xl text-[10.5px] font-black transition-all border cursor-pointer flex flex-col justify-between items-start h-[68px] relative overflow-hidden ${
            activeFilter === 'under_repair' 
              ? 'bg-blue-500 text-white border-blue-600 shadow-sm shadow-blue-100' 
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex justify-between items-center w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
            <span className={`text-[10px] font-mono font-black ${activeFilter === 'under_repair' ? 'text-blue-100' : 'text-slate-400'}`}>
              {counts.under_repair}
            </span>
          </div>
          <span className="mt-1">در حال تعمیر</span>
        </button>

        {/* WAITING PARTS */}
        <button
          onClick={() => setActiveFilter('waiting_parts')}
          className={`p-2.5 rounded-2xl text-[10.5px] font-black transition-all border cursor-pointer flex flex-col justify-between items-start h-[68px] relative overflow-hidden ${
            activeFilter === 'waiting_parts' 
              ? 'bg-orange-500 text-white border-orange-600 shadow-sm shadow-orange-100' 
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex justify-between items-center w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
            <span className={`text-[10px] font-mono font-black ${activeFilter === 'waiting_parts' ? 'text-orange-100' : 'text-slate-400'}`}>
              {counts.waiting_parts}
            </span>
          </div>
          <span className="mt-1">منتظر قطعه</span>
        </button>

        {/* READY FOR DELIVERY */}
        <button
          onClick={() => setActiveFilter('replaced')}
          className={`p-2.5 rounded-2xl text-[10.5px] font-black transition-all border cursor-pointer flex flex-col justify-between items-start h-[68px] relative overflow-hidden ${
            activeFilter === 'replaced' 
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm shadow-emerald-100' 
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="flex justify-between items-center w-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            <span className={`text-[10px] font-mono font-black ${activeFilter === 'replaced' ? 'text-emerald-100' : 'text-slate-400'}`}>
              {counts.replaced}
            </span>
          </div>
          <span className="mt-1">آماده تحویل</span>
        </button>

        {/* URGENT CHIP */}
        <button
          onClick={() => setActiveFilter('urgent')}
          className={`p-2.5 rounded-2xl text-[10.5px] font-black transition-all border cursor-pointer flex flex-col justify-between items-start h-[68px] relative overflow-hidden ${
            activeFilter === 'urgent' 
              ? 'bg-rose-600 text-white border-rose-700 shadow-sm shadow-rose-100' 
              : 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50'
          }`}
        >
          <div className="flex justify-between items-center w-full">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              {activeFilter !== 'urgent' && <span className="animate-ping w-1 h-1 rounded-full bg-rose-400 absolute top-3.5 right-3.5"></span>}
            </div>
            <span className={`text-[10px] font-mono font-black ${activeFilter === 'urgent' ? 'text-rose-100' : 'text-rose-500'}`}>
              {counts.urgent}
            </span>
          </div>
          <span className="mt-1">موارد فوری</span>
        </button>
      </div>

      {/* QUEUE CARDS CONTAINER */}
      <div className="space-y-3.5">
        <AnimatePresence mode="popLayout">
          {filteredQueue.length > 0 ? (
            filteredQueue.map((item, index) => {
              const statusMeta = getStatusMeta(item.status);
              
              // Color tags for warranty status
              let warrantyColor = 'text-emerald-600 bg-emerald-50 border-emerald-100/50';
              if (item.warrantyStatus.includes('منقضی')) {
                warrantyColor = 'text-rose-600 bg-rose-50 border-rose-100/50';
              } else if (item.warrantyStatus.includes('پایان')) {
                warrantyColor = 'text-amber-600 bg-amber-50 border-amber-100/50';
              } else if (item.warrantyStatus.includes('آزاد')) {
                warrantyColor = 'text-slate-600 bg-slate-50 border-slate-200/50';
              }

              // Priority badge configuration
              let priorityMeta = {
                label: 'عادی',
                badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/60',
                dotClass: 'bg-slate-400'
              };
              if (item.priority === 'خیلی فوری') {
                priorityMeta = {
                  label: 'خیلی فوری',
                  badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/60 animate-pulse font-black',
                  dotClass: 'bg-rose-500'
                };
              } else if (item.priority === 'فوری') {
                priorityMeta = {
                  label: 'فوری',
                  badgeClass: 'bg-orange-50 text-orange-700 border-orange-200/60 font-black',
                  dotClass: 'bg-orange-500'
                };
              }

              // Waiting days badge logic
              const getWaitingDaysMeta = (days: number) => {
                if (days === 0) {
                  return {
                    label: 'آماده تحویل',
                    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100/60',
                    dotClass: 'bg-emerald-500'
                  };
                } else if (days <= 2) {
                  return {
                    label: `${days} روز`,
                    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-100/60',
                    dotClass: 'bg-emerald-500'
                  };
                } else if (days < 7) {
                  return {
                    label: `${days} روز`,
                    badgeClass: 'bg-orange-50 text-orange-700 border-orange-100/60',
                    dotClass: 'bg-orange-500'
                  };
                } else {
                  return {
                    label: '۷ روز و بیشتر',
                    badgeClass: 'bg-rose-50 text-rose-700 border-rose-100/60',
                    dotClass: 'bg-rose-500'
                  };
                }
              };

              const waitingMeta = getWaitingDaysMeta(item.waitingDaysCount);

              // Determine standard top border strip color based on status
              let topBarColor = 'bg-blue-500'; // 🔵 در حال بررسی / در انتظار بررسی
              if (item.status === 'waiting_parts') {
                topBarColor = 'bg-amber-500'; // 🟡 منتظر قطعه
              } else if (item.status === 'replaced' || item.status === 'active') {
                topBarColor = 'bg-emerald-500'; // 🟢 آماده تحویل
              } else if (item.status === 'rejected') {
                topBarColor = 'bg-rose-500'; // 🔴 غیرقابل تعمیر
              }

              return (
                <motion.div
                  key={`${item.serial}-${index}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: Math.min(index * 0.04, 0.2) }}
                  className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs hover:shadow-md hover:border-slate-300 transition-all relative overflow-hidden"
                >
                  {/* Status-based top border strip indicator */}
                  <div className={`absolute top-0 right-0 left-0 h-1.5 ${topBarColor}`}></div>

                  {/* Customer & Product Information */}
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h4 className="text-xs font-black text-slate-900 flex items-center gap-1">
                        <span>{item.itemName}</span>
                      </h4>
                      <p className="text-[10px] text-slate-500 font-bold mt-1 flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>طرف حساب: {item.customerName}</span>
                      </p>
                    </div>

                    {/* Status Badge */}
                    <div className={`px-2.5 py-1 rounded-xl text-[10px] font-black border flex items-center gap-1.5 ${statusMeta.badgeClass}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dotClass}`}></span>
                      <span>{statusMeta.label}</span>
                    </div>
                  </div>

                  {/* Defect reported */}
                  <div className="mt-2 bg-rose-50/50 border border-rose-100/30 rounded-xl p-2.5 flex items-start gap-1.5 text-[10.5px]">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-rose-950 font-black">ایراد اعلام‌شده:</span>
                      <span className="text-rose-900 font-bold mr-1.5">{item.defectType || 'شرح خرابی نامشخص'}</span>
                    </div>
                  </div>

                  {/* Spec Metadata Table */}
                  <div className="grid grid-cols-2 gap-2 mt-3.5 pt-3 border-t border-slate-100 text-[10px]">
                    <div className="space-y-1.5">
                      <div>
                        <span className="text-slate-400 font-bold">شماره پذیرش:</span>
                        <span className="font-mono font-black text-slate-700 mr-1 bg-slate-100/80 px-1.5 py-0.5 rounded text-[10.5px]">{item.intakeNo}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold">شماره سریال:</span>
                        <span className="font-mono font-black text-slate-700 mr-1 text-[10.5px]" dir="ltr">{item.serial}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 font-bold">مدل دستگاه:</span>
                        <span className="font-mono font-bold text-slate-800 mr-1">{item.model}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-left border-r border-slate-100 pr-2">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-bold">وضعیت گارانتی:</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-black border ${warrantyColor}`}>{item.warrantyStatus}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-bold">اولویت تعمیر:</span>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border flex items-center gap-1 ${priorityMeta.badgeClass}`}>
                          <span className={`w-1 h-1 rounded-full ${priorityMeta.dotClass}`}></span>
                          <span>{priorityMeta.label}</span>
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 font-bold">تاریخ پذیرش:</span>
                        <span className="font-mono font-bold text-slate-700">{item.registeredAt.replace('امروز (', '').replace(')', '')}</span>
                      </div>
                    </div>
                  </div>
 
                  {/* Bottom Strip: Waiting Duration & Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                      {item.waitingDaysCount > 5 && (
                        <span className="flex items-center gap-1 text-rose-600 font-extrabold animate-pulse bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                          <span className="text-[9px]">اولویت عقب‌افتاده!</span>
                        </span>
                      )}
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>مدت انتظار:</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border flex items-center gap-1 ${waitingMeta.badgeClass}`}>
                        <span className={`w-1 h-1 rounded-full ${waitingMeta.dotClass}`}></span>
                        <span>{waitingMeta.label}</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenDossier(item.serial)}
                      className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-xl transition-all cursor-pointer flex items-center gap-1 shadow-sm active:scale-95"
                    >
                      <span>ورود به پرونده تعمیر</span>
                      <LogIn className="w-3.5 h-3.5 rotate-180 shrink-0" />
                    </button>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-slate-50 border border-slate-200/50 rounded-2xl p-8 text-center text-slate-400 space-y-2.5"
            >
              <FileText className="w-10 h-10 mx-auto text-slate-300" />
              <div className="space-y-0.5">
                <p className="text-xs font-black text-slate-700">هیچ موردی پیدا نشد!</p>
                <p className="text-[10px] text-slate-400 leading-normal">دستگاهی با مشخصات فوق در صف کارگاه یافت نگردید.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
