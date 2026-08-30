import React, { useState, useRef, useEffect } from 'react';
import { P018StandardInvoiceForm } from './components/P018StandardInvoiceForm';
import { P019ProjectBackupRoadmap } from './components/P019ProjectBackupRoadmap';
import { motion, AnimatePresence } from 'motion/react';
import { playScanBeepSound, scanImageData, scanImageFile } from './utils/qrScanner';
import { 
  ShieldCheck, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  Cpu, 
  Activity, 
  CheckCircle, 
  AlertCircle, 
  Search, 
  PlusCircle, 
  FileText, 
  Settings, 
  Camera, 
  Upload,
  RefreshCw, 
  QrCode, 
  UserCheck, 
  Check, 
  X, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Clock,
  Printer,
  ChevronLeft,
  ChevronDown,
  Info,
  Users,
  UserPlus,
  Edit2,
  Key,
  UserX,
  Building,
  Coins,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  Sliders,
  BarChart3,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Truck,
  ClipboardList,
  ClipboardCheck,
  Hammer,
  Wrench,
  Calendar,
  UserMinus,
  Menu,
  Receipt,
  ShoppingCart,
  Trash2,
  FileSpreadsheet,
  Calculator,
  Landmark,
  CreditCard,
  LogOut,
  Database,
  Layers
} from 'lucide-react';
import { WarrantyItem, WorkshopRole, ActiveTab, SystemModule, SystemUser, Supplier, PurchaseRecord, InventoryItem, BankAccount, BOMFormula } from './types';
import { INITIAL_WARRANTY_DB, DEFECT_PRESETS, INITIAL_BANK_ACCOUNTS, INITIAL_BOMS } from './initialData';
import { SystemSelectionHub } from './components/SystemSelectionHub';
import { AccountingDesk } from './components/AccountingDesk';
import ProductionUnit from './components/ProductionUnit';
import { 
  DevDashboardDrawer, 
  DevPreviewContainer,
  P003CustomerManagement,
  P004ProductManagement,
  P008DeviceHandover,
  P009ReportsAndAnalytics,
  P011HomeDashboard,
  P012DeviceDossier
} from './components/DevDashboard';
import P006DeviceReception from './components/P006DeviceReception';
import P007RepairsQueue from './components/P007RepairsQueue';
import P008RepairDossier from './components/P008RepairDossier';
import P013DossierSearch from './components/P013DossierSearch';
import P014WorkshopSettings from './components/P014WorkshopSettings';
import P010FinalTest from './components/P010FinalTest';
import P011DeviceHandover from './components/P011DeviceHandover';
import P012Settlement from './components/P012Settlement';
import P016SalesHistory from './components/P016SalesHistory';
import { P017PurchaseInvoice } from './components/P017PurchaseInvoice';
import { P017PurchaseHistory } from './components/P017PurchaseHistory';
import { P020BankAccounts } from './components/P020BankAccounts';
import HolooAccountingReports from './components/HolooAccountingReports';
import HolooTopNavbar from './components/HolooTopNavbar';
import HolooInvoiceForm from './components/HolooInvoiceForm';

