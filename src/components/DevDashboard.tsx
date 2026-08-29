import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { P018StandardInvoiceForm } from './P018StandardInvoiceForm';
import HolooInvoiceForm from './HolooInvoiceForm';
import { P019ProjectBackupRoadmap } from './P019ProjectBackupRoadmap';
import { DraggableModal } from './DraggableModal';
import { playScanBeepSound, scanImageData, scanImageFile } from '../utils/qrScanner';
import { 
  Sliders, 
  ClipboardCheck,
  X, 
  Check, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  Search, 
  UserPlus, 
  PlusCircle, 
  Edit2, 
  Building, 
  Coins, 
  Sparkles, 
  Cpu, 
  Users, 
  BarChart3, 
  TrendingUp,
  User,
  RefreshCw, 
  DollarSign, 
  ShoppingBag, 
  Truck, 
  ClipboardList, 
  Hammer, 
  Wrench,
  Calendar, 
  UserMinus,
  UserCheck,
  Printer,
  ArrowLeft,
  Clock,
  Activity,
  FileText,
  ShieldCheck,
  ChevronLeft,
  Phone,
  MessageSquare,
  QrCode,
  Package,
  Filter,
  MoreVertical,
  Camera,
  Upload,
  Receipt,
  Trash2,
  Copy,
  ExternalLink,
  Send
} from 'lucide-react';
import { WarrantyItem, SystemUser } from '../types';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import P008RepairDossier from './P008RepairDossier';
import P011DeviceHandover from './P011DeviceHandover';
import P012Settlement from './P012Settlement';
import P013DossierSearch from './P013DossierSearch';
import P014WorkshopSettings from './P014WorkshopSettings';

interface DevDashboardProps {
  devActiveScreen: string | null;
  setDevActiveScreen: (screen: string | null) => void;
  isDevModeOpen: boolean;
  setIsDevModeOpen: (open: boolean) => void;
  customers: any[];
  setCustomers: React.Dispatch<React.SetStateAction<any[]>>;
  suppliers?: any[];
  setSuppliers?: React.Dispatch<React.SetStateAction<any[]>>;
  purchases?: any[];
  setPurchases?: React.Dispatch<React.SetStateAction<any[]>>;
  inventory?: any[];
  setInventory?: React.Dispatch<React.SetStateAction<any[]>>;
  sales?: any[];
  setSales?: React.Dispatch<React.SetStateAction<any[]>>;
  products: any[];
  setProducts: React.Dispatch<React.SetStateAction<any[]>>;
  warrantyDb: WarrantyItem[];
  setWarrantyDb: React.Dispatch<React.SetStateAction<WarrantyItem[]>>;
  users: SystemUser[];
  setUsers: React.Dispatch<React.SetStateAction<SystemUser[]>>;
  userRole: 'admin' | 'reception' | 'technician' | 'delivery';
  setUserRole: (role: 'admin' | 'reception' | 'technician' | 'delivery') => void;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  
  // Custom navigation action binders
  activeTab?: any;
  setActiveTab?: (tab: any) => void;
  queueFilter?: any;
  setQueueFilter?: (filter: any) => void;
  setIsAuthenticated?: (authenticated: boolean) => void;
  setIsSetupCompleted?: (completed: boolean) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;

  // P003: Customer Management
  custSearchQuery?: string;
  setCustSearchQuery?: (val: string) => void;
  isCustModalOpen?: boolean;
  setIsCustModalOpen?: (val: boolean) => void;
  editingCustomer?: any;
  setEditingCustomer?: (val: any) => void;
  custFormName?: string;
  setCustFormName?: (val: string) => void;
  custFormPhone?: string;
  setCustFormPhone?: (val: string) => void;
  custFormType?: string;
  setCustFormType?: (val: string) => void;
  custFormEmail?: string;
  setCustFormEmail?: (val: string) => void;
  custFormAddress?: string;
  setCustFormAddress?: (val: string) => void;

  // P004: Product Catalog
  prodSearchQuery?: string;
  setProdSearchQuery?: (val: string) => void;
  isProdModalOpen?: boolean;
  setIsProdModalOpen?: (val: boolean) => void;
  editingProduct?: any;
  setEditingProduct?: (val: any) => void;
  prodFormName?: string;
  setProdFormName?: (val: string) => void;
  prodFormModel?: string;
  setProdFormModel?: (val: string) => void;
  prodFormDuration?: string;
  setProdFormDuration?: (val: string) => void;
  prodFormSuggestedPrice?: string;
  setProdFormSuggestedPrice?: (val: string) => void;

  // P012: Hardware dossier
  devFileSerial?: string;
  setDevFileSerial?: (val: string) => void;
}

