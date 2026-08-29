import React, { useState, useEffect } from 'react';
import { 
  User, 
  Coins, 
  Trash2, 
  RotateCcw, 
  AlertTriangle, 
  Edit2, 
  Info,
  CheckCircle,
  Clock,
  ChevronDown
} from 'lucide-react';
import { SaleRecord, SaleItem, WarrantyItem } from '../types';

interface P016SalesActionsProps {
  selectedSale: SaleRecord;
  warrantyDb: WarrantyItem[];
  modalView: 'details' | 'edit' | 'cancel' | 'return';
  setModalView: (view: 'details' | 'edit' | 'cancel' | 'return') => void;
  onSaveEdit: (updatedSale: SaleRecord) => void;
  onConfirmCancel: (cancelInfo: { reason: string; date: string; notes: string }) => void;
  onConfirmReturn: (returnInfo: {
    serials: string[];
    date: string;
    reason: string;
    notes: string;
    refundAmount: number;
    refundStatus: 'paid' | 'unpaid';
  }) => void;
  onClose: () => void;
}

// Convert string/English numbers to Persian numbers
const toPersianDigits = (str: string | number) => {
  if (str === undefined || str === null) return '';
  const id = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.toString().replace(/[0-9]/g, (w) => id[+w]);
};

// Utility to format price to Persian Toman
const formatToPersianPrice = (value: number | string) => {
  if (!value) return '۰ تومان';
  const num = typeof value === 'string' ? parseInt(value.replace(/[^\d]/g, '')) : value;
  if (isNaN(num)) return '۰ تومان';
  return num.toLocaleString('fa-IR') + ' تومان';
};