export default function App() {
  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [username, setUsername] = useState<string>('admin');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [loginProgressStep, setLoginProgressStep] = useState<number>(0);
  const [authError, setAuthError] = useState<string>('');
  const [userRole, setUserRole] = useState<WorkshopRole>('admin');
  const [rememberMe, setRememberMe] = useState<boolean>(false);

  // System Setup State (P000)
  const [isSetupCompleted, setIsSetupCompleted] = useState<boolean>(false);
  const [showSetupWelcome, setShowSetupWelcome] = useState<boolean>(false);

  // Company Info states
  const [setupCompanyName, setSetupCompanyName] = useState<string>('دیاکو الکترونیک');
  const [setupCompanyEnName, setSetupCompanyEnName] = useState<string>('Diaco Electronics');
  const [setupServerName, setSetupServerName] = useState<string>('Diaco-Server');
  const [setupServerIp, setSetupServerIp] = useState<string>('192.168.1.100');

  // Admin account states
  const [setupAdminName, setSetupAdminName] = useState<string>('');
  const [setupAdminUsername, setSetupAdminUsername] = useState<string>('');
  const [setupAdminPassword, setSetupAdminPassword] = useState<string>('');
  const [setupAdminPasswordConfirm, setSetupAdminPasswordConfirm] = useState<string>('');

  // Base Settings states
  const [setupCurrency, setSetupCurrency] = useState<string>('تومان');
  const [setupWarrantyDuration, setSetupWarrantyDuration] = useState<string>('12 ماه');
  const [setupMaxStayDays, setSetupMaxStayDays] = useState<string>('15 روز');

  // Error/Success state
  const [setupError, setSetupError] = useState<string>('');

  // App settings & network simulation
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isDbLoaded, setIsDbLoaded] = useState<boolean>(false);

  // Active System Module & Active PWA Tab
  const [selectedModule, setSelectedModule] = useState<SystemModule>('hub');
  const [activeTab, setActiveTab] = useState<ActiveTab>('hub');

  // Main State Database
  const [warrantyDb, setWarrantyDb] = useState<WarrantyItem[]>([]);

  // Sales/Invoices Database
  const [sales, setSales] = useState<any[]>([]);

  // Purchases & Inventory Stock Database
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);

  // Search Screen State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResult, setSearchResult] = useState<WarrantyItem | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanPulse, setScanPulse] = useState<number>(0);

  // New Claim Form State
  const [newSerial, setNewSerial] = useState<string>('');
  const [newItemName, setNewItemName] = useState<string>('');
  const [newCustomerName, setNewCustomerName] = useState<string>('');
  const [newCustomerPhone, setNewCustomerPhone] = useState<string>('');
  const [newDefectType, setNewDefectType] = useState<string>(DEFECT_PRESETS[0]);
  const [newNotes, setNewNotes] = useState<string>('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Camera integration
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Queue Status Editing
  const [editingItem, setEditingItem] = useState<WarrantyItem | null>(null);
  const [editStatus, setEditStatus] = useState<WarrantyItem['status']>('pending');
  const [editNotes, setEditNotes] = useState<string>('');

  // Queue Filter
  const [queueFilter, setQueueFilter] = useState<'all' | WarrantyItem['status']>('all');

  // User Management State (P002)
  const [users, setUsers] = useState<SystemUser[]>([
    { id: '1', fullName: 'هادی محمدزاده', username: 'admin', role: 'admin', isActive: true, lastLoginDate: '۱۴۰۵/۰۴/۰۷ - ۱۴:۳۲' },
    { id: '2', fullName: 'اکبر', username: 'akbar', role: 'reception', isActive: true, lastLoginDate: '۱۴۰۵/۰۴/۰۷ - ۱۵:۱۰' },
    { id: '3', fullName: 'مهدی', username: 'mehdi', role: 'technician', isActive: true, lastLoginDate: '۱۴۰۵/۰۴/۰۶ - ۰۹:۱۵' },
    { id: '4', fullName: 'علی', username: 'ali', role: 'delivery', isActive: true, lastLoginDate: '۱۴۰۵/۰۴/۰۷ - ۱۱:۰۰' }
  ]);
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [isUserModalOpen, setIsUserModalOpen] = useState<boolean>(false);
  const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
  const [userFormFullName, setUserFormFullName] = useState<string>('');
  const [userFormUsername, setUserFormUsername] = useState<string>('');
  const [userFormRole, setUserFormRole] = useState<SystemUser['role']>('reception');
  const [userFormCustomRole, setUserFormCustomRole] = useState<string>('');
  const [userFormIsActive, setUserFormIsActive] = useState<boolean>(true);
  const [userFormPassword, setUserFormPassword] = useState<string>('');
  const [userFormConfirmPassword, setUserFormConfirmPassword] = useState<string>('');
  const [userFormError, setUserFormError] = useState<string>('');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState<boolean>(false);
  const [passwordResetUser, setPasswordResetUser] = useState<SystemUser | null>(null);
  const [newResetPassword, setNewResetPassword] = useState<string>('');

  const getPageTitle = (tab: ActiveTab): string => {
    switch (tab) {
      case 'hub': return 'انتخاب سامانه کاری';
      case 'accounting_dashboard': return 'داشبورد سامانه حسابداری';
      case 'dashboard': return 'میز کار اصلی کارگاه';
      case 'search': return 'پیگیری و استعلام قطعه';
      case 'new_claim': return 'پذیرش قطعه جدید';
      case 'queue': return 'صف تعمیرات و کارگاه';
      case 'users': return 'مدیریت کاربران';
      case 'config': return 'تنظیمات کارگاه';
      case 'register_sale': return 'صدور فاکتور';
      case 'customers': return 'مدیریت طرف‌حساب‌ها';
      case 'products': return 'تعریف و مدیریت کالاها';
      case 'production': return 'واحد تولید و فرمول ساخت (BOM)';
      case 'bank_accounts': return 'مدیریت حساب‌های بانکی و پوز';
      case 'handover': return 'تحویل و عودت قطعه';
      case 'reports': return 'گزارش‌ها و آمار';
      case 'dossier': return 'پرونده فنی قطعه';
      case 'start_repair': return 'فرایند تعمیرات';
      case 'final_test': return 'تست نهایی کیفیت';
      case 'device_delivery': return 'تحویل به طرف حساب';
      case 'settlement': return 'تسویه‌حساب و فاکتور';
      case 'sales_history': return 'سوابق فاکتورهای فروش';
      case 'purchase_invoice': return 'فاکتور خرید کالا';
      case 'purchase_history': return 'سوابق فاکتورهای خرید و انبار';
      case 'accounting_reports': return 'مرکز گزارشات حسابداری هلو';
      case 'project_backup': return 'نقشه راه و بک‌آ‌پ کامل سیستم';
      default: return 'دیاکو الکترونیک';
    }
  };

  // Global Toast Notification State
  const [toastState, setToastState] = useState<{ msg: string; type?: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastState({ msg, type });
    setTimeout(() => {
      setToastState(null);
    }, 3500);
  };

  // Development Mode & Navigation States
  const [devActiveScreen, setDevActiveScreen] = useState<string | null>(null);
  const [isDevModeOpen, setIsDevModeOpen] = useState<boolean>(false);

  // Navigation History Stack for PWA Back Button Support
  const [navHistory, setNavHistory] = useState<Array<{ tab: ActiveTab; devScreen: string | null }>>([]);

  // Track and record navigation history automatically
  useEffect(() => {
    if (!isAuthenticated) {
      setNavHistory([]);
      return;
    }

    setNavHistory(prev => {
      if (prev.length === 0) {
        return [{ tab: activeTab, devScreen: devActiveScreen }];
      }
      const current = prev[prev.length - 1];
      if (current.tab === activeTab && current.devScreen === devActiveScreen) {
        return prev;
      }
      // If returning to the second-to-last page, pop the top
      if (prev.length > 1) {
        const penUltimate = prev[prev.length - 2];
        if (penUltimate.tab === activeTab && penUltimate.devScreen === devActiveScreen) {
          return prev.slice(0, -1);
        }
      }
      return [...prev, { tab: activeTab, devScreen: devActiveScreen }].slice(-20);
    });
  }, [activeTab, devActiveScreen, isAuthenticated]);

  const handleBack = () => {
    if (navHistory.length > 1) {
      const target = navHistory[navHistory.length - 2];
      setActiveTab(target.tab);
      setDevActiveScreen(target.devScreen);
    } else {
      setActiveTab('hub');
      setSelectedModule('hub');
      setDevActiveScreen(null);
    }
  };

  // P003: Dynamic Customer Management States
  const [custSearchQuery, setCustSearchQuery] = useState<string>('');
  const [isCustModalOpen, setIsCustModalOpen] = useState<boolean>(false);
  const [editingCustomer, setEditingCustomer] = useState<{ name: string; phone: string; type: string; email?: string; address?: string } | null>(null);
  const [custFormName, setCustFormName] = useState<string>('');
  const [custFormPhone, setCustFormPhone] = useState<string>('');
  const [custFormType, setCustFormType] = useState<string>('person');
  const [custFormEmail, setCustFormEmail] = useState<string>('');
  const [custFormAddress, setCustFormAddress] = useState<string>('');

  // P004: Dynamic Product Management States
  const [prodSearchQuery, setProdSearchQuery] = useState<string>('');
  const [isProdModalOpen, setIsProdModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<{ name: string; model: string; warrantyDuration: string; suggestedPrice: string } | null>(null);
  const [prodFormName, setProdFormName] = useState<string>('');
  const [prodFormModel, setProdFormModel] = useState<string>('');
  const [prodFormDuration, setProdFormDuration] = useState<string>('');
  const [prodFormSuggestedPrice, setProdFormSuggestedPrice] = useState<string>('');

  // P012: Device Timeline State
  const [devFileSerial, setDevFileSerial] = useState<string>('W-9082');

  // P005: Serial Sales Registration States
  const [customers, setCustomers] = useState<any[]>([]);

  const [products, setProducts] = useState<any[]>([]);

  const [boms, setBoms] = useState<BOMFormula[]>(INITIAL_BOMS);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(INITIAL_BANK_ACCOUNTS);

  // Load state from central Express server on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('diaco_theme_mode');
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }

    const savedFontSize = localStorage.getItem('diaco_font_size');
    if (savedFontSize === 'large') {
      document.documentElement.classList.add('font-large');
      document.body.classList.add('font-large');
    } else {
      document.documentElement.classList.remove('font-large');
      document.body.classList.remove('font-large');
    }

    const loadCentralState = async (tokenOverride?: string) => {
      try {
        const token = tokenOverride || sessionStorage.getItem('diaco_session_token') || localStorage.getItem('diaco_session_token');
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};

        const health = await fetch('/api/health');
        const healthData = await health.json();
        if (healthData.setupRequired) {
          setIsSetupCompleted(false);
          setIsAuthenticated(false);
          return;
        }
        setIsSetupCompleted(true);
        const session = await fetch('/api/auth/session', { headers, credentials: 'include' });
        if (!session.ok) {
          setIsAuthenticated(false);
          return;
        }
        const sessionData = await session.json();
        setUserRole(sessionData.user.role);
        setIsAuthenticated(true);
        const res = await fetch('/api/state', { headers, credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            setIsSetupCompleted(!!data.isSetupCompleted);
            if (data.setupCompanyName) setSetupCompanyName(data.setupCompanyName);
            if (data.setupCompanyEnName) setSetupCompanyEnName(data.setupCompanyEnName);
            if (data.setupServerName) setSetupServerName(data.setupServerName);
            if (data.setupServerIp) setSetupServerIp(data.setupServerIp);
            if (data.setupCurrency) setSetupCurrency(data.setupCurrency);
            if (data.setupWarrantyDuration) setSetupWarrantyDuration(data.setupWarrantyDuration);
            if (data.setupMaxStayDays) setSetupMaxStayDays(data.setupMaxStayDays);
            if (data.users) setUsers(data.users);
            if (data.warrantyDb) setWarrantyDb(data.warrantyDb);
            if (data.sales) setSales(data.sales);
            if (data.customers) setCustomers(data.customers);
            if (data.products) setProducts(data.products);
            if (data.boms) setBoms(data.boms);
            if (data.bankAccounts) setBankAccounts(data.bankAccounts);
            if (data.suppliers) setSuppliers(data.suppliers);
            if (data.purchases) setPurchases(data.purchases);
            if (data.inventory) setInventory(data.inventory);
          }
        }
      } catch (err) {
        console.error("Error loading central server state", err);
      } finally {
        setIsDbLoaded(true);
      }
    };
    loadCentralState();
  }, []);

  // Prevent background scrolling when hamburger menu (drawer) is open
  useEffect(() => {
    if (isDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDrawerOpen]);

  // Close an authenticated session after ten minutes without user activity.
  useEffect(() => {
    if (!isAuthenticated) return;
    let timer: ReturnType<typeof setTimeout>;
    const expire = async () => {
      const token = sessionStorage.getItem('diaco_session_token') || localStorage.getItem('diaco_session_token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      await fetch('/api/auth/logout', { method: 'POST', headers, credentials: 'include' }).catch(() => undefined);
      sessionStorage.removeItem('diaco_session_token');
      localStorage.removeItem('diaco_session_token');
      setIsAuthenticated(false);
      setAuthError('نشست شما به دلیل ۱۰ دقیقه بی‌کاری پایان یافت.');
    };
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(expire, 10 * 60 * 1000);
    };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(event => window.removeEventListener(event, reset));
    };
  }, [isAuthenticated]);

  // Central Server Synchronization
  useEffect(() => {
    if (!isDbLoaded || !isAuthenticated) return;
    
    const syncWithServer = async () => {
      try {
        setIsSyncing(true);
        const token = sessionStorage.getItem('diaco_session_token') || localStorage.getItem('diaco_session_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        await fetch('/api/state', {
          method: 'POST',
          headers,
          credentials: 'include',
          body: JSON.stringify({
            isSetupCompleted,
            setupCompanyName,
            setupCompanyEnName,
            setupServerName,
            setupServerIp,
            setupCurrency,
            setupWarrantyDuration,
            setupMaxStayDays,
            warrantyDb,
            sales,
            customers,
            products,
            bankAccounts,
            suppliers,
            purchases,
            inventory
          })
        });
      } catch (err) {
        console.error("Error syncing with central server", err);
      } finally {
        setIsSyncing(false);
      }
    };

    // Debounce to prevent flooding the server during active typing
    const handler = setTimeout(() => {
      syncWithServer();
    }, 400);

    return () => clearTimeout(handler);
  }, [
    isDbLoaded,
    isAuthenticated,
    isSetupCompleted,
    setupCompanyName,
    setupCompanyEnName,
    setupServerName,
    setupServerIp,
    setupCurrency,
    setupWarrantyDuration,
    setupMaxStayDays,
    warrantyDb,
    sales,
    customers,
    products,
    suppliers,
    purchases,
    inventory
  ]);

  const [saleSearchMobile, setSaleSearchMobile] = useState<string>('');
  const [saleDropdownOpen, setSaleDropdownOpen] = useState<boolean>(false);
  const [saleSelectedCustomer, setSaleSelectedCustomer] = useState<{ name: string; phone: string; type: string } | null>(null);
  const [saleSelectedProduct, setSaleSelectedProduct] = useState<{ name: string; model: string; warrantyDuration: string; suggestedPrice: string } | null>(null);
  const [saleSerials, setSaleSerials] = useState<string[]>([]);
  const [saleCurrentSerial, setSaleCurrentSerial] = useState<string>('');
  const [saleRegisterMode, setSaleRegisterMode] = useState<'single' | 'bulk'>('single');
  const [saleBulkPrefix, setSaleBulkPrefix] = useState<string>('DU');
  const [saleBulkCustomPrefix, setSaleBulkCustomPrefix] = useState<string>('');
  const [saleBulkStart, setSaleBulkStart] = useState<string>('');
  const [saleBulkEnd, setSaleBulkEnd] = useState<string>('');
  const [saleDate, setSaleDate] = useState<string>('۱۴۰۵/۰۴/۰۷');
  const [salePrice, setSalePrice] = useState<string>('');
  const [saleInvoiceNumber, setSaleInvoiceNumber] = useState<string>('');
  const [saleNotes, setSaleNotes] = useState<string>('');
  const [saleDuplicateError, setSaleDuplicateError] = useState<string>('');
  const [showThermalPreview, setShowThermalPreview] = useState<boolean>(false);
  
  // P005 Advanced Search and Template States
  const [templateDevice, setTemplateDevice] = useState<WarrantyItem | null>(null);
  const [saleHistorySearch, setSaleHistorySearch] = useState<string>('');
  
  // Barcode Scanner states
  const [saleShowScanner, setSaleShowScanner] = useState<boolean>(false);
  const [scannerFlash, setScannerFlash] = useState<boolean>(false);
  const [scannerSuccessMessage, setScannerSuccessMessage] = useState<string>('');
  const [scannerMockValue, setScannerMockValue] = useState<string>('');
  const saleVideoRef = useRef<HTMLVideoElement>(null);
  const [saleCameraStream, setSaleCameraStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    let scanInterval: any = null;
    let activeStream: MediaStream | null = null;
    if (saleShowScanner) {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          .then(stream => {
            activeStream = stream;
            setSaleCameraStream(stream);
            if (saleVideoRef.current) {
              saleVideoRef.current.srcObject = stream;
            }
          })
          .catch(err => {
            console.warn("Sale scanner camera access:", err);
          });
      }

      const scanCanvas = document.createElement('canvas');
      scanInterval = setInterval(async () => {
        if (saleVideoRef.current && saleVideoRef.current.readyState === saleVideoRef.current.HAVE_ENOUGH_DATA) {
          scanCanvas.width = saleVideoRef.current.videoWidth || 300;
          scanCanvas.height = saleVideoRef.current.videoHeight || 300;
          const ctx = scanCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(saleVideoRef.current, 0, 0, scanCanvas.width, scanCanvas.height);
            const scannedCode = await scanImageData(scanCanvas);
            if (scannedCode) {
              handleScanSerial(scannedCode);
            }
          }
        }
      }, 400);
    } else {
      if (saleCameraStream) {
        saleCameraStream.getTracks().forEach(t => t.stop());
        setSaleCameraStream(null);
      }
    }
    return () => {
      if (scanInterval) clearInterval(scanInterval);
      if (activeStream) {
        activeStream.getTracks().forEach(t => t.stop());
      }
    };
  }, [saleShowScanner]);

  const [saleShowAddCustomer, setSaleShowAddCustomer] = useState<boolean>(false);
  const [saleNewCustName, setSaleNewCustName] = useState<string>('');
  const [saleNewCustPhone, setSaleNewCustPhone] = useState<string>('');
  const [saleNewCustType, setSaleNewCustType] = useState<'person' | 'representative'>('person');
  const [saleNewCustAddress, setSaleNewCustAddress] = useState<string>('');
  
  // Real active sale items list
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [saleDiscount, setSaleDiscount] = useState<string>('');
  const [showSalePreview, setShowSalePreview] = useState<boolean>(false);
  const [salesFormMode, setSalesFormMode] = useState<'standard' | 'quick'>('standard');

  // User Management Action Handlers (P002)
  const handleOpenAddUser = () => {
    setEditingUser(null);
    setUserFormFullName('');
    setUserFormUsername('');
    setUserFormRole('reception');
    setUserFormCustomRole('');
    setUserFormIsActive(true);
    setUserFormPassword('');
    setUserFormConfirmPassword('');
    setUserFormError('');
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (user: SystemUser) => {
    setEditingUser(user);
    setUserFormFullName(user.fullName);
    setUserFormUsername(user.username);
    const defaultRoles = ['admin', 'reception', 'technician', 'delivery'];
    if (defaultRoles.includes(user.role)) {
      setUserFormRole(user.role);
      setUserFormCustomRole('');
    } else {
      setUserFormRole('__custom__');
      setUserFormCustomRole(user.role);
    }
    setUserFormIsActive(user.isActive);
    setUserFormPassword('');
    setUserFormConfirmPassword('');
    setUserFormError('');
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserFormError('');

    if (!userFormFullName.trim() || !userFormUsername.trim()) {
      setUserFormError('لطفاً تمامی فیلدهای ستاره‌دار را پر کنید.');
      return;
    }

    // Determine final role
    let finalRole = userFormRole;
    if (userFormRole === '__custom__') {
      if (!userFormCustomRole.trim()) {
        setUserFormError('لطفاً عنوان مسئولیت یا نقش جدید را وارد کنید.');
        return;
      }
      finalRole = userFormCustomRole.trim();
    }

    // Check duplicate username (unique username enforcement)
    const usernameTrimmed = userFormUsername.trim().toLowerCase();
    const otherUserExists = users.some(u => 
      u.id !== (editingUser?.id || '') && 
      u.username.toLowerCase() === usernameTrimmed
    );
    if (otherUserExists) {
      setUserFormError('این نام کاربری تکراری است و قبلاً در سیستم تعریف شده است.');
      return;
    }

    if (!editingUser) {
      if (!userFormPassword) {
        setUserFormError('لطفاً رمز عبور را وارد کنید.');
        return;
      }
      if (userFormPassword !== userFormConfirmPassword) {
        setUserFormError('رمز عبور و تکرار آن یکسان نیستند.');
        return;
      }
    } else {
      // If editing and password is filled
      if (userFormPassword || userFormConfirmPassword) {
        if (userFormPassword !== userFormConfirmPassword) {
          setUserFormError('رمز عبور و تکرار آن یکسان نیستند.');
          return;
        }
      }

      // Check if trying to deactivate the last active admin
      if (editingUser.role === 'admin' && !userFormIsActive) {
        const activeAdminsCount = users.filter(u => u.role === 'admin' && u.isActive).length;
        if (editingUser.isActive && activeAdminsCount <= 1) {
          setUserFormError('امکان غیرفعال‌سازی وجود ندارد. حداقل یک مدیر فعال باید در سیستم باقی بماند.');
          return;
        }
      }

      // Check if trying to change the role of the last active admin
      if (editingUser.role === 'admin' && finalRole !== 'admin' && editingUser.isActive) {
        const activeAdminsCount = users.filter(u => u.role === 'admin' && u.isActive).length;
        if (activeAdminsCount <= 1) {
          setUserFormError('امکان تغییر نقش وجود ندارد. حداقل یک مدیر فعال باید در سیستم باقی بماند.');
          return;
        }
      }
    }

    try {
      const token = sessionStorage.getItem('diaco_session_token') || localStorage.getItem('diaco_session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const endpoint = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const response = await fetch(endpoint, {
        method: editingUser ? 'PATCH' : 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ fullName: userFormFullName.trim(), username: userFormUsername.trim(), password: userFormPassword, role: finalRole, isActive: userFormIsActive })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'ثبت کاربر انجام نشد.');
      setUsers(prev => editingUser ? prev.map(u => u.id === result.user.id ? result.user : u) : [...prev, result.user]);
      setIsUserModalOpen(false);
    } catch (error) {
      setUserFormError(error instanceof Error ? error.message : 'خطا در ثبت کاربر');
    }
  };

  const userHasPerformedActions = (user: SystemUser) => {
    // 1. Core initial users are considered to have historical activity in the system
    if (['admin', 'akbar', 'mehdi', 'ali'].includes(user.username.toLowerCase())) {
      return true;
    }
    
    // 2. Check if user is assigned to any repairs in warrantyDb (either by fullName or username)
    const hasWarrantyWork = warrantyDb.some(item => {
      const tech = item.technicianName?.toLowerCase() || '';
      const notes = item.statusNotes?.toLowerCase() || '';
      const name = user.fullName.toLowerCase();
      const uName = user.username.toLowerCase();
      return (
        tech.includes(name) || 
        tech.includes(uName) || 
        notes.includes(name) || 
        notes.includes(uName)
      );
    });
    if (hasWarrantyWork) return true;

    // 3. Check if user is associated with sales (e.g., if their name or username is mentioned in sales notes or customer/items notes)
    const hasSalesWork = sales.some(sale => {
      const notes = sale.notes?.toLowerCase() || '';
      const name = user.fullName.toLowerCase();
      const uName = user.username.toLowerCase();
      return notes.includes(name) || notes.includes(uName);
    });
    if (hasSalesWork) return true;

    return false;
  };

  const handleDeleteUser = (userId: string) => {
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) return;

    if (userHasPerformedActions(userToDelete)) {
      alert(`امکان حذف کاربر "${userToDelete.fullName}" وجود ندارد، زیرا این کاربر فعالیت‌های ثبت شده (مانند عیب‌یابی، ثبت پذیرش، تاریخچه ورود یا فروش) در سیستم دارد.`);
      return;
    }

    // Check if it's the last active admin
    if (userToDelete.role === 'admin' && userToDelete.isActive) {
      const activeAdminsCount = users.filter(u => u.role === 'admin' && u.isActive).length;
      if (activeAdminsCount <= 1) {
        alert('امکان حذف این کاربر وجود ندارد. حداقل یک مدیر فعال باید در سیستم باقی بماند.');
        return;
      }
    }

    alert('حذف حساب کاربری برای حفظ سوابق ممنوع است. در صورت نیاز حساب را غیرفعال کنید.');
  };

  const handleToggleUserStatus = async (userId: string) => {
    const userToToggle = users.find(u => u.id === userId);
    if (userToToggle && userToToggle.role === 'admin' && userToToggle.isActive) {
      // Trying to deactivate an admin
      const activeAdminsCount = users.filter(u => u.role === 'admin' && u.isActive).length;
      if (activeAdminsCount <= 1) {
        alert('امکان غیرفعال‌سازی وجود ندارد. حداقل یک مدیر فعال باید در سیستم باقی بماند.');
        return;
      }
    }
    if (!userToToggle) return;
    const token = sessionStorage.getItem('diaco_session_token') || localStorage.getItem('diaco_session_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`/api/users/${userId}`, { method: 'PATCH', headers, credentials: 'include', body: JSON.stringify({ isActive: !userToToggle.isActive }) });
    const result = await response.json();
    if (!response.ok) return showToast(result.error || 'تغییر وضعیت کاربر انجام نشد.', 'error');
    setUsers(prev => prev.map(u => u.id === userId ? result.user : u));
  };

  const handleOpenPasswordReset = (user: SystemUser) => {
    setPasswordResetUser(user);
    setNewResetPassword('');
    setIsPasswordModalOpen(true);
  };

  const handleSavePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResetPassword.trim() || !passwordResetUser) return;
    try {
      const token = sessionStorage.getItem('diaco_session_token') || localStorage.getItem('diaco_session_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const response = await fetch(`/api/users/${passwordResetUser.id}/password`, { method: 'PATCH', headers, credentials: 'include', body: JSON.stringify({ password: newResetPassword }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'تغییر رمز انجام نشد.');
      showToast(`رمز عبور کاربر «${passwordResetUser.fullName}» تغییر کرد.`, 'success');
      setIsPasswordModalOpen(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'خطا در تغییر رمز', 'error');
    }
  };

  // P003: Customer Management Helpers
  const handleOpenAddCustomer = () => {
    setEditingCustomer(null);
    setCustFormName('');
    setCustFormPhone('');
    setCustFormType('person');
    setCustFormEmail('');
    setCustFormAddress('');
    setIsCustModalOpen(true);
  };

  const handleOpenEditCustomer = (cust: typeof customers[0]) => {
    setEditingCustomer(cust);
    setCustFormName(cust.name);
    setCustFormPhone(cust.phone);
    setCustFormType(cust.type);
    setCustFormEmail(cust.email || '');
    setCustFormAddress(cust.address || '');
    setIsCustModalOpen(true);
  };

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const name = custFormName.trim();
    const phone = custFormPhone.trim();
    if (!name || !phone) {
      alert('نام و تلفن طرف حساب الزامی است.');
      return;
    }

    // Check duplicate phone (phone is unique)
    const existingByPhone = customers.find(c => 
      c.phone === phone && (!editingCustomer || c.phone !== editingCustomer.phone)
    );
    if (existingByPhone) {
      alert(`طرف حساب دیگری با شماره تلفن (${phone}) با نام «${existingByPhone.name}» قبلاً در سیستم ثبت شده است!`);
      return;
    }

    const newCust = {
      name,
      phone,
      type: custFormType,
      email: custFormEmail.trim(),
      address: custFormAddress.trim()
    };

    if (editingCustomer) {
      setCustomers(prev => prev.map(c => c.phone === editingCustomer.phone ? newCust : c));
    } else {
      setCustomers(prev => [...prev, newCust]);
    }
    setIsCustModalOpen(false);
  };

  const handleDeleteCustomer = (phone: string) => {
    const cust = customers.find(c => c.phone === phone);
    if (!cust) return;

    const custSales = sales ? sales.filter((s: any) => s.customer?.phone === phone || s.customer?.name === cust.name) : [];
    const custDevices = warrantyDb ? warrantyDb.filter((d: any) => d.customerPhone === phone || d.customerName === cust.name) : [];

    if (custSales.length > 0 || custDevices.length > 0) {
      const confirmDeactivate = confirm(
        `طرف حساب «${cust.name}» دارای سابقه فاکتور فروش (${custSales.length} مورد) یا پرونده پذیرش دستگاه (${custDevices.length} مورد) در سیستم می‌باشد.\n\nبه جهت حفظ صحت سوابق مالی و حسابداری، امکان حذف کامل وجود ندارد.\n\nآیا مایلید وضعیت این طرف حساب را «غیرفعال» کنید تا در ثبت فاکتورهای جدید ظاهر نشود؟`
      );
      if (confirmDeactivate) {
        setCustomers(prev => prev.map(c => c.phone === phone ? { ...c, isActive: false } : c));
      }
      return;
    }

    if (confirm(`آیا از حذف کامل طرف حساب «${cust.name}» اطمینان دارید؟ این عمل غیرقابل بازگشت است.`)) {
      setCustomers(prev => prev.filter(c => c.phone !== phone));
    }
  };

  // P004: Product Management Helpers
  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProdFormName('');
    setProdFormModel('');
    setProdFormDuration('');
    setProdFormSuggestedPrice('');
    setIsProdModalOpen(true);
  };

  const handleOpenEditProduct = (prod: typeof products[0]) => {
    setEditingProduct(prod);
    setProdFormName(prod.name);
    setProdFormModel(prod.model);
    setProdFormDuration(prod.warrantyDuration);
    setProdFormSuggestedPrice(prod.suggestedPrice);
    setIsProdModalOpen(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodFormName.trim() || !prodFormModel.trim() || !prodFormDuration.trim()) {
      alert('نام کالا، مدل و مدت گارانتی الزامی است.');
      return;
    }

    const newProd = {
      name: prodFormName.trim(),
      model: prodFormModel.trim(),
      warrantyDuration: prodFormDuration.trim(),
      suggestedPrice: prodFormSuggestedPrice.trim() || 'ثبت نشده'
    };

    if (editingProduct) {
      setProducts(prev => prev.map(p => p.model === editingProduct.model ? newProd : p));
    } else {
      setProducts(prev => [...prev, newProd]);
    }
    setIsProdModalOpen(false);
  };

  const handleDeleteProduct = (model: string) => {
    if (confirm('آیا از حذف این کالا اطمینان دارید؟')) {
      setProducts(prev => prev.filter(p => p.model !== model));
    }
  };

  const handleSystemSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');

    if (!setupAdminUsername.trim() || !setupAdminPassword || !setupAdminPasswordConfirm) {
      setSetupError('تمامی فیلدهای الزامی برای مدیر اصلی باید تکمیل شوند.');
      return;
    }

    if (setupAdminPassword !== setupAdminPasswordConfirm) {
      setSetupError('رمز عبور و تکرار آن با یکدیگر مطابقت ندارند.');
      return;
    }

    try {
      const response = await fetch('/api/setup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: setupAdminName.trim() || 'مدیر کل سیستم', username: setupAdminUsername.trim(), password: setupAdminPassword, companyName: setupCompanyName, companyEnName: setupCompanyEnName, serverName: setupServerName, serverIp: setupServerIp, currency: setupCurrency, warrantyDuration: setupWarrantyDuration, maxStayDays: setupMaxStayDays })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'راه‌اندازی انجام نشد.');
      setIsSetupCompleted(true);
      setUsername(setupAdminUsername.trim());
      setShowSetupWelcome(true);
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'خطا در راه‌اندازی سیستم');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (!username.trim()) {
      setAuthError('نام کاربری الزامی است.');
      return;
    }
    if (!password.trim()) {
      setAuthError('رمز ورود الزامی است.');
      return;
    }

    setAuthLoading(true);
    setLoginProgressStep(0);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim(), password })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'ورود انجام نشد.');

      if (result.token) {
        sessionStorage.setItem('diaco_session_token', result.token);
        localStorage.setItem('diaco_session_token', result.token);
      }
      setLoginProgressStep(3);
      if (result.user?.role) {
        setUserRole(result.user.role);
      }
      setSelectedModule('hub');
      setActiveTab('hub');
      setIsAuthenticated(true);
      setAuthLoading(false);

      // Fetch state immediately with token header
      const token = result.token || sessionStorage.getItem('diaco_session_token') || localStorage.getItem('diaco_session_token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch('/api/state', { headers, credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setIsSetupCompleted(!!data.isSetupCompleted);
          if (data.setupCompanyName) setSetupCompanyName(data.setupCompanyName);
          if (data.setupCompanyEnName) setSetupCompanyEnName(data.setupCompanyEnName);
          if (data.setupServerName) setSetupServerName(data.setupServerName);
          if (data.setupServerIp) setSetupServerIp(data.setupServerIp);
          if (data.setupCurrency) setSetupCurrency(data.setupCurrency);
          if (data.setupWarrantyDuration) setSetupWarrantyDuration(data.setupWarrantyDuration);
          if (data.setupMaxStayDays) setSetupMaxStayDays(data.setupMaxStayDays);
          if (data.users) setUsers(data.users);
          if (data.warrantyDb) setWarrantyDb(data.warrantyDb);
          if (data.sales) setSales(data.sales);
          if (data.customers) setCustomers(data.customers);
          if (data.products) setProducts(data.products);
          if (data.boms) setBoms(data.boms);
          if (data.bankAccounts) setBankAccounts(data.bankAccounts);
          if (data.suppliers) setSuppliers(data.suppliers);
          if (data.purchases) setPurchases(data.purchases);
          if (data.inventory) setInventory(data.inventory);
        }
      }
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'خطا در ورود');
      setAuthLoading(false);
      setLoginProgressStep(0);
    }
  };

  const handleLogout = async () => {
    const token = sessionStorage.getItem('diaco_session_token') || localStorage.getItem('diaco_session_token');
    const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
    await fetch('/api/auth/logout', { method: 'POST', headers, credentials: 'include' }).catch(() => undefined);
    sessionStorage.removeItem('diaco_session_token');
    localStorage.removeItem('diaco_session_token');
    setIsAuthenticated(false);
    setSelectedModule('hub');
    setActiveTab('hub');
    setSearchQuery('');
    setSearchResult(null);
    setHasSearched(false);
    setLoginProgressStep(0);
  };

  // Perform Serial Number Search
  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    const query = searchQuery.trim().toUpperCase();
    const found = warrantyDb.find(item => item.serial.toUpperCase() === query);
    setSearchResult(found || null);
    setHasSearched(true);
  };

  const handleQuickSelect = (serial: string) => {
    setSearchQuery(serial);
    const found = warrantyDb.find(item => item.serial.toUpperCase() === serial.toUpperCase());
    setSearchResult(found || null);
    setHasSearched(true);
    setActiveTab('search');
  };

  // Barcode Scanning Simulation
  const triggerBarcodeScan = () => {
    setIsScanning(true);
    setSearchQuery('');
    setSearchResult(null);
    setHasSearched(false);

    let count = 0;
    const pulseInterval = setInterval(() => {
      setScanPulse(prev => prev + 1);
      count++;
      if (count > 10) clearInterval(pulseInterval);
    }, 200);

    setTimeout(() => {
      clearInterval(pulseInterval);
      setIsScanning(false);
      const randomItem = warrantyDb[Math.floor(Math.random() * warrantyDb.length)];
      setSearchQuery(randomItem.serial);
      setSearchResult(randomItem);
      setHasSearched(true);
    }, 2200);
  };

  // Camera Capture Simulation
  const startCamera = async () => {
    setIsCapturing(true);
    setCapturedPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn("Camera hardware access failed, falling back to simulated capture.", err);
      // Fallback: Simulation
      setTimeout(() => {
        const mockPhotos = [
          'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&auto=format&fit=crop&q=60',
          'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&auto=format&fit=crop&q=60',
          'https://images.unsplash.com/photo-1601524909162-be87252be298?w=400&auto=format&fit=crop&q=60'
        ];
        const randomPic = mockPhotos[Math.floor(Math.random() * mockPhotos.length)];
        setCapturedPhoto(randomPic);
        setIsCapturing(false);
      }, 1000);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && cameraStream) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        setCapturedPhoto(canvas.toDataURL('image/jpeg'));
      }
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsCapturing(false);
  };

  // Submit new claim ticket
  const handleCreateClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSerial.trim() || !newItemName.trim() || !newCustomerName.trim()) {
      return;
    }

    const newTicket: WarrantyItem = {
      serial: newSerial.trim().toUpperCase(),
      itemName: newItemName.trim(),
      customerName: newCustomerName.trim(),
      customerPhone: newCustomerPhone.trim() || 'ثبت نشده',
      defectType: newDefectType,
      status: 'pending',
      expiryDate: '۱۴۰۸/۱۲/۲۹',
      registeredAt: 'امروز (' + new Date().toLocaleDateString('fa-IR') + ')',
      photoUrl: capturedPhoto || undefined,
      statusNotes: newNotes.trim() || undefined,
      technicianName: userRole === 'technician' ? 'مهندس احمدی' : undefined
    };

    setWarrantyDb([newTicket, ...warrantyDb]);
    
    // Reset Form
    setNewSerial('');
    setNewItemName('');
    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewDefectType(DEFECT_PRESETS[0]);
    setNewNotes('');
    setCapturedPhoto(null);

    // Auto navigate to active workshop workspace to view the item
    setQueueFilter('all');
    setActiveTab('queue');
  };

  // Quick Auto-Fill Form for rapid workshop intake test
  const handleAutoFillForm = () => {
    const randomSerials = ['W-7781', 'W-4932', 'W-1109', 'W-6250'];
    const randomItems = ['کارت صدا Focusrite Scarlett Solo', 'حافظه RAM Corsair Vengeance 32GB', 'منبع تغذیه Corsair RM1000x', 'مانیتور گیمینگ ASUS TUF 27"'];
    const randomCustomers = ['استودیو نوا', 'امیرحسین کریمی', 'پیشگامان تک سپهر', 'نگین راد'];
    const randomPhones = ['09121112233', '09354445566', '09197778899', '09302223344'];
    
    const index = Math.floor(Math.random() * randomSerials.length);
    setNewSerial(randomSerials[index]);
    setNewItemName(randomItems[index]);
    setNewCustomerName(randomCustomers[index]);
    setNewCustomerPhone(randomPhones[index]);
    setNewDefectType(DEFECT_PRESETS[Math.floor(Math.random() * DEFECT_PRESETS.length)]);
    setNewNotes('بررسی سریع روی میز قطعات تایید شده.');
  };

  // Helper to calculate solar expiry date for warranty
  const calculatePersianExpiry = (startDate: string, durationMonths: number): string => {
    const persianToEnglish = (str: string) => str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
    const englishToPersian = (str: string) => str.replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'[parseInt(d)]);

    const normalized = persianToEnglish(startDate);
    const parts = normalized.split('/');
    if (parts.length !== 3) return englishToPersian('۱۴۰۷/۰۴/۰۷');

    let year = parseInt(parts[0]);
    let month = parseInt(parts[1]);
    let day = parseInt(parts[2]);

    if (isNaN(year) || isNaN(month) || isNaN(day)) return englishToPersian('۱۴۰۷/۰۴/۰۷');

    month += durationMonths;
    while (month > 12) {
      month -= 12;
      year += 1;
    }

    const monthStr = month < 10 ? `0${month}` : `${month}`;
    const dayStr = day < 10 ? `0${day}` : `${day}`;

    return englishToPersian(`${year}/${monthStr}/${dayStr}`);
  };

  // Helper to parse Persian/English/formatted numbers to standard number
  const parsePersianOrFormattedNumber = (str: string): number => {
    if (!str) return 0;
    let englishDigits = str.replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d).toString());
    let cleanStr = englishDigits.replace(/[^\d]/g, '');
    const parsed = parseInt(cleanStr, 10);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Helper to format English numbers to Persian currency format
  const formatToPersianPrice = (num: number): string => {
    const formatted = new Intl.NumberFormat('fa-IR').format(num);
    return `${formatted} تومان`;
  };

  // Check if serial is already in DB, current selected list, or in any added sale items
  const isSerialRegisteredOrAdded = (serialVal: string): { exists: boolean; location: 'db' | 'current' | 'added' } | null => {
    const normalized = serialVal.trim().toUpperCase();
    if (warrantyDb.some(item => item.serial.trim().toUpperCase() === normalized)) {
      return { exists: true, location: 'db' };
    }
    if (saleSerials.map(s => s.trim().toUpperCase()).includes(normalized)) {
      return { exists: true, location: 'current' };
    }
    if (saleItems.some(item => item.serials.map((s: string) => s.trim().toUpperCase()).includes(normalized))) {
      return { exists: true, location: 'added' };
    }
    return null;
  };

  // P005: Add dynamic new customer
  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    const name = saleNewCustName.trim();
    const phone = saleNewCustPhone.trim();
    if (!name || !phone) return;

    // Check duplicate phone
    const existingByPhone = customers.find(c => c.phone === phone);
    if (existingByPhone) {
      alert(`طرف حساب با شماره تلفن ${phone} با نام «${existingByPhone.name}» قبلاً ثبت شده است. همان طرف حساب انتخاب شد.`);
      setSaleSelectedCustomer(existingByPhone);
      setSaleSearchMobile(existingByPhone.phone);
      return;
    }

    const newCust = {
      name,
      phone,
      type: saleNewCustType,
      address: saleNewCustAddress.trim()
    };

    setCustomers(prev => [...prev, newCust]);
    setSaleSelectedCustomer(newCust);
    setSaleSearchMobile(newCust.phone);

    // Reset customer add form
    setSaleNewCustName('');
    setSaleNewCustPhone('');
    setSaleNewCustType('person');
    setSaleNewCustAddress('');
    setSaleShowAddCustomer(false);
  };

  // P005: Add serial number with duplicate checks
  const handleAddSerial = () => {
    const prefix = (saleBulkPrefix === 'custom' ? saleBulkCustomPrefix : saleBulkPrefix).trim().toUpperCase();
    const suffix = saleCurrentSerial.trim().toUpperCase();
    if (!suffix) return;

    const serialVal = `${prefix}${suffix}`;

    const check = isSerialRegisteredOrAdded(serialVal);
    if (check) {
      if (check.location === 'db') {
        setSaleDuplicateError('این شماره سریال قبلاً در پایگاه داده ثبت و فروخته شده است.');
      } else if (check.location === 'current') {
        setSaleDuplicateError('این شماره سریال در لیست فعلی همین کالا تکراری است.');
      } else {
        setSaleDuplicateError('این شماره سریال قبلاً در یکی از اقلام دیگر فاکتور فروش اضافه شده است.');
      }
      return;
    }

    // Success
    setSaleSerials(prev => [...prev, serialVal]);
    setSaleCurrentSerial('');
    setSaleDuplicateError('');
  };

  // Play barcode scanner beep sound
  const playScannerBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1900, audioCtx.currentTime); // Realistic high-pitch beep
      gainNode.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.12);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.12);
    } catch (e) {
      console.log('Browser audio block or error: ', e);
    }
  };

  const handleScanSerial = (scannedVal: string) => {
    const serialVal = scannedVal.trim().toUpperCase();
    if (!serialVal) return { success: false, message: 'سریال خالی است.' };

    const check = isSerialRegisteredOrAdded(serialVal);
    if (check) {
      if (check.location === 'db') {
        return { success: false, message: `سریال ${serialVal} قبلاً ثبت و فروخته شده است.` };
      } else if (check.location === 'current') {
        return { success: false, message: `سریال ${serialVal} در لیست فعلی تکراری است.` };
      } else {
        return { success: false, message: `سریال ${serialVal} در اقلام دیگر فاکتور تکراری است.` };
      }
    }

    // Play Beep!
    playScannerBeep();

    // Trigger flash effect
    setScannerFlash(true);
    setTimeout(() => setScannerFlash(false), 120);

    // Add to list
    setSaleSerials(prev => [...prev, serialVal]);
    
    // Set success toast
    setScannerSuccessMessage(`سریال ${serialVal} ثبت شد`);
    setTimeout(() => setScannerSuccessMessage(''), 2500);

    return { success: true, message: `سریال ${serialVal} با موفقیت افزوده شد.` };
  };

  // P005: Add bulk sequential serial numbers with checks
  const handleBulkAddSerials = () => {
    const prefix = (saleBulkPrefix === 'custom' ? saleBulkCustomPrefix : saleBulkPrefix).trim().toUpperCase();
    
    // Parse numeric start and end
    const startNumStr = saleBulkStart.trim();
    const endNumStr = saleBulkEnd.trim();
    
    if (!startNumStr || !endNumStr) {
      setSaleDuplicateError('لطفاً شماره شروع و پایان را وارد کنید.');
      return;
    }
    
    const startNum = parseInt(startNumStr, 10);
    const endNum = parseInt(endNumStr, 10);
    
    if (isNaN(startNum) || isNaN(endNum)) {
      setSaleDuplicateError('شماره‌های شروع و پایان باید عددی معتبر باشند.');
      return;
    }
    
    if (startNum > endNum) {
      setSaleDuplicateError('شماره شروع نباید از شماره پایان بزرگ‌تر باشد.');
      return;
    }
    
    // Check if the range is too huge to prevent crashing (e.g., max 200 at once)
    const count = endNum - startNum + 1;
    if (count > 200) {
      setSaleDuplicateError('حداکثر مجاز برای ثبت گروهی در یک بار، ۲۰۰ دستگاه می‌باشد.');
      return;
    }
    
    // Find the length of the number string to preserve leading zeros
    const maxLen = Math.max(startNumStr.length, endNumStr.length);
    const hasLeadingZeros = startNumStr.startsWith('0') || endNumStr.startsWith('0');
    
    const generatedSerials: string[] = [];
    const duplicatesInList: string[] = [];
    const duplicatesInDb: string[] = [];
    const duplicatesInAdded: string[] = [];
    
    for (let i = startNum; i <= endNum; i++) {
      let numStr = String(i);
      if (hasLeadingZeros && numStr.length < maxLen) {
        numStr = numStr.padStart(maxLen, '0');
      }
      const serialVal = `${prefix}${numStr}`;
      
      const check = isSerialRegisteredOrAdded(serialVal);
      if (check) {
        if (check.location === 'db') {
          duplicatesInDb.push(serialVal);
        } else if (check.location === 'current') {
          duplicatesInList.push(serialVal);
        } else {
          duplicatesInAdded.push(serialVal);
        }
      } else if (generatedSerials.includes(serialVal)) {
        duplicatesInList.push(serialVal);
      } else {
        generatedSerials.push(serialVal);
      }
    }
    
    if (generatedSerials.length === 0) {
      if (duplicatesInDb.length > 0) {
        setSaleDuplicateError(`تمامی سریال‌های این بازه قبلاً در سیستم ثبت شده‌اند (مثال: ${duplicatesInDb.slice(0, 3).join('، ')}).`);
      } else if (duplicatesInAdded.length > 0) {
        setSaleDuplicateError(`تمامی سریال‌های این بازه در اقلام دیگر فاکتور استفاده شده‌اند (مثال: ${duplicatesInAdded.slice(0, 3).join('، ')}).`);
      } else {
        setSaleDuplicateError('تمامی سریال‌های این بازه در لیست فعلی تکراری هستند.');
      }
      return;
    }
    
    // Append generated serials
    setSaleSerials(prev => [...prev, ...generatedSerials]);
    setSaleBulkStart('');
    setSaleBulkEnd('');
    
    let errorMsg = '';
    if (duplicatesInDb.length > 0) {
      errorMsg += `توجه: تعداد ${duplicatesInDb.length} سریال به دلیل تکراری بودن در پایگاه داده اضافه نشدند (${duplicatesInDb.slice(0, 3).join('، ')}...). `;
    }
    if (duplicatesInAdded.length > 0) {
      errorMsg += `تعداد ${duplicatesInAdded.length} سریال در اقلام دیگر فاکتور استفاده شده و فیلتر شدند. `;
    }
    if (duplicatesInList.length > 0) {
      errorMsg += `تعداد ${duplicatesInList.length} سریال نیز در لیست فعلی تکراری بودند و فیلتر شدند.`;
    }
    
    setSaleDuplicateError(errorMsg || '');
  };

  // P005: Remove serial number from list
  const handleRemoveSerial = (serialVal: string) => {
    setSaleSerials(prev => prev.filter(s => s !== serialVal));
  };

  // P005: Remove specific serial from an already added item in the invoice
  const handleRemoveSerialFromItem = (itemIdx: number, serialVal: string) => {
    const updated = [...saleItems];
    const item = updated[itemIdx];
    const filteredSerials = item.serials.filter(s => s !== serialVal);
    
    if (filteredSerials.length === 0) {
      // Remove the item completely if no serials left
      updated.splice(itemIdx, 1);
    } else {
      updated[itemIdx] = {
        ...item,
        serials: filteredSerials
      };
    }
    setSaleItems(updated);
  };

  // P005: Remove an entire item row from the invoice
  const handleRemoveItemFromInvoice = (itemIdx: number) => {
    setSaleItems(prev => prev.filter((_, idx) => idx !== itemIdx));
  };

  // P005: Add currently selected product and serials to invoice list
  const handleAddItemToInvoice = () => {
    if (!saleSelectedProduct) {
      alert('لطفاً ابتدا یک کالا انتخاب کنید.');
      return false;
    }
    if (saleSerials.length === 0) {
      alert('لطفاً حداقل یک شماره سریال معتبر وارد و اضافه کنید.');
      return false;
    }

    const priceToSave = salePrice.trim() || saleSelectedProduct.suggestedPrice;
    
    // Check if product is already in saleItems
    const existsIdx = saleItems.findIndex(item => item.product.id === saleSelectedProduct.id || (item.product.name === saleSelectedProduct.name && item.product.model === saleSelectedProduct.model));
    if (existsIdx > -1) {
      // Append serials to existing
      const existing = saleItems[existsIdx];
      const mergedSerials = [...existing.serials];
      const duplicates: string[] = [];
      saleSerials.forEach(s => {
        if (!mergedSerials.includes(s)) {
          mergedSerials.push(s);
        } else {
          duplicates.push(s);
        }
      });
      
      const updated = [...saleItems];
      updated[existsIdx] = {
        ...existing,
        serials: mergedSerials
      };
      setSaleItems(updated);
      
      if (duplicates.length > 0) {
        alert(`تعداد ${duplicates.length} سریال به دلیل تکراری بودن در این ردیف ادغام نشدند.`);
      }
    } else {
      const newItem = {
        product: saleSelectedProduct,
        serials: [...saleSerials],
        unitPrice: parsePersianOrFormattedNumber(priceToSave),
        unitPriceStr: priceToSave
      };
      setSaleItems(prev => [...prev, newItem]);
    }

    // Reset item input states
    setSaleSelectedProduct(null);
    setSaleSerials([]);
    setSalePrice('');
    setSaleDuplicateError('');
    return true;
  };

  // P005: Register sale and activate warranty for all added items
  const handleRegisterSaleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleSelectedCustomer) {
      alert('لطفاً ابتدا یک طرف حساب انتخاب کنید.');
      return;
    }

    let finalSaleItems = [...saleItems];

    // Auto-add current selection if user forgot to click Add, but filled out product and serials
    if (saleSelectedProduct && saleSerials.length > 0) {
      const priceToSave = salePrice.trim() || saleSelectedProduct.suggestedPrice;
      const newItem = {
        product: saleSelectedProduct,
        serials: [...saleSerials],
        unitPrice: parsePersianOrFormattedNumber(priceToSave),
        unitPriceStr: priceToSave
      };
      finalSaleItems.push(newItem);
    }

    if (finalSaleItems.length === 0) {
      alert('لطفاً حداقل یک کالا به همراه شماره سریال برای صدور فاکتور فروش اضافه کنید.');
      return;
    }

    const newSalesWarrantyItems: WarrantyItem[] = [];
    finalSaleItems.forEach(item => {
      const activeDuration = parseInt(item.product.warrantyDuration) || 12;
      const calculatedExpiry = calculatePersianExpiry(saleDate, activeDuration);
      
      item.serials.forEach(serialVal => {
        newSalesWarrantyItems.push({
          serial: serialVal,
          itemName: `${item.product.name} (${item.product.model})`,
          customerName: saleSelectedCustomer.name,
          customerPhone: saleSelectedCustomer.phone,
          defectType: '', // No defect yet
          status: 'active', // Active warranty status
          expiryDate: calculatedExpiry,
          registeredAt: saleDate,
          statusNotes: `فعالسازی گارانتی پس از فروش. قیمت واحد: ${item.unitPriceStr} ${saleNotes ? '- توضیحات: ' + saleNotes : ''}`
        });
      });
    });

    // Create and save invoice / sale record
    const finalInvoiceNumber = saleInvoiceNumber.trim() || `INV-1405-${Math.floor(100 + Math.random() * 900)}`;
    const newSaleRecord = {
      id: finalInvoiceNumber,
      invoiceNumber: finalInvoiceNumber,
      saleDate: saleDate,
      customer: {
        name: saleSelectedCustomer.name,
        phone: saleSelectedCustomer.phone,
        type: saleSelectedCustomer.type,
        address: (saleSelectedCustomer as any).address || '',
        email: (saleSelectedCustomer as any).email || ''
      },
      items: finalSaleItems.map(item => ({
        product: {
          name: item.product.name,
          model: item.product.model,
          warrantyDuration: item.product.warrantyDuration,
          suggestedPrice: item.product.suggestedPrice,
          category: item.product.category
        },
        serials: [...item.serials],
        unitPrice: item.unitPrice,
        unitPriceStr: item.unitPriceStr
      })),
      discount: parsePersianOrFormattedNumber(saleDiscount) || 0,
      notes: saleNotes.trim() || undefined
    };

    setSales(prev => [newSaleRecord, ...prev]);

    // Add them to general warranty db
    setWarrantyDb(prev => [...newSalesWarrantyItems, ...prev]);

    // Update inventory stock status for sold serials
    setInventory(prev => prev.map(invItem => {
      const matched = newSalesWarrantyItems.find(w => w.serial.toUpperCase() === invItem.serialNumber.toUpperCase());
      if (matched) {
        return {
          ...invItem,
          status: 'sold',
          soldInvoiceNumber: finalInvoiceNumber,
          soldDate: saleDate,
          soldToCustomer: saleSelectedCustomer.name
        };
      }
      return invItem;
    }));

    // Show clean success alert
    alert(`فروش با موفقیت ثبت شد!\nتعداد ${newSalesWarrantyItems.length} دستگاه کالا فعال گردید و گارانتی آن‌ها تا تاریخ پایان با موفقیت در سیستم ثبت شد.`);

    // Reset Form completely
    setSaleSerials([]);
    setSaleItems([]);
    setSaleDiscount('');
    setShowSalePreview(false);
    setSaleSelectedCustomer(null);
    setSaleSelectedProduct(null);
    setSaleSearchMobile('');
    setSalePrice('');
    setSaleInvoiceNumber('');
    setSaleNotes('');
    
    // Switch to search tab to let them verify
    setSearchQuery(newSalesWarrantyItems[0].serial);
    setSearchResult(newSalesWarrantyItems[0]);
    setHasSearched(true);
    setActiveTab('search');
  };

  // Update claim repair progress/status
  const handleSaveStatusUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setWarrantyDb(prev => prev.map(item => {
      if (item.serial === editingItem.serial) {
        return {
          ...item,
          status: editStatus,
          statusNotes: editNotes.trim() || undefined,
          technicianName: userRole === 'technician' ? 'مهندس احمدی (شما)' : 'مدیریت کل'
        };
      }
      return item;
    }));

    setEditingItem(null);
    setEditNotes('');
  };

  // Synchronize Local Database with Central Server
  const triggerManualSync = async () => {
    setIsSyncing(true);
    try {
      const token = sessionStorage.getItem('diaco_session_token') || localStorage.getItem('diaco_session_token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const response = await fetch('/api/state', { headers, credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        if (data) {
          setIsSetupCompleted(!!data.isSetupCompleted);
          if (data.setupCompanyName) setSetupCompanyName(data.setupCompanyName);
          if (data.setupCompanyEnName) setSetupCompanyEnName(data.setupCompanyEnName);
          if (data.setupServerName) setSetupServerName(data.setupServerName);
          if (data.setupServerIp) setSetupServerIp(data.setupServerIp);
          if (data.setupCurrency) setSetupCurrency(data.setupCurrency);
          if (data.setupWarrantyDuration) setSetupWarrantyDuration(data.setupWarrantyDuration);
          if (data.setupMaxStayDays) setSetupMaxStayDays(data.setupMaxStayDays);
          if (data.users) setUsers(data.users);
          if (data.warrantyDb) setWarrantyDb(data.warrantyDb);
          if (data.sales) setSales(data.sales);
          if (data.customers) setCustomers(data.customers);
          if (data.products) setProducts(data.products);
          if (data.bankAccounts) setBankAccounts(data.bankAccounts);
        }
      }
    } catch (err) {
      console.error("Manual sync failed", err);
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
      }, 500);
    }
  };

  // Print customer ticket
  const triggerThermalPrint = (item: WarrantyItem) => {
    alert(`رسید حرارتی شماره گارانتی ${item.serial} برای چاپگر Bixolon ارسال شد.`);
  };

  // Helper render for claims status badge
  const renderStatusBadge = (status: WarrantyItem['status']) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200/60 px-2.5 py-1 rounded-full text-xs font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>پذیرش اولیه</span>
          </span>
        );
      case 'under_repair':
        return (
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200/60 px-2.5 py-1 rounded-full text-xs font-bold">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>تحت تعمیر</span>
          </span>
        );
      case 'replaced':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 rounded-full text-xs font-bold">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>تعویض و تحویل</span>
          </span>
        );
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200/60 px-2.5 py-1 rounded-full text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>گارانتی فعال</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-200/60 px-2.5 py-1 rounded-full text-xs font-bold">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>ابطال گارانتی</span>
          </span>
        );
    }
  };

  const filteredQueue = warrantyDb.filter(item => {
    if (queueFilter === 'all') return true;
    return item.status === queueFilter;
  });

  if (!isDbLoaded) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center font-sans" dir="rtl">
        <div className="space-y-6 text-center p-6">
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/30 animate-pulse">
              <Cpu className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black">در حال اتصال به سرور مرکزی...</h2>
            <p className="text-xs text-slate-400 font-bold">لطفاً شکیبا باشید، اطلاعات در حال دریافت از شبکه محلی هستند</p>
          </div>
          <div className="flex justify-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col antialiased selection:bg-blue-100" dir="rtl">
      
      {/* GLOBAL PWA TOP BRAND HEADER */}
      {isAuthenticated && (
        <header className={`sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-xs px-3 sm:px-5 py-2.5 sm:py-3 shrink-0 transition-all ${activeTab !== 'hub' ? 'lg:pr-52' : ''}`}>
          <div className="max-w-[1800px] mx-auto flex items-center justify-between gap-1.5 sm:gap-3 transition-all">
            {/* Right side in RTL: Hamburger Drawer Toggle (Mobile only) */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {activeTab !== 'hub' && (
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(true)}
                  className="lg:hidden p-2 rounded-xl bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-all cursor-pointer flex items-center justify-center active:scale-95 shrink-0"
                  title="منوی اصلی سامانه"
                >
                  <Menu className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                </button>
              )}
            </div>

            {/* Center Page Title & Subtitle */}
            <div className="flex-1 text-center min-w-0 px-1">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 truncate leading-snug">
                {getPageTitle(activeTab)}
              </h1>
              <p className="text-[10px] sm:text-xs font-bold text-slate-400 truncate">سامانه حسابداری و خدمات پس از فروش دیاکو</p>
            </div>

            {/* Left side in RTL: Network/Sync & Back Button */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end">
              {navHistory.length <= 1 || activeTab === 'hub' ? (
                isOnline ? (
                  <button 
                    onClick={triggerManualSync}
                    disabled={isSyncing}
                    className="p-1.5 sm:p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all relative cursor-pointer"
                    title="همگام‌سازی اطلاعات با سرور مرکزی"
                  >
                    {isSyncing ? (
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                    ) : (
                      <Wifi className="w-4 h-4 text-emerald-600" />
                    )}
                  </button>
                ) : (
                  <div className="p-1.5 sm:p-2 rounded-lg bg-rose-50 text-rose-600" title="حالت آفلاین فعال است">
                    <WifiOff className="w-4 h-4" />
                  </div>
                )
              ) : (
                <button
                  type="button"
                  onClick={handleBack}
                  className="p-1.5 sm:py-1.5 sm:px-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 shrink-0 font-black text-xs border border-blue-100/70"
                  title="بازگشت به صفحه قبلی"
                >
                  <ArrowRight className="w-4 h-4 text-blue-600" />
                  <span className="hidden sm:inline">بازگشت</span>
                </button>
              )}
            </div>
          </div>
        </header>
      )}

      {/* DESKTOP PERMANENT SIDEBAR (Fixed on the Right side for PC/Large screens in RTL) */}
      {isAuthenticated && activeTab !== 'hub' && (
        <aside className="hidden lg:flex fixed top-0 bottom-0 right-0 w-48 bg-white border-l border-slate-200/80 shadow-xs z-40 flex-col justify-between p-2.5 overflow-y-auto" dir="rtl">
          <div className="space-y-2.5">
            {/* Header Brand */}
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100 cursor-pointer" onClick={() => { setActiveTab('hub'); setSelectedModule('hub'); }}>
              <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <Cpu className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xs font-black text-slate-900 truncate">دیاکو الکترونیک</h2>
                <p className="text-[9px] font-bold text-slate-400 truncate">حسابداری و خدمات</p>
              </div>
            </div>

            {/* Quick Switch to Landing Hub */}
            <button
              onClick={() => { setActiveTab('hub'); setSelectedModule('hub'); setDevActiveScreen(null); }}
              className={`w-full py-1.5 px-2 rounded-xl text-right text-xs font-black flex items-center gap-2 transition-all cursor-pointer border ${
                activeTab === 'hub' ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
              }`}
            >
              <Database className={`w-3.5 h-3.5 shrink-0 ${activeTab === 'hub' ? 'text-blue-400' : 'text-blue-600'}`} />
              <span className="truncate">انتخاب سامانه (هاب)</span>
            </button>

            {/* Subsystem Selector Tabs in Sidebar */}
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setSelectedModule('accounting');
                  if (activeTab === 'hub' || !['accounting_dashboard', 'register_sale', 'purchase_invoice', 'products', 'customers', 'bank_accounts', 'sales_history', 'purchase_history', 'accounting_reports', 'project_backup'].includes(activeTab)) {
                    setActiveTab('accounting_dashboard');
                  }
                }}
                className={`py-1.5 px-1 rounded-lg text-[10px] font-black text-center transition-all cursor-pointer ${
                  selectedModule === 'accounting' && activeTab !== 'hub'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                حسابداری
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedModule('services');
                  if (activeTab === 'hub' || ['accounting_dashboard', 'register_sale', 'purchase_invoice', 'products', 'customers', 'bank_accounts', 'sales_history', 'purchase_history', 'accounting_reports'].includes(activeTab)) {
                    setActiveTab('dashboard');
                  }
                }}
                className={`py-1.5 px-1 rounded-lg text-[10px] font-black text-center transition-all cursor-pointer ${
                  selectedModule === 'services' && activeTab !== 'hub'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                خدمات و گارانتی
              </button>
            </div>

            {/* Nav Links based on selectedModule */}
            <div className="space-y-0.5 pt-0.5">
              {selectedModule === 'accounting' ? (
                <>
                  <div className="px-2 py-1 text-[9.5px] font-black text-blue-700 bg-blue-50/70 rounded-lg mb-1 flex items-center justify-between">
                    <span>واحد حسابداری و فروش</span>
                    <Calculator className="w-3 h-3 text-blue-600" />
                  </div>

                  <button
                    onClick={() => { setActiveTab('accounting_dashboard'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'accounting_dashboard' && devActiveScreen === null ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">میز کار حسابداری</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('register_sale'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'register_sale' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Coins className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">فاکتور فروش</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('purchase_invoice'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'purchase_invoice' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span className="truncate">فاکتور خرید</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('products'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'products' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <ShoppingBag className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">مدیریت کالا</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('production'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'production' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">واحد تولید و BOM</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('customers'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'customers' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">طرف‌های حساب</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('bank_accounts'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'bank_accounts' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Landmark className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                    <span className="truncate">حساب‌های بانکی</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('sales_history'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'sales_history' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">سوابق فاکتورهای فروش</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('purchase_history'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'purchase_history' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">سوابق فاکتورهای خرید</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('accounting_reports'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'accounting_reports' && devActiveScreen === null ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-700 bg-blue-50/70 hover:bg-blue-100'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">گزارشات هلو و تراز</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="px-2 py-1 text-[9.5px] font-black text-emerald-800 bg-emerald-50/70 rounded-lg mb-1 flex items-center justify-between">
                    <span>واحد خدمات و گارانتی</span>
                    <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  </div>

                  <button
                    onClick={() => { setActiveTab('dashboard'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'dashboard' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Cpu className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">میز کار اصلی کارگاه</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('search'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'search' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">استعلام اصالت و گارانتی</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('new_claim'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'new_claim' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <PlusCircle className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">پذیرش دستگاه و ثبت عیب</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('queue'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'queue' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Wrench className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">صف تعمیرات</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('start_repair'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'start_repair' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">پرونده‌ها و جستجو</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('reports'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'reports' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">گزارش‌ها و آمار</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('users'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'users' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">مدیریت کاربران</span>
                  </button>

                  <button
                    onClick={() => { setActiveTab('config'); setDevActiveScreen(null); }}
                    className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                      activeTab === 'config' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">تنظیمات کارگاه</span>
                  </button>
                </>
              )}

              <button
                onClick={() => { setActiveTab('project_backup'); setDevActiveScreen(null); }}
                className={`w-full py-1.5 px-2 rounded-xl text-right text-[11px] font-black flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'project_backup' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">نقشه راه و بک‌آ‌پ</span>
              </button>
            </div>
          </div>

          {/* User Badge & Logout */}
          <div className="pt-2 border-t border-slate-100 space-y-1.5 bg-white">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-0.5">
              <span className="truncate max-w-[95px] text-[10.5px]">{users.find(u => u.username.toLowerCase() === username.toLowerCase())?.fullName || `@${username}`}</span>
              <span className="text-[8.5px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md font-black border border-blue-100 shrink-0">
                {userRole === 'admin' ? 'مدیر' : userRole === 'technician' ? 'تعمیرکار' : userRole === 'delivery' ? 'تحویل' : 'پذیرش'}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="w-full py-1.5 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>خروج از حساب</span>
            </button>
          </div>
        </aside>
      )}

      {/* CORE PORTAL SCREEN */}
      <main className={`flex-1 w-full max-w-[1800px] 2xl:max-w-[1920px] mx-auto px-2.5 sm:px-5 lg:px-6 pt-3 pb-20 overflow-x-hidden transition-all ${activeTab !== 'hub' ? 'lg:pr-52' : ''}`}>
        <AnimatePresence mode="wait">
          
          {devActiveScreen !== null && ['P003', 'P004', 'P008', 'P009', 'P011', 'P012', 'P013', 'P014', 'P015'].includes(devActiveScreen) ? (
            <motion.div
              key="dev-preview-screen-wrapper"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-4 text-right"
              dir="rtl"
            >
              <DevPreviewContainer
                screenId={devActiveScreen}
                onClose={() => setDevActiveScreen(null)}
                props={{
                  devActiveScreen,
                  setDevActiveScreen,
                  isDevModeOpen,
                  setIsDevModeOpen,
                  customers,
                  setCustomers,
                  products,
                  setProducts,
                  warrantyDb,
                  setWarrantyDb,
                  users,
                  setUsers,
                  userRole,
                  setUserRole,
                  isOnline,
                  setIsOnline,

                  // P003 Customer States
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

                  // P004 Product States
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

                  // P012 Dossier States
                  devFileSerial,
                  setDevFileSerial,

                  // Navigation helpers
                  activeTab,
                  setActiveTab,
                  queueFilter,
                  setQueueFilter
                }}
              />
            </motion.div>
          ) : (!isSetupCompleted || devActiveScreen === 'P000') ? (
            showSetupWelcome ? (
              /* ===================== SCREEN P000_WELCOME: GORGEOUS WELCOME SCREEN ===================== */
              <motion.div
                key="setup-welcome-screen"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-md mx-auto py-10 space-y-6 text-center"
                dir="rtl"
              >
                {/* Visual celebration card */}
                <div className="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-xl shadow-slate-100/40 space-y-6 relative overflow-hidden">
                  {/* Decorative glowing background elements */}
                  <div className="absolute -top-10 -left-10 w-24 h-24 bg-blue-400/10 rounded-full blur-xl" />
                  <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-emerald-400/10 rounded-full blur-xl" />

                  {/* Sparking check icon */}
                  <div className="relative">
                    <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100/80 shadow-md shadow-emerald-50 mx-auto">
                      <Sparkles className="w-10 h-10 animate-bounce text-emerald-500" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-black rounded-full uppercase tracking-wider">
                      عملیات با موفقیت انجام شد
                    </span>
                    <h2 className="text-lg font-black text-slate-900 tracking-tight pt-2">
                      سامانه دیاکو با موفقیت راه‌اندازی شد!
                    </h2>
                    <p className="text-xs text-slate-500 font-bold leading-relaxed px-2">
                      خوش آمدید! سامانه مدیریت خدمات و گارانتی دیاکو الکترونیک اکنون آماده استفاده است. حساب مدیر ارشد با موفقیت ایجاد گردید و می‌توانید وارد سیستم شوید.
                    </p>
                  </div>

                  {/* Account details card */}
                  <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-right space-y-2.5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-bold">سمت شما:</span>
                      <span className="text-slate-900 font-black">مدیر ارشد سامانه</span>
                    </div>
                    <div className="border-t border-slate-200/50 my-1.5" />
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-bold">نام کاربری ورود:</span>
                      <span className="text-blue-700 font-black font-mono bg-blue-50 px-2 py-0.5 rounded-lg border border-blue-100">{setupAdminUsername.trim()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setIsSetupCompleted(true);
                      setShowSetupWelcome(false);
                    }}
                    className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-sm rounded-2xl shadow-lg shadow-blue-200/60 transition-all flex items-center justify-center gap-2 cursor-pointer group"
                  >
                    <span>ورود به سیستم</span>
                    <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                  </button>
                </div>
              </motion.div>
            ) : (
              /* ===================== SCREEN P000: INITIAL SYSTEM SETUP ===================== */
              <motion.div
                key="setup-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-md mx-auto py-6 space-y-6 text-right"
              dir="rtl"
            >
              {/* Header */}
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shadow-xs mx-auto animate-pulse">
                  <ShieldCheck className="w-9 h-9" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-black text-slate-950 tracking-tight leading-tight">
                    راه‌اندازی اولیه سامانه
                  </h2>
                </div>
              </div>

              {setupError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                  <span>{setupError}</span>
                </div>
              )}

              <form onSubmit={handleSystemSetup} className="space-y-5">
                
                {/* 1. اطلاعات شرکت */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <Building className="w-5 h-5 text-blue-600" />
                    <h3 className="text-xs font-black text-slate-900">۱. اطلاعات شرکت</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5">
                    {/* نام شرکت */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 block">
                        نام شرکت <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={setupCompanyName}
                        onChange={(e) => setSetupCompanyName(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all"
                      />
                    </div>

                    {/* نام انگلیسی شرکت */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 block">
                        نام انگلیسی شرکت <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={setupCompanyEnName}
                        onChange={(e) => setSetupCompanyEnName(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all font-mono"
                        dir="ltr"
                      />
                    </div>

                    {/* نام سرور */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 block">
                        نام سرور <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={setupServerName}
                        onChange={(e) => setSetupServerName(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. حساب مدیر اصلی */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                    <User className="w-5 h-5 text-blue-600" />
                    <h3 className="text-xs font-black text-slate-900">۲. حساب مدیر اصلی</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5">
                    {/* نام کاربری مدیر */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 block">
                        نام کاربری مدیر <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="لطفا نام کاربری را وارد کنید"
                        value={setupAdminUsername}
                        onChange={(e) => setSetupAdminUsername(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all"
                      />
                    </div>

                    {/* رمز عبور */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 block">
                        رمز عبور <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="رمز عبور"
                        value={setupAdminPassword}
                        onChange={(e) => setSetupAdminPassword(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all"
                      />
                    </div>

                    {/* تکرار رمز عبور */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-black text-slate-700 block">
                        تکرار رمز عبور <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        placeholder="تکرار رمز عبور"
                        value={setupAdminPasswordConfirm}
                        onChange={(e) => setSetupAdminPasswordConfirm(e.target.value)}
                        className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Main Action Button */}
                <button
                  type="submit"
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow-md shadow-blue-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  <Check className="w-5 h-5" />
                  <span>ایجاد سامانه</span>
                </button>
              </form>

              {/* Footer */}
              <div className="flex flex-col items-center justify-center text-center pt-4 space-y-1 text-slate-400 select-none">
                <p className="text-xs font-bold">نسخه 1.0.0</p>
                <p className="text-xs font-bold">© 1405 دیاکو الکترونیک</p>
                <p className="text-[10px] font-mono tracking-wider text-slate-300 uppercase">Diaco Electronics</p>
              </div>
            </motion.div>
          )
        ) : (!isAuthenticated || devActiveScreen === 'P001') ? (
            /* ===================== GATE: AUTHENTICATION SCREEN ===================== */
            <motion.div
              key="auth-gate"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="max-w-md mx-auto py-8 space-y-6"
            >
              {/* Logo & Title */}
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shadow-xs mx-auto">
                  <ShieldCheck className="w-9 h-9" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-lg font-black text-slate-950 tracking-tight leading-tight">
                    سامانه حسابداری و خدمات پس از فروش
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    ورود به پورتال یکپارچه حسابداری، انبار و خدمات دیاکو
                  </p>
                </div>
              </div>

              {/* Server Status Indicator */}
              <div 
                onClick={() => setIsOnline(!isOnline)} 
                title="برای شبیه‌سازی وضعیت سرور کلیک کنید"
                className="bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 rounded-2xl p-4 text-center cursor-pointer select-none transition-all"
              >
                {isOnline ? (
                  <div className="space-y-1.5">
                    <span className="text-xs font-black text-emerald-700 flex items-center justify-center gap-1.5">
                      🟢 اتصال به سرور برقرار است
                    </span>
                    <div className="text-[11px] text-slate-500 font-bold space-y-0.5">
                      <p className="font-mono tracking-wider">DIACO-SERVER</p>
                      <p className="font-mono text-slate-400">192.168.1.100</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <span className="text-xs font-black text-rose-700 flex items-center justify-center gap-1.5">
                      🔴 ارتباط با سرور برقرار نیست
                    </span>
                    <div className="text-[11px] text-rose-500/80 font-bold">
                      <p>در انتظار اتصال...</p>
                    </div>
                  </div>
                )}
              </div>

              {authError && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {/* Animated Login Progress Card or Login Form */}
              {authLoading ? (
                <motion.div 
                  key="login-loading-card"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-5 text-center"
                >
                  <div className="flex flex-col items-center justify-center space-y-3">
                    <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
                    <h3 className="text-sm font-black text-slate-800">در حال اتصال...</h3>
                  </div>
                  
                  <div className="space-y-3 pt-2 text-right max-w-[200px] mx-auto">
                    {/* Step 1: بررسی کاربر */}
                    <motion.div 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: loginProgressStep >= 1 ? 1 : 0.4, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center gap-2.5 text-xs font-bold text-slate-700"
                    >
                      <span className={loginProgressStep >= 1 ? "text-emerald-500 font-bold" : "text-slate-300"}>
                        {loginProgressStep >= 1 ? "✔" : "○"}
                      </span>
                      <span className={loginProgressStep >= 1 ? "text-slate-900 font-black" : "text-slate-400"}>
                        بررسی کاربر
                      </span>
                    </motion.div>

                    {/* Step 2: دریافت مجوزها */}
                    <motion.div 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: loginProgressStep >= 2 ? 1 : 0.4, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center gap-2.5 text-xs font-bold text-slate-700"
                    >
                      <span className={loginProgressStep >= 2 ? "text-emerald-500 font-bold" : "text-slate-300"}>
                        {loginProgressStep >= 2 ? "✔" : "○"}
                      </span>
                      <span className={loginProgressStep >= 2 ? "text-slate-900 font-black" : "text-slate-400"}>
                        دریافت مجوزها
                      </span>
                    </motion.div>

                    {/* Step 3: آماده‌سازی محیط */}
                    <motion.div 
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: loginProgressStep >= 3 ? 1 : 0.4, x: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center gap-2.5 text-xs font-bold text-slate-700"
                    >
                      <span className={loginProgressStep >= 3 ? "text-emerald-500 font-bold" : "text-slate-300"}>
                        {loginProgressStep >= 3 ? "✔" : "○"}
                      </span>
                      <span className={loginProgressStep >= 3 ? "text-slate-900 font-black" : "text-slate-400"}>
                        آماده‌سازی محیط
                      </span>
                    </motion.div>
                  </div>
                </motion.div>
              ) : (
                /* Simple Login Form */
                <form onSubmit={handleLogin} className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs space-y-4">
                  {/* Username Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700" htmlFor="login-username">
                      نام کاربری
                    </label>
                    <div className="relative">
                      <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        id="login-username"
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="نام کاربری خود را وارد کنید"
                        className="w-full pr-11 pl-4 py-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-sm font-semibold outline-none transition-all focus:ring-4 focus:ring-blue-50"
                      />
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-black text-slate-700" htmlFor="login-password">
                      رمز عبور
                    </label>
                    <div className="relative">
                      <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="رمز عبور"
                        className="w-full pr-11 pl-12 py-3 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-sm font-semibold outline-none transition-all focus:ring-4 focus:ring-blue-50"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Remember Me Checkbox */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id="remember-me"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4.5 h-4.5 text-blue-600 border-slate-300 rounded-md focus:ring-blue-50 cursor-pointer"
                    />
                    <label htmlFor="remember-me" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                      مرا به خاطر بسپار
                    </label>
                  </div>

                  {/* Login Button */}
                  <button
                    type="submit"
                    disabled={!isOnline}
                    className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-xl shadow-md shadow-blue-100 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:shadow-none"
                  >
                    <span>ورود به سامانه</span>
                  </button>
                </form>
              )}

              {/* Footer */}
              <div className="flex flex-col items-center justify-center text-center pt-6 space-y-1 text-slate-400 select-none">
                <p className="text-xs font-bold">نسخه 1.0.0</p>
                <p className="text-xs font-bold">© 1405</p>
                <p className="text-xs font-bold">دیاکو الکترونیک</p>
                <p className="text-[10px] font-mono tracking-wider text-slate-300 uppercase">Diaco Electronics</p>
              </div>
            </motion.div>
          ) : (
            
            /* ===================== AUTHENTICATED PWA INTERFACE ===================== */
            <div className="space-y-4">
              {devActiveScreen !== null && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-700 text-[10px] font-black px-3 py-2 rounded-2xl flex items-center justify-between mb-4 animate-pulse" dir="rtl">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>پیش‌نمایش تعاملی توسعه (PWA Review Mode)</span>
                  </span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[9px]">{devActiveScreen}</span>
                    <button
                      onClick={() => setDevActiveScreen(null)}
                      className="hover:bg-amber-200 p-1 rounded transition-colors text-amber-900 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
              
              {/* LANDING SELECTION HUB */}
              {activeTab === 'hub' && (
                <SystemSelectionHub
                  onSelectSystem={(mod, defaultTab) => {
                    setSelectedModule(mod);
                    if (defaultTab) {
                      setActiveTab(defaultTab);
                    } else if (mod === 'accounting') {
                      setActiveTab('accounting_dashboard');
                    } else {
                      setActiveTab('dashboard');
                    }
                  }}
                  customers={customers}
                  products={products}
                  warrantyDb={warrantyDb}
                  sales={sales}
                  purchases={purchases}
                  inventory={inventory}
                  bankAccounts={bankAccounts}
                />
              )}

              {/* TAB: ACCOUNTING DESK / DASHBOARD */}
              {activeTab === 'accounting_dashboard' && (
                <motion.div
                  key="accounting-desk-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <AccountingDesk
                    setActiveTab={setActiveTab}
                    customers={customers}
                    products={products}
                    sales={sales}
                    purchases={purchases}
                    bankAccounts={bankAccounts}
                    boms={boms}
                  />
                </motion.div>
              )}

              {/* TAB 1: QUICK SERIAL SEARCH & STATUS CHECK */}
              {activeTab === 'search' && (
                <motion.div
                  key="search-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Search className="text-blue-600 w-5 h-5" />
                      <span>استعلام سریع اصالت و گارانتی</span>
                    </h3>
                    <p className="text-xs text-slate-500">شماره سریال قطعه طرف حساب را جهت استعلام گارانتی و سابقه تعمیر وارد کنید.</p>
                  </div>

                  {/* Search Input Box */}
                  <form onSubmit={handleSearch} className="space-y-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="سریال قطعه کالا (مانند: W-9082)"
                        className="w-full pr-11 pl-12 py-3.5 bg-white border border-slate-200 focus:border-blue-600 rounded-xl outline-none text-sm font-black transition-all focus:ring-4 focus:ring-blue-50"
                      />
                      <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
                      <button
                        type="button"
                        onClick={triggerBarcodeScan}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 transition-colors p-1"
                        title="اسکن هوشمند بارکد با دوربین"
                      >
                        <QrCode className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>بررسی وضعیت سریال</span>
                      </button>
                      <button
                        type="button"
                        onClick={triggerBarcodeScan}
                        className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <QrCode className="w-4 h-4" />
                        <span>اسکنر مجازی</span>
                      </button>
                    </div>
                  </form>

                  {/* Simulator Scanner HUD */}
                  {isScanning && (
                    <div className="bg-slate-900 text-white rounded-2xl p-5 overflow-hidden relative border border-slate-800 shadow-md">
                      <div className="absolute inset-0 bg-radial from-blue-900/30 via-slate-950 to-slate-950 opacity-90"></div>
                      <div 
                        className="absolute left-0 right-0 h-0.5 bg-rose-500 shadow-[0_0_10px_#f43f5e] z-10"
                        style={{ top: `${(scanPulse % 6) * 16 + 10}%`, transition: 'all 0.2s ease-in-out' }}
                      ></div>

                      <div className="relative z-10 text-center py-4 space-y-2">
                        <div className="inline-flex p-3 bg-white/5 rounded-full animate-pulse border border-white/10">
                          <QrCode className="w-8 h-8 text-blue-400" />
                        </div>
                        <p className="text-xs font-black tracking-wide">در حال فوکوس و خواندن بارکد...</p>
                        <p className="text-[10px] text-slate-400 font-mono">ALIGN SERIAL IN WORKSHOP SCANNER</p>
                      </div>
                    </div>
                  )}

                  {/* Quick sandbox select list */}
                  <div className="bg-slate-100 border border-slate-200/60 rounded-xl p-3">
                    <p className="text-[10px] font-black text-slate-500 mb-2 uppercase">پیشنهاد قطعه در کارگاه برای تست سریع:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {warrantyDb.map((item, idx) => (
                        <button
                          key={`${item.serial}-${idx}`}
                          type="button"
                          onClick={() => handleQuickSelect(item.serial)}
                          className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs hover:border-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1.5 font-mono font-bold cursor-pointer"
                        >
                          <span className={`w-2 h-2 rounded-full ${
                            item.status === 'under_repair' ? 'bg-blue-600' :
                            item.status === 'rejected' ? 'bg-rose-500' :
                            item.status === 'replaced' ? 'bg-emerald-500' : 'bg-amber-500'
                          }`}></span>
                          <span>{item.serial}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Look-up Details */}
                  <div className="pt-2">
                    {hasSearched ? (
                      searchResult ? (
                        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-4 shadow-xs">
                          <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                            <div>
                              <span className="text-[10px] font-black text-slate-400 block">شناسه سریال گارانتی</span>
                              <span className="text-lg font-mono font-black text-slate-900 tracking-wider">{searchResult.serial}</span>
                            </div>
                            <div>
                              {renderStatusBadge(searchResult.status)}
                            </div>
                          </div>

                          <div className="space-y-3 text-xs">
                            <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                              <span className="text-slate-500 font-bold">نوع کالا / مدل قطعه:</span>
                              <span className="font-black text-slate-800">{searchResult.itemName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-bold">نام طرف حساب:</span>
                              <span className="font-bold text-slate-800">{searchResult.customerName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-bold">شماره تماس طرف حساب:</span>
                              <span className="font-bold text-slate-800 font-mono">{searchResult.customerPhone}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-bold">تاریخ ثبت اولیه:</span>
                              <span className="font-bold text-slate-800 font-mono">{searchResult.registeredAt}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 font-bold">پایان دوره گارانتی:</span>
                              <span className="font-bold text-slate-800 font-mono">{searchResult.expiryDate}</span>
                            </div>

                            {searchResult.defectType && (
                              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <span className="text-[10px] font-black text-slate-400 block mb-1">عیب گزارش شده پذیرش</span>
                                <span className="text-slate-700 font-medium leading-relaxed">{searchResult.defectType}</span>
                              </div>
                            )}

                            {searchResult.statusNotes && (
                              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 text-blue-900">
                                <span className="text-[10px] font-black text-blue-700 block mb-1">آخرین گزارش اقدامات کارگاه</span>
                                <p className="font-medium text-[11px] leading-relaxed">{searchResult.statusNotes}</p>
                              </div>
                            )}

                            {searchResult.photoUrl && (
                              <div className="space-y-1">
                                <span className="text-[10px] font-black text-slate-400 block">تصویر وضعیت فیزیکی قطعه</span>
                                <img 
                                  src={searchResult.photoUrl} 
                                  alt={searchResult.itemName} 
                                  className="w-full h-32 object-cover rounded-xl border border-slate-200"
                                  referrerPolicy="no-referrer"
                                />
                              </div>
                            )}
                          </div>

                          {/* Quick Edit Trigger from Search results */}
                          <div className="pt-2 border-t border-slate-100 flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingItem(searchResult);
                                setEditStatus(searchResult.status);
                                setEditNotes(searchResult.statusNotes || '');
                                setActiveTab('queue');
                              }}
                              className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-black rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <span>ویرایش وضعیت و اقدامات تعمیر</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => triggerThermalPrint(searchResult)}
                              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all cursor-pointer"
                              title="چاپ فیش طرف حساب"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5 text-center space-y-2">
                          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
                          <h4 className="text-sm font-black text-rose-900">سریال وارد شده معتبر نیست</h4>
                          <p className="text-xs text-slate-600 leading-relaxed">این کالا در پایگاه داده پذیرش محلی ثبت نشده است.</p>
                          <button
                            type="button"
                            onClick={() => {
                              setNewSerial(searchQuery);
                              setActiveTab('new_claim');
                            }}
                            className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white font-black text-xs rounded-xl cursor-pointer"
                          >
                            <PlusCircle className="w-4 h-4" />
                            <span>ثبت پذیرش جدید با این سریال</span>
                          </button>
                        </div>
                      )
                    ) : (
                      <div className="bg-slate-100/50 border border-slate-200/50 rounded-2xl p-6 text-center text-slate-400">
                        <Search className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="text-xs font-bold">برای بررسی وضعیت گارانتی، سریال یا بارکد را وارد نمایید.</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* TAB 2: REGISTER NEW WARRANTY INTAKE TICKET (P006 REDESIGNED) */}
              {activeTab === 'new_claim' && (
                <motion.div
                  key="claim-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <P006DeviceReception
                    warrantyDb={warrantyDb}
                    setWarrantyDb={setWarrantyDb}
                    customers={customers}
                    setCustomers={setCustomers}
                    products={products}
                    setProducts={setProducts}
                    userRole={userRole}
                    setActiveTab={setActiveTab}
                    setQueueFilter={setQueueFilter}
                    onRedirectToSale={(serial) => {
                      setSaleCurrentSerial(serial.toUpperCase());
                      setActiveTab('register_sale');
                    }}
                    templateDevice={templateDevice}
                    setTemplateDevice={setTemplateDevice}
                  />
                </motion.div>
              )}


              {/* TAB 2.5: REGISTER SOLD DEVICE FOR WARRANTY TRACKING (P005) */}
              {activeTab === 'register_sale' && (() => {
                const invoiceTotalSum = saleItems.reduce((acc, item) => acc + (item.serials.length * item.unitPrice), 0);
                const parsedDiscount = parsePersianOrFormattedNumber(saleDiscount);
                const invoiceFinalPayable = Math.max(0, invoiceTotalSum - parsedDiscount);

                return (
                  <motion.div
                  key="register-sale-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 text-right"
                  dir="rtl"
                >
                  {/* Page Title & Header */}
                  <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs text-center flex flex-col items-center justify-center space-y-1">
                    <h3 className="text-base font-black text-slate-900 flex items-center justify-center gap-2">
                      <Coins className="text-blue-600 w-5 h-5" />
                      <span>صدور فاکتور</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      سامانه یکپارچه ثبت و صدور فاکتورها ادغام‌شده با ردیابی شماره سریال‌ها و فعال‌سازی گارانتی
                    </p>
                  </div>

                  <HolooInvoiceForm
                    initialType="sale"
                    showToast={(msg, type) => showToast(msg, type)}
                    customers={customers}
                    setCustomers={setCustomers}
                    suppliers={suppliers}
                    setSuppliers={setSuppliers}
                    products={products}
                    setProducts={setProducts}
                    warrantyDb={warrantyDb}
                    setWarrantyDb={setWarrantyDb}
                    inventory={inventory}
                    setInventory={setInventory}
                    sales={sales}
                    setSales={setSales}
                    purchases={purchases}
                    setPurchases={setPurchases}
                    bankAccounts={bankAccounts}
                    setActiveTab={setActiveTab}
                    onSaveSuccess={(invoiceData) => {
                      showToast(`فاکتور با شماره «${invoiceData.invoiceNumber}» ثبت گردید.`, 'success');
                    }}
                  />
                </motion.div>
              );
            })()}

              {/* TAB 2.6: SALES HISTORY ARCHIVE (P016) */}
              {activeTab === 'sales_history' && (
                <motion.div
                  key="sales-history-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P016SalesHistory
                    sales={sales}
                    warrantyDb={warrantyDb}
                    setSales={setSales}
                    setWarrantyDb={setWarrantyDb}
                    onReturn={() => setActiveTab('register_sale')}
                    onSearchSerial={(serial) => {
                      setSearchQuery(serial);
                      const found = warrantyDb.find(w => w.serial.toUpperCase() === serial.toUpperCase());
                      setSearchResult(found || null);
                      setHasSearched(true);
                      setActiveTab('search');
                    }}
                  />
                </motion.div>
              )}

              {/* TAB: PURCHASE INVOICE (P017 / HOLOO) */}
              {activeTab === 'purchase_invoice' && (
                <motion.div
                  key="purchase-invoice-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <HolooInvoiceForm
                    initialType="purchase"
                    showToast={(msg, type) => showToast(msg, type)}
                    customers={customers}
                    setCustomers={setCustomers}
                    suppliers={suppliers}
                    setSuppliers={setSuppliers}
                    products={products}
                    setProducts={setProducts}
                    warrantyDb={warrantyDb}
                    setWarrantyDb={setWarrantyDb}
                    inventory={inventory}
                    setInventory={setInventory}
                    sales={sales}
                    setSales={setSales}
                    purchases={purchases}
                    setPurchases={setPurchases}
                    bankAccounts={bankAccounts}
                    setActiveTab={setActiveTab}
                    onSaveSuccess={(invoiceData) => {
                      showToast(`فاکتور خرید با شماره «${invoiceData.invoiceNumber}» ثبت گردید.`, 'success');
                    }}
                  />
                </motion.div>
              )}

              {/* TAB: PURCHASE HISTORY & INVENTORY STOCK (P017) */}
              {activeTab === 'purchase_history' && (
                <motion.div
                  key="purchase-history-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P017PurchaseHistory
                    purchases={purchases}
                    setPurchases={setPurchases}
                    inventory={inventory}
                    setInventory={setInventory}
                    suppliers={suppliers}
                    setSuppliers={setSuppliers}
                    setActiveTab={setActiveTab}
                    onGoToNewPurchase={() => setActiveTab('purchase_invoice')}
                    onGoToNewSaleWithSerial={(serial) => {
                      if (!saleSerials.includes(serial)) {
                        setSaleSerials(prev => [...prev, serial]);
                      }
                      setActiveTab('register_sale');
                    }}
                  />
                </motion.div>
              )}

              {/* TAB: HOLOO ACCOUNTING REPORTS */}
              {activeTab === 'accounting_reports' && (
                <motion.div
                  key="accounting-reports-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <HolooAccountingReports
                    sales={sales}
                    purchases={purchases}
                    customers={customers}
                    suppliers={suppliers}
                    products={products}
                    bankAccounts={bankAccounts}
                    inventory={inventory}
                    showToast={showToast}
                    onNavigateTab={setActiveTab}
                  />
                </motion.div>
              )}

              {/* TAB 3: ACTIVE REPAIR WORKSHOP QUEUE (P007) */}
              {activeTab === 'queue' && (
                <motion.div
                  key="queue-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4"
                >
                  <P007RepairsQueue
                    warrantyDb={warrantyDb}
                    setDevFileSerial={setDevFileSerial}
                    setActiveTab={setActiveTab}
                  />
                </motion.div>
              )}

              {/* TAB: USER MANAGEMENT (P002) */}
              {activeTab === 'users' && (
                <motion.div
                  key="users-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-4 text-right"
                >
                  <div className="space-y-1">
                    <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                      <Users className="text-blue-600 w-5 h-5" />
                      <span>مدیریت کاربران</span>
                    </h3>
                    <p className="text-xs text-slate-500">ایجاد و ویرایش کاربران سیستم خدمات پس از فروش دیاکو الکترونیک</p>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 text-right flex items-start gap-2.5 shadow-xs">
                    <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-blue-950">سطح دسترسی لازم: مدیر سیستم</p>
                      <p className="text-[10px] text-blue-700 font-bold mt-0.5 leading-relaxed">
                        تنها مدیر ارشد سیستم مجاز به مدیریت کاربران کارگاه (ایجاد کاربر جدید، تغییر نقش، ویرایش مشخصات، تغییر رمز عبور و فعال/غیرفعال‌سازی همکاران) است.
                      </p>
                    </div>
                  </div>

                  {/* Search and Add User */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => setUserSearchQuery(e.target.value)}
                        placeholder="جستجوی کاربر (نام، نام کاربری...)"
                        className="w-full pr-10 pl-4 py-3 bg-white border border-slate-200 focus:border-blue-600 rounded-xl outline-none text-xs font-bold transition-all focus:ring-4 focus:ring-blue-50"
                      />
                      <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 pointer-events-none" />
                    </div>
                    
                    <button
                      type="button"
                      onClick={handleOpenAddUser}
                      className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-100 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>افزودن کاربر جدید</span>
                    </button>
                  </div>

                  {/* Users Cards List */}
                  <div className="space-y-3">
                    {users
                      .filter(u => 
                        u.fullName.includes(userSearchQuery) || 
                        u.username.includes(userSearchQuery)
                      )
                      .map((user) => {
                        let roleLabel = '';
                        let roleBgColor = '';
                        let roleTextColor = '';
                        
                        switch (user.role) {
                          case 'admin':
                            roleLabel = 'مدیر سیستم';
                            roleBgColor = 'bg-rose-50';
                            roleTextColor = 'text-rose-700 border-rose-100';
                            break;
                          case 'reception':
                            roleLabel = 'پذیرش';
                            roleBgColor = 'bg-blue-50';
                            roleTextColor = 'text-blue-700 border-blue-100';
                            break;
                          case 'technician':
                            roleLabel = 'تعمیرکار';
                            roleBgColor = 'bg-emerald-50';
                            roleTextColor = 'text-emerald-700 border-emerald-100';
                            break;
                          case 'delivery':
                            roleLabel = 'مسئول تحویل';
                            roleBgColor = 'bg-amber-50';
                            roleTextColor = 'text-amber-700 border-amber-100';
                            break;
                          default:
                            roleLabel = user.role;
                            roleBgColor = 'bg-violet-50';
                            roleTextColor = 'text-violet-700 border-violet-100';
                            break;
                        }

                        return (
                          <div 
                            key={user.id} 
                            className="bg-white border border-slate-200/80 rounded-2xl p-4 space-y-4 shadow-xs hover:border-slate-300 transition-all text-right"
                          >
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                                  <User className="w-5 h-5" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-slate-900">{user.fullName}</h4>
                                  <p className="text-[10px] text-slate-400 font-bold font-mono tracking-wider text-right">@{user.username}</p>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-1.5">
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border ${roleBgColor} ${roleTextColor}`}>
                                  {roleLabel}
                                </span>
                                
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black border ${
                                  user.isActive 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                    : 'bg-slate-50 text-slate-500 border-slate-200'
                                }`}>
                                  {user.isActive ? 'فعال' : 'غیرفعال'}
                                </span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-[10px] border-t border-b border-slate-50 py-2.5">
                              <span className="text-slate-400 font-bold">آخرین ورود به سامانه:</span>
                              <span className="font-bold text-slate-700 font-mono" dir="ltr">{user.lastLoginDate}</span>
                            </div>

                            {/* User Cards Actions */}
                            <div className="flex justify-between gap-1.5 pt-1 flex-wrap">
                              <div className="flex gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditUser(user)}
                                  className="px-2 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-black rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                  title="ویرایش کاربر"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  <span>ویرایش</span>
                                </button>
                                
                                <button
                                  type="button"
                                  onClick={() => handleOpenPasswordReset(user)}
                                  className="px-2 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-black rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                  title="تغییر رمز عبور"
                                >
                                  <Key className="w-3.5 h-3.5 text-blue-600" />
                                  <span>رمز عبور</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(user.id)}
                                  className={`px-2 py-2 border text-[10px] font-black rounded-lg transition-all flex items-center gap-1 cursor-pointer ${
                                    userHasPerformedActions(user)
                                      ? 'bg-slate-100/60 text-slate-400 border-slate-200/60 cursor-not-allowed opacity-60'
                                      : 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-600 active:scale-95'
                                  }`}
                                  title={userHasPerformedActions(user) ? 'به دلیل وجود فعالیت‌های ثبتی غیرقابل حذف است' : 'حذف کاربر'}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                  <span>حذف</span>
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleToggleUserStatus(user.id)}
                                className={`px-3 py-2 border text-[10px] font-black rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                                  user.isActive
                                    ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-700'
                                    : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                                }`}
                              >
                                {user.isActive ? (
                                  <>
                                    <UserX className="w-3.5 h-3.5" />
                                    <span>غیرفعال‌سازی</span>
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="w-3.5 h-3.5" />
                                    <span>فعال‌سازی</span>
                                  </>
                                )}
                              </button>
                            </div>

                          </div>
                        );
                      })}
                  </div>
                </motion.div>
              )}

              {/* TAB 4: CONFIG & HARDWARE TOOLS (P014 Workshop Settings) */}
              {activeTab === 'config' && (
                <motion.div
                  key="config-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P014WorkshopSettings onReturn={() => setActiveTab('dashboard')} />
                </motion.div>
              )}

              {/* TAB: DASHBOARD (P011) */}
              {activeTab === 'dashboard' && (
                <motion.div
                  key="dashboard-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P011HomeDashboard
                    devActiveScreen={devActiveScreen}
                    setDevActiveScreen={setDevActiveScreen}
                    isDevModeOpen={isDevModeOpen}
                    setIsDevModeOpen={setIsDevModeOpen}
                    customers={customers}
                    setCustomers={setCustomers}
                    products={products}
                    setProducts={setProducts}
                    warrantyDb={warrantyDb}
                    setWarrantyDb={setWarrantyDb}
                    users={users}
                    setUsers={setUsers}
                    userRole={userRole}
                    setUserRole={setUserRole}
                    isOnline={isOnline}
                    setIsOnline={setIsOnline}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    queueFilter={queueFilter}
                    setQueueFilter={setQueueFilter}
                    setIsAuthenticated={setIsAuthenticated}
                    setIsSetupCompleted={setIsSetupCompleted}
                  />
                </motion.div>
              )}

              {/* TAB: PROJECT ROADMAP & PDF BACKUP (P019) */}
              {activeTab === 'project_backup' && (
                <motion.div
                  key="project-backup-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P019ProjectBackupRoadmap
                    onReturn={() => setActiveTab('dashboard')}
                    showToast={(msg, type) => showToast(msg, type)}
                  />
                </motion.div>
              )}

              {/* TAB: CUSTOMERS (P003) */}
              {activeTab === 'customers' && (
                <motion.div
                  key="customers-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P003CustomerManagement
                    devActiveScreen={devActiveScreen}
                    setDevActiveScreen={setDevActiveScreen}
                    isDevModeOpen={isDevModeOpen}
                    setIsDevModeOpen={setIsDevModeOpen}
                    customers={customers}
                    setCustomers={setCustomers}
                    products={products}
                    setProducts={setProducts}
                    warrantyDb={warrantyDb}
                    setWarrantyDb={setWarrantyDb}
                    users={users}
                    setUsers={setUsers}
                    userRole={userRole}
                    setUserRole={setUserRole}
                    isOnline={isOnline}
                    setIsOnline={setIsOnline}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    queueFilter={queueFilter}
                    setQueueFilter={setQueueFilter}
                    setIsAuthenticated={setIsAuthenticated}
                    setIsSetupCompleted={setIsSetupCompleted}
                    custSearchQuery={custSearchQuery}
                    setCustSearchQuery={setCustSearchQuery}
                    isCustModalOpen={isCustModalOpen}
                    setIsCustModalOpen={setIsCustModalOpen}
                    editingCustomer={editingCustomer}
                    setEditingCustomer={setEditingCustomer}
                    custFormName={custFormName}
                    setCustFormName={setCustFormName}
                    custFormPhone={custFormPhone}
                    setCustFormPhone={setCustFormPhone}
                    custFormType={custFormType}
                    setCustFormType={setCustFormType}
                    custFormEmail={custFormEmail}
                    setCustFormEmail={setCustFormEmail}
                    custFormAddress={custFormAddress}
                    setCustFormAddress={setCustFormAddress}
                    sales={sales}
                  />
                </motion.div>
              )}

              {/* TAB: PRODUCTS (P004) */}
              {activeTab === 'products' && (
                <motion.div
                  key="products-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P004ProductManagement
                    devActiveScreen={devActiveScreen}
                    setDevActiveScreen={setDevActiveScreen}
                    isDevModeOpen={isDevModeOpen}
                    setIsDevModeOpen={setIsDevModeOpen}
                    customers={customers}
                    setCustomers={setCustomers}
                    products={products}
                    setProducts={setProducts}
                    warrantyDb={warrantyDb}
                    setWarrantyDb={setWarrantyDb}
                    users={users}
                    setUsers={setUsers}
                    userRole={userRole}
                    setUserRole={setUserRole}
                    isOnline={isOnline}
                    setIsOnline={setIsOnline}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    queueFilter={queueFilter}
                    setQueueFilter={setQueueFilter}
                    setIsAuthenticated={setIsAuthenticated}
                    setIsSetupCompleted={setIsSetupCompleted}
                    prodSearchQuery={prodSearchQuery}
                    setProdSearchQuery={setProdSearchQuery}
                    isProdModalOpen={isProdModalOpen}
                    setIsProdModalOpen={setIsProdModalOpen}
                    editingProduct={editingProduct}
                    setEditingProduct={setEditingProduct}
                    prodFormName={prodFormName}
                    setProdFormName={setProdFormName}
                    prodFormModel={prodFormModel}
                    setProdFormModel={setProdFormModel}
                    prodFormDuration={prodFormDuration}
                    setProdFormDuration={setProdFormDuration}
                    prodFormSuggestedPrice={prodFormSuggestedPrice}
                    setProdFormSuggestedPrice={setProdFormSuggestedPrice}
                    sales={sales}
                  />
                </motion.div>
              )}

              {/* TAB: PRODUCTION UNIT & BOM */}
              {activeTab === 'production' && (
                <motion.div
                  key="production-unit-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <ProductionUnit
                    products={products}
                    setProducts={setProducts}
                    boms={boms}
                    setBoms={setBoms}
                    showToast={showToast}
                  />
                </motion.div>
              )}

              {/* TAB: BANK ACCOUNTS (P020) */}
              {activeTab === 'bank_accounts' && (
                <motion.div
                  key="bank-accounts-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P020BankAccounts
                    bankAccounts={bankAccounts}
                    setBankAccounts={setBankAccounts}
                    showToast={showToast}
                    userRole={userRole}
                  />
                </motion.div>
              )}

              {/* TAB: HANDOVER (P008) */}
              {activeTab === 'handover' && (
                <motion.div
                  key="handover-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P008DeviceHandover
                    devActiveScreen={devActiveScreen}
                    setDevActiveScreen={setDevActiveScreen}
                    isDevModeOpen={isDevModeOpen}
                    setIsDevModeOpen={setIsDevModeOpen}
                    customers={customers}
                    setCustomers={setCustomers}
                    products={products}
                    setProducts={setProducts}
                    warrantyDb={warrantyDb}
                    setWarrantyDb={setWarrantyDb}
                    users={users}
                    setUsers={setUsers}
                    userRole={userRole}
                    setUserRole={setUserRole}
                    isOnline={isOnline}
                    setIsOnline={setIsOnline}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    queueFilter={queueFilter}
                    setQueueFilter={setQueueFilter}
                    setIsAuthenticated={setIsAuthenticated}
                    setIsSetupCompleted={setIsSetupCompleted}
                    devFileSerial={devFileSerial}
                    setDevFileSerial={setDevFileSerial}
                  />
                </motion.div>
              )}

              {/* TAB: REPORTS (P009) */}
              {activeTab === 'reports' && (
                <motion.div
                  key="reports-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P009ReportsAndAnalytics
                    devActiveScreen={devActiveScreen}
                    setDevActiveScreen={setDevActiveScreen}
                    isDevModeOpen={isDevModeOpen}
                    setIsDevModeOpen={setIsDevModeOpen}
                    customers={customers}
                    setCustomers={setCustomers}
                    products={products}
                    setProducts={setProducts}
                    warrantyDb={warrantyDb}
                    setWarrantyDb={setWarrantyDb}
                    users={users}
                    setUsers={setUsers}
                    userRole={userRole}
                    setUserRole={setUserRole}
                    isOnline={isOnline}
                    setIsOnline={setIsOnline}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    queueFilter={queueFilter}
                    setQueueFilter={setQueueFilter}
                    setIsAuthenticated={setIsAuthenticated}
                    setIsSetupCompleted={setIsSetupCompleted}
                  />
                </motion.div>
              )}

              {/* TAB: DOSSIER (P008) */}
              {activeTab === 'dossier' && (
                <motion.div
                  key="dossier-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P008RepairDossier
                    devFileSerial={devFileSerial}
                    setDevFileSerial={setDevFileSerial}
                    setActiveTab={setActiveTab}
                    warrantyDb={warrantyDb}
                    setWarrantyDb={setWarrantyDb}
                  />
                </motion.div>
              )}

              {/* TAB: DOSSIER SEARCH (P013) */}
              {activeTab === 'start_repair' && (
                <motion.div
                  key="start-repair-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P013DossierSearch />
                </motion.div>
              )}

              {/* TAB: FINAL TEST (P010) */}
              {activeTab === 'final_test' && (
                <motion.div
                  key="final-test-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P010FinalTest />
                </motion.div>
              )}

              {/* TAB: DEVICE DELIVERY (P011) */}
              {activeTab === 'device_delivery' && (
                <motion.div
                  key="device-delivery-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P011DeviceHandover />
                </motion.div>
              )}

              {/* TAB: SETTLEMENT (P012) */}
              {activeTab === 'settlement' && (
                <motion.div
                  key="settlement-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <P012Settlement />
                </motion.div>
              )}

              {devActiveScreen !== null && (
                <div className="text-center py-3 text-[11px] font-black text-amber-600/80 bg-amber-500/5 rounded-2xl border border-dashed border-amber-500/15 mt-6 animate-pulse" dir="rtl">
                  این صفحه در حال طراحی است. (پیش‌نمایش تعاملی دیاکو الکترونیک)
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* FIXED NATIVE PWA BOTTOM BAR */}
      {isAuthenticated && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-[0_-2px_12px_rgba(0,0,0,0.03)] pb-safe shrink-0 lg:hidden">
          <div className="max-w-xl md:max-w-3xl lg:max-w-5xl mx-auto flex justify-around py-2 px-1 transition-all">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'dashboard' ? 'text-blue-600 font-bold bg-blue-50/60' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Cpu className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-black">میز کار</span>
            </button>

            <button
              onClick={() => setActiveTab('search')}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'search' ? 'text-blue-600 font-bold bg-blue-50/60' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Search className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-black">استعلام</span>
            </button>

            <button
              onClick={() => setActiveTab('new_claim')}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'new_claim' ? 'text-blue-600 font-bold bg-blue-50/60' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <PlusCircle className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-black">پذیرش جدید</span>
            </button>

            <button
              onClick={() => setActiveTab('register_sale')}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer ${
                activeTab === 'register_sale' ? 'text-blue-600 font-bold bg-blue-50/60' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Coins className="w-5 h-5 mb-0.5" />
              <span className="text-[10px] font-black">فاکتور فروش</span>
            </button>

            <button
              onClick={() => setActiveTab('queue')}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all cursor-pointer relative ${
                activeTab === 'queue' ? 'text-blue-600 font-bold bg-blue-50/60' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <FileText className="w-5 h-5 mb-0.5" />
              <span className="absolute top-1 right-2 bg-blue-600 text-white text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white">
                {warrantyDb.length}
              </span>
              <span className="text-[10px] font-black">کارتابل</span>
            </button>
          </div>
        </nav>
      )}

      {/* USER MANAGEMENT MODAL (ADD / EDIT) */}
      <AnimatePresence>
        {isUserModalOpen && (
          <div 
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setIsUserModalOpen(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl w-full max-w-sm border border-slate-200 shadow-xl overflow-hidden"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200/80 flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-900">
                  {editingUser ? 'ویرایش اطلاعات کاربر' : 'افزودن کاربر جدید'}
                </h3>
                <button 
                  onClick={() => setIsUserModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveUser} className="p-5 space-y-4">
                {/* Error Banner */}
                {userFormError && (
                  <div className="bg-rose-50 border border-rose-100 text-rose-700 text-[11px] font-black px-3 py-2 rounded-lg flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>{userFormError}</span>
                  </div>
                )}

                {/* Full Name */}
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-black text-slate-700 block">
                    نام و نام خانوادگی <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormFullName}
                    onChange={(e) => setUserFormFullName(e.target.value)}
                    placeholder="مانند: علیرضا احمدی"
                    className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all"
                  />
                </div>

                {/* Username */}
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-black text-slate-700 block">
                    نام کاربری <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={userFormUsername}
                    onChange={(e) => setUserFormUsername(e.target.value)}
                    placeholder="مانند: user_ahmadi"
                    disabled={!!editingUser}
                    className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                </div>

                {/* Role select */}
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-black text-slate-700 block">نقش کاربر <span className="text-rose-500">*</span></label>
                  <select
                    value={userFormRole}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUserFormRole(val);
                      if (val !== '__custom__') {
                        setUserFormCustomRole('');
                      }
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none cursor-pointer"
                  >
                    <option value="admin">مدیر سیستم</option>
                    <option value="reception">پذیرش</option>
                    <option value="technician">تعمیرکار</option>
                    <option value="delivery">مسئول تحویل</option>
                    
                    {/* Dynamic unique custom roles already present in users list */}
                    {(() => {
                      const defaultRoles = ['admin', 'reception', 'technician', 'delivery'];
                      const customRoles = Array.from(new Set(users.map(u => u.role).filter(r => r && !defaultRoles.includes(r))));
                      return customRoles.map(cr => (
                        <option key={cr} value={cr}>{cr}</option>
                      ));
                    })()}

                    <option value="__custom__">➕ افزودن مسئولیت یا نقش جدید...</option>
                  </select>
                </div>

                {/* Custom Role Input field */}
                {userFormRole === '__custom__' && (
                  <div className="space-y-1.5 text-right animate-in fade-in slide-in-from-top-1 duration-200">
                    <label className="text-[11px] font-black text-blue-700 block">عنوان مسئولیت یا نقش جدید <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={userFormCustomRole}
                      onChange={(e) => setUserFormCustomRole(e.target.value)}
                      placeholder="مانند: حسابدار، مدیر داخلی، پشتیبان"
                      className="w-full px-3 py-2 bg-blue-50/20 border border-blue-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none"
                    />
                  </div>
                )}

                {/* Password Fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 text-right">
                    <label className="text-[11px] font-black text-slate-700 block">
                      رمز عبور {!editingUser && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      value={userFormPassword}
                      onChange={(e) => setUserFormPassword(e.target.value)}
                      placeholder={editingUser ? "بدون تغییر" : "••••••"}
                      className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all font-mono"
                    />
                  </div>

                  <div className="space-y-1.5 text-right">
                    <label className="text-[11px] font-black text-slate-700 block">
                      تکرار رمز عبور {!editingUser && <span className="text-rose-500">*</span>}
                    </label>
                    <input
                      type="password"
                      required={!editingUser}
                      value={userFormConfirmPassword}
                      onChange={(e) => setUserFormConfirmPassword(e.target.value)}
                      placeholder={editingUser ? "بدون تغییر" : "••••••"}
                      className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all font-mono"
                    />
                  </div>
                </div>

                {/* Active Checkbox */}
                <div className="flex items-center gap-2 pt-1 text-right">
                  <input
                    id="user-form-active"
                    type="checkbox"
                    checked={userFormIsActive}
                    onChange={(e) => setUserFormIsActive(e.target.checked)}
                    className="w-4.5 h-4.5 text-blue-600 border-slate-300 rounded-md focus:ring-blue-50 cursor-pointer"
                  />
                  <label htmlFor="user-form-active" className="text-xs font-bold text-slate-600 cursor-pointer select-none">
                    وضعیت فعال (مجوز ورود به سیستم دارد)
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md shadow-blue-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingUser ? 'ذخیره تغییرات کاربر' : 'افزودن کاربر جدید'}</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PASSWORD RESET MODAL */}
      <AnimatePresence>
        {isPasswordModalOpen && passwordResetUser && (
          <div 
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setIsPasswordModalOpen(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl w-full max-w-sm border border-slate-200 shadow-xl overflow-hidden"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-slate-50 px-5 py-4 border-b border-slate-200/80 flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-900">
                  تغییر رمز عبور: {passwordResetUser.fullName}
                </h3>
                <button 
                  onClick={() => setIsPasswordModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSavePasswordReset} className="p-5 space-y-4">
                <div className="space-y-1.5 text-right">
                  <label className="text-xs font-black text-slate-700 block">
                    رمز عبور جدید <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newResetPassword}
                    onChange={(e) => setNewResetPassword(e.target.value)}
                    placeholder="رمز عبور جدید را وارد کنید"
                    className="w-full px-3 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-blue-600 rounded-xl text-xs font-bold outline-none transition-all"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md shadow-blue-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  <Check className="w-4 h-4" />
                  <span>بروزرسانی رمز عبور</span>
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HAMBURGER SIDE DRAWER MENU (P011 requirement) */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Dark blur backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs cursor-pointer overscroll-none touch-none lg:hidden"
            />

            {/* Right Side Drawer Panel (RTL) */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 bottom-0 right-0 w-72 max-w-[85vw] bg-white border-l border-slate-100 shadow-2xl z-55 flex flex-col justify-between overscroll-contain lg:hidden"
              dir="rtl"
            >
              <div className="p-4 flex-1 overflow-y-auto space-y-3">
                {/* Header with Close Button */}
                <div className="flex justify-between items-center pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => { setActiveTab('hub'); setSelectedModule('hub'); setIsDrawerOpen(false); }}>
                    <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
                      <Cpu className="w-4.5 h-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-xs font-black text-slate-900 truncate">دیاکو الکترونیک</h2>
                      <p className="text-[9px] font-bold text-slate-400 truncate">حسابداری و خدمات پس از فروش</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Switch to Landing Hub */}
                <button
                  onClick={() => {
                    setActiveTab('hub');
                    setSelectedModule('hub');
                    setDevActiveScreen(null);
                    setIsDrawerOpen(false);
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl text-right text-xs font-black flex items-center gap-2.5 transition-all cursor-pointer border ${
                    activeTab === 'hub' ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-slate-50 text-slate-700 border-slate-200/80 hover:bg-slate-100'
                  }`}
                >
                  <Database className={`w-4 h-4 shrink-0 ${activeTab === 'hub' ? 'text-blue-400' : 'text-blue-600'}`} />
                  <span>صفحه انتخاب سامانه (هاب)</span>
                </button>

                {/* Subsystem Selector Tabs */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedModule('accounting');
                      if (activeTab === 'hub' || !['register_sale', 'purchase_invoice', 'products', 'customers', 'bank_accounts', 'sales_history', 'purchase_history', 'project_backup'].includes(activeTab)) {
                        setActiveTab('register_sale');
                      }
                    }}
                    className={`py-2 px-1 rounded-lg text-[11px] font-black text-center transition-all cursor-pointer ${
                      selectedModule === 'accounting' && activeTab !== 'hub'
                        ? 'bg-white text-blue-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    سامانه حسابداری
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedModule('services');
                      if (activeTab === 'hub' || ['register_sale', 'purchase_invoice', 'products', 'customers', 'bank_accounts', 'sales_history', 'purchase_history'].includes(activeTab)) {
                        setActiveTab('dashboard');
                      }
                    }}
                    className={`py-2 px-1 rounded-lg text-[11px] font-black text-center transition-all cursor-pointer ${
                      selectedModule === 'services' && activeTab !== 'hub'
                        ? 'bg-white text-emerald-700 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    خدمات و گارانتی
                  </button>
                </div>

                {/* Main Navigation Items */}
                <div className="space-y-1 pt-1">
                  {selectedModule === 'accounting' ? (
                    <>
                      <div className="px-2 py-1 text-[10px] font-black text-blue-700 bg-blue-50/70 rounded-lg mb-1 flex items-center justify-between">
                        <span>ماژول‌های حسابداری و فروش</span>
                        <Calculator className="w-3.5 h-3.5 text-blue-600" />
                      </div>

                      <button
                        onClick={() => {
                          setActiveTab('register_sale');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'register_sale' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Coins className="w-4 h-4 text-blue-600" />
                        <span>فاکتور فروش</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('purchase_invoice');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'purchase_invoice' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <ShoppingCart className="w-4 h-4 text-indigo-600" />
                        <span>فاکتور خرید</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('products');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'products' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <ShoppingBag className="w-4 h-4 text-emerald-600" />
                        <span>مدیریت کالا</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('customers');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'customers' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Users className="w-4 h-4 text-amber-600" />
                        <span>طرف‌های حساب</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('bank_accounts');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'bank_accounts' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Landmark className="w-4 h-4 text-sky-600" />
                        <span>حساب‌های بانکی</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('sales_history');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'sales_history' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <FileText className="w-4 h-4 text-slate-500" />
                        <span>سوابق فاکتورهای فروش</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('purchase_history');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'purchase_history' && devActiveScreen === null ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                        <span>سوابق فاکتورهای خرید</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('accounting_reports');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'accounting_reports' && devActiveScreen === null ? 'bg-blue-600 text-white shadow-xs' : 'text-blue-700 bg-blue-50/70 hover:bg-blue-100'
                        }`}
                      >
                        <BarChart3 className="w-4 h-4" />
                        <span>گزارشات هلو و تراز</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="px-2 py-1 text-[10px] font-black text-emerald-800 bg-emerald-50/70 rounded-lg mb-1 flex items-center justify-between">
                        <span>ماژول‌های خدمات و گارانتی</span>
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      </div>

                      <button
                        onClick={() => {
                          setActiveTab('dashboard');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'dashboard' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Cpu className="w-4 h-4 text-slate-500" />
                        <span>میز کار اصلی کارگاه</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('search');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'search' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Search className="w-4 h-4 text-slate-500" />
                        <span>پیگیری و استعلام قطعه</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('new_claim');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'new_claim' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <PlusCircle className="w-4 h-4 text-slate-500" />
                        <span>پذیرش دستگاه و ثبت عیب</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('queue');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'queue' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Wrench className="w-4 h-4 text-slate-500" />
                        <span>صف تعمیرات کارگاه</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('start_repair');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'start_repair' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Search className="w-4 h-4 text-slate-500" />
                        <span>پرونده‌ها و جستجو</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('reports');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'reports' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <BarChart3 className="w-4 h-4 text-slate-500" />
                        <span>گزارش‌ها و آمار</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('users');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'users' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Users className="w-4 h-4 text-slate-500" />
                        <span>مدیریت کاربران</span>
                      </button>

                      <button
                        onClick={() => {
                          setActiveTab('config');
                          setDevActiveScreen(null);
                          setIsDrawerOpen(false);
                        }}
                        className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                          activeTab === 'config' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Settings className="w-4 h-4 text-slate-500" />
                        <span>تنظیمات کارگاه</span>
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => {
                      setActiveTab('project_backup');
                      setDevActiveScreen(null);
                      setIsDrawerOpen(false);
                    }}
                    className={`w-full py-2 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 transition-all cursor-pointer ${
                      activeTab === 'project_backup' && devActiveScreen === null ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'text-emerald-700 bg-emerald-50/50 hover:bg-emerald-50'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-emerald-600" />
                    <span>نقشه راه و بک‌آ‌پ</span>
                  </button>

                  {/* Last Menu Item: Logout */}
                  <div className="pt-2 mt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        handleLogout();
                        setIsDrawerOpen(false);
                      }}
                      className="w-full py-2.5 px-3 rounded-xl text-right text-xs font-black flex items-center gap-3 text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>خروج از حساب</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Drawer Footer / Simple User Badge */}
              <div className="p-3 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between text-right">
                <div>
                  <span className="text-xs font-black text-slate-800 block">
                    {users.find(u => u.username.toLowerCase() === username.toLowerCase())?.fullName || (username ? `@${username}` : 'کاربر فعال')}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 block">
                    {userRole === 'admin' ? 'مدیر سیستم' : userRole === 'technician' ? 'تعمیرکار' : userRole === 'delivery' ? 'مسئول تحویل' : userRole === 'reception' ? 'پذیرش' : userRole}
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* BARCODE SCANNER SIMULATOR MODAL */}
      <AnimatePresence>
        {saleShowScanner && (
          <div 
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
            onClick={() => setSaleShowScanner(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-white"
              dir="rtl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-slate-850 px-6 py-4.5 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center animate-pulse">
                    <Camera className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white">
                      اسکنر هوشمند بارکد و لیزر کارگاه
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold">
                      شبیه‌ساز تصویر دوربین و سیستم ثبت مسلسل گارانتی
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSaleShowScanner(false)}
                  className="text-slate-400 hover:text-white transition-colors p-1 bg-slate-800 hover:bg-slate-700 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Simulated Lens Viewport */}
                <div className="relative aspect-video rounded-2xl bg-black border border-slate-800 overflow-hidden shadow-inner flex flex-col justify-between p-4 group">
                  {saleCameraStream && (
                    <video 
                      ref={saleVideoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className="absolute inset-0 w-full h-full object-cover z-0"
                    />
                  )}
                  
                  {/* Neon laser scan line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-red-500/85 shadow-[0_0_15px_rgba(239,68,68,1)] top-1/2 -translate-y-1/2 z-10 animate-bounce pointer-events-none" />

                  {/* Camera overlay grids / frame indicators */}
                  <div className="absolute inset-4 border border-dashed border-white/10 rounded-xl pointer-events-none z-0" />
                  <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-emerald-500 pointer-events-none" />
                  <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-emerald-500 pointer-events-none" />
                  <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-emerald-500 pointer-events-none" />
                  <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-emerald-500 pointer-events-none" />

                  {/* REC/Blinking overlay */}
                  <div className="flex justify-between items-center z-10">
                    <span className="text-[9px] font-black tracking-wider text-slate-300 bg-black/60 px-2 py-1 rounded-md flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                      <span>{saleCameraStream ? 'LIVE CAMERA' : 'SCANNER ACTIVE'}</span>
                    </span>
                    <span className="text-[9px] font-black tracking-wider text-slate-300 bg-black/60 px-2 py-1 rounded-md">
                      FPS: 60 • ZOOM: 1.2X
                    </span>
                  </div>

                  {/* Centered crosshair target */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <div className="w-16 h-16 rounded-full border border-red-500/30 flex items-center justify-center animate-pulse">
                      <div className="w-2 h-2 rounded-full bg-red-500" />
                    </div>
                  </div>

                  {/* White Flash overlay on successful scan */}
                  {scannerFlash && (
                    <div className="absolute inset-0 bg-white z-40 pointer-events-none" style={{ opacity: 0.95 }} />
                  )}

                  {/* Bottom HUD message or success alert */}
                  <div className="z-10 text-center bg-black/75 backdrop-blur-xs py-2 px-3 rounded-xl border border-slate-800">
                    {scannerSuccessMessage ? (
                      <p className="text-xs text-emerald-400 font-black flex items-center justify-center gap-1.5 animate-pulse">
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                        <span>{scannerSuccessMessage}</span>
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-400 font-bold">
                        [ دوربین را روی بارکد بگیرید، عکسی را انتخاب کنید یا سریال را وارد نمایید ]
                      </p>
                    )}
                  </div>
                </div>

                {/* File Upload Scan Button */}
                <div>
                  <label className="w-full py-2.5 bg-slate-850 hover:bg-slate-800 text-blue-400 border border-slate-800 hover:border-blue-500/50 rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all">
                    <Upload className="w-4 h-4 text-blue-500" />
                    <span>بارگذاری عکس / تصویر بارکد یا QR کالا</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const code = await scanImageFile(file);
                          if (code) {
                            const res = handleScanSerial(code);
                            if (!res.success) alert(res.message);
                          } else {
                            alert("کد QR یا بارکدی در این تصویر خوانده نشد.");
                          }
                        }
                      }}
                    />
                  </label>
                </div>

                {/* Simulated handheld gun fast entry */}
                <div className="space-y-2 text-right">
                  <span className="text-[10px] font-black text-slate-400 block">شبیه‌ساز دستی و کیبورد (تفنگی فیزیکی)</span>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={scannerMockValue}
                      onChange={(e) => setScannerMockValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (scannerMockValue.trim()) {
                            const res = handleScanSerial(scannerMockValue);
                            if (res.success) {
                              setScannerMockValue('');
                            } else {
                              alert(res.message);
                            }
                          }
                        }
                      }}
                      placeholder="سریال مورد نظر را بنویسید و Enter بزنید..."
                      className="flex-1 px-3 py-2.5 bg-slate-850 border border-slate-800 rounded-xl text-xs font-bold text-white font-mono outline-none focus:border-blue-500 focus:bg-slate-800 text-center transition-all"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (scannerMockValue.trim()) {
                          const res = handleScanSerial(scannerMockValue);
                          if (res.success) {
                            setScannerMockValue('');
                          } else {
                            alert(res.message);
                          }
                        }
                      }}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl cursor-pointer"
                    >
                      ثبت شلیک
                    </button>
                  </div>
                </div>

                {/* Instant Tap simulated barcodes */}
                <div className="space-y-3">
                  <span className="text-[10px] font-black text-slate-400 block text-right">
                    بارکدهای روی جعبه {saleSelectedProduct ? `کالای منتخب (${saleSelectedProduct.name})` : 'محصولات کارگاه'} جهت تست سریع:
                  </span>
                  
                  <div className="grid grid-cols-2 gap-2.5">
                    {/* Let's generate 4 dynamic barcodes based on selected product or default ones */}
                    {(saleSelectedProduct 
                      ? [
                          `${saleSelectedProduct.model}-${Math.floor(1000 + Math.random() * 9000)}`,
                          `${saleSelectedProduct.model}-${Math.floor(1000 + Math.random() * 9000)}`,
                          `${saleSelectedProduct.model}-${Math.floor(1000 + Math.random() * 9000)}`,
                          `${saleSelectedProduct.model}-${Math.floor(1000 + Math.random() * 9000)}`
                        ]
                      : ['DU4700-1920', 'DEC-1209-A', 'W-4820-K', 'TS-9011-P']
                    ).map((code, idx) => {
                      const isAdded = saleSerials.includes(code);
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={isAdded}
                          onClick={() => handleScanSerial(code)}
                          className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between gap-2 cursor-pointer ${
                            isAdded
                              ? 'bg-slate-950/40 border-slate-850/50 text-slate-500 cursor-not-allowed select-none opacity-50'
                              : 'bg-slate-850 hover:bg-slate-800 border-slate-800 hover:border-blue-600 text-slate-200'
                          }`}
                        >
                          <div className="flex justify-between items-center w-full">
                            <span className="text-[8px] font-black text-slate-400 uppercase">کالای شماره {idx + 1}</span>
                            <span className="text-[8px] font-black text-blue-500">⚡ اسکن با شلیک لیزر</span>
                          </div>
                          
                          {/* Simulated Barcode Stripes */}
                          <div className="h-6 bg-slate-900 border border-slate-800 rounded flex items-center justify-around px-2 py-1 overflow-hidden" dir="ltr">
                            {[2, 4, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 4, 1, 2].map((weight, bIdx) => (
                              <div 
                                key={bIdx} 
                                className="bg-white h-full" 
                                style={{ width: `${weight}px` }} 
                              />
                            ))}
                          </div>
                          
                          <span className="text-xs font-black font-mono tracking-wider block text-center mt-1">
                            {code}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Helpful Instruction */}
                <div className="bg-slate-850 border border-slate-800 rounded-2xl p-3.5 text-right space-y-1 text-[11px] leading-relaxed text-slate-300">
                  <p className="font-black text-slate-200 flex items-center gap-1">
                    <span className="text-emerald-400">🔊</span>
                    <span>تولید خودکار بوق لیزر (Beep):</span>
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
                    سیستم مجهز به تولید فرکانس صوتی ۱۹۰۰ هرتز است تا پس از هر اسکن موفق صدای رضایت‌بخش شلیک لیزر به گوش برسد. شماره سریال‌ها بلافاصله به عنوان کارهای فروخته شده و تحت گارانتی این فاکتور ثبت شده و در جدول چرخه قرار می‌گیرند.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="bg-slate-850 p-4 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSaleShowScanner(false)}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-md"
                >
                  تایید و اتمام اسکنر ({saleSerials.length} دستگاه در چرخه)
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* THERMAL RECEIPT PRINT PREVIEW MODAL */}
      <AnimatePresence>
        {showThermalPreview && saleSelectedCustomer && (saleItems.length > 0 || (saleSelectedProduct && saleSerials.length > 0)) && (() => {
          const receiptItems = [...saleItems];
          if (saleSelectedProduct && saleSerials.length > 0) {
            const priceToSave = salePrice.trim() || saleSelectedProduct.suggestedPrice;
            receiptItems.push({
              product: saleSelectedProduct,
              serials: [...saleSerials],
              unitPrice: parsePersianOrFormattedNumber(priceToSave),
              unitPriceStr: priceToSave
            });
          }
          
          const receiptTotalSum = receiptItems.reduce((acc, item) => acc + (item.serials.length * item.unitPrice), 0);
          const receiptDiscount = parsePersianOrFormattedNumber(saleDiscount);
          const receiptPayable = Math.max(0, receiptTotalSum - receiptDiscount);
          const receiptAllSerials = receiptItems.reduce<string[]>((acc, item) => [...acc, ...item.serials], []);

          return (
            <div 
              className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
              onClick={() => setShowThermalPreview(false)}
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-white rounded-3xl w-full max-w-md border border-slate-200/80 shadow-2xl overflow-hidden flex flex-col my-8"
                dir="rtl"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="bg-slate-50 px-5 py-4 border-b border-slate-200/80 flex justify-between items-center shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                      <Printer className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-slate-900">پیش‌نمایش فیش حرارتی</h3>
                      <p className="text-[10px] text-slate-400 font-bold">فرمت چاپی استاندارد ۸۰ میلی‌متری (صندوق کارگاه)</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowThermalPreview(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Modal Body containing simulated receipt roll paper */}
                <div className="p-6 bg-slate-100 overflow-y-auto max-h-[60vh] flex flex-col items-center">
                  
                  {/* Thermal Receipt Body */}
                  <div className="w-full bg-white border border-zinc-200 shadow-md p-5 text-zinc-800 font-mono text-xs relative select-none" style={{ fontFamily: 'monospace, "JetBrains Mono"' }}>
                    
                    {/* Jagged / Tear-off cut line simulation top */}
                    <div className="absolute -top-2 left-0 right-0 h-2 bg-gradient-to-b from-transparent to-white pointer-events-none"></div>
                    
                    {/* Receipt Header */}
                    <div className="text-center space-y-1 pb-4 border-b border-dashed border-zinc-300">
                      <div className="text-xs font-black text-black">سامانه خدمات پس از فروش دیاکو</div>
                      <div className="text-[10px] text-zinc-500 font-bold">بزرگترین مرکز گارانتی و تعمیرات بردهای الکترونیکی</div>
                      <div className="text-[9px] text-zinc-400 font-bold">تلفن: ۰۲۱-۸۸۸۸۴۴۴۴</div>
                      <div className="pt-2 text-xs font-black text-black tracking-widest">--- فیش گارانتی و فروش کالا ---</div>
                    </div>

                    {/* Receipt Info Fields */}
                    <div className="py-4 space-y-1.5 text-[11px] border-b border-dashed border-zinc-300">
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-bold">شماره فیش:</span>
                        <span className="font-bold text-black font-mono">SL-{saleInvoiceNumber || `14050407-${Math.floor(100 + Math.random() * 900)}`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-bold">تاریخ ثبت:</span>
                        <span className="font-bold text-black font-mono">{saleDate}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-bold">طرف حساب / خریدار:</span>
                        <span className="font-bold text-black">{saleSelectedCustomer.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-500 font-bold">تلفن تماس:</span>
                        <span className="font-bold text-black font-mono">{saleSelectedCustomer.phone}</span>
                      </div>
                    </div>

                    {/* Receipt Product Information */}
                    <div className="py-4 space-y-2 text-[11px] border-b border-dashed border-zinc-300 text-right">
                      <div className="flex justify-between text-xs font-black text-black pb-1.5 border-b border-zinc-100">
                        <span>شرح کالا / خدمات</span>
                        <span>تعداد</span>
                      </div>
                      {receiptItems.map((item, rIdx) => (
                        <div key={rIdx} className="flex justify-between items-start gap-4 py-1.5 border-b border-dotted border-zinc-250 last:border-0">
                          <div className="space-y-0.5">
                            <span className="font-black text-black block">{item.product.name}</span>
                            <span className="text-[10px] text-zinc-500 font-bold block">مدل: {item.product.model}</span>
                            <span className="text-[10px] text-emerald-600 font-bold block">گارانتی: {item.product.warrantyDuration} ماه</span>
                            <span className="text-[10px] text-zinc-400 font-mono block">قیمت واحد: {item.unitPriceStr}</span>
                          </div>
                          <span className="font-bold font-mono text-xs text-black">{item.serials.length}x</span>
                        </div>
                      ))}
                      
                      <div className="flex justify-between pt-2 border-t border-dotted border-zinc-200">
                        <span className="text-zinc-500 font-bold">جمع کل اقلام:</span>
                        <span className="font-bold font-mono text-black">{formatToPersianPrice(receiptTotalSum)}</span>
                      </div>
                      {receiptDiscount > 0 && (
                        <div className="flex justify-between text-rose-600">
                          <span className="font-bold">تخفیف:</span>
                          <span className="font-bold font-mono">-{formatToPersianPrice(receiptDiscount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-xs font-black text-black pt-1">
                        <span>مبلغ نهایی فاکتور:</span>
                        <span className="font-mono text-indigo-700 underline">{formatToPersianPrice(receiptPayable)}</span>
                      </div>
                    </div>

                    {/* Serials & Barcodes List */}
                    <div className="py-4 space-y-4">
                      <div className="text-[10.5px] font-black text-black border-b border-zinc-200 pb-1 flex items-center justify-between">
                        <span>لیست شماره سریال‌های گارانتی</span>
                        <span className="text-[9px] bg-zinc-100 px-1.5 py-0.5 rounded text-zinc-600 font-bold">شناسه سخت‌افزاری</span>
                      </div>

                      <div className="space-y-3">
                        {receiptAllSerials.map((serial, idx) => {
                          // Generate pseudo-barcode pattern using vertical barcode lines
                          const seedStr = serial.toUpperCase();
                          let totalVal = 0;
                          for (let i = 0; i < seedStr.length; i++) {
                            totalVal += seedStr.charCodeAt(i);
                          }
                          const barcodeBars = [];
                          for (let i = 0; i < 28; i++) {
                            // generate semi-deterministic bar widths
                            const width = ((totalVal + i * 17) % 3) + 1;
                            barcodeBars.push(width);
                          }

                          return (
                            <div key={idx} className="flex flex-col items-center bg-zinc-50 p-2.5 rounded-lg border border-zinc-200 text-center space-y-1.5">
                              <span className="text-[9px] text-zinc-400 font-bold">بارکد فعالسازی گارانتی {idx + 1}</span>
                              
                              {/* Stylized Simulated Barcode */}
                              <div className="h-9 w-44 flex items-center justify-center bg-white px-2 border border-zinc-300">
                                <div className="flex gap-0.5 items-stretch h-full py-1">
                                  {barcodeBars.map((w, barIdx) => (
                                    <div 
                                      key={barIdx} 
                                      className="bg-black" 
                                      style={{ width: `${w}px` }} 
                                    />
                                  ))}
                                </div>
                              </div>

                              <span className="text-[11px] font-black font-mono tracking-widest text-black">
                                {serial}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Receipt Footer Terms */}
                    <div className="pt-4 border-t border-dashed border-zinc-300 text-center space-y-2 text-[10px] text-zinc-500 leading-relaxed font-bold">
                      <p>
                        کاربر گرامی، این فیش به عنوان تاییدیه رسمی فعالسازی گارانتی صادر شده است. لطفاً آن را جهت دریافت خدمات در کارگاه مرکزی دیاکو نگهداری نمایید.
                      </p>
                      
                      {/* Simulated QR Code scan-box */}
                      <div className="w-16 h-16 border border-zinc-300 rounded mx-auto p-1 bg-white flex items-center justify-center">
                        <div className="grid grid-cols-4 gap-0.5 w-full h-full">
                          {Array.from({ length: 16 }).map((_, i) => (
                            <div 
                              key={i} 
                              className={`rounded-xs ${(i * 7 + 13) % 5 === 0 || i % 3 === 0 ? 'bg-black' : 'bg-transparent'}`}
                            />
                          ))}
                        </div>
                      </div>
                      
                      <p className="text-[9px] text-zinc-400 font-mono">طراحی شده برای پرینترهای حرارتی ۸۰ میلی‌متری</p>
                    </div>

                    {/* Jagged / Tear-off cut line simulation bottom */}
                    <div className="absolute -bottom-2 left-0 right-0 h-2 bg-gradient-to-t from-transparent to-white pointer-events-none"></div>

                  </div>

                </div>

                {/* Modal Footer Controls */}
                <div className="p-4 bg-slate-50 border-t border-slate-200/80 flex flex-col sm:flex-row gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowThermalPreview(false);
                      alert(`دستور چاپ فیش حرارتی به پرینتر ۸۰ میلی‌متری متصل به غرفه ارسال شد.\nسند چاپی حاوی ${receiptAllSerials.length} دستگاه به همراه اطلاعات طرف حساب "${saleSelectedCustomer.name}" می‌باشد.`);
                    }}
                    className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                  >
                    <Printer className="w-4 h-4 text-emerald-400" />
                    <span>تایید و ارسال فرمان به پرینتر غرفه</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowThermalPreview(false)}
                    className="py-3 px-5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-black text-xs rounded-xl transition-all cursor-pointer text-center active:scale-98"
                  >
                    انصراف و اصلاح فاکتور
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* DEVELOPMENT FLOATING NAVIGATION SYSTEM */}
      <DevDashboardDrawer
        devActiveScreen={devActiveScreen}
        setDevActiveScreen={setDevActiveScreen}
        isDevModeOpen={isDevModeOpen}
        setIsDevModeOpen={setIsDevModeOpen}
        customers={customers}
        setCustomers={setCustomers}
        suppliers={suppliers}
        setSuppliers={setSuppliers}
        purchases={purchases}
        setPurchases={setPurchases}
        inventory={inventory}
        setInventory={setInventory}
        sales={sales}
        setSales={setSales}
        products={products}
        setProducts={setProducts}
        warrantyDb={warrantyDb}
        setWarrantyDb={setWarrantyDb}
        users={users}
        setUsers={setUsers}
        userRole={userRole}
        setUserRole={setUserRole}
        isOnline={isOnline}
        setIsOnline={setIsOnline}
        setActiveTab={setActiveTab}
        setQueueFilter={setQueueFilter}
        setIsAuthenticated={setIsAuthenticated}
        setIsSetupCompleted={setIsSetupCompleted}
      />

      {/* GLOBAL TOAST NOTIFICATION */}
      <AnimatePresence>
        {toastState && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl text-xs font-black flex items-center gap-2 border text-white ${
              toastState.type === 'success' ? 'bg-emerald-600 border-emerald-500' :
              toastState.type === 'error' ? 'bg-rose-600 border-rose-500' :
              'bg-slate-900 border-slate-700'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>{toastState.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