export function DevDashboardDrawer({
  devActiveScreen,
  setDevActiveScreen,
  isDevModeOpen,
  setIsDevModeOpen,
  userRole,
  setUserRole,
  isOnline,
  setIsOnline,
  setActiveTab,
  setQueueFilter,
  setIsAuthenticated,
  setIsSetupCompleted,
  customers,
  setCustomers,
  suppliers,
  setSuppliers,
  purchases,
  setPurchases,
  inventory,
  setInventory,
  sales,
  setSales,
  products,
  setProducts,
  warrantyDb,
  setWarrantyDb,
  users,
  setUsers
}: DevDashboardProps) {

  const screens = [
    { id: 'P000', name: 'راه‌اندازی اولیه سیستم', icon: ShieldCheck, status: 'fully_built', desc: 'فرم پیکربندی دیتابیس و مدیریت ارشد' },
    { id: 'P001', name: 'ورود به سیستم', icon: UserCheck, status: 'fully_built', desc: 'تایید هویت و لاگین چندسطحی کاربران' },
    { id: 'P015', name: 'داشبورد اصلی', icon: Sparkles, status: 'preview', desc: 'نمای کلی کارگاه، هشدارها و بنتو گرید' },
    { id: 'P011', name: 'تحویل دستگاه به طرف حساب', icon: Truck, status: 'fully_built', desc: 'ثبت نهایی تحویل و بستن پرونده تعمیر' },
    { id: 'P002', name: 'مدیریت کاربران', icon: Users, status: 'fully_built', desc: 'تعریف نقش‌ها و تخصیص سطوح دسترسی' },
    { id: 'P003', name: 'مدیریت طرف حساب', icon: UserPlus, status: 'preview', desc: 'لیست تعاملی طرف حساب حقیقی، حقوقی و همکاران' },
    { id: 'P004', name: 'مدیریت کالاها', icon: Cpu, status: 'preview', desc: 'کاتالوگ محصولات دیاکو و تعرفه‌های گارانتی' },
    { id: 'P017', name: 'فاکتور خرید و انبار', icon: ShoppingBag, status: 'fully_built', desc: 'ثبت فاکتورهای تامین کالا، تعریف تامین‌کننده و افزاش خودکار موجودی انبار' },
    { id: 'P005', name: 'فاکتور فروش', icon: Coins, status: 'fully_built', desc: 'فعالسازی چندگانه سریال با محاسبه خودکار گارانتی' },
    { id: 'P006', name: 'پذیرش دستگاه', icon: PlusCircle, status: 'fully_built', desc: 'ثبت عیب، عکاسی قطعه و رسید حرارتی' },
    { id: 'P007', name: 'تعمیرات کارگاه', icon: Hammer, status: 'fully_built', desc: 'بردهای تحت عیب‌یابی تکنسین و تست استرس' },
    { id: 'P008', name: 'پرونده تعمیر دستگاه', icon: ClipboardList, status: 'fully_built', desc: 'ثبت عیب‌یابی، یادداشت فنی، قطعات و فاکتور خدمات کارگاه' },
    { id: 'P009', name: 'گزارش‌ها و آمار', icon: BarChart3, status: 'preview', desc: 'نرخ تعویض، فراوانی عیوب و چارت‌های تحلیلی' },
    { id: 'P010', name: 'تست نهایی دستگاه', icon: ClipboardCheck, status: 'fully_built', desc: 'چک‌لیست تست کامل عملکرد، ثبت نتیجه تست نهایی و وضعیت آماده تحویل' },
    { id: 'P012', name: 'ثبت هزینه و تسویه حساب', icon: Receipt, status: 'fully_built', desc: 'ثبت نهایی هزینه‌های تعمیر و وضعیت پرداخت طرف حساب' },
    { id: 'P013', name: 'جستجوی پرونده', icon: Search, status: 'fully_built', desc: 'جستجوی پرونده بر اساس شماره پرونده، سریال، نام طرف حساب و شماره تماس' },
    { id: 'P014', name: 'تنظیمات سیستم', icon: Sliders, status: 'fully_built', desc: 'کانفیگ پول رایج، آدرس سرور و سقف نگهداری' },
    { id: 'P018', name: 'فاکتور استاندارد حسابداری', icon: FileText, status: 'fully_built', desc: 'فرم جامع صدور فاکتور فروش، پیش‌فاکتور، خرید و امانی به همراه پیامک لینک و پرینت' },
    { id: 'P019', name: 'نقشه راه و بک‌آ‌پ کامل سیستم', icon: Sparkles, status: 'fully_built', desc: 'شناسنامه پروژه، ساختار داده‌ها و دانلود PDF نقشه راه جهت راه‌اندازی مجدد' },
  ];

  return (
    <>
      {/* Floating dev tool trigger */}
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => setIsDevModeOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white py-2.5 px-4 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-black border border-slate-700/80 cursor-pointer active:scale-95 transition-all"
        >
          <Sliders className="w-4 h-4 text-amber-400 animate-spin-slow" />
          <span>🛠️ ابزار پیش‌نمایش توسعه</span>
        </button>
      </div>

      {/* Side Drawer Modal */}
      <AnimatePresence>
        {isDevModeOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDevModeOpen(false)}
              className="fixed inset-0 bg-black z-50 cursor-pointer"
            />

            {/* Sidebar drawer container */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-full max-w-sm bg-slate-900 text-slate-100 z-50 flex flex-col shadow-2xl border-r border-slate-800 text-right"
              dir="rtl"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-black text-amber-400 flex items-center gap-1.5">
                    <Sliders className="w-4.5 h-4.5" />
                    <span>داشبورد ابزار توسعه (Review Mode)</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold">فقط برای طراحی، تست و بررسی صفحات کارفرما</p>
                </div>
                <button
                  onClick={() => setIsDevModeOpen(false)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                
                {/* 1. Quick Global Simulation Toggles */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3.5 space-y-3">
                  <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider block">شبیه‌سازی متغیرهای محیطی</span>
                  
                  {/* Role Simulator */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-400 font-bold block">نقش کاربر فعال:</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { role: 'admin', label: 'مدیر سیستم' },
                        { role: 'reception', label: 'پذیرش' },
                        { role: 'technician', label: 'تعمیرکار' },
                        { role: 'delivery', label: 'مسئول تحویل' }
                      ].map(r => (
                        <button
                          key={r.role}
                          onClick={() => setUserRole(r.role as any)}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-black border transition-all text-center cursor-pointer ${
                            userRole === r.role 
                              ? 'bg-blue-600/20 text-blue-400 border-blue-500/50 font-black' 
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Network Simulator */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-400 font-bold">شبیه‌سازی اینترنت:</span>
                    <button
                      onClick={() => setIsOnline(!isOnline)}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black transition-colors cursor-pointer ${
                        isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {isOnline ? '🟢 آنلاین (متصل)' : '🔴 آفلاین (محلی)'}
                    </button>
                  </div>
                </div>

                {/* 2. Interactive Navigation List */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-slate-400">انتقال سریع به تمامی صفحات (P000 - P012):</span>
                    {devActiveScreen !== null && (
                      <button
                        onClick={() => {
                          setDevActiveScreen(null);
                          setIsDevModeOpen(false);
                        }}
                        className="text-[10px] font-black text-rose-400 hover:text-rose-300"
                      >
                        خروج از پیش‌نمایش
                      </button>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    {screens.map(scr => {
                      const isActive = devActiveScreen === scr.id;
                      return (
                        <button
                          key={scr.id}
                          onClick={() => {
                            setDevActiveScreen(scr.id);
                            setIsDevModeOpen(false);

                            // Auto-route system states for already-built modules to display them live
                            if (scr.id === 'P000') {
                              if (setIsSetupCompleted) setIsSetupCompleted(false);
                            } else if (scr.id === 'P001') {
                              if (setIsSetupCompleted) setIsSetupCompleted(true);
                              if (setIsAuthenticated) setIsAuthenticated(false);
                            } else {
                              if (setIsSetupCompleted) setIsSetupCompleted(true);
                              if (setIsAuthenticated) setIsAuthenticated(true);

                              if (scr.id === 'P002') {
                                if (setActiveTab) setActiveTab('users');
                              } else if (scr.id === 'P005') {
                                if (setActiveTab) setActiveTab('register_sale');
                              } else if (scr.id === 'P006') {
                                if (setActiveTab) setActiveTab('new_claim');
                              } else if (scr.id === 'P007') {
                                if (setActiveTab) setActiveTab('queue');
                                if (setQueueFilter) setQueueFilter('under_repair');
                              } else if (scr.id === 'P010') {
                                if (setActiveTab) setActiveTab('final_test');
                              } else if (scr.id === 'P011') {
                                if (setActiveTab) setActiveTab('device_delivery');
                              } else if (scr.id === 'P015') {
                                if (setActiveTab) setActiveTab('dashboard');
                              } else if (scr.id === 'P014') {
                                if (setActiveTab) setActiveTab('config');
                              } else if (scr.id === 'P013') {
                                if (setActiveTab) setActiveTab('start_repair');
                              } else if (scr.id === 'P018') {
                                if (setActiveTab) setActiveTab('register_sale');
                              } else if (scr.id === 'P019') {
                                if (setActiveTab) setActiveTab('project_backup');
                              }
                            }
                          }}
                          className={`w-full text-right p-3 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                            isActive
                              ? 'bg-gradient-to-r from-blue-900/40 to-slate-900 text-white border-blue-600 shadow-lg'
                              : 'bg-slate-900/55 hover:bg-slate-800 text-slate-300 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div className={`p-2 rounded-lg shrink-0 ${
                            isActive ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                          }`}>
                            <scr.icon className="w-4.5 h-4.5" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-black font-mono text-amber-500">{scr.id}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black shrink-0 ${
                                scr.status === 'fully_built' 
                                  ? 'bg-slate-800 text-slate-400 border border-slate-700' 
                                  : 'bg-blue-950 text-blue-400 border border-blue-900'
                              }`}>
                                {scr.status === 'fully_built' ? 'پایه / ثبت‌شده' : 'پیش‌نمایش تعاملی'}
                              </span>
                            </div>
                            <h4 className="text-xs font-black text-slate-100 truncate mt-0.5">{scr.name}</h4>
                            <p className="text-[10px] text-slate-400 font-bold truncate mt-0.5 leading-tight">{scr.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>

              {/* Drawer Footer */}
              <div className="p-3 bg-slate-950 border-t border-slate-800 text-center">
                <button
                  onClick={() => {
                    setDevActiveScreen(null);
                    setIsDevModeOpen(false);
                  }}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-black rounded-lg border border-slate-700 transition-colors cursor-pointer"
                >
                  ریست کامل به حالت اصلی سیستم
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------
// DETAILED PREVIEW AND DEMO PAGES RENDERER FOR UNBUILT AND WRAPPED PAGES
// ---------------------------------------------------------------------------------------------------

interface DevPreviewContainerProps {
  screenId: string;
  props: DevDashboardProps;
  onClose: () => void;
}

export function DevPreviewContainer({ screenId, props, onClose }: DevPreviewContainerProps) {
  return (
    <div className="space-y-4">
      {/* Top Warning Ribbon */}
      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 text-[10px] font-black px-3 py-2 rounded-2xl flex items-center justify-between animate-pulse">
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>پیش‌نمایش تعاملی توسعه (مخصوص ارزیابی طراحی)</span>
        </span>
        <div className="flex items-center gap-2 font-mono">
          <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[9px]">{screenId}</span>
          <button
            onClick={onClose}
            className="hover:bg-amber-200 p-1 rounded transition-colors text-amber-900 cursor-pointer"
            title="بستن پیش‌نمایش"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Screen Content Wrapper */}
      <div className="bg-slate-50 min-h-[500px]">
        {renderScreenContent(screenId, props, onClose)}
      </div>

      {/* Bottom Design Indicator */}
      <div className="text-center py-3 text-[11px] font-black text-amber-600/80 bg-amber-500/5 rounded-2xl border border-dashed border-amber-500/15">
        این صفحه در حال طراحی است. (نسخه پیش‌نمایش کاربردی دیاکو الکترونیک)
      </div>
    </div>
  );
}

// ROUTER OF DEVELOPER PREVIEWS
function renderScreenContent(screenId: string, props: DevDashboardProps, onClose?: () => void) {
  switch (screenId) {
    case 'P003': // ACCOUNT HOLDER MANAGEMENT (مدیریت طرف حساب)
      return <P003CustomerManagement {...props} />;
    case 'P004': // PRODUCT CATALOG (مدیریت کالاها)
      return <P004ProductManagement {...props} />;
    case 'P008': // REPAIR DOSSIER (پرونده تعمیر دستگاه)
      return (
        <P008RepairDossier
          devFileSerial={props.devFileSerial || ''}
          setDevFileSerial={props.setDevFileSerial || (() => {})}
          setActiveTab={props.setActiveTab || (() => {})}
          warrantyDb={props.warrantyDb}
          setWarrantyDb={props.setWarrantyDb}
        />
      );
    case 'P009': // REPORTS & ANALYTICS (گزارش‌ها و آمار)
      return <P009ReportsAndAnalytics {...props} />;
    case 'P011': // DEVICE HANDOVER (تحویل دستگاه به طرف حساب)
      return <P011DeviceHandover />;
    case 'P015': // SYSTEM HOME DASHBOARD (داشبورد اصلی)
      return <P011HomeDashboard {...props} />;
    case 'P012': // SETTLEMENT (ثبت هزینه و تسویه حساب)
      return <P012Settlement />;
    case 'P013': // DOSSIER SEARCH (جستجوی پرونده)
      return <P013DossierSearch />;
    case 'P014': // WORKSHOP SETTINGS (تنظیمات کارگاه)
      return <P014WorkshopSettings onReturn={onClose} />;
    case 'P018': // UNIFIED HOLOO INVOICE FORM (سامانه یکپارچه فاکتورهای هلو)
      return (
        <HolooInvoiceForm
          initialType="sale"
          showToast={props.showToast}
          customers={props.customers}
          setCustomers={props.setCustomers}
          suppliers={props.suppliers}
          setSuppliers={props.setSuppliers}
          products={props.products}
          setProducts={props.setProducts}
          warrantyDb={props.warrantyDb}
          setWarrantyDb={props.setWarrantyDb}
          inventory={props.inventory}
          setInventory={props.setInventory}
          sales={props.sales}
          setSales={props.setSales}
          purchases={props.purchases}
          setPurchases={props.setPurchases}
          setActiveTab={props.setActiveTab}
        />
      );
    case 'P019': // PROJECT ROADMAP & PDF BACKUP (نقشه راه و بک‌آ‌پ سیستم)
      return <P019ProjectBackupRoadmap onReturn={onClose} showToast={props.showToast} />;
    default:
      return (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center text-slate-500 space-y-2">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto" />
          <h4 className="font-black text-sm text-slate-800">پیش‌نمایش این صفحه در بخش اصلی پیاده شده است</h4>
          <p className="text-xs">لطفاً برای مشاهده، از منوی پایین یا داشبورد توسعه بر روی گزینه‌های فعال کلیک کنید.</p>
        </div>
      );
  }
}

// ---------------------------------------------------------------------------------------------------
// P003: CUSTOMER MANAGEMENT SCREEN PREVIEW
// ---------------------------------------------------------------------------------------------------
export function P003CustomerManagement({
  customers,
  setCustomers,
  custSearchQuery,
  setCustSearchQuery,
  isCustModalOpen,
  setIsCustModalOpen,
  editingCustomer,
  setEditingCustomer,
  custFormName,
  setCustFormName,
  custFormPhone,
  setCustFormPhone,
  custFormType,
  setCustFormType,
  custFormEmail,
  setCustFormEmail,
  custFormAddress,
  setCustFormAddress,
  warrantyDb,
  setDevFileSerial,
  setDevActiveScreen,
  setActiveTab,
  sales
}: DevDashboardProps) {

  // Local state for city, notes and customer profile modal
  const [custFormCity, setCustFormCity] = useState<string>('');
  const [custFormNotes, setCustFormNotes] = useState<string>('');
  const [selectedProfileCust, setSelectedProfileCust] = useState<any | null>(null);
  const [activeMenuCustPhone, setActiveMenuCustPhone] = useState<string | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<any | null>(null);

  // Call & SMS Action States
  const [activeCallCust, setActiveCallCust] = useState<any | null>(null);
  const [activeSmsCust, setActiveSmsCust] = useState<any | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleCallCustomer = (cust: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!cust || !cust.phone) return;
    try {
      window.location.href = `tel:${cust.phone}`;
    } catch (err) {
      console.log(err);
    }
    setActiveCallCust(cust);
  };

  const handleSmsCustomer = (cust: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!cust || !cust.phone) return;
    try {
      window.location.href = `sms:${cust.phone}`;
    } catch (err) {
      console.log(err);
    }
    setActiveSmsCust(cust);
  };

  // Filter and Scanner States (Requirement 4 & 7)
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'person' | 'representative' | 'service_center'>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [realCameraActive, setRealCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  // Helper to check if a customer has previous transactions (sales or devices)
  const getCustomerTransactions = (cust: any) => {
    if (!cust) return { devices: [], sales: [], hasTransactions: false };
    const custDevices = warrantyDb ? warrantyDb.filter(d => d.customerPhone === cust.phone || d.customerName === cust.name) : [];
    const custSales = sales ? sales.filter(s => s.customer?.phone === cust.phone || s.customer?.name === cust.name) : [];
    return {
      devices: custDevices,
      sales: custSales,
      hasTransactions: custDevices.length > 0 || custSales.length > 0
    };
  };

  // Helper to fallback to city from address if city is missing
  const getCity = (cust: any) => {
    if (cust.city) return cust.city;
    if (cust.address) {
      const parts = cust.address.split(/[،, \s]+/);
      if (parts.length > 0 && parts[0]) return parts[0];
    }
    return 'نامشخص';
  };

  // Helper to get consistent random color for each customer based on name hash (Requirement 2)
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/60',
      'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/60',
      'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60',
      'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60',
      'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200/60 dark:border-indigo-800/60',
      'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/60',
      'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-200/60 dark:border-pink-800/60',
      'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200/60 dark:border-teal-800/60',
      'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border-cyan-200/60 dark:border-cyan-800/60'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  // Scanner actions logic (Requirement 7)
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setRealCameraActive(true);
        }
      } else {
        setCameraError('دسترسی به دوربین در این بستر امنیتی مرورگر مسدود است.');
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      setCameraError('دسترسی به دوربین داده نشد یا دستگاه فاقد دوربین فعال است.');
      setRealCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setRealCameraActive(false);
  };

  // Start camera on modal open and scan live video frames
  React.useEffect(() => {
    let scanInterval: any = null;
    if (isScannerOpen) {
      startCamera();

      // Live video frame QR/Barcode detection
      const scanCanvas = document.createElement('canvas');
      scanInterval = setInterval(async () => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          scanCanvas.width = videoRef.current.videoWidth || 300;
          scanCanvas.height = videoRef.current.videoHeight || 300;
          const ctx = scanCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, scanCanvas.width, scanCanvas.height);
            const scannedCode = await scanImageData(scanCanvas);
            if (scannedCode) {
              handlePerformScan(scannedCode);
            }
          }
        }
      }, 400);
    } else {
      stopCamera();
      setScanFeedback(null);
    }
    return () => {
      if (scanInterval) clearInterval(scanInterval);
      stopCamera();
    };
  }, [isScannerOpen]);

  const handlePerformScan = (scannedCode: string) => {
    const code = scannedCode.trim();
    if (!code) return;

    playScanBeepSound();

    // 1. Search in sold devices
    const matchedDevice = warrantyDb ? warrantyDb.find(d => d.serial.toLowerCase() === code.toLowerCase()) : null;
    if (matchedDevice) {
      setScanFeedback(`✅ کد دستگاه "${matchedDevice.itemName}" یافت شد! انتقال به پرونده فنی...`);
      setTimeout(() => {
        setIsScannerOpen(false);
        setDevFileSerial?.(matchedDevice.serial);
        setDevActiveScreen?.('P012'); // TECHNICAL FILE SCREEN ID
      }, 1200);
      return;
    }

    // 2. Search in customers (by Phone or Name)
    const matchedCustomer = customers.find(c => c.phone === code || c.name.toLowerCase() === code.toLowerCase());
    if (matchedCustomer) {
      setScanFeedback(`✅ طرف حساب "${matchedCustomer.name}" یافت شد! انتقال به پروفایل طرف حساب...`);
      setTimeout(() => {
        setIsScannerOpen(false);
        setSelectedProfileCust(matchedCustomer);
      }, 1200);
      return;
    }

    // 3. Nothing found
    setScanFeedback('❌ موردی یافت نشد');
    setTimeout(() => {
      setScanFeedback(null);
    }, 2000);
  };

  // Improved search + type filtering (Requirement 4)
  const filtered = customers.filter(c => {
    // 1. Type filtering
    if (selectedFilter !== 'all') {
      if (c.type !== selectedFilter) return false;
    }

    // 2. Search Query
    const query = (custSearchQuery || '').trim().toLowerCase();
    if (!query) return true;
    
    // Basic fields
    const matchesBasic = 
      c.name.toLowerCase().includes(query) || 
      c.phone.includes(query) ||
      (c.email && c.email.toLowerCase().includes(query)) ||
      (c.city && c.city.toLowerCase().includes(query)) ||
      (c.address && c.address.toLowerCase().includes(query));
      
    if (matchesBasic) return true;
    
    // Device serial numbers
    const customerDevices = warrantyDb ? warrantyDb.filter(d => d.customerPhone === c.phone || d.customerName === c.name) : [];
    const matchesSerial = customerDevices.some(d => d.serial.toLowerCase().includes(query));
    
    return matchesSerial;
  });

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setCustFormName('');
    setCustFormPhone('');
    setCustFormType('person');
    setCustFormEmail('');
    setCustFormAddress('');
    setCustFormCity('');
    setCustFormNotes('');
    setIsCustModalOpen(true);
  };

  const handleOpenEdit = (cust: any) => {
    setEditingCustomer(cust);
    setCustFormName(cust.name);
    setCustFormPhone(cust.phone);
    setCustFormType(cust.type || 'person');
    setCustFormEmail(cust.email || '');
    setCustFormAddress(cust.address || '');
    setCustFormCity(cust.city || getCity(cust));
    setCustFormNotes(cust.notes || '');
    setIsCustModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const name = custFormName.trim();
    const phone = custFormPhone.trim();
    if (!name || !phone) return;

    // Check duplicate phone number (Unique primary identifier)
    const existingByPhone = customers.find(c => 
      c.phone === phone && (!editingCustomer || c.phone !== editingCustomer.phone)
    );
    if (existingByPhone) {
      alert(`طرف حساب دیگری با شماره تلفن (${phone}) با نام «${existingByPhone.name}» قبلاً در سیستم ثبت شده است.`);
      return;
    }

    const newCust = {
      name,
      phone,
      type: custFormType,
      email: custFormEmail.trim(),
      address: custFormAddress.trim(),
      city: custFormCity.trim() || 'تهران',
      notes: custFormNotes.trim()
    };

    if (editingCustomer) {
      setCustomers(prev => prev.map(c => c.phone === editingCustomer.phone ? newCust : c));
    } else {
      setCustomers(prev => [...prev, newCust]);
    }
    setIsCustModalOpen(false);
  };

  return (
    <div className="space-y-4 text-right relative" dir="rtl">
      
      {/* Sticky Header and Search (Requirement 3 & 7 & 4) */}
      <div className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md pt-2 pb-4 z-20 space-y-3 border-b border-slate-200/50 dark:border-slate-800">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>لیست طرف حساب دیاکو</span>
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">مدیریت و پرونده‌های طرف حساب حقیقی، حقوقی و همکاران</p>
          </div>
          
          <div className="flex items-center gap-2 relative">
            {/* Filter Button (Requirement 4) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsFilterDropdownOpen(!isFilterDropdownOpen)}
                className={`p-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 border min-h-[40px] ${
                  selectedFilter !== 'all' 
                    ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300' 
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-600 dark:text-slate-300'
                }`}
                title="فیلتر نوع طرف حساب"
              >
                <Filter className="w-4 h-4" />
                <span className="text-[11px]">
                  {selectedFilter === 'all' && 'همه'}
                  {selectedFilter === 'person' && 'حقیقی'}
                  {selectedFilter === 'representative' && 'نمایندگی'}
                  {selectedFilter === 'service_center' && 'مرکز خدمات'}
                </span>
              </button>

              {/* Filter Dropdown (Requirement 4) */}
              <AnimatePresence>
                {isFilterDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsFilterDropdownOpen(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute left-0 mt-2 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 overflow-hidden text-right py-1"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFilter('all');
                          setIsFilterDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-right text-xs font-black flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${selectedFilter === 'all' ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/40' : 'text-slate-700 dark:text-slate-200'}`}
                      >
                        <span>همه طرف حساب</span>
                        {selectedFilter === 'all' && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFilter('person');
                          setIsFilterDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-right text-xs font-black flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${selectedFilter === 'person' ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/40' : 'text-slate-700 dark:text-slate-200'}`}
                      >
                        <span>🟢 طرف حساب حقیقی</span>
                        {selectedFilter === 'person' && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFilter('representative');
                          setIsFilterDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-right text-xs font-black flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${selectedFilter === 'representative' ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/40' : 'text-slate-700 dark:text-slate-200'}`}
                      >
                        <span>🔵 نمایندگی / همکار</span>
                        {selectedFilter === 'representative' && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFilter('service_center');
                          setIsFilterDropdownOpen(false);
                        }}
                        className={`w-full px-4 py-3 text-right text-xs font-black flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${selectedFilter === 'service_center' ? 'text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/40' : 'text-slate-700 dark:text-slate-200'}`}
                      >
                        <span>🟠 مرکز خدمات / تعمیرگاه</span>
                        {selectedFilter === 'service_center' && <Check className="w-3.5 h-3.5" />}
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* + طرف حساب جدید Button (Requirement 3: Sticky at top while scrolling) */}
            <button
              type="button"
              onClick={handleOpenAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-transform active:scale-95 cursor-pointer min-h-[40px]"
            >
              <span>+ طرف حساب جدید</span>
            </button>
          </div>
        </div>

        {/* Search Input with QR Scan Button (Requirement 7) */}
        <div className="relative">
          <input
            type="text"
            value={custSearchQuery || ''}
            onChange={(e) => setCustSearchQuery?.(e.target.value)}
            placeholder="جستجو بر اساس نام، شماره تماس یا سریال دستگاه..."
            className="w-full pl-12 pr-10 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-blue-600 dark:focus:border-blue-500 rounded-2xl text-xs font-bold outline-none transition-all shadow-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          
          <button
            type="button"
            onClick={() => setIsScannerOpen(true)}
            className="absolute left-1.5 top-1/2 -translate-y-1/2 p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700/60 rounded-xl transition-all cursor-pointer active:scale-90 min-h-[38px]"
            title="اسکن هوشمند بارکد یا QR"
          >
            <QrCode className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Customer List Cards (2 per row on desktop for spacious, clean layout) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4.5 pt-1">
        {filtered.length > 0 ? (
          filtered.map((cust, idx) => {
            const customerDevices = warrantyDb ? warrantyDb.filter(d => d.customerPhone === cust.phone || d.customerName === cust.name) : [];
            const activeWarranties = customerDevices.filter(d => d.status === 'active').length;
            const isMenuOpen = activeMenuCustPhone === cust.phone;
            const openUpward = filtered.length > 1 && idx >= filtered.length - 2;

            return (
              <motion.div 
                key={idx} 
                onClick={() => setSelectedProfileCust(cust)}
                whileTap={{ scale: 0.985 }}
                className={`bg-white dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800 rounded-2xl p-4.5 shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer relative flex flex-col justify-between space-y-3.5 ${cust.isActive === false ? 'opacity-65 bg-slate-50/50 dark:bg-slate-900/50' : ''}`}
              >
                {/* Header Section: Avatar & Name on Right, Actions on Left (No overlap!) */}
                <div className="flex items-start justify-between gap-3 w-full">
                  {/* Right side: Avatar, Name & Type Badges */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base border shadow-xs shrink-0 ${getAvatarColor(cust.name)}`}>
                      {cust.name.charAt(0)}
                    </div>
                    
                    <div className="text-right min-w-0 flex-1">
                      <h4 className="text-sm md:text-base font-black text-slate-900 dark:text-slate-100 leading-snug truncate" title={cust.name}>
                        {cust.name}
                      </h4>
                      
                      <div className="mt-1 flex items-center gap-1 flex-wrap">
                        {cust.type === 'representative' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8.5px] font-black bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-900/60">
                            <span className="w-1 h-1 rounded-full bg-blue-500"></span>
                            نمایندگی / حقوقی
                          </span>
                        ) : cust.type === 'service_center' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8.5px] font-black bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-100 dark:border-amber-900/60">
                            <span className="w-1 h-1 rounded-full bg-amber-500"></span>
                            مرکز خدمات تخصصی
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8.5px] font-black bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/60">
                            <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                            طرف حساب حقیقی
                          </span>
                        )}

                        {cust.isActive === false && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8.5px] font-black bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/60">
                            <span className="w-1 h-1 rounded-full bg-rose-500"></span>
                            غیرفعال
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Left side: Edit and Menu buttons side-by-side */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(cust)}
                      className="w-9 h-9 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/50 text-slate-500 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/60 dark:border-slate-700/60 transition-all active:scale-90 flex items-center justify-center shadow-2xs cursor-pointer"
                      title="ویرایش مشخصات"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuCustPhone(isMenuOpen ? null : cust.phone)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 border border-slate-200/60 dark:border-slate-700/60 transition-all active:scale-90 cursor-pointer"
                        title="گزینه‌ها"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu Overlay & List */}
                      {isMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setActiveMenuCustPhone(null)} />
                          <div className={`absolute left-0 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-40 py-1.5 text-right font-black text-xs text-slate-700 dark:text-slate-200 animate-in fade-in duration-150 ${
                            openUpward 
                              ? 'bottom-full mb-1 slide-in-from-bottom-2' 
                              : 'top-full mt-1 slide-in-from-top-2'
                          }`}>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuCustPhone(null);
                                setSelectedProfileCust(cust);
                              }}
                              className="w-full px-4 py-2.5 text-right hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors flex items-center gap-2 text-slate-800 dark:text-slate-200 cursor-pointer"
                            >
                              <span>👤</span>
                              <span>مشاهده پروفایل</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuCustPhone(null);
                                handleOpenEdit(cust);
                              }}
                              className="w-full px-4 py-2.5 text-right hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors flex items-center gap-2 text-blue-600 dark:text-blue-400 cursor-pointer"
                            >
                              <span>✏️</span>
                              <span>ویرایش اطلاعات</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                setActiveMenuCustPhone(null);
                                handleCallCustomer(cust, e);
                              }}
                              className="w-full px-4 py-2.5 text-right hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors flex items-center gap-2 text-blue-600 dark:text-blue-400 cursor-pointer"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>تماس با طرف حساب</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                setActiveMenuCustPhone(null);
                                handleSmsCustomer(cust, e);
                              }}
                              className="w-full px-4 py-2.5 text-right hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors flex items-center gap-2 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>ارسال پیامک</span>
                            </button>
                            <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                            {(() => {
                              const hasTransactions = getCustomerTransactions(cust).hasTransactions;
                              if (hasTransactions) {
                                if (cust.isActive !== false) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuCustPhone(null);
                                        setCustomerToDelete(cust);
                                      }}
                                      className="w-full px-4 py-2.5 text-right hover:bg-amber-50 dark:hover:bg-amber-950/50 text-amber-600 dark:text-amber-400 transition-colors flex items-center gap-2 font-black cursor-pointer"
                                    >
                                      <span>🔄</span>
                                      <span>غیرفعال‌سازی طرف حساب</span>
                                    </button>
                                  );
                                } else {
                                  return (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuCustPhone(null);
                                        setCustomers(prev => prev.map(c => c.phone === cust.phone ? { ...c, isActive: true } : c));
                                      }}
                                      className="w-full px-4 py-2.5 text-right hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 transition-colors flex items-center gap-2 font-black cursor-pointer"
                                    >
                                      <span>🟢</span>
                                      <span>فعال‌سازی مجدد طرف حساب</span>
                                    </button>
                                  );
                                }
                              } else {
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveMenuCustPhone(null);
                                      setCustomerToDelete(cust);
                                    }}
                                    className="w-full px-4 py-2.5 text-right hover:bg-rose-50 dark:hover:bg-rose-950/50 text-rose-600 dark:text-rose-400 transition-colors flex items-center gap-2 font-black cursor-pointer"
                                  >
                                    <span>🗑️</span>
                                    <span>حذف طرف حساب</span>
                                  </button>
                                );
                              }
                            })()}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card details section: Mobile, Location & Statistics */}
                <div className="flex flex-col gap-2 pt-3 border-t border-slate-100/90 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 font-bold w-full">
                  
                  {/* Row 1: Phone + Phone & SMS action buttons */}
                  <div className="flex items-center justify-between gap-2 bg-slate-50/90 dark:bg-slate-800/60 p-2 rounded-xl border border-slate-200/60 dark:border-slate-700/60 w-full" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5 min-w-0 pr-1">
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold shrink-0">همراه:</span>
                      <span className="font-mono text-xs md:text-sm text-slate-900 dark:text-slate-100 font-black tracking-wide truncate" dir="ltr">{cust.phone}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button 
                        type="button"
                        onClick={(e) => handleCallCustomer(cust, e)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 text-xs font-black shadow-xs"
                        title="تماس تلفنی با مخاطب"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>تماس</span>
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => handleSmsCustomer(cust, e)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer flex items-center gap-1.5 active:scale-95 text-xs font-black shadow-xs"
                        title="ارسال پیام به مخاطب"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>پیامک</span>
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Location / City */}
                  <div className="flex items-center gap-1.5 bg-slate-50/60 dark:bg-slate-800/40 px-2.5 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 w-full min-w-0" title={`شهر/محل سکونت: ${getCity(cust)}`}>
                    <span className="shrink-0 text-xs">📍</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-400 font-bold shrink-0">محل سکونت:</span>
                    <span className="font-bold text-[11px] text-slate-800 dark:text-slate-200 truncate w-full">{getCity(cust)}</span>
                  </div>

                  {/* Row 3: Devices & Warranties Statistics Box */}
                  <div className="flex items-center justify-between bg-slate-50/60 dark:bg-slate-800/40 px-3 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-800 font-black text-xs text-slate-700 dark:text-slate-300 w-full">
                    <span className="flex items-center gap-1.5" title="تعداد دستگاه‌های ثبت شده">
                      <span className="text-sm">📦</span>
                      <span className="font-mono text-slate-900 dark:text-slate-100 text-xs">{customerDevices.length}</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">دستگاه</span>
                    </span>
                    <span className="text-slate-200 dark:text-slate-700">|</span>
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400" title="تعداد گارانتی‌های فعال">
                      <span className="text-sm">🛡️</span>
                      <span className="font-mono text-xs">{activeWarranties}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">فعال</span>
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-6 text-center text-slate-400 text-xs font-bold">
            طرف حساب منطبق با عبارت جستجو پیدا نشد.
          </div>
        )}
      </div>

      {/* Camera Barcode/QR Scanner Modal (Requirement 7) */}
      {isScannerOpen && (
        <div className="fixed inset-0 z-55 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md cursor-pointer" onClick={() => setIsScannerOpen(false)} />
          <div className="bg-slate-900 text-white rounded-3xl border border-slate-800 w-full max-w-sm overflow-hidden shadow-2xl relative z-10 text-right flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="bg-slate-950 border-b border-slate-800 px-5 py-4 flex justify-between items-center shrink-0">
              <span className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-blue-500" />
                <span>اسکنر هوشمند بارکد و QR</span>
              </span>
              <button 
                onClick={() => setIsScannerOpen(false)} 
                className="text-slate-400 hover:text-slate-200 cursor-pointer p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 flex flex-col justify-between">
              
              {/* Scan box animation */}
              <div className="relative w-full aspect-square max-w-[240px] mx-auto bg-black rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
                {realCameraActive ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                  />
                ) : (
                  <div className="text-center p-4 space-y-2">
                    <span className="text-3xl block">📷</span>
                    <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                      {cameraError || "در حال آماده‌سازی دوربین..."}
                    </p>
                  </div>
                )}

                {/* Laser scan animation line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 shadow-lg shadow-red-500/50 animate-bounce" />
                
                {/* Overlay guides */}
                <div className="absolute inset-4 border border-dashed border-blue-500/40 rounded-xl pointer-events-none" />
              </div>

              {/* Status / Feedback message */}
              {scanFeedback ? (
                <div className={`p-3 rounded-xl text-center text-xs font-black transition-all ${
                  scanFeedback.includes('❌') 
                    ? 'bg-rose-950/50 text-rose-300 border border-rose-900/30' 
                    : 'bg-emerald-950/50 text-emerald-300 border border-emerald-900/30'
                }`}>
                  {scanFeedback}
                </div>
              ) : (
                <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                  دوربین را مقابل بارکد دستگاه یا کد خریدار نگه دارید.
                </p>
              )}

              {/* Upload QR/Barcode photo button */}
              <div className="pt-1">
                <label className="w-full py-2 bg-slate-800 hover:bg-slate-750 text-blue-400 border border-slate-700 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  <span>بارگذاری عکس / فایل بارکد یا QR</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const code = await scanImageFile(file);
                        if (code) {
                          handlePerformScan(code);
                        } else {
                          setScanFeedback("❌ کد QR یا بارکدی در این تصویر خوانده نشد.");
                        }
                      }
                    }}
                  />
                </label>
              </div>

              {/* Fast simulator selectors (Perfect for preview/testing) */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <span className="text-[9px] font-black text-slate-400 block mb-1">کدهای فرضی جهت شبیه‌سازی سریع اسکن:</span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1 text-right">
                    <span className="text-[8px] text-slate-500 block">دستگاه‌های فروخته‌شده:</span>
                    {warrantyDb && warrantyDb.slice(0, 2).map((item, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handlePerformScan(item.serial)}
                        className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-white font-mono text-[9px] rounded-lg text-center transition-colors truncate block border border-slate-700 cursor-pointer"
                        title={item.itemName}
                      >
                        {item.serial}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1 text-right">
                    <span className="text-[8px] text-slate-500 block">شماره خریداران:</span>
                    {customers.slice(0, 2).map((c, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handlePerformScan(c.phone)}
                        className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-white font-mono text-[9px] rounded-lg text-center transition-colors truncate block border border-slate-700 cursor-pointer"
                        title={c.name}
                      >
                        {c.phone}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Manual entry fallback */}
                <div className="pt-2 flex gap-1.5">
                  <input
                    type="text"
                    id="manualScanCode"
                    placeholder="یا کد را دستی بنویسید..."
                    className="flex-1 bg-slate-950 border border-slate-800 focus:border-blue-600 rounded-xl px-2.5 py-1.5 text-[10px] font-mono text-white outline-none"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.currentTarget as HTMLInputElement).value;
                        handlePerformScan(val);
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('manualScanCode') as HTMLInputElement;
                      if (input) handlePerformScan(input.value);
                    }}
                    className="px-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] rounded-xl transition-colors cursor-pointer"
                  >
                    بررسی
                  </button>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsScannerOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black rounded-xl cursor-pointer transition-colors"
              >
                انصراف و خروج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Profile Modal Sheet (Requirement 6) */}
      {selectedProfileCust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs cursor-pointer" onClick={() => setSelectedProfileCust(null)} />
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-md overflow-hidden shadow-2xl relative z-10 text-right flex flex-col max-h-[85vh]">
            
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-100 px-5 py-4 flex justify-between items-center shrink-0">
              <span className="text-sm font-black text-slate-950 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                <span>پروفایل کامل طرف حساب</span>
              </span>
              <button 
                onClick={() => setSelectedProfileCust(null)} 
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content (Scrollable) */}
            <div className="p-5 space-y-5 overflow-y-auto">
              
              {/* Profile Card Header */}
              <div className="text-center space-y-2">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center font-black text-xl mx-auto shadow-sm border ${getAvatarColor(selectedProfileCust.name)}`}>
                  {selectedProfileCust.name.charAt(0)}
                </div>
                <h3 className="text-base font-black text-slate-900">{selectedProfileCust.name}</h3>
                
                {/* Type Badge */}
                <div className="flex justify-center">
                  {selectedProfileCust.type === 'representative' ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-100">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      نماینده / همکار حقوقی
                    </span>
                  ) : selectedProfileCust.type === 'service_center' ? (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-700 border border-amber-100">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      مرکز خدمات تخصصی
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      طرف حساب حقیقی
                    </span>
                  )}
                </div>
              </div>

              {/* Contacts Details */}
              <div className="bg-slate-50/60 rounded-2xl p-4 border border-slate-100 space-y-3 text-xs">
                <h4 className="font-black text-slate-800 text-[11px] pb-2 border-b border-slate-200/50">📞 اطلاعات تماس و آدرس</h4>
                
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">تلفن همراه:</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-black text-slate-900">{selectedProfileCust.phone}</span>
                    <div className="flex gap-1.5">
                      <button 
                        type="button"
                        onClick={(e) => handleCallCustomer(selectedProfileCust, e)} 
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="تماس تلفنی"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => handleSmsCustomer(selectedProfileCust, e)} 
                        className="p-1.5 rounded-lg bg-white border border-slate-200 text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
                        title="ارسال پیامک"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {selectedProfileCust.email && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-bold">پست الکترونیکی:</span>
                    <span className="font-mono text-slate-800 font-bold select-all">{selectedProfileCust.email}</span>
                  </div>
                )}

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold">شهر سکونت/فعالیت:</span>
                  <span className="text-slate-800 font-black">{getCity(selectedProfileCust)}</span>
                </div>

                <div className="pt-2 border-t border-slate-200/30">
                  <span className="text-slate-400 font-bold block mb-1">نشانی دقیق پستی:</span>
                  <p className="text-slate-700 font-black leading-relaxed bg-white/70 p-2 rounded-xl border border-slate-200/40">{selectedProfileCust.address || 'ثبت نشده است'}</p>
                </div>
              </div>

              {/* Devices, Warranties, & Repair History (Requirement 6) */}
              <div className="space-y-2.5">
                <h4 className="font-black text-slate-800 text-[11px] flex justify-between items-center px-1">
                  <span>💻 دستگاه‌های ثبت‌شده و گارانتی‌ها</span>
                  <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-lg text-[10px] font-black">
                    {(() => {
                      const customerDevices = warrantyDb ? warrantyDb.filter(d => d.customerPhone === selectedProfileCust.phone || d.customerName === selectedProfileCust.name) : [];
                      return `${customerDevices.length} دستگاه`;
                    })()}
                  </span>
                </h4>

                {(() => {
                  const customerDevices = warrantyDb ? warrantyDb.filter(d => d.customerPhone === selectedProfileCust.phone || d.customerName === selectedProfileCust.name) : [];
                  
                  if (customerDevices.length === 0) {
                    return (
                      <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold text-[11px]">
                        هیچ دستگاهی برای این طرف حساب ثبت نشده است.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      {customerDevices.map((dev, idx) => (
                        <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-black text-slate-900 block text-xs">{dev.itemName}</span>
                              <span className="font-mono text-[10px] text-slate-400 block mt-0.5 select-all">سریال: {dev.serial}</span>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                              dev.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/40' :
                              dev.status === 'under_repair' ? 'bg-blue-50 text-blue-700 border border-blue-200/40' :
                              dev.status === 'replaced' ? 'bg-teal-50 text-teal-700 border border-teal-200/40' :
                              dev.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200/40' : 'bg-rose-50 text-rose-700 border border-rose-200/40'
                            }`}>
                              {dev.status === 'active' ? 'گارانتی فعال' :
                               dev.status === 'under_repair' ? 'تحت تعمیر' :
                               dev.status === 'replaced' ? 'تعویض شده' :
                               dev.status === 'pending' ? 'پذیرش اولیه' : 'ابطال گارانتی'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500 font-bold border-t border-slate-100 pt-2">
                            <div>
                              <span>ثبت گارانتی: </span>
                              <span className="text-slate-800">{dev.registeredAt}</span>
                            </div>
                            <div>
                              <span>تاریخ انقضا: </span>
                              <span className="text-slate-800">{dev.expiryDate}</span>
                            </div>
                          </div>

                          {/* Repair History / Defect details (Requirement 6) */}
                          {dev.defectType && (
                            <div className="bg-rose-50/40 border border-rose-100/50 rounded-xl p-2.5 text-[10px] text-rose-950 space-y-1">
                              <div className="font-black flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                <span>ایراد اعلامی: {dev.defectType}</span>
                              </div>
                              {dev.statusNotes && (
                                <p className="text-[10px] text-slate-600 font-medium leading-relaxed">
                                  توضیحات تعمیر: {dev.statusNotes}
                                </p>
                              )}
                              {dev.technicianName && (
                                <div className="text-[9px] text-slate-400 font-bold text-left">
                                  تکنسین تعمیرکار: {dev.technicianName}
                                </div>
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProfileCust(null);
                              setDevFileSerial?.(dev.serial);
                              setDevActiveScreen?.('P012');
                            }}
                            className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200/50 text-blue-600 rounded-xl text-[10px] font-black transition-colors"
                          >
                            مشاهده پرونده فنی و تاریخچه کامل دستگاه
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Customer Purchases (خریدهای طرف حساب) */}
              <div className="space-y-2.5 border-t border-slate-100 pt-3">
                <h4 className="font-black text-slate-800 text-[11px] flex justify-between items-center px-1">
                  <span>🛍️ سوابق خرید و فاکتورها (خریدهای طرف حساب)</span>
                  <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg text-[10px] font-black">
                    {(() => {
                      const customerSales = sales ? sales.filter(s => s.customer?.phone === selectedProfileCust.phone || s.customer?.name === selectedProfileCust.name) : [];
                      return `${customerSales.length} فاکتور`;
                    })()}
                  </span>
                </h4>

                {(() => {
                  const customerSales = sales ? sales.filter(s => s.customer?.phone === selectedProfileCust.phone || s.customer?.name === selectedProfileCust.name) : [];
                  
                  if (customerSales.length === 0) {
                    return (
                      <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-slate-400 font-bold text-[11px]">
                        هیچ خرید ثبتی برای این طرف حساب یافت نشد.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                      {customerSales.map((sale, idx) => {
                        const grandTotal = sale.items.reduce((sum: number, item: any) => sum + (item.serials.length * item.unitPrice), 0) - (sale.discount || 0);
                        return (
                          <div key={idx} className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 space-y-2">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-black text-slate-900">فاکتور: <span className="font-mono">{sale.invoiceNumber}</span></span>
                              <span className="text-slate-500 font-mono font-bold">{sale.saleDate}</span>
                            </div>
                            <div className="divide-y divide-slate-150 border-t border-b border-slate-200/50 py-2 space-y-2">
                              {sale.items.map((item: any, itemIdx: number) => (
                                <div key={itemIdx} className="space-y-1 pt-1.5 first:pt-0">
                                  <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-slate-700 font-bold">{item.product?.name} ({item.product?.model})</span>
                                    <span className="text-slate-900 font-black font-mono">
                                      {item.serials?.length || 1} عدد
                                    </span>
                                  </div>
                                  {item.serials && item.serials.length > 0 && (
                                    <div className="flex flex-wrap gap-1 bg-white border border-slate-200/40 p-1.5 rounded-lg">
                                      {item.serials.map((s: string) => (
                                        <span 
                                          key={s} 
                                          onClick={() => {
                                            setSelectedProfileCust(null);
                                            setDevActiveScreen?.('P012');
                                            setDevFileSerial?.(s);
                                          }}
                                          className="bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-600 hover:text-blue-700 font-mono text-[9px] px-1.5 py-0.5 rounded-sm cursor-pointer transition-colors"
                                          title="رهگیری این دستگاه"
                                        >
                                          {s}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between items-center text-[10px] font-black text-emerald-800">
                              <span>مبلغ نهایی فاکتور:</span>
                              <span className="font-mono">
                                {grandTotal ? grandTotal.toLocaleString('fa-IR') + ' تومان' : 'رایگان'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Notes Section (Requirement 6) */}
              <div className="bg-amber-50/50 border border-amber-200/40 rounded-2xl p-4 text-xs space-y-1">
                <h4 className="font-black text-amber-900 text-[11px] flex items-center gap-1">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>📝 یادداشت‌های همکار / طرف حساب</span>
                </h4>
                <p className="text-amber-950 font-medium leading-relaxed">
                  {selectedProfileCust.notes || 'هیچ یادداشتی برای این طرف حساب ثبت نشده است.'}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedProfileCust(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-black rounded-xl cursor-pointer transition-colors"
              >
                بستن پروفایل
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      <DraggableModal
        isOpen={!!isCustModalOpen}
        onClose={() => setIsCustModalOpen?.(false)}
        title={editingCustomer ? 'ویرایش اطلاعات طرف حساب' : 'افزودن طرف حساب جدید'}
        icon={<UserPlus className="w-4 h-4 text-blue-600" />}
        maxWidthClass="max-w-sm"
      >
        <form onSubmit={handleSave} className="p-5 space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-700 block">نام و نام خانوادگی / عنوان شرکت <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={custFormName}
                  onChange={(e) => setCustFormName?.(e.target.value)}
                  placeholder="مثال: مهدی علیزاده"
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-700 block">تلفن همراه / مستقیم <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={custFormPhone}
                  onChange={(e) => setCustFormPhone?.(e.target.value)}
                  placeholder="مثال: 09123456789"
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold font-mono outline-none text-left"
                />
              </div>

              {/* Customer Type Selection (Requirement 4) */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-700 block">نوع طرف حساب</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCustFormType?.('person')}
                    className={`py-2 px-1 text-[10px] font-black rounded-xl border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      custFormType === 'person' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs' 
                        : 'bg-slate-50 text-slate-600 border-slate-200/70 hover:bg-slate-100'
                    }`}
                  >
                    <span>🟢</span>
                    <span>حقیقی</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustFormType?.('representative')}
                    className={`py-2 px-1 text-[10px] font-black rounded-xl border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      custFormType === 'representative' 
                        ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs' 
                        : 'bg-slate-50 text-slate-600 border-slate-200/70 hover:bg-slate-100'
                    }`}
                  >
                    <span>🔵</span>
                    <span>نمایندگی</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCustFormType?.('service_center')}
                    className={`py-2 px-1 text-[10px] font-black rounded-xl border transition-all flex flex-col items-center gap-1 cursor-pointer ${
                      custFormType === 'service_center' 
                        ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-xs' 
                        : 'bg-slate-50 text-slate-600 border-slate-200/70 hover:bg-slate-100'
                    }`}
                  >
                    <span>🟠</span>
                    <span>مرکز خدمات</span>
                  </button>
                </div>
              </div>

              {/* City input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-700 block">شهر <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={custFormCity}
                  onChange={(e) => setCustFormCity(e.target.value)}
                  placeholder="مثال: تهران"
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-700 block">پست الکترونیکی <span className="text-slate-400">(اختیاری)</span></label>
                <input
                  type="email"
                  value={custFormEmail}
                  onChange={(e) => setCustFormEmail?.(e.target.value)}
                  placeholder="example@mail.com"
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold font-mono outline-none text-left"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-700 block">نشانی دقیق پستی <span className="text-slate-400">(اختیاری)</span></label>
                <textarea
                  value={custFormAddress}
                  onChange={(e) => setCustFormAddress?.(e.target.value)}
                  placeholder="آدرس دقیق..."
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold h-16 resize-none outline-none"
                />
              </div>

              {/* Notes input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-700 block">یادداشت‌های اختصاصی <span className="text-slate-400">(اختیاری)</span></label>
                <textarea
                  value={custFormNotes}
                  onChange={(e) => setCustFormNotes(e.target.value)}
                  placeholder="نکات فاکتور، هماهنگی‌های ارسال..."
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold h-14 resize-none outline-none"
                />
              </div>

              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-sm"
                >
                  {editingCustomer ? 'ذخیره تغییرات طرف حساب' : 'ثبت طرف حساب جدید'}
                </button>

                {/* Requirement 1: Delete/Deactivate button inside edit form only */}
                {editingCustomer && (() => {
                  const hasTransactions = getCustomerTransactions(editingCustomer).hasTransactions;
                  if (hasTransactions) {
                    if (editingCustomer.isActive !== false) {
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerToDelete(editingCustomer);
                          }}
                          className="w-full py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-black rounded-xl border border-amber-200/40 transition-all cursor-pointer text-center"
                        >
                          غیرفعال‌سازی این طرف حساب
                        </button>
                      );
                    } else {
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setCustomers(prev => prev.map(c => c.phone === editingCustomer.phone ? { ...c, isActive: true } : c));
                            setIsCustModalOpen?.(false);
                          }}
                          className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-black rounded-xl border border-emerald-200/40 transition-all cursor-pointer text-center"
                        >
                          فعال‌سازی مجدد این طرف حساب
                        </button>
                      );
                    }
                  } else {
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerToDelete(editingCustomer);
                        }}
                        className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black rounded-xl border border-rose-200/40 transition-all cursor-pointer text-center"
                      >
                        حذف این طرف حساب از سیستم
                      </button>
                    );
                  }
                })()}
              </div>
            </form>
      </DraggableModal>

      {/* CUSTOM CONFIRMATION DIALOG FOR CUSTOMER DELETION */}
      {customerToDelete && (() => {
        const hasTransactions = getCustomerTransactions(customerToDelete).hasTransactions;
        return (
          <DraggableModal
            isOpen={!!customerToDelete}
            onClose={() => setCustomerToDelete(null)}
            title={hasTransactions ? 'غیرفعال‌سازی حساب طرف حساب' : 'حذف طرف حساب از سیستم'}
            icon={<AlertTriangle className={`w-5 h-5 ${hasTransactions ? 'text-amber-500' : 'text-rose-500'}`} />}
            maxWidthClass="max-w-sm"
          >
            <div className="p-5 space-y-4">
              {hasTransactions ? (
                <>
                  <p className="text-xs text-slate-600 leading-relaxed" dir="rtl">
                    طرف حساب <span className="font-black text-slate-900">«{customerToDelete.name}»</span> قبلاً در سیستم خرید یا پرونده فعال ثبت کرده است و امکان حذف کامل اطلاعات او وجود ندارد. آیا مایلید حساب او را <span className="text-amber-700 font-black">غیرفعال</span> کنید؟ (او در فهرست فاکتورهای جدید نشان داده نخواهد شد)
                  </p>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomers(prev => prev.map(c => c.phone === customerToDelete.phone ? { ...c, isActive: false } : c));
                        setIsCustModalOpen?.(false);
                        setCustomerToDelete(null);
                      }}
                      className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-xl transition-colors cursor-pointer text-center"
                    >
                      بله، غیرفعال شود
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerToDelete(null)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
                    >
                      انصراف
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-600 leading-relaxed" dir="rtl">
                    آیا از حذف طرف حساب <span className="font-black text-slate-900">«{customerToDelete.name}»</span> با شماره تماس <span className="font-bold text-slate-900 font-mono" dir="ltr">{customerToDelete.phone}</span> و تمامی اطلاعات او مطمئن هستید؟ این عمل غیرقابل بازگشت است.
                  </p>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomers(prev => prev.filter(c => c.phone !== customerToDelete.phone));
                        setIsCustModalOpen?.(false);
                        setCustomerToDelete(null);
                      }}
                      className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-colors cursor-pointer text-center"
                    >
                      بله، حذف شود
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerToDelete(null)}
                      className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
                    >
                      انصراف
                    </button>
                  </div>
                </>
              )}
            </div>
          </DraggableModal>
        );
      })()}

      {/* CALL ACTION MODAL */}
      <DraggableModal
        isOpen={!!activeCallCust}
        onClose={() => setActiveCallCust(null)}
        title={`ارتباط تلفنی با ${activeCallCust?.name || ''}`}
        icon={<Phone className="w-5 h-5 text-blue-600" />}
        maxWidthClass="max-w-sm"
      >
        {activeCallCust && (
          <div className="p-5 space-y-4 text-right">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-center space-y-1">
              <span className="text-xs text-slate-500 font-bold block">شماره تلفن همراه</span>
              <span className="text-lg font-black font-mono text-slate-900 dir-ltr inline-block tracking-wider">
                {activeCallCust.phone}
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <a
                href={`tel:${activeCallCust.phone}`}
                onClick={() => showToast('در حال برقراری تماس تلفنی...')}
                className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>تماس مستقیم تلفنی (Softphone/Dialer)</span>
              </a>

              <a
                href={`https://wa.me/98${activeCallCust.phone.replace(/^0/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <MessageSquare className="w-4 h-4" />
                <span>تماس / گفتگو در واتس‌اپ (WhatsApp)</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeCallCust.phone);
                  showToast('شماره تلفن با موفقیت کپی شد!');
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border border-slate-200/60"
              >
                <Copy className="w-4 h-4 text-slate-500" />
                <span>کپی شماره همراه در حافظه</span>
              </button>
            </div>
          </div>
        )}
      </DraggableModal>

      {/* SMS / MESSAGE ACTION MODAL */}
      <DraggableModal
        isOpen={!!activeSmsCust}
        onClose={() => setActiveSmsCust(null)}
        title={`ارسال پیام به ${activeSmsCust?.name || ''}`}
        icon={<MessageSquare className="w-5 h-5 text-emerald-600" />}
        maxWidthClass="max-w-md"
      >
        {activeSmsCust && (
          <div className="p-5 space-y-4 text-right">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between">
              <div className="text-right">
                <span className="text-xs font-black text-slate-900 block">{activeSmsCust.name}</span>
                <span className="text-[11px] font-bold font-mono text-slate-500">{activeSmsCust.phone}</span>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100">
                پیام‌رسانی سریع
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={`sms:${activeSmsCust.phone}`}
                onClick={() => showToast('در حال انتقال به برنامه پیام‌رسان...')}
                className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer text-center"
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span>ارسال پیامک SMS</span>
              </a>

              <a
                href={`https://wa.me/98${activeSmsCust.phone.replace(/^0/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-3 px-3 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer text-center"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>چت در واتس‌اپ</span>
              </a>
            </div>

            {/* Quick Message Templates */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-xs font-black text-slate-800 block">پیش‌نویس‌های آماده پیام:</span>
              <div className="space-y-1.5">
                {[
                  `سلام جناب ${activeSmsCust.name}، جهت اطلاع‌رسانی وضعیت گارانتی و پذیرش قطعه شما از طرف واحد خدمات تماس گرفتیم.`,
                  `طرف حساب گرامی ${activeSmsCust.name}، دستگاه/قطعه شما آماده تحویل می‌باشد. جهت دریافت مراجعه فرمایید.`,
                  `با سلام، لطفا جهت تأیید مشخصات و هماهنگی ارسال قطعه با پشتیبانی تماس بگیرید.`
                ].map((tmpl, idx) => (
                  <div 
                    key={idx}
                    onClick={() => {
                      navigator.clipboard.writeText(tmpl);
                      showToast('متن پیام آماده کپی شد!');
                    }}
                    className="p-2.5 bg-slate-50 hover:bg-emerald-50/50 border border-slate-200/60 hover:border-emerald-200 rounded-xl text-[11px] font-bold text-slate-700 leading-relaxed cursor-pointer transition-colors flex items-start gap-2 group"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-600 shrink-0 mt-0.5" />
                    <span className="flex-1">{tmpl}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DraggableModal>

      {/* FLOATING TOAST NOTIFICATION */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-2xl text-xs font-black flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
}

// Helper function to visually highlight matching text in search results
function highlightText(text: string, search: string): React.ReactNode {
  if (!search || !search.trim()) {
    return text;
  }
  try {
    const escapedSearch = search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearch})`, 'gi');
    const parts = text.split(regex);
    return (
      <>
        {parts.map((part, index) => {
          const isMatch = regex.test(part);
          return isMatch ? (
            <mark
              key={index}
              className="bg-amber-200 text-amber-950 px-0.5 rounded font-black border-b border-amber-500 shadow-xxs mx-[1px]"
            >
              {part}
            </mark>
          ) : (
            part
          );
        })}
      </>
    );
  } catch (err) {
    return text;
  }
}

// Helper function to render product image (either Base64 string/URL or Emoji)
function renderProductImage(imageStr: string | undefined, defaultClass: string, isEmojiContainerClass?: string) {
  const isRealImage = imageStr && (imageStr.startsWith('data:') || imageStr.startsWith('http') || imageStr.length > 10);
  if (isRealImage) {
    return (
      <img
        src={imageStr}
        alt="تصویر کالا"
        referrerPolicy="no-referrer"
        className={`${defaultClass} object-cover`}
      />
    );
  }
  return (
    <div className={`${defaultClass} ${isEmojiContainerClass || 'bg-gradient-to-br from-blue-50 to-slate-100 text-slate-700 flex items-center justify-center'}`}>
      {imageStr || '📦'}
    </div>
  );
}

const SIMULATED_PHOTOS = [
  {
    name: 'شارژر هوشمند طلایی دیاکو',
    emoji: '🔌',
    data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 100 100"><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%23f59e0b"/><stop offset="100%" stop-color="%23d97706"/></linearGradient></defs><rect width="100%" height="100%" fill="%231e293b"/><rect x="25" y="25" width="50" height="50" rx="10" fill="url(%23g1)" stroke="%23fbbf24" stroke-width="2"/><circle cx="50" cy="50" r="15" fill="%230f172a"/><path d="M48 40 L54 50 L46 50 L52 60" fill="none" stroke="%23fbbf24" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  },
  {
    name: 'کیت برد مدار چاپی دیاکو',
    emoji: '🧩',
    data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 100 100"><defs><linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2310b981"/><stop offset="100%" stop-color="%23047857"/></linearGradient></defs><rect width="100%" height="100%" fill="%230f172a"/><rect x="20" y="20" width="60" height="60" rx="6" fill="url(%23g2)" stroke="%2334d399" stroke-width="1.5"/><circle cx="35" cy="35" r="4" fill="%23f59e0b"/><circle cx="65" cy="35" r="4" fill="%2338bdf8"/><path d="M35 35 L50 50 L65 35" fill="none" stroke="%23f8fafc" stroke-width="2" stroke-linecap="round"/><circle cx="50" cy="50" r="8" fill="%230f172a" stroke="%2334d399"/><circle cx="50" cy="65" r="5" fill="%23ef4444"/></svg>'
  },
  {
    name: 'دستگاه تستر و مانیتورینگ',
    emoji: '📟',
    data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 100 100"><defs><linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%233b82f6"/><stop offset="100%" stop-color="%231d4ed8"/></linearGradient></defs><rect width="100%" height="100%" fill="%23111827"/><rect x="22" y="22" width="56" height="56" rx="8" fill="%231f2937" stroke="%234b5563" stroke-width="2"/><rect x="30" y="30" width="40" height="25" rx="3" fill="url(%23g3)"/><path d="M35 42 L42 42 L45 35 L50 48 L53 40 L65 40" fill="none" stroke="%23ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="38" cy="67" r="4" fill="%23ef4444"/><circle cx="50" cy="67" r="4" fill="%2310b981"/><circle cx="62" cy="67" r="4" fill="%23f59e0b"/></svg>'
  },
  {
    name: 'منبع تغذیه صنعتی پیشرفته',
    emoji: '⚡',
    data: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 100 100"><defs><linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2364748b"/><stop offset="100%" stop-color="%23334155"/></linearGradient></defs><rect width="100%" height="100%" fill="%230f172a"/><rect x="25" y="20" width="50" height="60" rx="4" fill="url(%23g4)" stroke="%23475569" stroke-width="2"/><line x1="35" y1="35" x2="65" y2="35" stroke="%230f172a" stroke-width="8" stroke-linecap="round"/><line x1="35" y1="50" x2="65" y2="50" stroke="%230f172a" stroke-width="8" stroke-linecap="round"/><line x1="35" y1="65" x2="65" y2="65" stroke="%230f172a" stroke-width="8" stroke-linecap="round"/><circle cx="42" cy="35" r="2" fill="%2310b981"/><circle cx="58" cy="35" r="2" fill="%2338bdf8"/></svg>'
  }
];

// ---------------------------------------------------------------------------------------------------
// P004: PRODUCT CATALOG MANAGEMENT SCREEN PREVIEW
// ---------------------------------------------------------------------------------------------------
export function P004ProductManagement({
  products,
  setProducts,
  prodSearchQuery,
  setProdSearchQuery,
  isProdModalOpen,
  setIsProdModalOpen,
  editingProduct,
  setEditingProduct,
  prodFormName,
  setProdFormName,
  prodFormModel,
  setProdFormModel,
  prodFormDuration,
  setProdFormDuration,
  prodFormSuggestedPrice,
  setProdFormSuggestedPrice,
  warrantyDb,
  setDevFileSerial,
  setDevActiveScreen,
  setActiveTab,
  sales
}: DevDashboardProps) {

  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [expandedCardModel, setExpandedCardModel] = useState<string | null>(null);

  // QR Code Scanner States
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn("Camera access failed:", err);
      setCameraError("دسترسی به دوربین امکان‌پذیر نیست یا مسدود شده است. از شبیه‌ساز هوشمند اسکن کالا در زیر استفاده کنید.");
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
  };

  React.useEffect(() => {
    let scanInterval: any = null;
    if (isQRScannerOpen) {
      startCamera();

      // Live video QR/Barcode frame detection loop
      const scanCanvas = document.createElement('canvas');
      scanInterval = setInterval(async () => {
        if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          scanCanvas.width = videoRef.current.videoWidth || 300;
          scanCanvas.height = videoRef.current.videoHeight || 300;
          const ctx = scanCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, scanCanvas.width, scanCanvas.height);
            const scannedCode = await scanImageData(scanCanvas);
            if (scannedCode) {
              playScanBeepSound();
              setProdSearchQuery(scannedCode);
              setIsQRScannerOpen(false);
            }
          }
        }
      }, 400);
    } else {
      stopCamera();
    }
    return () => {
      if (scanInterval) clearInterval(scanInterval);
      stopCamera();
    };
  }, [isQRScannerOpen]);

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // High pitch beep
      gainNode.gain.setValueAtTime(0.15, audioCtx.currentTime);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15); // Beep duration 150ms
    } catch (e) {
      console.log("Audio not supported or blocked by user gesture");
    }
  };

  // Product Photo Camera States
  const [isProductCameraOpen, setIsProductCameraOpen] = useState(false);
  const [productCameraStream, setProductCameraStream] = useState<MediaStream | null>(null);
  const [productCameraError, setProductCameraError] = useState<string | null>(null);
  const productVideoRef = React.useRef<HTMLVideoElement>(null);

  const startProductCamera = async () => {
    setProductCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 640 } }
      });
      setProductCameraStream(stream);
      if (productVideoRef.current) {
        productVideoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      console.warn("Product camera access failed:", err);
      setProductCameraError("دسترسی به دوربین امکان‌پذیر نیست یا مسدود شده است. از شبیه‌ساز عکس‌برداری سریع در زیر استفاده کنید.");
    }
  };

  const stopProductCamera = () => {
    if (productCameraStream) {
      productCameraStream.getTracks().forEach(track => track.stop());
      setProductCameraStream(null);
    }
  };

  React.useEffect(() => {
    if (isProductCameraOpen) {
      startProductCamera();
    } else {
      stopProductCamera();
    }
    return () => {
      stopProductCamera();
    };
  }, [isProductCameraOpen]);

  const captureProductPhoto = () => {
    if (productVideoRef.current) {
      try {
        const video = productVideoRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 640;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          playBeep(); // shutter beep
          setFormImage(dataUrl);
          setIsProductCameraOpen(false);
        }
      } catch (err) {
        console.error("Failed to capture product photo:", err);
      }
    }
  };

  // Dynamic Categories from products database + 'سایر'
  const availableCategories = ['all', ...Array.from(new Set(products.map(p => p.category || 'سایر')))];

  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Form States (Local to keep UX fluid & robust)
  const [formName, setFormName] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formStartSerial, setFormStartSerial] = useState('10001');
  const [formCategory, setFormCategory] = useState('شارژر باتری');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [formDuration, setFormDuration] = useState('18');
  const [formDescription, setFormDescription] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formImage, setFormImage] = useState('⚡');
  const [formProductionPrice, setFormProductionPrice] = useState('');
  const [formSellingPrice, setFormSellingPrice] = useState('');
  const [formPriceStartDate, setFormPriceStartDate] = useState('۱۴۰۵/۰۴/۰۸');
  const [formTotalStock, setFormTotalStock] = useState('50');

  // Price Management States
  const [selectedPriceProduct, setSelectedPriceProduct] = useState<any | null>(null);
  const [priceFormProduction, setPriceFormProduction] = useState('');
  const [priceFormSelling, setPriceFormSelling] = useState('');
  const [priceFormStartDate, setPriceFormStartDate] = useState('');

  // Product Deletion States
  const [deleteCandidate, setDeleteCandidate] = useState<any | null>(null);
  const [deleteWarning, setDeleteWarning] = useState<string | null>(null);

  // Search and Filter Products
  const filtered = products.filter(p => {
    const nameVal = p.name || '';
    const modelVal = p.model || '';
    const serialVal = String(p.startSerial || p.serialNumber || p.code || '');
    
    const matchesSearch = nameVal.toLowerCase().includes(prodSearchQuery.toLowerCase()) || 
                          modelVal.toLowerCase().includes(prodSearchQuery.toLowerCase()) ||
                          serialVal.toLowerCase().includes(prodSearchQuery.toLowerCase());

    const matchesCategory = selectedCategoryFilter === 'all' || (p.category || 'سایر') === selectedCategoryFilter;
    
    const isActiveVal = p.isActive !== false;
    const matchesStatus = selectedStatusFilter === 'all' || 
                          (selectedStatusFilter === 'active' && isActiveVal) || 
                          (selectedStatusFilter === 'inactive' && !isActiveVal);

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setFormName('');
    setFormModel('');
    setFormStartSerial('10001');
    setFormCategory('شارژر باتری');
    setNewCategoryName('');
    setFormDuration('18');
    setFormDescription('');
    setFormIsActive(true);
    setFormImage('⚡');
    setFormProductionPrice('');
    setFormSellingPrice('');
    setFormPriceStartDate('۱۴۰۵/۰۴/۰۸');
    setFormTotalStock('50');
    setIsProdModalOpen(true);
  };

  const handleOpenEdit = (prod: any) => {
    setEditingProduct(prod);
    setFormName(prod.name || '');
    setFormModel(prod.model || '');
    setFormStartSerial(String(prod.startSerial || prod.serialNumber || '10001'));
    
    const defaultCategories = ['شارژر باتری', 'تجهیزات تست', 'بردهای الکترونیکی', 'سایر'];
    if (defaultCategories.includes(prod.category || 'سایر')) {
      setFormCategory(prod.category || 'سایر');
      setNewCategoryName('');
    } else {
      setFormCategory('__new__');
      setNewCategoryName(prod.category || '');
    }

    setFormDuration(prod.warrantyDuration || '18');
    setFormDescription(prod.description || '');
    setFormIsActive(prod.isActive !== false);
    setFormImage(prod.image || '⚙️');
    setFormProductionPrice(prod.productionPrice || '');
    setFormSellingPrice(prod.sellingPrice || prod.suggestedPrice || '');
    setFormPriceStartDate(prod.priceStartDate || '۱۴۰۵/۰۴/۰۸');
    setFormTotalStock(String(prod.totalStock || '50'));
    setIsProdModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formModel.trim() || !formDuration.trim()) return;

    let finalCategory = formCategory;
    if (formCategory === '__new__') {
      if (!newCategoryName.trim()) {
        alert('لطفاً نام دسته‌بندی جدید را وارد کنید.');
        return;
      }
      finalCategory = newCategoryName.trim();
    }

    let finalSellingPrice = formSellingPrice.trim();
    if (finalSellingPrice && !finalSellingPrice.includes('تومان')) {
      finalSellingPrice = Number(finalSellingPrice.replace(/,/g, '')).toLocaleString('fa-IR') + ' تومان';
    }

    let finalProductionPrice = formProductionPrice.trim();
    if (finalProductionPrice && !finalProductionPrice.includes('تومان')) {
      finalProductionPrice = Number(finalProductionPrice.replace(/,/g, '')).toLocaleString('fa-IR') + ' تومان';
    }

    const newProd = {
      name: formName.trim(),
      model: formModel.trim(),
      startSerial: formStartSerial.trim() || '10001',
      code: formModel.trim(),
      category: finalCategory,
      warrantyDuration: formDuration.trim(),
      description: formDescription.trim(),
      isActive: formIsActive,
      image: formImage,
      productionPrice: finalProductionPrice || 'ثبت نشده',
      sellingPrice: finalSellingPrice || 'ثبت نشده',
      suggestedPrice: finalSellingPrice || 'ثبت نشده',
      priceStartDate: formPriceStartDate.trim() || '۱۴۰۵/۰۴/۰۸',
      totalStock: parseInt(formTotalStock) || 50
    };

    if (editingProduct) {
      setProducts(prev => prev.map(p => p.model === editingProduct.model ? newProd : p));
    } else {
      setProducts(prev => [...prev, newProd]);
    }
    setIsProdModalOpen(false);
  };

  const handleToggleActive = (prod: any, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = {
      ...prod,
      isActive: prod.isActive === false ? true : false
    };
    setProducts(prev => prev.map(p => p.model === prod.model ? updated : p));
  };

  const handleOpenPriceMgmt = (prod: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPriceProduct(prod);
    setPriceFormProduction(prod.productionPrice?.replace(/ تومان/g, '').replace(/[^\d]/g, '') || '');
    setPriceFormSelling((prod.sellingPrice || prod.suggestedPrice || '').replace(/ تومان/g, '').replace(/[^\d]/g, '') || '');
    setPriceFormStartDate(prod.priceStartDate || '۱۴۰۵/۰۴/۰۸');
  };

  const handleSavePrices = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPriceProduct) return;

    let finalSellingPrice = priceFormSelling.trim();
    if (finalSellingPrice && !finalSellingPrice.includes('تومان')) {
      finalSellingPrice = Number(finalSellingPrice.replace(/,/g, '')).toLocaleString('fa-IR') + ' تومان';
    }

    let finalProductionPrice = priceFormProduction.trim();
    if (finalProductionPrice && !finalProductionPrice.includes('تومان')) {
      finalProductionPrice = Number(finalProductionPrice.replace(/,/g, '')).toLocaleString('fa-IR') + ' تومان';
    }

    const updated = {
      ...selectedPriceProduct,
      productionPrice: finalProductionPrice || 'ثبت نشده',
      sellingPrice: finalSellingPrice || 'ثبت نشده',
      suggestedPrice: finalSellingPrice || 'ثبت نشده',
      priceStartDate: priceFormStartDate.trim() || '۱۴۰۵/۰۴/۰۸'
    };

    setProducts(prev => prev.map(p => p.model === selectedPriceProduct.model ? updated : p));
    setSelectedPriceProduct(null);
  };

  const handleInitiateDelete = (prod: any, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!prod) return;

    // Check if the product has any records in warrantyDb (sales, warranties, receptions, repairs, etc.)
    const soldDevices = warrantyDb ? warrantyDb.filter((d: any) => {
      const itemNameVal = d.itemName ? d.itemName.toLowerCase() : '';
      const prodNameVal = prod.name ? prod.name.toLowerCase() : '';
      const prodModelVal = prod.model ? prod.model.toLowerCase() : '';
      
      return itemNameVal.includes(prodNameVal) || itemNameVal.includes(prodModelVal);
    }) : [];

    const hasSalesRecord = sales ? sales.some(s => s.items.some((i: any) => i.product?.model === prod.model || i.product?.name === prod.name)) : false;

    if (soldDevices.length > 0 || hasSalesRecord) {
      setDeleteWarning('این کالا قبلاً در سیستم استفاده شده و قابل حذف نیست. برای حذف آن از فهرست فروش، کالا را غیرفعال کنید.');
      setDeleteCandidate(null);
    } else {
      setDeleteWarning(null);
      setDeleteCandidate(prod);
    }
    setIsProdModalOpen(false);
  };

  const emojisList = ['⚡', '🔋', '🔌', '📟', '🧩', '⚙️', '📦', '🛠️', '💻', '📈'];

  return (
    <div className="product-list-container space-y-5 text-right pb-10" dir="rtl">
      {/* Page Header */}
      <div className="flex justify-between items-center bg-slate-50 p-4 rounded-3xl border border-slate-200/40">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Cpu className="w-4.5 h-4.5" />
            </div>
            <span>مدیریت کالاها</span>
          </h3>
          <p className="text-[10px] text-slate-500 font-bold mt-1">تعریف محصولات و قطعات تحت خدمات دیاکو الکترونیک</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-3.5 rounded-2xl text-xs font-black flex items-center gap-1 shadow-sm hover:shadow transition-all duration-200 active:scale-95 cursor-pointer"
        >
          <span>+ افزودن کالای جدید</span>
        </button>
      </div>

      {/* Search Bar & Advanced Filters (Requirement: Search + Filters) */}
      <div className="space-y-3">
        {/* Search & QR Scanner Button */}
        <div className="flex gap-2.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={prodSearchQuery}
              onChange={(e) => setProdSearchQuery(e.target.value)}
              placeholder="جستجوی کالا با نام قطعه، پارت‌نامبر یا کد فنی..."
              className="w-full pl-3 pr-10 py-3 bg-white border border-slate-200/80 focus:border-blue-600 rounded-2xl text-xs font-bold outline-none transition-all shadow-xs text-right"
            />
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>
          <button
            type="button"
            onClick={() => setIsQRScannerOpen(true)}
            className="px-4 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/60 hover:border-blue-300 rounded-2xl text-xs font-black flex items-center gap-1.5 transition-all duration-200 active:scale-95 cursor-pointer shadow-xs whitespace-nowrap"
            title="اسکن کد QR کالا"
          >
            <QrCode className="w-4.5 h-4.5" />
            <span className="hidden sm:inline">اسکن QR کالا</span>
          </button>
        </div>

        {/* Dynamic Category Filter pills */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1 text-[10px] font-black text-slate-400">
            <Filter className="w-3 h-3 text-slate-400" />
            <span>فیلتر بر اساس دسته‌بندی کالا:</span>
          </div>
          <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {availableCategories.map((cat, cIdx) => (
              <button
                key={cIdx}
                type="button"
                onClick={() => setSelectedCategoryFilter(cat)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black transition-all whitespace-nowrap border cursor-pointer ${
                  selectedCategoryFilter === cat
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                {cat === 'all' ? '🟢 همه دسته‌ها' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter pills */}
        <div className="flex flex-wrap gap-1.5 border-t border-slate-100/60 pt-2.5">
          <button
            type="button"
            onClick={() => setSelectedStatusFilter('all')}
            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${
              selectedStatusFilter === 'all'
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            همه وضعیت‌ها
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatusFilter('active')}
            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${
              selectedStatusFilter === 'active'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
            }`}
          >
            فعال‌ها
          </button>
          <button
            type="button"
            onClick={() => setSelectedStatusFilter('inactive')}
            className={`px-3 py-1 rounded-full text-[10px] font-bold transition-colors ${
              selectedStatusFilter === 'inactive'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 border border-rose-100'
            }`}
          >
            غیرفعال‌ها
          </button>
        </div>
      </div>

      {/* Product list (Requirement: White rounded cards, soft design system) */}
      <div className="space-y-4">
        {filtered.length > 0 ? (
          filtered.map((prod, idx) => {
            const soldDevices = warrantyDb ? warrantyDb.filter(d => d.itemName.includes(prod.name) || d.itemName.includes(prod.model)) : [];
            const isActive = prod.isActive !== false;

            return (
              <motion.div 
                key={idx} 
                onClick={() => setExpandedCardModel(expandedCardModel === prod.model ? null : prod.model)}
                className={`bg-white border rounded-3xl p-5 shadow-xs transition-all duration-300 relative flex flex-col justify-between space-y-4 cursor-pointer select-none ${
                  expandedCardModel === prod.model 
                    ? 'border-blue-500 ring-4 ring-blue-100/50 shadow-md' 
                    : 'border-slate-200/80 hover:bg-slate-50/40 hover:border-slate-300/80 hover:shadow-xs'
                }`}
              >
                {/* Top Block: Always visible (Image/Icon, Title, Badges) */}
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3.5">
                    {/* Modern Product Thumbnail (Requirement 7) */}
                    {renderProductImage(prod.image, "w-[52px] h-[52px] rounded-2xl text-2xl border border-slate-200/60 shadow-xs shrink-0", "bg-gradient-to-br from-blue-50 to-slate-100 text-slate-700 flex items-center justify-center")}
                    <div>
                      {/* Name, Model, Code info */}
                      <h4 className="text-sm font-black text-slate-950 leading-snug">
                        {highlightText(prod.name, prodSearchQuery)}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1">
                        <span className="font-mono text-xs text-slate-500 font-medium">مدل: {highlightText(prod.model, prodSearchQuery)}</span>
                        <span className="text-slate-200">|</span>
                        <span className="font-mono text-[10.5px] text-slate-500 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">شروع سریال: {highlightText(String(prod.startSerial || prod.serialNumber || '10001'), prodSearchQuery)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Badges system (Category and Active Status) */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black bg-blue-50 text-blue-700 border border-blue-100/60 shadow-xxs">
                      🏷️ {prod.category || 'سایر'}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleActive(prod, e);
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black border shadow-xxs transition-all active:scale-95 cursor-pointer ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-150 hover:bg-emerald-100'
                          : 'bg-rose-50 text-rose-700 border-rose-150 hover:bg-rose-100'
                      }`}
                      title="تغییر وضعیت فعال‌بودن"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                      {isActive ? 'فعال' : 'غیرفعال'}
                    </button>
                  </div>
                </div>

                {/* Always-visible brief instruction/chevron to guide user */}
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold border-t border-slate-100/60 pt-2.5 mt-1 select-none">
                  <span className="flex items-center gap-1">
                    <span>💡</span>
                    <span>
                      {expandedCardModel === prod.model 
                        ? 'جهت بستن پنل مشخصات کالا ضربه بزنید' 
                        : 'لمس کنید: نمایش تصویر بزرگ کالا و توضیحات تکمیلی'}
                    </span>
                  </span>
                  <ChevronLeft className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${expandedCardModel === prod.model ? '-rotate-90' : 'rotate-0'}`} />
                </div>

                {/* Collapsible details section */}
                <AnimatePresence>
                  {expandedCardModel === prod.model && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden space-y-4 pt-3 border-t border-slate-100"
                      onClick={(e) => e.stopPropagation()} // Prevent clicking inside collapsible details from collapsing/closing the card
                    >
                      {/* 1. Large Collapsible Product Image (Requirement) */}
                      <div className="bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200/50 rounded-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden group shadow-xxs">
                        {/* Decorative background grid/pattern */}
                        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-30 pointer-events-none" />
                        {/* Glow circle */}
                        <div className="absolute w-28 h-28 bg-blue-100/40 rounded-full blur-2xl pointer-events-none" />
                        
                        {/* Huge product image with subtle scale/shadow */}
                        <div className="relative z-10 mb-3 select-none group-hover:scale-105 transition-transform duration-300">
                          {renderProductImage(prod.image, "w-20 h-20 rounded-2xl shadow-md border border-slate-200/30 text-5xl", "bg-white flex items-center justify-center")}
                        </div>
                        
                        <span className="text-[10px] text-slate-400 font-extrabold tracking-wider uppercase">نمای کاتالوگ الکترونیک خدمات دیاکو</span>
                        <span className="text-xs text-slate-700 font-black mt-1.5">
                          {highlightText(prod.name, prodSearchQuery)} ({highlightText(prod.model, prodSearchQuery)})
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5">شروع سریال کانتر: {highlightText(String(prod.startSerial || prod.serialNumber || '10001'), prodSearchQuery)}</span>
                      </div>

                      {/* 2. Collapsible Descriptions */}
                      {prod.description ? (
                        <div className="bg-slate-50 border border-slate-150 p-3 rounded-2xl space-y-1.5">
                          <span className="text-[10px] font-black text-slate-400 block">ℹ️ مشخصات و توضیحات تکمیلی:</span>
                          <p className="text-xs text-slate-600 leading-relaxed font-bold">
                            {prod.description}
                          </p>
                        </div>
                      ) : (
                        <div className="bg-slate-50 border border-dashed border-slate-200 p-4 rounded-2xl text-center">
                          <span className="text-xs font-bold text-slate-400">ℹ️ هیچ توضیحات فنی دیگری برای این کالا ثبت نشده است.</span>
                        </div>
                      )}

                      {/* 3. Detailed Prices & Warranty Stats */}
                      <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150/80 flex flex-col justify-center">
                          <span className="text-slate-400 text-[10px] block">🛡️ مدت گارانتی فعال:</span>
                          <span className="text-emerald-700 font-black text-xs mt-1">{prod.warrantyDuration} ماه گارانتی طلایی خدمات</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150/80 flex flex-col justify-center">
                          <span className="text-slate-400 text-[10px] block">💰 قیمت فروش پایه:</span>
                          <span className="text-blue-700 font-black text-xs mt-1">{prod.sellingPrice || prod.suggestedPrice || 'ثبت نشده'}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150/80 flex flex-col justify-center">
                          <span className="text-slate-400 text-[10px] block">💵 قیمت تولید/خرید:</span>
                          <span className="text-slate-700 font-black text-xs mt-1">{prod.productionPrice || 'ثبت نشده'}</span>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150/80 flex flex-col justify-center">
                          <span className="text-slate-400 text-[10px] block">📅 شروع اعتبار قیمت:</span>
                          <span className="text-slate-700 font-mono text-xs mt-1">{prod.priceStartDate || 'ثبت نشده'}</span>
                        </div>
                      </div>

                      {/* 3.5. Sales History of this Product (سوابق فروش این کالا) */}
                      <div className="border-t border-slate-100 pt-3 space-y-2">
                        <span className="text-[10px] font-black text-slate-400 block">📊 سوابق فروش و فاکتورهای کالا:</span>
                        {(() => {
                          const productSales = sales ? sales.filter(s => s.items.some((i: any) => i.product?.model === prod.model || i.product?.name === prod.name)) : [];
                          const totalSoldQty = productSales.reduce((sum: number, s: any) => {
                            const foundItem = s.items.find((i: any) => i.product?.model === prod.model || i.product?.name === prod.name);
                            return sum + (foundItem ? (foundItem.serials?.length || 1) : 0);
                          }, 0);

                          if (productSales.length === 0) {
                            return (
                              <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-slate-400 font-bold text-[10px]">
                                هیچ سابقه فروشی برای این کالا ثبت نشده است.
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center bg-blue-50/50 border border-blue-100/50 px-2.5 py-1 rounded-lg text-[10px] font-bold text-blue-800">
                                <span>تعداد کل فروخته شده:</span>
                                <span>{totalSoldQty} عدد</span>
                              </div>
                              <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                                {productSales.map((sale: any, idx: number) => {
                                  const foundItem = sale.items.find((i: any) => i.product?.model === prod.model || i.product?.name === prod.name);
                                  const itemQty = foundItem?.serials?.length || 1;
                                  const itemUnitPrice = foundItem?.unitPrice || 0;
                                  return (
                                    <div key={idx} className="bg-slate-50/70 border border-slate-150/50 rounded-lg p-2 flex justify-between items-center text-[10px]">
                                      <div>
                                        <span className="font-black text-slate-800 block">خریدار: {sale.customer?.name}</span>
                                        <span className="text-slate-400 font-mono text-[9px]">فاکتور: {sale.invoiceNumber} | تاریخ: {sale.saleDate}</span>
                                      </div>
                                      <div className="text-left font-bold text-slate-700">
                                        <span className="block">{itemQty} عدد</span>
                                        <span className="text-[9px] font-mono text-slate-500">
                                          {itemUnitPrice ? (itemUnitPrice).toLocaleString('fa-IR') + ' ریال' : 'رایگان'}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* 4. Action Buttons block */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                        {/* Active Registrations check button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedModel(expandedModel === prod.model ? null : prod.model);
                          }}
                          className="text-blue-600 hover:text-blue-700 text-[11px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>دستگاه‌های فروخته شده و فعال ({soldDevices.length})</span>
                          <ChevronLeft className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedModel === prod.model ? '-rotate-90' : 'rotate-0'}`} />
                        </button>

                        {/* Control buttons */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Toggle Active Switch */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleActive(prod, e);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-black transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                            title={isActive ? 'غیرفعال کردن کالا' : 'فعال کردن کالا'}
                          >
                            <span>🔄</span>
                            <span>{isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</span>
                          </button>

                          {/* Price Management Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenPriceMgmt(prod, e);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/70 text-[10px] font-black transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                          >
                            <Coins className="w-3.5 h-3.5" />
                            <span>مدیریت قیمت‌ها</span>
                          </button>

                          {/* Edit Primary Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEdit(prod);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/50 text-[10px] font-black transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>ویرایش اطلاعات</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInitiateDelete(prod, e);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/50 text-[10px] font-black transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف کالا</span>
                          </button>
                        </div>
                      </div>

                      {/* Nested Sold Devices list */}
                      <AnimatePresence>
                        {expandedModel === prod.model && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden space-y-2 pt-2 border-t border-slate-100/60 mt-2"
                          >
                            {soldDevices.length > 0 ? (
                              <div className="space-y-1.5">
                                {soldDevices.map((dev, dIdx) => (
                                  <div key={dIdx} className="bg-slate-50 border border-slate-200/50 rounded-xl p-2.5 flex justify-between items-center text-[11px] hover:bg-slate-100/75 transition-colors" onClick={(ev) => ev.stopPropagation()}>
                                    <div className="text-right">
                                      <span className="font-black text-slate-800 block">طرف حساب: {dev.customerName}</span>
                                      <span className="font-mono text-[9px] text-slate-400 block mt-0.5">سریال: {dev.serial}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                                        dev.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                                        dev.status === 'under_repair' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                        dev.status === 'replaced' ? 'bg-teal-50 text-teal-700 border border-teal-100' :
                                        dev.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                                      }`}>
                                        {dev.status === 'active' ? 'فعال' :
                                         dev.status === 'under_repair' ? 'تحت تعمیر' :
                                         dev.status === 'replaced' ? 'تعویض شده' :
                                         dev.status === 'pending' ? 'پذیرش اولیه' : 'ابطال گارانتی'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          setDevFileSerial?.(dev.serial);
                                          setDevActiveScreen?.('P012');
                                        }}
                                        className="px-2 py-1 bg-white hover:bg-blue-50 text-blue-600 rounded-md border border-slate-200 hover:border-blue-200 text-[9px] font-black transition-colors cursor-pointer"
                                      >
                                        پرونده فنی
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-3 text-center space-y-2" onClick={(ev) => ev.stopPropagation()}>
                                <p className="text-[10px] text-slate-400 font-bold">هیچ گارانتی فعالی برای این محصول ثبت نشده است.</p>
                                <button
                                  type="button"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setDevActiveScreen?.(null);
                                    setActiveTab?.('register_sale');
                                  }}
                                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black cursor-pointer transition-colors inline-block"
                                >
                                  ثبت اولین فروش و فعالسازی
                                </button>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        ) : (
          <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-8 text-center space-y-3">
            <span className="text-3xl">🔍</span>
            <p className="text-xs text-slate-400 font-bold">هیچ کالایی متناسب با فیلترها و کلمه کلیدی شما یافت نشد.</p>
            <button
              onClick={() => {
                setProdSearchQuery('');
                setSelectedCategoryFilter('all');
                setSelectedStatusFilter('all');
              }}
              className="text-xs text-blue-600 font-black underline cursor-pointer"
            >
              پاک کردن فیلترها
            </button>
          </div>
        )}
      </div>

      {/* Product Add / Edit Modal */}
      {isProdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" />
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-sm overflow-hidden shadow-2xl relative z-10 text-right max-h-[90vh] flex flex-col">
            <div className="bg-slate-50 border-b border-slate-200/80 px-5 py-4 flex items-center justify-center shrink-0 relative">
              <span className="text-xs font-black text-slate-900 flex items-center justify-center gap-1.5 text-center">
                <span>⚡</span>
                <span>{editingProduct ? 'ویرایش اطلاعات کالا' : 'افزودن کالای جدید'}</span>
              </span>
              <button onClick={() => setIsProdModalOpen(false)} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 space-y-4 overflow-y-auto text-center">
              {/* Product Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-700 block text-center">نام کالا (نام قطعه تجاری) <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: شارژر باتری صنعتی ۱۰ آمپر دیاکو"
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none text-center"
                />
              </div>

              {/* Model and Starting Serial Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-700 block text-center">مدل دستگاه <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formModel}
                    onChange={(e) => setFormModel(e.target.value)}
                    placeholder="مثال: DEC-1210"
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold font-mono outline-none text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-700 block text-center">شروع شماره سریال <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formStartSerial}
                    onChange={(e) => setFormStartSerial(e.target.value)}
                    placeholder="مثال: 10001"
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold font-mono outline-none text-center"
                  />
                </div>
              </div>
              <p className="text-[9.5px] text-slate-500 font-bold bg-blue-50/60 border border-blue-100 p-2 rounded-xl flex items-center justify-center gap-1.5 text-center">
                <span>💡</span>
                <span>شماره سریال‌ها از این عدد پایه به صورت صعودی (۱+) افزایش می‌یابند.</span>
              </p>

              {/* Category Dropdown/Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-700 block text-center">دسته‌بندی کالا <span className="text-rose-500">*</span></label>
                <select
                  value={formCategory}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormCategory(val);
                    if (val !== '__new__') {
                      setNewCategoryName('');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none cursor-pointer text-center"
                >
                  <option value="شارژر باتری">🔋 شارژر باتری</option>
                  <option value="تجهیزات تست">📟 تجهیزات تست</option>
                  <option value="بردهای الکترونیکی">🧩 بردهای الکترونیکی</option>
                  <option value="سایر">⚙️ سایر / متفرقه</option>
                  
                  {/* Custom categories from existing products */}
                  {(() => {
                    const defaultCategories = ['شارژر باتری', 'تجهیزات تست', 'بردهای الکترونیکی', 'سایر'];
                    const customCats = Array.from(new Set(products.map(p => p.category).filter(c => c && !defaultCategories.includes(c))));
                    return customCats.map(cc => (
                      <option key={cc} value={cc}>📂 {cc}</option>
                    ));
                  })()}

                  <option value="__new__">➕ تعریف دسته‌بندی جدید...</option>
                </select>

                {formCategory === '__new__' && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="text-[9px] font-black text-blue-700 block mb-1 text-center">نام دسته‌بندی جدید <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="مانند: مخابرات"
                      className="w-full px-3 py-1.5 bg-blue-50/20 border border-blue-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none text-center"
                    />
                  </div>
                )}
              </div>

              {/* Warranty Duration in Months */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-700 block text-center">مدت پوشش گارانتی (به ماه) <span className="text-rose-500">*</span></label>
                <input
                  type="number"
                  required
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value)}
                  placeholder="مثال: 18"
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold font-mono outline-none text-center"
                />
              </div>

              {/* Image Picker Section */}
              <div className="space-y-2.5">
                <label className="text-[10px] font-black text-slate-700 block text-center">تصویر کالا (آیکون، گالری یا دوربین) <span className="text-rose-500">*</span></label>
                
                {/* Image Preview & Media Actions */}
                <div className="flex items-center justify-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200/50">
                  {/* Current Image Preview */}
                  <div className="relative group shrink-0">
                    {renderProductImage(formImage, "w-16 h-16 rounded-xl text-3xl", "bg-white flex items-center justify-center shadow-xs border border-slate-200/60")}
                    {formImage && formImage.length > 8 && (
                      <button
                        type="button"
                        onClick={() => setFormImage('⚡')}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center text-[10px] shadow-xs hover:bg-rose-700 transition-colors cursor-pointer"
                        title="حذف تصویر"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Media buttons */}
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    {/* Gallery Button */}
                    <button
                      type="button"
                      onClick={() => document.getElementById('product-gallery-input')?.click()}
                      className="py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-2xs"
                    >
                      <Upload className="w-3.5 h-3.5 text-blue-600" />
                      <span>انتخاب از گالری</span>
                    </button>
                    <input
                      type="file"
                      id="product-gallery-input"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              setFormImage(event.target.result as string);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />

                    {/* Camera Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsProductCameraOpen(true);
                      }}
                      className="py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300 rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 shadow-2xs"
                    >
                      <Camera className="w-3.5 h-3.5 text-emerald-600" />
                      <span>عکاسی با دوربین</span>
                    </button>
                  </div>
                </div>

                {/* Emoji fallback selection */}
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-slate-400 block text-center">یا انتخاب از بین آیکون‌های آماده:</span>
                  <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50/50 rounded-xl border border-slate-200/30 justify-center">
                    {emojisList.map((emo, eIdx) => (
                      <button
                        key={eIdx}
                        type="button"
                        onClick={() => setFormImage(emo)}
                        className={`w-7 h-7 rounded-lg text-base flex items-center justify-center transition-all cursor-pointer ${
                          formImage === emo 
                            ? 'bg-blue-600 text-white scale-110 shadow-xs' 
                            : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200/50'
                        }`}
                      >
                        {emo}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Production and Selling Prices */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-700 block text-center">قیمت تولید کالا (تومان) <span className="text-slate-400">(اختیاری)</span></label>
                  <input
                    type="text"
                    value={formProductionPrice}
                    onChange={(e) => setFormProductionPrice(e.target.value)}
                    placeholder="مثال: ۲,۸۰۰,۰۰۰"
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-700 block text-center">قیمت فروش کالا (تومان) <span className="text-slate-400">(اختیاری)</span></label>
                  <input
                    type="text"
                    value={formSellingPrice}
                    onChange={(e) => setFormSellingPrice(e.target.value)}
                    placeholder="مثال: ۴,۲۰۰,۰۰۰"
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none text-center"
                  />
                </div>
              </div>

              {/* Price validity start date and Total Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-700 block text-center">تاریخ شروع اعتبار قیمت <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={formPriceStartDate}
                    onChange={(e) => setFormPriceStartDate(e.target.value)}
                    placeholder="مثال: ۱۴۰۵/۰۴/۰۸"
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-700 block text-center">موجودی اولیه انبار <span className="text-rose-500">*</span></label>
                  <input
                    type="number"
                    required
                    value={formTotalStock}
                    onChange={(e) => setFormTotalStock(e.target.value)}
                    placeholder="مثال: ۵۰"
                    className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none text-center"
                    min="0"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-700 block text-center">توضیحات و مشخصات فنی</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="توضیحات کوتاه درباره کاربری قطعه یا سیستم محافظتی..."
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none resize-none text-center"
                />
              </div>

              {/* Status active switch */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/60">
                <span className="text-[11px] font-black text-slate-700">وضعیت کالا در سیستم فعال باشد؟</span>
                <button
                  type="button"
                  onClick={() => setFormIsActive(!formIsActive)}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                    formIsActive ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <div className={`bg-white w-5 h-5 rounded-full shadow-xs transition-transform duration-200 ${
                    formIsActive ? '-translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                {editingProduct && (
                  <button
                    type="button"
                    onClick={() => handleInitiateDelete(editingProduct)}
                    className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-black text-xs rounded-xl border border-rose-200 transition-all cursor-pointer"
                  >
                    حذف کالا
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-sm hover:shadow"
                >
                  {editingProduct ? 'اعمال تغییرات کالا' : 'ثبت قطعه در کاتالوگ'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRICE MANAGEMENT MODAL */}
      <DraggableModal
        isOpen={!!selectedPriceProduct}
        onClose={() => setSelectedPriceProduct(null)}
        title={`مدیریت قیمت‌ها: ${selectedPriceProduct?.name || ''}`}
        icon={<Coins className="w-4 h-4 text-amber-500" />}
        maxWidthClass="max-w-sm"
      >
        <form onSubmit={handleSavePrices} className="p-5 space-y-4">
          {/* Production Price */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-700 block">قیمت تولید کالا (تومان)</label>
            <input
              type="text"
              value={priceFormProduction}
              onChange={(e) => setPriceFormProduction(e.target.value)}
              placeholder="مثال: ۲,۸۰۰,۰۰۰"
              className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none font-mono"
            />
            <span className="text-[9px] text-slate-400 font-bold block mt-0.5">قیمت ساخت و بهای تمام شده قطعه</span>
          </div>

          {/* Selling Price */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-700 block">قیمت فروش پایه (تومان)</label>
            <input
              type="text"
              value={priceFormSelling}
              onChange={(e) => setPriceFormSelling(e.target.value)}
              placeholder="مثال: ۴,۲۰۰,۰۰۰"
              className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none font-mono"
            />
            <span className="text-[9px] text-slate-400 font-bold block mt-0.5">قیمت نهایی عرضه به طرف حساب گارانتی</span>
          </div>

          {/* Effective Validity Date */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-700 block">تاریخ شروع اعتبار قیمت جدید</label>
            <input
              type="text"
              required
              value={priceFormStartDate}
              onChange={(e) => setPriceFormStartDate(e.target.value)}
              placeholder="مثال: ۱۴۰۵/۰۴/۰۸"
              className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none font-mono"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSelectedPriceProduct(null)}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-xl transition-all cursor-pointer border border-slate-200/50"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="flex-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl transition-all cursor-pointer shadow-sm"
            >
              به‌روزرسانی قیمت کالا
            </button>
          </div>
        </form>
      </DraggableModal>

      {/* Product Delete Warning / Confirmation Modal */}
      <DraggableModal
        isOpen={!!(deleteCandidate || deleteWarning)}
        onClose={() => { setDeleteCandidate(null); setDeleteWarning(null); }}
        title={deleteWarning ? 'کالا قابل حذف نیست' : 'تأیید نهایی حذف کالا'}
        icon={<AlertTriangle className="w-5 h-5 text-rose-500" />}
        maxWidthClass="max-w-sm"
      >
        <div className="p-5 space-y-4">
          {deleteWarning ? (
            <div className="space-y-4">
              <p className="text-xs font-bold text-slate-700 leading-relaxed text-right">
                {deleteWarning}
              </p>
              <button
                type="button"
                onClick={() => setDeleteWarning(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black rounded-xl transition-all cursor-pointer text-center"
              >
                متوجه شدم
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-bold text-slate-700 leading-relaxed">
                آیا از حذف این کالا مطمئن هستید؟ این عملیات قابل بازگشت نیست.
              </p>
              
              {deleteCandidate && (
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">نام کالا:</span>
                    <span className="font-black text-slate-800">{deleteCandidate.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold">مدل:</span>
                    <span className="font-mono font-black text-slate-800">{deleteCandidate.model}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteCandidate(null)}
                  className="py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black rounded-xl transition-all cursor-pointer active:scale-98 text-center"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (deleteCandidate) {
                      setProducts(prev => prev.filter(p => p.model !== deleteCandidate.model));
                      setDeleteCandidate(null);
                    }
                  }}
                  className="py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer active:scale-98 text-center"
                >
                  حذف کالا
                </button>
              </div>
            </div>
          )}
        </div>
      </DraggableModal>

      {/* QR Code Scanner Dialog with Fallback & Intelligent Simulator */}
      {isQRScannerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs cursor-pointer" onClick={() => setIsQRScannerOpen(false)} />
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-md overflow-hidden shadow-2xl relative z-10 text-right flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="bg-slate-50 border-b border-slate-200/80 px-5 py-4 flex justify-between items-center shrink-0">
              <span className="text-xs font-black text-slate-950 flex items-center gap-1.5">
                <QrCode className="w-5 h-5 text-blue-600 animate-pulse" />
                <span>اسکنر هوشمند کد QR کالا</span>
              </span>
              <button 
                onClick={() => setIsQRScannerOpen(false)} 
                className="w-8 h-8 rounded-full bg-slate-200/50 hover:bg-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              
              {/* Camera view screen area */}
              <div className="relative aspect-video rounded-2xl bg-slate-900 border-2 border-slate-800 overflow-hidden flex flex-col items-center justify-center text-center shadow-inner group">
                
                {/* Simulated/Real Video Frame */}
                {cameraStream ? (
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 to-slate-900 flex flex-col items-center justify-center p-4">
                    <span className="text-3xl animate-bounce">🎥</span>
                    <span className="text-[11px] text-slate-400 font-bold mt-2">درحال اتصال ایمن به دوربین...</span>
                  </div>
                )}

                {/* Laser Line Animation (Universal for scanning feel) */}
                <motion.div 
                  animate={{ top: ['4%', '96%', '4%'] }}
                  transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                  className="absolute left-4 right-4 h-[3px] bg-emerald-500 shadow-[0_0_10px_#10b981] z-20 pointer-events-none"
                />

                {/* Cyberpunk Scanner HUD Overlay */}
                <div className="absolute inset-4 border border-dashed border-emerald-500/40 rounded-xl pointer-events-none z-10 flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <div className="w-4 h-4 border-t-2 border-r-2 border-emerald-500" />
                    <div className="w-4 h-4 border-t-2 border-l-2 border-emerald-500" />
                  </div>
                  <div className="flex justify-between">
                    <div className="w-4 h-4 border-b-2 border-r-2 border-emerald-500" />
                    <div className="w-4 h-4 border-b-2 border-l-2 border-emerald-500" />
                  </div>
                </div>

                {/* Camera access error message banner */}
                {cameraError && (
                  <div className="absolute bottom-3 left-3 right-3 bg-rose-950/90 border border-rose-800 rounded-xl p-2.5 text-center z-30">
                    <p className="text-[9.5px] text-rose-200 leading-normal font-black">
                      ⚠️ {cameraError}
                    </p>
                  </div>
                )}
              </div>

              {/* Scan simulation explanation and triggers */}
              <div className="space-y-3.5 pt-1">
                {/* Upload Photo Button */}
                <label className="w-full py-2.5 bg-slate-100 hover:bg-blue-50/60 text-blue-700 border border-slate-200 hover:border-blue-300 rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span>انتخاب عکس / تصویر بارکد یا کد QR</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const code = await scanImageFile(file);
                        if (code) {
                          playScanBeepSound();
                          setProdSearchQuery(code);
                          setIsQRScannerOpen(false);
                        } else {
                          alert("کد QR یا بارکد معتبری در این تصویر یافت نشد.");
                        }
                      }
                    }}
                  />
                </label>

                <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-3 flex gap-2.5">
                  <span className="text-base shrink-0">💡</span>
                  <p className="text-[10.5px] text-blue-800 leading-relaxed font-bold">
                    همکار گرامی؛ جهت شبیه‌سازی اسکن یا تست عملکرد فیلتر سریع کالا، روی یکی از نمونه کدهای QR زیر ضربه بزنید تا اسکن موفقیت‌آمیز دستگاه بلافاصله شبیه‌سازی شود.
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10.5px] font-black text-slate-400 block">📱 کدهای QR آماده جهت تست سریع اسکنر:</span>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    {products.map((p, idx) => {
                      const codeToScan = p.code || p.model;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            playBeep();
                            setProdSearchQuery(codeToScan);
                            setIsQRScannerOpen(false);
                          }}
                          className="flex flex-col text-right p-2.5 bg-slate-50 hover:bg-emerald-50/40 border border-slate-200/80 hover:border-emerald-300 rounded-2xl transition-all group cursor-pointer active:scale-95"
                        >
                          <div className="flex items-center gap-2 mb-1 justify-between w-full">
                            <span className="text-[10px] font-black text-slate-800 leading-tight truncate group-hover:text-emerald-700">{p.name}</span>
                            <span className="text-base shrink-0">📱</span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-auto">
                            <span className="font-mono text-[9px] text-slate-400 font-extrabold group-hover:text-emerald-600">کد: {codeToScan}</span>
                            <span className="text-[8px] bg-slate-200/85 group-hover:bg-emerald-100/80 text-slate-600 group-hover:text-emerald-700 px-1.5 py-0.5 rounded-lg font-black transition-all">شبیه‌سازی اسکن</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Direct Manual filter code option as a safety net */}
                <div className="space-y-1 pt-2 border-t border-slate-100/80">
                  <label className="text-[10px] font-black text-slate-700 block">ورود دستی پارت‌نامبر / بارکد دستگاه</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="manual-scanned-code"
                      placeholder="مثال: DEC-1210-CH"
                      className="flex-1 px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold font-mono outline-none text-left"
                      dir="ltr"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = (e.currentTarget as HTMLInputElement).value.trim();
                          if (val) {
                            playBeep();
                            setProdSearchQuery(val);
                            setIsQRScannerOpen(false);
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.getElementById('manual-scanned-code') as HTMLInputElement;
                        if (input && input.value.trim()) {
                          playBeep();
                          setProdSearchQuery(input.value.trim());
                          setIsQRScannerOpen(false);
                        }
                      }}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black cursor-pointer transition-all"
                    >
                      تایید اسکن
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Product Photo Camera Capture Dialog with Real/Mock Toggle */}
      {isProductCameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs cursor-pointer" onClick={() => setIsProductCameraOpen(false)} />
          <div className="bg-white rounded-3xl border border-slate-200 w-full max-w-md overflow-hidden shadow-2xl relative z-10 text-right flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200/80 px-5 py-4 flex justify-between items-center shrink-0">
              <span className="text-xs font-black text-slate-950 flex items-center gap-1.5">
                <Camera className="w-5 h-5 text-emerald-600 animate-pulse" />
                <span>عکاسی دیجیتال هوشمند کالا</span>
              </span>
              <button 
                onClick={() => setIsProductCameraOpen(false)} 
                className="w-8 h-8 rounded-full bg-slate-200/50 hover:bg-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Camera Screen Viewfinder */}
              <div className="relative aspect-video rounded-2xl bg-slate-900 border-2 border-slate-800 overflow-hidden flex flex-col items-center justify-center text-center shadow-inner group">
                {productCameraStream ? (
                  <>
                    <video 
                      ref={productVideoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
                    />
                    
                    {/* Capture button overlay */}
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center z-30">
                      <button
                        type="button"
                        onClick={captureProductPhoto}
                        className="w-12 h-12 rounded-full bg-emerald-500 hover:bg-emerald-600 border-4 border-white shadow-lg flex items-center justify-center text-white transition-all transform hover:scale-110 active:scale-95 cursor-pointer"
                        title="ثبت عکس"
                      >
                        <Camera className="w-5 h-5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 to-slate-900 flex flex-col items-center justify-center p-4">
                    <span className="text-3xl animate-bounce">📸</span>
                    <span className="text-[11px] text-slate-400 font-bold mt-2">درحال اتصال ایمن به دوربین محصول...</span>
                  </div>
                )}

                {/* Grid HUD lines for framing the product */}
                <div className="absolute inset-4 border border-dashed border-white/20 rounded-xl pointer-events-none z-10 flex flex-col justify-between p-2">
                  <div className="flex justify-between">
                    <div className="w-3 h-3 border-t border-r border-white/30" />
                    <div className="w-3 h-3 border-t border-l border-white/30" />
                  </div>
                  <div className="flex justify-between">
                    <div className="w-3 h-3 border-b border-r border-white/30" />
                    <div className="w-3 h-3 border-b border-l border-white/30" />
                  </div>
                </div>

                {/* Banner message if real camera is not available or has error */}
                {productCameraError && (
                  <div className="absolute bottom-3 left-3 right-3 bg-rose-950/90 border border-rose-800 rounded-xl p-2.5 text-center z-30">
                    <p className="text-[9.5px] text-rose-200 leading-normal font-black">
                      ⚠️ {productCameraError}
                    </p>
                  </div>
                )}
              </div>

              {/* Simulation/Quick Snap Options */}
              <div className="space-y-3">
                <div className="bg-emerald-50/50 border border-emerald-150 rounded-2xl p-3 flex gap-2.5">
                  <span className="text-base shrink-0">💡</span>
                  <p className="text-[10.5px] text-emerald-800 leading-relaxed font-bold">
                    همکار گرامی؛ چنانچه دوربین فیزیکی ندارید یا مرورگرتان فاقد دسترسی است، می‌توانید روی هر یک از تصاویر نمونه و واقعی صنعتی دیاکو در زیر کلیک کنید تا به عنوان عکس محصول شبیه‌سازی و ذخیره گردد:
                  </p>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-black text-slate-400 block">⚡ گالری تصاویر شبیه‌ساز عکاسی فوری دیاکو:</span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {SIMULATED_PHOTOS.map((ph, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          playBeep();
                          setFormImage(ph.data);
                          setIsProductCameraOpen(false);
                        }}
                        className="flex flex-col text-right p-2 bg-slate-50 hover:bg-emerald-50/40 border border-slate-200/80 hover:border-emerald-300 rounded-xl transition-all group cursor-pointer active:scale-95"
                      >
                        <div className="flex items-center gap-1.5 mb-1.5 justify-between w-full">
                          <span className="text-[9px] font-black text-slate-700 leading-tight truncate group-hover:text-emerald-700">{ph.name}</span>
                          <span className="text-sm shrink-0">{ph.emoji}</span>
                        </div>
                        <div className="w-full h-20 rounded-lg overflow-hidden border border-slate-200/50 bg-white flex items-center justify-center relative">
                          <img src={ph.data} alt={ph.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                            <span className="bg-emerald-600 text-white font-black text-[8px] px-1.5 py-0.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity">انتخاب سریع</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// P008: DEVICE HANDOVER SCREEN PREVIEW
// ---------------------------------------------------------------------------------------------------
export function P008DeviceHandover({ 
  warrantyDb, 
  setWarrantyDb,
  setDevFileSerial,
  setDevActiveScreen
}: DevDashboardProps) {
  // Devices ready for release/handover are status 'replaced' or 'ready to handover'
  // In our DB, we have status 'replaced' as ready for delivery.
  const [deliveryInvoice, setDeliveryInvoice] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');
  const [signatureDone, setSignatureDone] = useState<boolean>(false);
  const [deliveringItem, setDeliveringItem] = useState<WarrantyItem | null>(null);

  const readyItems = warrantyDb.filter(item => item.status === 'replaced' || item.status === 'pending'); // Show some items as simulation

  const handleDeliverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliveringItem) return;

    // Transition state to 'active' or simulated delivered state
    setWarrantyDb(prev => prev.map(item => {
      if (item.serial === deliveringItem.serial) {
        return {
          ...item,
          status: 'active',
          statusNotes: `ترخیص و تحویل به طرف حساب انجام شد. رسید دیجیتال شماره ${deliveryInvoice || 'DLV-12'} ثبت گردید. توضیحات: ${deliveryNotes || 'تست نهایی با موفقیت انجام شد'}`
        };
      }
      return item;
    }));

    alert(`دستگاه ${deliveringItem.serial} ترخیص شد و رسید خروج صادر گردید.\nتوضیحات خروج: ${deliveryNotes || 'بدون مغایرت'}`);
    setDeliveringItem(null);
    setDeliveryInvoice('');
    setDeliveryNotes('');
    setSignatureDone(false);
  };

  return (
    <div className="space-y-4 text-right" dir="rtl">
      <div>
        <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
          <Truck className="w-5 h-5 text-blue-600" />
          <span>ترخیص و تحویل دستگاه به طرف حساب (P008)</span>
        </h3>
        <p className="text-[10px] text-slate-500 font-bold">بخش نهایی چرخه خدمات جهت کنترل و تسویه نهایی کالا با طرف حساب</p>
      </div>

      <div className="space-y-3">
        <span className="text-[10px] font-black text-slate-400 block">کالاهای آماده ترخیص در کارگاه:</span>
        {readyItems.map((item, idx) => (
          <div key={idx} className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[9px] font-black rounded-lg border border-emerald-200/40">آماده ترخیص</span>
                <h4 className="text-xs font-black text-slate-900 mt-1.5">{item.itemName}</h4>
                <p className="text-[10px] text-slate-400 font-black font-mono mt-0.5">سریال: {item.serial}</p>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setDeliveringItem(item)}
                  className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black rounded-xl transition-colors cursor-pointer shadow-xs shadow-blue-100"
                >
                  ثبت ترخیص
                </button>
                <button
                  onClick={() => {
                    setDevFileSerial?.(item.serial);
                    setDevActiveScreen?.('P012');
                  }}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black rounded-xl transition-colors cursor-pointer border border-slate-200"
                  title="مشاهده شناسنامه فنی"
                >
                  پرونده فنی
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 font-bold bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div>طرف حساب: <span className="text-slate-900 font-black">{item.customerName}</span></div>
              <div>موبایل: <span className="text-slate-900 font-black font-mono">{item.customerPhone}</span></div>
              <div className="col-span-2 pt-1 border-t border-slate-200/40">آخرین شرح فنی: <span className="text-slate-800 font-bold">{item.statusNotes || 'تعویض قطعات آسیب‌دیده تغذیه'}</span></div>
            </div>
          </div>
        ))}
      </div>

      {/* Deliver Form Modal Dialog */}
      <DraggableModal
        isOpen={!!deliveringItem}
        onClose={() => setDeliveringItem(null)}
        title={
          <div>
            <span className="text-xs font-black text-slate-900 block">تکمیل فرم ترخیص قطعه</span>
            <span className="text-[9px] font-black font-mono text-slate-400">{deliveringItem?.serial}</span>
          </div>
        }
        maxWidthClass="max-w-sm"
      >
        <form onSubmit={handleDeliverSubmit} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-700 block">شماره حواله خروج / فاکتور تسویه <span className="text-slate-400">(اختیاری)</span></label>
                <input
                  type="text"
                  value={deliveryInvoice}
                  onChange={(e) => setDeliveryInvoice(e.target.value)}
                  placeholder="مثال: OUT-4908"
                  className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-700 block">توضیحات نهایی تحویل کالا</label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="مثال: تست قطعه با حضور طرف حساب انجام شد و کلیه کابل‌ها تحویل گردید."
                  className="w-full px-3 py-2 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold h-16 resize-none outline-none"
                />
              </div>

              {/* Digital Signature Simulation Box */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-700 block">امضای دیجیتال طرف حساب (تایید تحویل سلامت فیزیکی)</label>
                <div 
                  onClick={() => setSignatureDone(true)}
                  className={`border border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                    signatureDone 
                      ? 'bg-emerald-50/50 border-emerald-300 text-emerald-800' 
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-300 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {signatureDone ? (
                    <div className="space-y-1 flex flex-col items-center">
                      <div className="font-serif italic text-lg text-emerald-700 font-bold opacity-80 tracking-widest leading-none">M. Rezai</div>
                      <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md">امضا ثبت گردید</span>
                    </div>
                  ) : (
                    <div className="space-y-1 flex flex-col items-center py-2">
                      <Edit2 className="w-5 h-5 text-slate-400 animate-pulse" />
                      <span className="text-[9px] font-black">برای ثبت امضای الکترونیک طرف حساب کلیک کنید</span>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={!signatureDone}
                className={`w-full py-3 text-white font-black text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-md ${
                  signatureDone ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100' : 'bg-slate-300 cursor-not-allowed shadow-none'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>ثبت ترخیص نهایی و فعالسازی گارانتی مجدد</span>
              </button>
            </form>
      </DraggableModal>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// P009: REPORTS AND STATISTICS PREVIEW SCREEN
// ---------------------------------------------------------------------------------------------------
export function P009ReportsAndAnalytics({
  setActiveTab,
  setDevActiveScreen,
  setQueueFilter,
  warrantyDb = []
}: DevDashboardProps) {
  const [timeframe, setTimeframe] = useState<'today' | 'week' | 'month'>('month');

  // Dynamic + baseline calculation for defect types
  const defectCounts: { [key: string]: number } = {};
  
  warrantyDb.forEach(item => {
    const type = item.defectType || '';
    let simplified = 'سایر عیوب سخت‌افزاری';
    if (type.includes('سوختگی') || type.includes('مدار') || type.includes('ولتاژ') || type.includes('اتصالی')) {
      simplified = 'سوختگی برد / اتصالی نوسان ولتاژ';
    } else if (type.includes('فیزیکی') || type.includes('شکستگی') || type.includes('پین') || type.includes('سوکت')) {
      simplified = 'آسیب مکانیکی فیزیکی (پین‌های کج)';
    } else if (type.includes('خازن') || type.includes('پاور') || type.includes('بوی سوختگی') || type.includes('صدا') || type.includes('فن')) {
      simplified = 'خرابی خازن ثانویه در فیلتر پاور';
    } else if (type.includes('عدم شناسایی') || type.includes('بایوس') || type.includes('بوق')) {
      simplified = 'بوق خطا یا عدم شناسایی در مادربورد';
    }
    defectCounts[simplified] = (defectCounts[simplified] || 0) + 1;
  });

  const chartData = [
    { name: 'سوختگی برد / اتصالی نوسان ولتاژ', value: (defectCounts['سوختگی برد / اتصالی نوسان ولتاژ'] || 0) + 42, color: '#3b82f6' },
    { name: 'آسیب مکانیکی فیزیکی (پین‌های کج)', value: (defectCounts['آسیب مکانیکی فیزیکی (پین‌های کج)'] || 0) + 18, color: '#f43f5e' },
    { name: 'خرابی خازن ثانویه در فیلتر پاور', value: (defectCounts['خرابی خازن ثانویه در فیلتر پاور'] || 0) + 15, color: '#f59e0b' },
    { name: 'بوق خطا یا عدم شناسایی در مادربورد', value: (defectCounts['بوق خطا یا عدم شناسایی در مادربورد'] || 0) + 9, color: '#10b981' }
  ];

  const totalValue = chartData.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="space-y-4 text-right animate-fade-in" dir="rtl">
      {/* Page Title */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
            <BarChart3 className="text-blue-600 w-5 h-5" />
            <span>گزارشات و آمارهای مدیریتی (P009)</span>
          </h3>
          <p className="text-[10px] text-slate-500 font-bold">نمای کلی کارایی فنی کارگاه و پایداری کالاها</p>
        </div>
        
        {/* Filter Selection Tabs */}
        <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 shrink-0">
          {[
            { id: 'today', label: 'امروز' },
            { id: 'week', label: 'هفته' },
            { id: 'month', label: 'این ماه' }
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTimeframe(t.id as any)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-black transition-all cursor-pointer ${
                timeframe === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'دستگاه‌های ترخیص‌شده', value: timeframe === 'today' ? '۳ دستگاه' : timeframe === 'week' ? '۱۵ دستگاه' : '۷۲ دستگاه', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50', tab: 'handover', filter: 'replaced' },
          { label: 'پرونده‌های پذیرش', value: timeframe === 'today' ? '۴ دستگاه' : timeframe === 'week' ? '۱۸ دستگاه' : '۸۴ دستگاه', icon: ClipboardList, color: 'text-blue-600 bg-blue-50', tab: 'queue', filter: 'pending' },
          { label: 'نرخ تعویض قطعه نو', value: '۴.۸ درصد', icon: RefreshCw, color: 'text-indigo-600 bg-indigo-50', tab: 'queue', filter: 'replaced' },
          { label: 'متوسط زمان تعمیر کالا', value: '۲.۴ روز', icon: Clock, color: 'text-amber-600 bg-amber-50', tab: 'queue', filter: 'under_repair' }
        ].map((kpi, idx) => (
          <div 
            key={idx} 
            onClick={() => {
              if (kpi.tab) {
                setDevActiveScreen?.(null);
                setActiveTab?.(kpi.tab);
                if (kpi.filter) {
                  setQueueFilter?.(kpi.filter as any);
                }
              }
            }}
            className="bg-white border border-slate-200/80 rounded-2xl p-3.5 space-y-1.5 shadow-xs hover:border-blue-500/40 hover:bg-slate-50/50 cursor-pointer transition-all active:scale-95 group text-right"
          >
            <div className="flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold group-hover:text-blue-600 transition-colors">{kpi.label}</span>
              <div className={`w-7 h-7 rounded-lg ${kpi.color} flex items-center justify-center`}>
                <kpi.icon className="w-4 h-4" />
              </div>
            </div>
            <div className="text-sm font-black text-slate-900 font-mono pt-1">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Graphical Breakdown bar cards & Pie Chart side-by-side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Progress Bars Breakdown */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-2 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-black text-slate-900">دسته‌بندی فراوانی عیوب سخت‌افزاری</h4>
          </div>

          <div className="space-y-3.5">
            {chartData.map((item, idx) => {
              const pct = ((item.value / totalValue) * 100).toFixed(0);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-600">
                    <span>{item.name}</span>
                    <span className="font-mono text-slate-950 font-black">{item.value} عدد ({pct}٪)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recharts Pie Chart representation */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4 flex flex-col justify-between">
          <div className="border-b border-slate-100 pb-2 flex items-center gap-1.5 justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-blue-600 animate-pulse" />
              <h4 className="text-xs font-black text-slate-900">نمودار دایره‌ای توزیع عیوب سخت‌افزاری</h4>
            </div>
            <span className="text-[9px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold border border-blue-100">تحلیل سیستمی</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-2">
            {/* Recharts Pie component */}
            <div className="w-40 h-40 shrink-0 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-950 text-white px-2.5 py-1.5 rounded-xl text-[9px] font-black text-right shadow-md border border-slate-800">
                            <p>{data.name}</p>
                            <p className="text-blue-400 mt-0.5 font-mono">{data.value} پرونده ({((data.value / totalValue) * 100).toFixed(1)}٪)</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Inner absolute label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9px] text-slate-400 font-bold">کل عیوب</span>
                <span className="text-sm font-black text-slate-800 font-mono">{totalValue}</span>
              </div>
            </div>

            {/* Custom Pie Chart Legend */}
            <div className="flex-1 space-y-2 w-full">
              {chartData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-[10px] font-bold">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-600 text-[10px] font-semibold">{item.name}</span>
                  </div>
                  <span className="font-mono text-slate-900 font-black shrink-0">
                    {((item.value / totalValue) * 100).toFixed(0)}٪
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Financial Breakdown or Technician efficiency list */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
          <Users className="w-4 h-4 text-blue-600" />
          <h4 className="text-xs font-black text-slate-900">راندمان و عملکرد فنی تعمیرکاران</h4>
        </div>

        <div className="space-y-2.5">
          {[
            { name: 'مهندس سهراب مرادی (اصلی)', active: 14, completed: 42, successRate: '۹۷.۶٪', avatarBg: 'bg-blue-50 text-blue-600' },
            { name: 'مهندس حسینی (پشتیبان)', active: 5, completed: 18, successRate: '۹۱٪', avatarBg: 'bg-indigo-50 text-indigo-600' }
          ].map((tech, idx) => (
            <div key={idx} className="bg-slate-50/60 rounded-xl p-3 flex justify-between items-center text-xs">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-lg ${tech.avatarBg} flex items-center justify-center font-black text-xs shrink-0`}>
                  {tech.name[6]}
                </div>
                <div>
                  <h5 className="font-black text-slate-900">{tech.name}</h5>
                  <p className="text-[9px] text-slate-400 font-bold mt-0.5">در حال تعمیر: {tech.active} دستگاه</p>
                </div>
              </div>
              <div className="text-left">
                <span className="text-[9px] text-slate-400 block font-bold">نرخ موفقیت تعمیر:</span>
                <span className="text-emerald-700 font-black font-mono">{tech.successRate}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// P011: SYSTEM HOME DASHBOARD SCREEN PREVIEW
// ---------------------------------------------------------------------------------------------------
export function P011HomeDashboard({ 
  warrantyDb, 
  users,
  userRole,
  isOnline,
  setActiveTab,
  setDevActiveScreen,
  setQueueFilter,
  setDevFileSerial
}: DevDashboardProps) {
  const persianDate = "۱۶ تیر ۱۴۰۵";
  
  // Realistic demo user name matching the requested list
  let currentUserName = "هادی محمدزاده";
  let displayRoleName = "مدیر سیستم";
  
  if (userRole === 'reception') {
    currentUserName = "اکبر";
    displayRoleName = "پذیرش";
  } else if (userRole === 'technician') {
    currentUserName = "مهدی";
    displayRoleName = "تعمیرکار";
  } else if (userRole === 'delivery') {
    currentUserName = "علی";
    displayRoleName = "مسئول تحویل";
  }

  // Dedicated Workshop & Service desk cards:
  const dashboardCards = [
    { id: 'new_claim', label: 'پذیرش دستگاه', desc: 'ثبت رسید و ورود به کارگاه', icon: PlusCircle, color: 'from-blue-600 to-indigo-500', badge: null },
    { id: 'queue', label: 'صف تعمیرات', desc: 'بردهای در دست عیب‌یابی و تعمیر', icon: Hammer, color: 'from-amber-500 to-orange-500', badge: warrantyDb?.filter(i => i.status === 'under_repair').length || 0 },
    { id: 'start_repair', label: 'ثبت تعمیرات', desc: 'ثبت اقدامات فنی، دیاگ و قطعات', icon: Wrench, color: 'from-rose-500 to-orange-500', badge: null },
    { id: 'final_test', label: 'تست نهایی (QC)', desc: 'آزمون کنترل کیفیت و کارکرد', icon: ClipboardCheck, color: 'from-violet-600 to-purple-500', badge: null },
    { id: 'handover', label: 'تحویل دستگاه', desc: 'ترخیص کالا و تحویل به مشتری', icon: CheckCircle, color: 'from-teal-500 to-emerald-500', badge: warrantyDb?.filter(i => i.status === 'replaced').length || 0 },
    { id: 'settlement', label: 'تسویه‌حساب خدمات', desc: 'محاسبه اجرت و صدور قبض خدمات', icon: DollarSign, color: 'from-emerald-600 to-teal-500', badge: null },
    { id: 'dossier', label: 'پرونده دستگاه', desc: 'رهگیری کالا و تاریخچه فنی', icon: FileText, color: 'from-slate-600 to-slate-800', badge: null },
    { id: 'search', label: 'استعلام سریال', desc: 'جستجو و بررسی گارانتی دستگاه', icon: Search, color: 'from-cyan-600 to-blue-500', badge: null },
    { id: 'reports', label: 'گزارش‌های کارگاه', desc: 'آمار راندمان و عملکرد تعمیرات', icon: BarChart3, color: 'from-purple-500 to-pink-500', badge: null },
  ];

  return (
    <div className="space-y-4 sm:space-y-5 text-right" dir="rtl">
      {/* Dynamic Header Box */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col items-center justify-center text-center gap-3">
        <div className="w-12 h-12 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-100 shrink-0">
          <Cpu className="w-6 h-6 sm:w-6.5 sm:h-6.5" />
        </div>
        <div className="space-y-1 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
            <span className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-wider">سیستم گارانتی دیاکو الکترونیک</span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-slate-900">خوش آمدید، {currentUserName} عزیز!</h2>
          <p className="text-xs sm:text-sm text-slate-500 font-bold leading-relaxed">
            امروز {persianDate}. دسترسی سریع به عملکردهای کارگاه فعال است.
          </p>
        </div>
      </div>

      {/* Exactly 8 Large Buttons Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 sm:gap-4">
        {dashboardCards.map((card) => {
          const IconComponent = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => {
                setDevActiveScreen?.(null);
                setActiveTab?.(card.id);
              }}
              className="relative overflow-hidden bg-white hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:p-5 flex flex-col justify-between items-start text-right transition-all hover:border-blue-500/30 hover:shadow-xs active:scale-95 group min-h-[118px] sm:min-h-[130px] cursor-pointer"
            >
              {/* Top: Icon & Badge */}
              <div className="flex justify-between items-center w-full">
                <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-tr ${card.color} text-white flex items-center justify-center shadow-xs`}>
                  <IconComponent className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                </div>
                {card.badge !== null && card.badge > 0 && (
                  <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full min-w-4.5 h-4.5 flex items-center justify-center">
                    {card.badge}
                  </span>
                )}
              </div>

              {/* Bottom: Label & Description */}
              <div className="mt-4 space-y-0.5 w-full">
                <span className="text-xs sm:text-sm font-black text-slate-900 block group-hover:text-blue-600 transition-colors">
                  {card.label}
                </span>
                <span className="text-[10px] sm:text-xs font-bold text-slate-400 block truncate w-full">
                  {card.desc}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Touch-Friendly Status Bar */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-800 space-y-2.5">
        <div className="flex items-center gap-1.5 border-b border-slate-800/60 pb-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-[10px] sm:text-xs font-black uppercase text-slate-400">اطلاعات وضعیت پایانه فعال</span>
        </div>
        <div className="grid grid-cols-2 gap-y-2 text-[10px] sm:text-xs font-bold">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">کاربر:</span>
            <span className="text-white font-black">{currentUserName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">نقش:</span>
            <span className="text-blue-400 font-black">{displayRoleName}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">وضعیت اتصال:</span>
            {isOnline ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1 h-1 bg-emerald-400 rounded-full animate-pulse" />
                متصل به مرکز
              </span>
            ) : (
              <span className="text-rose-400 flex items-center gap-1">
                <span className="w-1 h-1 bg-rose-400 rounded-full" />
                آفلاین
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">تاریخ امروز:</span>
            <span className="text-white font-black">{persianDate}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------
// P012: DEVICE TIMELINE HISTORY FILE LEDGER PREVIEW
// ---------------------------------------------------------------------------------------------------
export function P012DeviceDossier({ warrantyDb, devFileSerial, setDevFileSerial }: DevDashboardProps) {
  const searchedItem = warrantyDb.find(item => item.serial.toUpperCase() === devFileSerial.toUpperCase()) || warrantyDb[0];

  // Simulated events for the selected device
  const events = [
    { title: 'فعال‌سازی گارانتی و فروش اولیه', date: searchedItem.registeredAt, text: `دستگاه توسط کارگزار ثبت گردید. فاکتور فروش INV-9102. مدت گارانتی فعال شده ${searchedItem.expiryDate ? 'معتبر تا ' + searchedItem.expiryDate : '۱۲ ماه'}.`, icon: ShieldCheck, color: 'bg-emerald-500 text-white' },
    { title: 'ثبت پذیرش و عیب اعلامی طرف حساب', date: searchedItem.registeredAt, text: `عیب قطعه: "${searchedItem.defectType || 'نوسان ولتاژ و بوی سوختگی الکترونیکی'}" ارجاع به کارشناس پذیرش جهت عکاسی و ورود به انبار کارگاه.`, icon: ClipboardList, color: 'bg-blue-500 text-white' },
    { title: 'ارجاع پرونده به تکنسین فنی کارگاه', date: searchedItem.registeredAt, text: `تکنسین ارشد مسئول: "${searchedItem.technicianName || 'مهندس سهراب مرادی'}". تست مسیرهای جریان روی اسیلوسکوپ و تایید دشارژ حرارتی خازن‌های فیلتر ثانویه.`, icon: Clock, color: 'bg-indigo-500 text-white' },
    { title: 'وضعیت ترخیص و اقدامات انجام شده', date: '۱۴۰۵/۰۴/۰۷', text: searchedItem.statusNotes || 'تعویض کلیه رگولاتورهای تغذیه ثانویه و تست کارایی ۳ ساعته برد.', icon: CheckCircle, color: searchedItem.status === 'rejected' ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white' }
  ];

  return (
    <div className="space-y-4 text-right animate-fade-in" dir="rtl">
      <div>
        <h3 className="text-base font-black text-slate-900 flex items-center gap-1.5">
          <ClipboardList className="w-5 h-5 text-blue-600" />
          <span>شناسنامه و تاریخچه پرونده قطعه (P012)</span>
        </h3>
        <p className="text-[10px] text-slate-500 font-bold">نمای خط زمان کل چرخه حیات کالا، تعمیرکار مربوطه و فرآیند گارانتی</p>
      </div>

      {/* Select sample serial shortcuts */}
      <div className="space-y-1.5 bg-slate-100 p-3 rounded-2xl border border-slate-200/60">
        <span className="text-[9px] font-black text-slate-400 block">انتخاب سریع از میان نمونه‌های کارگاه:</span>
        <div className="flex flex-wrap gap-1.5">
          {warrantyDb.slice(0, 4).map((item, idx) => (
            <button
              key={idx}
              onClick={() => setDevFileSerial(item.serial)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-black border transition-all cursor-pointer ${
                devFileSerial.toUpperCase() === item.serial.toUpperCase()
                  ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                  : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {item.serial}
            </button>
          ))}
        </div>
      </div>

      {/* Ledger device card spec sheet */}
      {searchedItem && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-xs font-black text-slate-900">{searchedItem.itemName}</h4>
                <p className="font-mono text-[9px] text-slate-400 mt-0.5">شناسه گارانتی: {searchedItem.serial}</p>
              </div>
              <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black ${
                searchedItem.status === 'replaced' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 
                searchedItem.status === 'under_repair' ? 'bg-amber-50 text-amber-700 border border-amber-200/50' :
                searchedItem.status === 'rejected' ? 'bg-rose-50 text-rose-700 border border-rose-200/50' : 'bg-slate-100 text-slate-600'
              }`}>
                {searchedItem.status === 'replaced' ? 'تعویض سلامت تحویل' :
                 searchedItem.status === 'under_repair' ? 'کارگاه تحت عیب‌یابی' :
                 searchedItem.status === 'rejected' ? 'ابطال پوشش گارانتی' : 'فعال در صف'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 font-bold leading-normal">
              <div>طرف حساب اول: <span className="text-slate-950 font-black">{searchedItem.customerName}</span></div>
              <div>موبایل: <span className="text-slate-950 font-black font-mono">{searchedItem.customerPhone}</span></div>
              <div>تاریخ فاکتور فروش: <span className="text-slate-950 font-black font-mono">{searchedItem.registeredAt}</span></div>
              <div>انقضای گارانتی: <span className="text-slate-950 font-black font-mono text-emerald-700 bg-emerald-50 px-1 rounded">{searchedItem.expiryDate}</span></div>
            </div>
          </div>

          {/* Interactive Timeline Lifecycle */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-xs space-y-4">
            <h4 className="text-xs font-black text-slate-900 border-b border-slate-100 pb-2">خط زمان و چرخه کارکرد قطعه</h4>

            <div className="relative pr-6 border-r-2 border-slate-200 space-y-5">
              {events.map((ev, idx) => (
                <div key={idx} className="relative">
                  {/* Circle indicator on timeline border */}
                  <span className={`absolute -right-[31px] top-1 w-4 h-4 rounded-full flex items-center justify-center shadow-sm ${ev.color} border-2 border-white`}>
                    <ev.icon className="w-2 h-2" />
                  </span>
                  
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 justify-between">
                      <span className="text-xs font-black text-slate-950">{ev.title}</span>
                      <span className="text-[9px] font-mono font-black text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">{ev.date}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-bold pt-1">{ev.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