export function P016SalesActions({
  selectedSale,
  warrantyDb,
  modalView,
  setModalView,
  onSaveEdit,
  onConfirmCancel,
  onConfirmReturn,
  onClose
}: P016SalesActionsProps) {

  // --- EDIT FORM STATES ---
  const [editCustomerName, setEditCustomerName] = useState<string>('');
  const [editCustomerPhone, setEditCustomerPhone] = useState<string>('');
  const [editCustomerType, setEditCustomerType] = useState<string>('person');
  const [editCustomerEmail, setEditCustomerEmail] = useState<string>('');
  const [editCustomerAddress, setEditCustomerAddress] = useState<string>('');
  const [editSaleDate, setEditSaleDate] = useState<string>('');
  const [editPaymentMethod, setEditPaymentMethod] = useState<string>('نقدی');
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editNotes, setEditNotes] = useState<string>('');
  const [editItems, setEditItems] = useState<SaleItem[]>([]);

  // --- CANCEL FORM STATES ---
  const [cancelReason, setCancelReason] = useState<string>('ثبت اشتباه فاکتور');
  const [cancelDate, setCancelDate] = useState<string>('۱۴۰۵/۰۴/۰۷');
  const [cancelNotes, setCancelNotes] = useState<string>('');

  // --- RETURN FORM STATES ---
  const [selectedSerialsToReturn, setSelectedSerialsToReturn] = useState<string[]>([]);
  const [returnDate, setReturnDate] = useState<string>('۱۴۰۵/۰۴/۰۷');
  const [returnReason, setReturnReason] = useState<string>('نقص فنی و خرابی مکرر دستگاه');
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundStatus, setRefundStatus] = useState<'paid' | 'unpaid'>('paid');

  // --- CUSTOM INLINE OVERLAY STATES ---
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showCancelConfirmModal, setShowCancelConfirmModal] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState<boolean>(false);

  // Initialize Edit state when selectedSale or modalView changes to edit
  useEffect(() => {
    if (selectedSale) {
      setEditCustomerName(selectedSale.customer.name);
      setEditCustomerPhone(selectedSale.customer.phone);
      setEditCustomerType(selectedSale.customer.type || 'person');
      setEditCustomerEmail(selectedSale.customer.email || '');
      setEditCustomerAddress(selectedSale.customer.address || '');
      setEditSaleDate(selectedSale.saleDate);
      setEditPaymentMethod(selectedSale.paymentMethod || 'نقدی');
      setEditDiscount(selectedSale.discount || 0);
      setEditNotes(selectedSale.notes || '');
      setEditItems(JSON.parse(JSON.stringify(selectedSale.items)));
    }
  }, [selectedSale, modalView]);

  // Initialize Return state when selectedSale or modalView changes to return
  useEffect(() => {
    if (selectedSale) {
      const returns = selectedSale.returns || [];
      const returnedSerials = returns.map(r => r.serial.toUpperCase());
      const nonReturnedSerials = selectedSale.items
        .flatMap(i => i.serials)
        .filter(s => !returnedSerials.includes(s.toUpperCase()));
      
      setSelectedSerialsToReturn(nonReturnedSerials);
      setReturnDate('۱۴۰۵/۰۴/۰۷');
      setReturnReason('نقص فنی و خرابی مکرر دستگاه');
      setReturnNotes('');
      setRefundStatus('paid');
      setShowConfirmModal(false);
      setShowCancelConfirmModal(false);
      setIsLoading(false);
      setShowSuccessAlert(false);
    }
  }, [selectedSale, modalView]);

  // Dynamically recalculate refund amount based on selected serials in Return view
  useEffect(() => {
    if (!selectedSale || modalView !== 'return') return;

    let computedRefund = 0;
    selectedSale.items.forEach(item => {
      const count = item.serials.filter(s => selectedSerialsToReturn.includes(s)).length;
      computedRefund += count * item.unitPrice;
    });

    // Proportional discount reduction
    const totalSerialsCount = selectedSale.items.reduce((acc, i) => acc + i.serials.length, 0);
    const returnedCount = selectedSerialsToReturn.length;

    let proportionalDiscount = 0;
    if (totalSerialsCount > 0 && selectedSale.discount) {
      proportionalDiscount = Math.round((selectedSale.discount * returnedCount) / totalSerialsCount);
    }

    setRefundAmount(Math.max(0, computedRefund - proportionalDiscount));
  }, [selectedSerialsToReturn, selectedSale, modalView]);

  // Helper to check if item is editable (no repair/technical history registered for its serials)
  const isItemEditable = (itemSerials: string[]) => {
    return itemSerials.every(serial => {
      const found = warrantyDb.find(w => w.serial.toUpperCase() === serial.toUpperCase());
      if (!found) return true;
      return found.status === 'active';
    });
  };

  const handleSaveEditClick = () => {
    if (!editCustomerName.trim() || !editCustomerPhone.trim()) {
      alert('نام خریدار و شماره تماس نمی‌تواند خالی باشد.');
      return;
    }
    onSaveEdit({
      ...selectedSale,
      saleDate: editSaleDate,
      customer: {
        ...selectedSale.customer,
        name: editCustomerName.trim(),
        phone: editCustomerPhone.trim(),
        type: editCustomerType,
        address: editCustomerAddress.trim(),
        email: editCustomerEmail.trim()
      },
      items: editItems,
      discount: Number(editDiscount) || 0,
      paymentMethod: editPaymentMethod,
      notes: editNotes.trim()
    });
  };

  const handleConfirmCancelClick = () => {
    if (!cancelReason) {
      alert('لطفاً علت لغو فاکتور را انتخاب کنید.');
      return;
    }
    if (!cancelDate.trim()) {
      alert('لطفاً تاریخ لغو فاکتور را وارد کنید.');
      return;
    }
    if (selectedSale.status === 'cancelled') {
      alert('خطا: این فاکتور قبلاً لغو شده است.');
      return;
    }
    setShowCancelConfirmModal(true);
  };

  const handleConfirmReturnClick = () => {
    if (selectedSerialsToReturn.length === 0) {
      alert('لطفاً حداقل یک شماره سریال را برای مرجوعی انتخاب کنید.');
      return;
    }
    if (!returnDate.trim()) {
      alert('لطفاً تاریخ مرجوعی را وارد کنید.');
      return;
    }
    if (!returnReason) {
      alert('لطفاً علت مرجوعی را انتخاب کنید.');
      return;
    }
    if (refundAmount < 0 || isNaN(refundAmount)) {
      alert('مبلغ بازپرداخت نامعتبر است.');
      return;
    }
    if (selectedSale.status === 'cancelled') {
      alert('خطا: این فاکتور قبلاً لغو شده است.');
      return;
    }

    // Validation: make sure no serial is already returned
    for (const serial of selectedSerialsToReturn) {
      const alreadyReturned = (selectedSale.returns || []).some(r => r.serial.toUpperCase() === serial.toUpperCase());
      if (alreadyReturned) {
        alert(`خطا: سریال ${serial} قبلاً مرجوع شده است.`);
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const handleFinalSubmitReturn = () => {
    setIsLoading(true);
    setTimeout(() => {
      onConfirmReturn({
        serials: selectedSerialsToReturn,
        date: returnDate,
        reason: returnReason,
        notes: returnNotes.trim(),
        refundAmount,
        refundStatus
      });
      setIsLoading(false);
      setShowConfirmModal(false);
      setShowSuccessAlert(true);
    }, 800);
  };

  const handleFinalSubmitCancel = () => {
    setIsLoading(true);
    setTimeout(() => {
      onConfirmCancel({
        reason: cancelReason,
        date: cancelDate,
        notes: cancelNotes.trim()
      });
      setIsLoading(false);
      setShowCancelConfirmModal(false);
      setShowSuccessAlert(true);
    }, 800);
  };

  return (
    <div className="text-right text-xs leading-relaxed" dir="rtl">
      {/* ----------------------------------------------------------------------
          1. EDIT MODE
         ---------------------------------------------------------------------- */}
      {modalView === 'edit' && (
        <div className="space-y-4 text-slate-800">
          <div className="bg-blue-50/70 border border-blue-100 p-3 rounded-2xl text-[10px] text-blue-800 font-bold leading-relaxed">
            ℹ️ در این بخش می‌توانید مشخصات طرف حساب، تاریخ و تخفیف فاکتور را ویرایش کنید. مشخصات کالا و سریال‌ها تنها زمانی قابل تغییرند که هیچ خدمات یا تعمیراتی برای آنها ثبت نشده باشد.
          </div>

          {/* Customer Info */}
          <div className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/30 space-y-3">
            <h5 className="font-black text-xs text-slate-900 border-b border-slate-100 pb-1.5 flex items-center gap-1">
              <User className="w-4 h-4 text-blue-600" />
              <span>مشخصات طرف حساب / خریدار</span>
            </h5>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 block">نام خریدار</label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 block">شماره تماس</label>
                <input
                  type="text"
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 font-mono font-bold text-left"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 block">نوع طرف حساب</label>
                <select
                  value={editCustomerType}
                  onChange={(e) => setEditCustomerType(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 font-bold cursor-pointer"
                >
                  <option value="person">حقیقی / مصرف‌کننده</option>
                  <option value="representative">نمایندگی / همکار</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 block">ایمیل طرف حساب (اختیاری)</label>
                <input
                  type="text"
                  value={editCustomerEmail}
                  onChange={(e) => setEditCustomerEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 font-mono text-left"
                  dir="ltr"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-black text-slate-400 block">نشانی تحویل کالا</label>
                <textarea
                  value={editCustomerAddress}
                  onChange={(e) => setEditCustomerAddress(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Invoice Info */}
          <div className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/30 space-y-3">
            <h5 className="font-black text-xs text-slate-900 border-b border-slate-100 pb-1.5">اطلاعات فاکتور فروش</h5>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 block">تاریخ فروش (مثال: ۱۴۰۵/۰۲/۱۵)</label>
                <input
                  type="text"
                  value={editSaleDate}
                  onChange={(e) => setEditSaleDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 font-mono font-bold text-center"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 block">روش پرداخت</label>
                <select
                  value={editPaymentMethod}
                  onChange={(e) => setEditPaymentMethod(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 font-bold cursor-pointer"
                >
                  <option value="نقدی">نقدی</option>
                  <option value="کارتخوان">کارتخوان</option>
                  <option value="حواله بانکی">حواله بانکی</option>
                  <option value="ترکیبی">ترکیبی</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 block">مبلغ تخفیف فاکتور (تومان)</label>
                <input
                  type="number"
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 font-mono font-bold text-left"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-black text-slate-400 block">توضیحات فاکتور</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-600 font-bold"
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="border border-slate-200/80 rounded-2xl p-4 bg-slate-50/30 space-y-3">
            <h5 className="font-black text-xs text-slate-900 border-b border-slate-100 pb-1.5">کالاهای ثبت‌شده در فاکتور</h5>
            <div className="space-y-4 divide-y divide-slate-100">
              {editItems.map((item, idx) => {
                const editable = isItemEditable(item.serials);
                return (
                  <div key={idx} className="pt-4 first:pt-0 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-xs text-slate-900">ردیف {toPersianDigits(idx + 1)}</span>
                      {editable ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full text-[9px] font-bold">
                          🔓 مشخصات فنی قابل تغییر
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-[9px] font-bold">
                          🔒 قفل شده (دارای پرونده فعال در کارگاه)
                        </span>
                      )}
                    </div>

                    {editable ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 block">نام کالا</label>
                          <input
                            type="text"
                            value={item.product.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, product: { ...it.product, name: val } } : it));
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 block">مدل دستگاه</label>
                          <input
                            type="text"
                            value={item.product.model}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, product: { ...it.product, model: val } } : it));
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 block">مدت زمان گارانتی (ماه)</label>
                          <input
                            type="text"
                            value={item.product.warrantyDuration}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, product: { ...it.product, warrantyDuration: val } } : it));
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 block">قیمت واحد (تومان)</label>
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, unitPrice: val, unitPriceStr: val.toLocaleString('fa-IR') } : it));
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none font-mono font-bold"
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <label className="text-[10px] font-black text-slate-400 block">سریال‌ها (با کاما / ویرگول جدا کنید)</label>
                          <input
                            type="text"
                            value={item.serials.join(', ')}
                            onChange={(e) => {
                              const val = e.target.value.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                              setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, serials: val } : it));
                            }}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none font-mono font-bold"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-100/60 rounded-xl p-3 grid grid-cols-2 gap-3 text-[10px] font-bold border border-slate-200/55">
                        <div>
                          <span className="text-slate-400 block text-[9px]">نام و مدل کالا:</span>
                          <span className="text-slate-700">{item.product.name} ({item.product.model})</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">مدت گارانتی:</span>
                          <span className="text-slate-700">{toPersianDigits(item.product.warrantyDuration)} ماه</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">قیمت واحد:</span>
                          <span className="text-slate-700 font-mono">{formatToPersianPrice(item.unitPrice)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[9px]">سریال‌ها:</span>
                          <span className="text-slate-700 font-mono">{item.serials.join(' - ')}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Edit action triggers */}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setModalView('details')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer text-xs"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleSaveEditClick}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black transition-all cursor-pointer text-xs"
            >
              ذخیره تغییرات فاکتور
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          2. CANCEL MODE
         ---------------------------------------------------------------------- */}
      {modalView === 'cancel' && (
        <div className="space-y-4 text-slate-800">
          <div className="bg-rose-50 border border-rose-100 p-3.5 rounded-2xl flex gap-2.5 text-rose-800">
            <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="text-[10px] leading-relaxed">
              <span className="font-black text-xs block mb-0.5 text-rose-950">هشدار بسیار مهم ابطال فاکتور فروش</span>
              لغو فروش صرفاً برای فاکتورهای اشتباه صادرشده یا فسخ کامل معامله است. پس از تایید، فاکتور در آرشیو باقی مانده ولی با برچسب سرخ «لغوشده» نشان داده شده و مبالغ و تعداد کالاها از کل آمار و سود مالی فروشگاه خارج می‌گردد. همچنین گارانتی تمام شماره سریال‌های این فاکتور ابطال شده و به وضعیت باطل‌شده تغییر می‌یابد.
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/20 space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 block">علت لغو فاکتور</label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-2.5 py-2.5 bg-white border border-slate-200 focus:border-rose-600 rounded-xl outline-none font-bold cursor-pointer text-xs"
              >
                <option value="ثبت اشتباه فاکتور">ثبت اشتباه فاکتور (خطای اپراتور)</option>
                <option value="انصراف خریدار از معامله">انصراف خریدار از معامله و مرجوعی قبل تحویل</option>
                <option value="عدم موجودی و عدم امکان تحویل کالا">عدم موجودی انبار و لغو دوطرفه</option>
                <option value="سایر موارد (در توضیحات ذکر شود)">سایر دلایل (ذکر در توضیحات)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 block">تاریخ لغو فاکتور (فرمت: ۱۴۰۵/۰۴/۰۷)</label>
              <input
                type="text"
                value={cancelDate}
                onChange={(e) => setCancelDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border border-slate-200 focus:border-rose-600 rounded-xl outline-none font-mono font-bold text-center"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 block">توضیحات تکمیلی ابطال فاکتور (اختیاری)</label>
              <textarea
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                rows={3}
                placeholder="توضیحات اختیاری درباره علت لغو معامله..."
                className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-rose-600 rounded-xl outline-none font-bold text-xs"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setModalView('details')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer text-xs"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleConfirmCancelClick}
              className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black transition-all cursor-pointer text-xs flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              <span>تأیید نهایی و ابطال فاکتور</span>
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------------
          3. RETURN MODE (برگشت از فروش)
         ---------------------------------------------------------------------- */}
      {modalView === 'return' && (
        <div className="space-y-4 text-slate-800">
          <div className="bg-indigo-50 border border-indigo-100 p-3.5 rounded-2xl flex gap-2.5 text-indigo-950">
            <RotateCcw className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-[10px] leading-relaxed">
              <span className="font-black text-xs block mb-0.5 text-indigo-950">ثبت مرجوعی کالا (برگشت از فروش)</span>
              در این بخش می‌توانید برگشت یک یا چند قطعه کالا را از این فاکتور ثبت کنید. با انتخاب تمام کالاها، وضعیت فاکتور به «برگشت کامل» تغییر یافته و در غیر این صورت به «برگشت جزئی» تغییر می‌یابد. گارانتی کالاها باطل شده و مبالغ آن‌ها از حساب مالی کسر و حساب طرف حساب بستانکار/اصلاح می‌گردد.
            </div>
          </div>

          {/* Serial checklist */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/20 space-y-3">
            <h5 className="font-black text-xs text-slate-900 border-b border-slate-100 pb-1.5">انتخاب شماره سریال‌های مرجوعی</h5>
            
            <div className="space-y-3">
              {selectedSale.items.map((item, itemIdx) => (
                <div key={itemIdx} className="space-y-1.5">
                  <span className="font-black text-[10px] text-slate-500 block">{item.product.name} ({item.product.model})</span>
                  <div className="grid grid-cols-2 gap-2">
                    {item.serials.map(serial => {
                      const alreadyReturned = (selectedSale.returns || []).some(r => r.serial.toUpperCase() === serial.toUpperCase());
                      const isChecked = selectedSerialsToReturn.includes(serial);
                      
                      return (
                        <label 
                          key={serial} 
                          className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer select-none transition-all ${
                            alreadyReturned 
                              ? 'bg-rose-50 border-rose-100 text-rose-500 cursor-not-allowed opacity-60' 
                              : isChecked
                                ? 'bg-indigo-50/75 border-indigo-300 text-indigo-900'
                                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={alreadyReturned}
                            checked={alreadyReturned || isChecked}
                            onChange={() => {
                              if (alreadyReturned) return;
                              if (isChecked) {
                                setSelectedSerialsToReturn(prev => prev.filter(s => s !== serial));
                              } else {
                                setSelectedSerialsToReturn(prev => [...prev, serial]);
                              }
                            }}
                            className="accent-indigo-600 w-4 h-4 cursor-pointer"
                          />
                          <div className="font-mono font-bold text-[10px]">
                            <span>{serial}</span>
                            {alreadyReturned && <span className="text-[8px] font-black block text-rose-500">(قبلاً مرجوع شده)</span>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Return specifications */}
          <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/20 space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 block">تاریخ مرجوعی کالا (فرمت: ۱۴۰۵/۰۴/۰۷)</label>
              <input
                type="text"
                value={returnDate}
                onChange={(e) => setReturnDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-600 rounded-xl outline-none font-mono font-bold text-center"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 block">علت مرجوعی کالا</label>
              <select
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="w-full px-2.5 py-2.5 bg-white border border-slate-200 focus:border-indigo-600 rounded-xl outline-none font-bold cursor-pointer text-xs"
              >
                <option value="نقص فنی و خرابی مکرر دستگاه">نقص فنی و خرابی مکرر دستگاه</option>
                <option value="عدم رضایت خریدار از کیفیت یا عملکرد">عدم رضایت خریدار از کیفیت یا عملکرد کالا</option>
                <option value="اشتباه در ارسال مدل یا قطعه توسط فروشگاه">اشتباه در ارسال مدل یا اشتباه فاکتور</option>
                <option value="سایر موارد (در توضیحات ذکر شود)">سایر موارد (ثبت توضیحات)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 block">مبلغ بازپرداختی به طرف حساب (تومان)</label>
                <input
                  type="number"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(Number(e.target.value) || 0)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 focus:border-indigo-600 rounded-xl outline-none font-mono font-bold text-left"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 block">وضعیت پرداخت وجه بازپرداختی</label>
                <select
                  value={refundStatus}
                  onChange={(e) => setRefundStatus(e.target.value as any)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-200 focus:border-indigo-600 rounded-xl outline-none font-bold cursor-pointer"
                >
                  <option value="paid">پرداخت شده (نقد/بانکی)</option>
                  <option value="unpaid">پرداخت نشده (بستانکاری حساب طرف حساب)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 block">توضیحات مرجوعی کالا</label>
              <textarea
                value={returnNotes}
                onChange={(e) => setReturnNotes(e.target.value)}
                rows={2}
                placeholder="توضیحات اختیاری درباره شرایط فیزیکی کالای برگشتی یا نحوه بازپرداخت..."
                className="w-full px-3 py-1.5 bg-white border border-slate-200 focus:border-indigo-600 rounded-xl outline-none font-bold text-xs"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={() => setModalView('details')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer text-xs"
            >
              انصراف
            </button>
            <button
              type="button"
              onClick={handleConfirmReturnClick}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all cursor-pointer text-xs flex items-center gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              <span>ثبت برگشتی و بازپرداخت</span>
            </button>
          </div>
        </div>
      )}

      {/* --- RETURN CONFIRMATION OVERLAY --- */}
      {showConfirmModal && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-sm w-full shadow-2xl text-right space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6 animate-pulse" />
            </div>
            <div className="text-center space-y-2">
              <h4 className="font-black text-slate-900 text-sm">تأیید نهایی ثبت مرجوعی</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-bold">
                آیا از ثبت برگشت از فروش این کالاها و ابطال گارانتی آن‌ها اطمینان دارید؟
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4.5 space-y-3 border border-slate-200/65 text-xs font-bold text-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">تعداد قطعات مرجوعی:</span>
                <span className="text-slate-900 font-mono font-black">{toPersianDigits(selectedSerialsToReturn.length)} دستگاه</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">مبلغ بازپرداخت:</span>
                <span className="text-emerald-700 font-mono font-black">{formatToPersianPrice(refundAmount)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-150 pt-2 text-[10.5px]">
                <span className="text-slate-400">وضعیت پرداخت:</span>
                <span className={`px-2 py-0.5 rounded-md font-black text-[10px] ${
                  refundStatus === 'paid' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' 
                    : 'bg-amber-50 text-amber-700 border border-amber-200/50'
                }`}>
                  {refundStatus === 'paid' ? 'پرداخت شده (نقد/بانکی)' : 'پرداخت نشده (بستانکاری حساب)'}
                </span>
              </div>
            </div>

            <div className="flex gap-2 justify-stretch pt-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer text-xs"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleFinalSubmitReturn}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>تأیید و ثبت نهایی</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- CANCELLATION CONFIRMATION OVERLAY --- */}
      {showCancelConfirmModal && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-sm w-full shadow-2xl text-right space-y-4 animate-scale-in">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 animate-bounce" />
            </div>
            <div className="text-center space-y-2">
              <h4 className="font-black text-rose-950 text-sm">تأیید نهایی ابطال فاکتور</h4>
              <p className="text-[11px] text-slate-500 leading-relaxed font-bold">
                آیا از لغو کامل این فاکتور مطمئن هستید؟ این عملیات غیرقابل بازگشت است و گارانتی تمام کالاها باطل می‌شود.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4.5 space-y-2.5 border border-slate-200/65 text-xs font-bold text-slate-700">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">علت ابطال:</span>
                <span className="text-slate-900 font-black">{cancelReason}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400">تاریخ ثبت:</span>
                <span className="text-slate-900 font-mono font-black">{toPersianDigits(cancelDate)}</span>
              </div>
            </div>

            <div className="flex gap-2 justify-stretch pt-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => setShowCancelConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer text-xs"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={handleFinalSubmitCancel}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>ابطال قطعی فاکتور</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SUCCESS OVERLAY --- */}
      {showSuccessAlert && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-white rounded-3xl border border-slate-100 p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-scale-in">
            <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg animate-bounce">
              <CheckCircle className="w-8 h-8 stroke-[3]" />
            </div>
            <div className="space-y-1.5">
              <h4 className="font-black text-slate-900 text-sm">عملیات با موفقیت انجام شد</h4>
              <p className="text-[11px] text-slate-500 font-bold leading-relaxed">
                تغییرات با موفقیت در پایگاه داده فروشگاه ذخیره گردید و وضعیت گارانتی دستگاه‌ها بروزرسانی شد.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowSuccessAlert(false);
                onClose();
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black transition-all cursor-pointer text-xs"
            >
              تایید و بازگشت
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
