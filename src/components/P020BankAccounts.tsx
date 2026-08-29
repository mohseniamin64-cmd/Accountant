import React, { useState } from 'react';
import { 
  Building2, 
  CreditCard, 
  Plus, 
  Search, 
  Copy, 
  Check, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Wallet, 
  QrCode, 
  Building,
  Landmark,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  ArrowUpRight,
  ChevronDown,
  Info
} from 'lucide-react';
import { BankAccount } from '../types';

interface P020BankAccountsProps {
  bankAccounts: BankAccount[];
  setBankAccounts: React.Dispatch<React.SetStateAction<BankAccount[]>>;
  showToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  userRole?: string;
}

const PRESET_BANKS = [
  { name: 'بانک ملت', color: 'from-rose-500 to-red-700', badgeColor: 'bg-rose-100 text-rose-800 border-rose-200', iconColor: 'text-rose-600' },
  { name: 'بانک سامان', color: 'from-sky-500 to-blue-700', badgeColor: 'bg-sky-100 text-sky-800 border-sky-200', iconColor: 'text-sky-600' },
  { name: 'بانک پاسارگاد', color: 'from-amber-500 to-yellow-600', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200', iconColor: 'text-amber-600' },
  { name: 'بانک ملی', color: 'from-emerald-500 to-teal-700', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200', iconColor: 'text-emerald-600' },
  { name: 'بانک صادرات', color: 'from-blue-600 to-indigo-800', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200', iconColor: 'text-indigo-600' },
  { name: 'بانک تجارت', color: 'from-cyan-500 to-blue-600', badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200', iconColor: 'text-cyan-600' },
  { name: 'بانک سپه', color: 'from-slate-600 to-slate-800', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200', iconColor: 'text-slate-600' },
  { name: 'بانک پارسیان', color: 'from-purple-500 to-violet-700', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200', iconColor: 'text-purple-600' },
  { name: 'بلوبانک', color: 'from-blue-500 to-blue-700', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200', iconColor: 'text-blue-600' },
  { name: 'بانک شهر', color: 'from-pink-500 to-rose-600', badgeColor: 'bg-pink-100 text-pink-800 border-pink-200', iconColor: 'text-pink-600' },
  { name: 'بانک کشاورزی', color: 'from-green-600 to-emerald-800', badgeColor: 'bg-green-100 text-green-800 border-green-200', iconColor: 'text-green-600' },
];

export const P020BankAccounts: React.FC<P020BankAccountsProps> = ({
  bankAccounts,
  setBankAccounts,
  showToast,
  userRole = 'admin'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'inactive' | 'pos'>('all');
  const [copiedFieldId, setCopiedFieldId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);

  // Form Fields
  const [bankName, setBankName] = useState('بانک ملت');
  const [customBankName, setCustomBankName] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [shebaNumber, setShebaNumber] = useState('');
  const [branchName, setBranchName] = useState('');
  const [accountType, setAccountType] = useState('جاری');
  const [balance, setBalance] = useState<number>(0);
  const [posConnected, setPosConnected] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  // Delete modal state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatMoney = (num: number) => {
    return new Intl.NumberFormat('fa-IR').format(num);
  };

  const handleCopy = (text: string, label: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedFieldId(id);
    showToast(`${label} کپی شد`, 'success');
    setTimeout(() => {
      setCopiedFieldId(null);
    }, 2000);
  };

  const handleOpenAddModal = () => {
    setEditingAccount(null);
    setBankName('بانک ملت');
    setCustomBankName('');
    setAccountHolder('');
    setAccountNumber('');
    setCardNumber('');
    setShebaNumber('');
    setBranchName('');
    setAccountType('جاری');
    setBalance(0);
    setPosConnected(true);
    setIsActive(true);
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (acc: BankAccount) => {
    setEditingAccount(acc);
    const isPreset = PRESET_BANKS.some(b => b.name === acc.bankName);
    if (isPreset) {
      setBankName(acc.bankName);
      setCustomBankName('');
    } else {
      setBankName('سایر / اختصاصی');
      setCustomBankName(acc.bankName);
    }
    setAccountHolder(acc.accountHolder || '');
    setAccountNumber(acc.accountNumber || '');
    setCardNumber(acc.cardNumber || '');
    setShebaNumber(acc.shebaNumber || '');
    setBranchName(acc.branchName || '');
    setAccountType(acc.accountType || 'جاری');
    setBalance(acc.balance || 0);
    setPosConnected(acc.posConnected ?? true);
    setIsActive(acc.isActive ?? true);
    setNotes(acc.notes || '');
    setIsModalOpen(true);
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const finalBankName = bankName === 'سایر / اختصاصی' ? customBankName.trim() : bankName;

    if (!finalBankName) {
      return showToast('لطفاً نام بانک را مشخص کنید.', 'error');
    }
    if (!accountHolder.trim()) {
      return showToast('لطفاً نام صاحب حساب را وارد کنید.', 'error');
    }
    if (!accountNumber.trim()) {
      return showToast('لطفاً شماره حساب را وارد کنید.', 'error');
    }

    // Format Sheba if provided without IR
    let formattedSheba = shebaNumber.trim();
    if (formattedSheba && !formattedSheba.toUpperCase().startsWith('IR')) {
      formattedSheba = `IR${formattedSheba}`;
    }

    if (editingAccount) {
      // Edit
      setBankAccounts(prev => prev.map(a => a.id === editingAccount.id ? {
        ...a,
        bankName: finalBankName,
        accountHolder: accountHolder.trim(),
        accountNumber: accountNumber.trim(),
        cardNumber: cardNumber.trim(),
        shebaNumber: formattedSheba,
        branchName: branchName.trim(),
        accountType,
        balance: Number(balance) || 0,
        posConnected,
        isActive,
        notes: notes.trim()
      } : a));
      showToast('مشخصات حساب بانکی با موفقیت به‌روزرسانی شد.', 'success');
    } else {
      // Add
      const newAcc: BankAccount = {
        id: `BNK-${Date.now().toString().slice(-4)}`,
        bankName: finalBankName,
        accountHolder: accountHolder.trim(),
        accountNumber: accountNumber.trim(),
        cardNumber: cardNumber.trim(),
        shebaNumber: formattedSheba,
        branchName: branchName.trim(),
        accountType,
        balance: Number(balance) || 0,
        currency: 'تومان',
        isActive,
        posConnected,
        notes: notes.trim(),
        createdAt: new Date().toLocaleDateString('fa-IR')
      };
      setBankAccounts(prev => [newAcc, ...prev]);
      showToast('حساب بانکی جدید با موفقیت اضافه شد.', 'success');
    }

    setIsModalOpen(false);
  };

  const handleToggleActive = (id: string) => {
    setBankAccounts(prev => prev.map(a => {
      if (a.id === id) {
        const updated = !a.isActive;
        showToast(updated ? 'حساب بانکی فعال شد.' : 'حساب بانکی غیرفعال شد.', 'info');
        return { ...a, isActive: updated };
      }
      return a;
    }));
  };

  const handleDeleteAccount = (id: string) => {
    setBankAccounts(prev => prev.filter(a => a.id !== id));
    setDeletingId(null);
    showToast('حساب بانکی حذف شد.', 'success');
  };

  // Filtered Accounts
  const filteredAccounts = bankAccounts.filter(acc => {
    const matchesSearch = 
      acc.bankName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.accountHolder.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.accountNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (acc.cardNumber && acc.cardNumber.includes(searchQuery)) ||
      (acc.shebaNumber && acc.shebaNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (acc.branchName && acc.branchName.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterTab === 'active') return acc.isActive;
    if (filterTab === 'inactive') return !acc.isActive;
    if (filterTab === 'pos') return acc.posConnected;

    return true;
  });

  // Totals
  const totalAccountsCount = bankAccounts.length;
  const activeAccountsCount = bankAccounts.filter(a => a.isActive).length;
  const inactiveAccountsCount = bankAccounts.filter(a => !a.isActive).length;
  const posConnectedCount = bankAccounts.filter(a => a.posConnected && a.isActive).length;
  const totalActiveBalance = bankAccounts
    .filter(a => a.isActive)
    .reduce((sum, a) => sum + (a.balance || 0), 0);

  const getBankStyle = (bankName: string) => {
    const found = PRESET_BANKS.find(b => b.name === bankName);
    if (found) return found;
    return {
      name: bankName,
      color: 'from-slate-600 to-slate-800',
      badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
      iconColor: 'text-slate-600'
    };
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shadow-inner shrink-0">
              <Landmark className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-white">مدیریت حساب‌های بانکی</h1>
                <span className="bg-blue-500/20 text-blue-300 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-blue-400/30">
                  خزانه و مالی
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                تعریف، ویرایش و مدیریت تمامی حساب‌های فعال و غیرفعال، دستگاه‌های پوز و شماره شبای فروشگاه
              </p>
            </div>
          </div>

          <button
            onClick={handleOpenAddModal}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md transition-all duration-200 flex items-center gap-2 cursor-pointer active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>افزودن حساب بانکی جدید</span>
          </button>
        </div>

        {/* Stats Grid inside Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/60 backdrop-blur-md p-3.5 rounded-2xl border border-slate-700/50">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold mb-1">
              <span>کل حساب‌ها</span>
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-lg font-black text-white">{totalAccountsCount} <span className="text-xs font-normal text-slate-400">حساب</span></div>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-md p-3.5 rounded-2xl border border-slate-700/50">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold mb-1">
              <span>حساب‌های فعال</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-black text-emerald-400">{activeAccountsCount} <span className="text-xs font-normal text-slate-400">فعال</span></div>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-md p-3.5 rounded-2xl border border-slate-700/50">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold mb-1">
              <span>موجودی کل فعال</span>
              <Wallet className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-base font-black text-amber-300">
              {formatMoney(totalActiveBalance)} <span className="text-[10px] font-normal text-slate-400">تومان</span>
            </div>
          </div>

          <div className="bg-slate-800/60 backdrop-blur-md p-3.5 rounded-2xl border border-slate-700/50">
            <div className="flex items-center justify-between text-slate-400 text-[11px] font-bold mb-1">
              <span>دستگاه پوز متصل</span>
              <CreditCard className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-lg font-black text-purple-300">{posConnectedCount} <span className="text-xs font-normal text-slate-400">کارتخوان</span></div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="جستجو بر اساس نام بانک، صاحب حساب، کارت یا شبا..."
            className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 ${
              filterTab === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            همه حساب‌ها ({totalAccountsCount})
          </button>
          <button
            onClick={() => setFilterTab('active')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 ${
              filterTab === 'active' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            فعال ({activeAccountsCount})
          </button>
          <button
            onClick={() => setFilterTab('inactive')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 ${
              filterTab === 'inactive' ? 'bg-slate-700 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            غیرفعال ({inactiveAccountsCount})
          </button>
          <button
            onClick={() => setFilterTab('pos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer shrink-0 ${
              filterTab === 'pos' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            متصل به پوز ({posConnectedCount})
          </button>
        </div>
      </div>

      {/* Account Cards Grid */}
      {filteredAccounts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-3">
            <CreditCard className="w-8 h-8" />
          </div>
          <h3 className="text-base font-black text-slate-800">هیچ حساب بانکی پیدا نشد</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {searchQuery ? 'با عبارت جستجوی وارد شده حسابی یافت نشد.' : 'هنوز هیچ حساب بانکی در سیستم ثبت نشده است. جهت اضافه کردن اولین حساب روی دکمه زیر کلیک کنید.'}
          </p>
          {!searchQuery && (
            <button
              onClick={handleOpenAddModal}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>افزودن حساب بانکی</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredAccounts.map((acc) => {
            const bankStyle = getBankStyle(acc.bankName);
            return (
              <div 
                key={acc.id}
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-xs hover:shadow-md overflow-hidden flex flex-col justify-between ${
                  acc.isActive ? 'border-slate-200' : 'border-slate-200 bg-slate-50/50 opacity-75'
                }`}
              >
                {/* Card Top Branding Header */}
                <div className={`bg-gradient-to-r ${bankStyle.color} text-white p-4 relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
                  <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border border-white/30 shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-white">{acc.bankName}</h3>
                        <p className="text-[10px] text-white/80 font-medium">
                          {acc.branchName || 'شعبه مرکزی'} {acc.accountType ? `• ${acc.accountType}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {acc.posConnected && (
                        <span className="bg-white/20 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-lg border border-white/30 flex items-center gap-1" title="متصل به دستگاه کارتخوان پوز">
                          <QrCode className="w-3 h-3" />
                          <span>پوز</span>
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        acc.isActive 
                          ? 'bg-emerald-500/20 text-emerald-100 border-emerald-300/40' 
                          : 'bg-slate-500/30 text-slate-200 border-slate-400/40'
                      }`}>
                        {acc.isActive ? 'فعال' : 'غیرفعال'}
                      </span>
                    </div>
                  </div>

                  {/* Account Holder */}
                  <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between">
                    <span className="text-[11px] text-white/70 font-medium">صاحب حساب:</span>
                    <span className="text-xs font-black text-white">{acc.accountHolder}</span>
                  </div>
                </div>

                {/* Card Content Details */}
                <div className="p-4 space-y-3 text-xs">
                  {/* Account Number */}
                  <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <span className="text-slate-500 text-[11px] font-bold">شماره حساب:</span>
                    <div className="flex items-center gap-2 font-mono font-black text-slate-800">
                      <span>{acc.accountNumber}</span>
                      <button
                        onClick={() => handleCopy(acc.accountNumber, 'شماره حساب', `acc-${acc.id}`)}
                        className="text-slate-400 hover:text-blue-600 transition-colors p-1 cursor-pointer"
                        title="کپی شماره حساب"
                      >
                        {copiedFieldId === `acc-${acc.id}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Card Number */}
                  {acc.cardNumber && (
                    <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <span className="text-slate-500 text-[11px] font-bold flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                        <span>شماره کارت:</span>
                      </span>
                      <div className="flex items-center gap-2 font-mono font-black text-blue-900 text-xs dir-ltr">
                        <span>{acc.cardNumber}</span>
                        <button
                          onClick={() => handleCopy(acc.cardNumber || '', 'شماره کارت', `card-${acc.id}`)}
                          className="text-slate-400 hover:text-blue-600 transition-colors p-1 cursor-pointer"
                          title="کپی شماره کارت"
                        >
                          {copiedFieldId === `card-${acc.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sheba IBAN Number */}
                  {acc.shebaNumber && (
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold">
                        <span>شماره شبا (IBAN):</span>
                        <button
                          onClick={() => handleCopy(acc.shebaNumber || '', 'شماره شبا', `sheba-${acc.id}`)}
                          className="text-blue-600 hover:text-blue-800 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          {copiedFieldId === `sheba-${acc.id}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span className="text-emerald-600">کپی شد</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>کپی شبا</span>
                            </>
                          )}
                        </button>
                      </div>
                      <div className="font-mono font-bold text-[11px] text-slate-700 dir-ltr text-left break-all select-all">
                        {acc.shebaNumber}
                      </div>
                    </div>
                  )}

                  {/* Balance Display */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-500 text-[11px] font-bold">موجودی ثبت شده:</span>
                    <span className="text-sm font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      {formatMoney(acc.balance || 0)} <span className="text-[10px] font-normal text-emerald-600">تومان</span>
                    </span>
                  </div>

                  {acc.notes && (
                    <p className="text-[11px] text-slate-500 bg-amber-50/60 border border-amber-200/50 p-2 rounded-xl">
                      💡 {acc.notes}
                    </p>
                  )}
                </div>

                {/* Card Footer Actions */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(acc.id)}
                      className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                        acc.isActive 
                          ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' 
                          : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                      }`}
                    >
                      {acc.isActive ? (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span>غیرفعال‌سازی</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>فعال‌سازی</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEditModal(acc)}
                      className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="ویرایش حساب"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeletingId(acc.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="حذف حساب"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Bank Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/30 border border-blue-400/40 flex items-center justify-center text-blue-300">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-white">
                    {editingAccount ? 'ویرایش مشخصات حساب بانکی' : 'افزودن حساب بانکی جدید'}
                  </h3>
                  <p className="text-[11px] text-slate-300">اطلاعات حساب بانکی و کارتخوان فروشگاه را وارد کنید</p>
                </div>
              </div>

              <button
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveAccount} className="p-6 space-y-4 text-xs">
              {/* Bank Name Selector */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">انتخاب بانک *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-2">
                  {PRESET_BANKS.map((b) => (
                    <button
                      type="button"
                      key={b.name}
                      onClick={() => { setBankName(b.name); setCustomBankName(''); }}
                      className={`p-2 rounded-xl border text-right transition-all flex items-center gap-2 cursor-pointer ${
                        bankName === b.name
                          ? 'bg-blue-50 border-blue-500 text-blue-900 font-black shadow-2xs ring-1 ring-blue-400'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${b.iconColor.replace('text-', 'bg-')}`} />
                      <span className="truncate">{b.name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setBankName('سایر / اختصاصی')}
                    className={`p-2 rounded-xl border text-right transition-all flex items-center gap-2 cursor-pointer ${
                      bankName === 'سایر / اختصاصی'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 font-black shadow-2xs ring-1 ring-blue-400'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                    <span className="truncate">سایر بانک‌ها</span>
                  </button>
                </div>

                {bankName === 'سایر / اختصاصی' && (
                  <input
                    type="text"
                    value={customBankName}
                    onChange={e => setCustomBankName(e.target.value)}
                    placeholder="نام بانک را تایپ کنید (مثلاً بانک سامان، بلوبانک...)"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-blue-400 focus:border-blue-600 rounded-xl font-bold text-slate-800 outline-none transition-all"
                  />
                )}
              </div>

              {/* Account Holder & Account Number */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">نام صاحب حساب *</label>
                  <input
                    type="text"
                    required
                    value={accountHolder}
                    onChange={e => setAccountHolder(e.target.value)}
                    placeholder="مثلاً: دیاکو الکترونیک یا علی احمدی"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl font-bold text-slate-800 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">شماره حساب *</label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={e => setAccountNumber(e.target.value)}
                    placeholder="مثلاً: 8841029311"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl font-bold text-slate-800 outline-none transition-all font-mono"
                  />
                </div>
              </div>

              {/* Card Number & Branch Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">شماره کارت (۱۶ رقمی)</label>
                  <input
                    type="text"
                    maxLength={19}
                    value={cardNumber}
                    onChange={e => setCardNumber(e.target.value)}
                    placeholder="6104-3378-9012-4450"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl font-bold text-slate-800 outline-none transition-all font-mono dir-ltr"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">نام / کد شعبه</label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={e => setBranchName(e.target.value)}
                    placeholder="مثلاً: شعبه ولیعصر - کد ۶۵۱۲"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl font-bold text-slate-800 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Sheba IBAN Number */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">شماره شبا (IBAN)</label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={34}
                    value={shebaNumber}
                    onChange={e => setShebaNumber(e.target.value)}
                    placeholder="IR80 0120 0000 0008 8410 2931 10"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl font-bold text-slate-800 outline-none transition-all font-mono dir-ltr"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold">۲۴ رقم شبا</span>
                </div>
              </div>

              {/* Account Type & Initial Balance */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">نوع حساب</label>
                  <select
                    value={accountType}
                    onChange={e => setAccountType(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl font-bold text-slate-800 outline-none transition-all cursor-pointer"
                  >
                    <option value="جاری">حساب جاری</option>
                    <option value="قرض‌الحسنه">حساب قرض‌الحسنه</option>
                    <option value="کوتاه مدت">حساب کوتاه مدت</option>
                    <option value="بلند مدت">حساب بلند مدت</option>
                    <option value="پس‌انداز">حساب پس‌انداز</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">موجودی اولیه (تومان)</label>
                  <input
                    type="number"
                    min={0}
                    value={balance}
                    onChange={e => setBalance(Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl font-bold text-slate-800 outline-none transition-all"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {balance > 0 ? `معادل: ${formatMoney(balance)} تومان` : ''}
                  </span>
                </div>
              </div>

              {/* Toggles: POS & Active */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={posConnected}
                    onChange={e => setPosConnected(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">متصل به کارتخوان (POS)</span>
                    <span className="text-[10px] text-slate-500">حساب دریافت کِش و واریزی دستگاه کارتخوان فروشگاه</span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/70 transition-colors">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={e => setIsActive(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold text-slate-800 block">وضعیت حساب فعال</span>
                    <span className="text-[10px] text-slate-500">قابل استفاده در فاکتورها و دریافت/پرداخت‌ها</span>
                  </div>
                </label>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">توضیحات تکمیلی</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="یادداشت‌های مرتبط با این حساب..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:border-blue-600 focus:bg-white rounded-xl font-medium text-slate-800 outline-none transition-all"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer"
                >
                  {editingAccount ? 'ذخیره تغییرات' : 'ثبت حساب بانکی'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 w-full max-w-sm text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-black text-slate-800">حذف حساب بانکی</h3>
            <p className="text-xs text-slate-600">
              آیا از حذف این حساب بانکی اطمینان دارید؟ این عمل غیرقابل بازگشت است.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
              >
                انصراف
              </button>
              <button
                onClick={() => handleDeleteAccount(deletingId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                تایید و حذف
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
