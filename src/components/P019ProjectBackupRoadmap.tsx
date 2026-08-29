import React, { useState } from 'react';
import { 
  FileText, Download, Printer, ShieldCheck, Cpu, Users, 
  ShoppingBag, Wrench, CheckCircle2, Sliders, Database, 
  Layers, Code, Palette, Smartphone, Sparkles, Check, ChevronDown, ChevronUp, Copy
} from 'lucide-react';

interface P019ProjectBackupRoadmapProps {
  onReturn?: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const P019ProjectBackupRoadmap: React.FC<P019ProjectBackupRoadmapProps> = ({
  onReturn,
  showToast
}) => {
  const [copied, setCopied] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('all');

  const jsonBackupData = {
    appName: "Diaco Electronics ERP & Warranty Management System",
    version: "2.4.0",
    generatedAt: "1405/05/22 - 2026-08-12",
    architecture: "React 18 + Vite + TypeScript + Tailwind CSS (RTL Persian)",
    terminologyStandard: "طرف حساب (Account Holder)",
    currency: "Toman (تومان)",
    modulesCount: 19,
    modules: [
      { id: "P001", name: "پذیرش دستگاه و استعلام گارانتی", desc: "ثبت سریال، چک گارانتی شرکتی، پذیرش بدون گارانتی و فرم تحویل اولیه." },
      { id: "P002", name: "مدیریت کاربران و دسترسی‌ها", desc: "تعریف تکنسین، انباردار، مدیر مالی و تخصیص سطوح دسترسی پیشرفته." },
      { id: "P003", name: "مدیریت طرف حساب", desc: "پرونده تعاملی طرف‌های حساب حقیقی، حقوقی و همکاران، ثبت مانده حساب و شناسه ملی." },
      { id: "P004", name: "مدیریت کالاها و تعرفه‌ها", desc: "کاتالوگ قطعات، نرخ خدمات تعمیر، قیمت‌گذاری و تعرفه‌های گارانتی دیاکو." },
      { id: "P005", name: "فاکتور فروش کالا", desc: "فعالسازی چندگانه سریال‌ها، محاسبه خودکار گارانتی و صدور فاکتور سریع." },
      { id: "P006", name: "رسید و پذیرش رسمی کارگاه", desc: "صدور رسید رسمی پذیرش، امضای دیجیتال، چاپ A5/A4 و حرارتی، ارسال SMS لینک." },
      { id: "P007", name: "صف تعمیرات و کارگاه", desc: "مدیریت وضعیت قطعات (در انتظار، در حال تعمیر، تست نهایی، آماده تحویل)." },
      { id: "P008", name: "پرونده الکترونیک تعمیرات", desc: "گردش کار جامع تعمیرات، ثبت ایرادات اعلامی طرف حساب و گزارش فنی تکنسین." },
      { id: "P009", name: "عملیات تعمیر و مصرف قطعه", desc: "ثبت قطعات مصرفی از انبار، ثبت گارانتی قطعه و هزینه دستمزد." },
      { id: "P010", name: "تست نهایی کیفیت (QC)", desc: "چک‌لیست تست کارکرد، تأییدیه کیفیت قبل از تحویل و انتقال به انبار تحویل." },
      { id: "P011", name: "تحویل دستگاه به طرف حساب", desc: "ثبت تحویل نهایی، عودت داغی قطعه، بستن پرونده و چاپ رسید عودت." },
      { id: "P012", name: "تسویه حساب و ثبت هزینه", desc: "محاسبه تخفیف، هزینه قطعات، دستمزد و تسویه نهایی نقد/کارتخوان/دفتری." },
      { id: "P013", name: "جستجوی پیشرفته پرونده", desc: "جستجو بر اساس شماره پذیرش، سریال، نام طرف حساب و شماره موبایل." },
      { id: "P014", name: "تنظیمات عمومی کارگاه", desc: "تنظیم نام کارگاه، آدرس، تلفن، متون رسید چاپی و سامانه پیامک." },
      { id: "P015", name: "داشبورد مدیریتی و بنتو گرید", desc: "نمای کلی کارگاه، هشدارهای فوری، نمودارهای مالی و کارت‌های سریع." },
      { id: "P016", name: "سوابق و بایگانی فروش", desc: "بایگانی فاکتورها، لغو فاکتور، مرجوعی جزئی/کامل و بستانکاری حساب طرف حساب." },
      { id: "P017", name: "فاکتور خرید و انباردار", desc: "ثبت فاکتورهای تامین کالا، تعریف تامین‌کنندگان و افزایش خودکار انبار." },
      { id: "P018", name: "فاکتور استاندارد حسابداری", desc: "فرم جامع صدور فاکتور فروش، پیش‌فاکتور، خرید، امانی، ضایعات و ارزش افزوده." },
      { id: "P019", name: "مستندات و بک‌آ‌پ کامل سیستم", desc: "تولید فایل نقشه راه، شناسنامه فنی و امکان دانلود و ذخیره PDF کامل جهت بازیابی." }
    ],
    typeDefinitions: {
      Customer: "interface Customer { id: string; name: string; phone: string; type: 'person' | 'representative'; balance: number; address: string; }",
      Product: "interface Product { id: string; code: string; name: string; price: number; stock: number; warrantyMonths: number; category: string; }",
      RepairItem: "interface RepairItem { id: string; receptionNo: string; serial: string; itemName: string; customerName: string; customerPhone: string; status: 'pending' | 'repairing' | 'tested' | 'delivered'; defectType: string; cost: number; partsUsed: string[]; }"
    }
  };

  const generatePrintableHtmlContent = () => {
    return `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
  <meta charset="UTF-8">
  <title>شناسنامه و بک‌آ‌پ کامل سیستم صنایع الکترونیک دیاکو (ERP & Warranty)</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css" rel="stylesheet" type="text/css" />
  <style>
    body { font-family: 'Vazirmatn', sans-serif; background-color: #f8fafc; color: #0f172a; padding: 20px; }
    @media print {
      body { background-color: #ffffff; padding: 0; }
      .no-print { display: none !important; }
      .page-break { page-break-after: always; }
    }
  </style>
</head>
<body class="p-6 md:p-10 max-w-5xl mx-auto space-y-6">

  <div class="no-print bg-slate-900 text-white p-4 rounded-2xl flex justify-between items-center mb-6">
    <div>
      <h2 class="font-bold text-sm">شناسنامه و بک‌آ‌پ کامل سیستم دیاکو (نسخه ۲.۴.۰)</h2>
      <p class="text-xs text-slate-400">این صفحه آماده چاپ و ذخیره‌سازی به عنوان فایل PDF می‌باشد.</p>
    </div>
    <button onclick="window.print()" class="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
      🖨️ ذخیره به عنوان PDF (Save as PDF)
    </button>
  </div>

  <div class="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm space-y-8">
    <div class="border-b-2 border-slate-900 pb-6 flex justify-between items-start">
      <div class="space-y-2">
        <span class="bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full uppercase">صنایع الکترونیک دیاکو (DI ACO Electronics)</span>
        <h1 class="text-2xl font-black text-slate-900">مستندات فنی، نقشه راه و بک‌آ‌پ کامل سیستم ERP و گارانتی</h1>
        <p class="text-xs text-slate-600 font-bold">معماری تک‌صفحه‌ای (SPA) | راست‌چین (RTL) | استانداردهای مالی و تعمیرات</p>
      </div>
      <div class="text-left font-mono text-xs font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div>تاریخ تنظیم: ۱۴۰۵/۰۵/۲۲</div>
        <div>ارز پایه: تومان</div>
        <div>ترمینولوژی: طرف حساب</div>
      </div>
    </div>

    <div class="space-y-3">
      <h3 class="text-base font-bold text-slate-900 border-r-4 border-blue-600 pr-3">۱. فناوری‌ها و استانداردهای توسعه</h3>
      <div class="grid grid-cols-3 gap-3 text-xs font-bold">
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">فریم‌ورک: React 18 + TypeScript + Vite</div>
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200">استایل: Tailwind CSS + Lucide + Motion</div>
        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 text-emerald-700">ترمینولوژی: طرف حساب (Account Holder)</div>
      </div>
    </div>

    <div class="space-y-3">
      <h3 class="text-base font-bold text-slate-900 border-r-4 border-emerald-600 pr-3">۲. فهرست ۱۹ ماژول پیاده‌سازی شده سیستم</h3>
      <div class="grid grid-cols-2 gap-3 text-xs">
        ${jsonBackupData.modules.map(m => `
          <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <div class="font-bold text-slate-900 mb-1">${m.id} - ${m.name}</div>
            <div class="text-slate-600 text-[11px]">${m.desc}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="space-y-3">
      <h3 class="text-base font-bold text-slate-900 border-r-4 border-amber-500 pr-3">۳. اسکیماهای اصلی داده (Data Models)</h3>
      <div class="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs leading-relaxed space-y-2">
        <div>${jsonBackupData.typeDefinitions.Customer}</div>
        <div>${jsonBackupData.typeDefinitions.Product}</div>
        <div>${jsonBackupData.typeDefinitions.RepairItem}</div>
      </div>
    </div>

    <div class="p-4 bg-blue-50 border border-blue-200 rounded-xl text-xs space-y-2">
      <div class="font-bold text-blue-900 text-sm">راهنمای بازیابی و راه‌اندازی مجدد در صورت پاک شدن سیستم:</div>
      <ol class="list-decimal list-inside space-y-1 text-blue-950 font-bold">
        <li>اجرای دستور npm install جهت نصب بسته‌های React 18 و Tailwind.</li>
        <li>اجرای دستور npm run dev برای بالا آمدن سرور محلی بر روی پورت 3000.</li>
        <li>کُد اصلی در App.tsx و کامپوننت‌های ۱۹ گانه در پوشه /src/components قرار دارند.</li>
      </ol>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 800);
    };
  </script>
</body>
</html>`;
  };

  const handleDownloadHtmlPdfFile = () => {
    try {
      const htmlContent = generatePrintableHtmlContent();
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = `diaco-erp-system-roadmap-printable.html`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      URL.revokeObjectURL(url);

      if (showToast) {
        showToast('فایل قابل چاپ diaco-erp-system-roadmap-printable.html دانلود شد! آن را باز کنید تا خودکار PDF ذخیره شود.', 'success');
      }
    } catch (e) {
      if (showToast) showToast('خطا در دانلود فایل.', 'error');
    }
  };

  const handleOpenInNewTab = () => {
    try {
      const htmlContent = generatePrintableHtmlContent();
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const newWin = window.open(url, '_blank');
      if (!newWin) {
        // Fallback to direct HTML download if popup was blocked
        handleDownloadHtmlPdfFile();
      } else {
        if (showToast) showToast('صفحه سند در تب جدید باز شد.', 'info');
      }
    } catch (e) {
      handleDownloadHtmlPdfFile();
    }
  };

  const handlePrintPdf = () => {
    try {
      // First try opening in new tab or triggering direct window print
      handleOpenInNewTab();
    } catch (e) {
      handleDownloadHtmlPdfFile();
    }
  };

  const handleCopyJsonSpec = () => {
    const textToCopy = JSON.stringify(jsonBackupData, null, 2);
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(textToCopy).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
        if (showToast) showToast('چکیده متنی پروژه (JSON) با موفقیت در حافظه کپی شد.', 'success');
      }).catch(() => fallbackCopyText(textToCopy));
    } else {
      fallbackCopyText(textToCopy);
    }
  };

  const fallbackCopyText = (text: string) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      if (showToast) showToast('چکیده متنی پروژه (JSON) با موفقیت در حافظه کپی شد.', 'success');
    } catch (err) {
      if (showToast) showToast('امکان کپی خودکار فراهم نشد.', 'error');
    }
    document.body.removeChild(textArea);
  };

  const handleDownloadJsonFile = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(jsonBackupData, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", "diaco-erp-system-roadmap-backup.json");
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    if (showToast) showToast('فایل بک‌آ‌پ diaco-erp-system-roadmap-backup.json با موفقیت دانلود شد.', 'success');
  };


  return (
    <div className="space-y-6 font-sans text-right" dir="rtl">
      {/* ACTION BAR (Hidden in print) */}
      <div className="print:hidden bg-slate-900 text-white p-5 rounded-3xl shadow-xl border border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black">شناسنامه کامل، نقشه راه و فایل بک‌آ‌پ جامع سیستم دیاکو</h2>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            شامل تمامی ماژول‌ها، ساختار داده‌ها، استایل‌ها، ترمینولوژی (طرف حساب) و نحوه راه‌اندازی مجدد پروژه
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadJsonFile}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-colors cursor-pointer border border-blue-500 shadow-xs"
          >
            <Download className="w-4 h-4 text-blue-100" />
            <span>دانلود JSON</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadHtmlPdfFile}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black transition-colors cursor-pointer border border-amber-500 shadow-xs"
          >
            <Download className="w-4 h-4 text-amber-100" />
            <span>دانلود سند HTML (ذخیره مستقیم)</span>
          </button>

          <button
            type="button"
            onClick={handleOpenInNewTab}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-950/40 transition-all cursor-pointer"
          >
            <Printer className="w-4.5 h-4.5" />
            <span>باز کردن در تب جدید / ذخیره PDF</span>
          </button>
        </div>
      </div>

      {/* PRINTABLE DOCUMENT BODY */}
      <div id="pdf-backup-content" className="bg-white border border-slate-200/90 rounded-3xl p-6 md:p-8 shadow-xs space-y-8 text-slate-900 print:p-0 print:border-none print:shadow-none">
        
        {/* DOCUMENT HEADER */}
        <div className="border-b-2 border-slate-900 pb-6 flex justify-between items-start">
          <div className="space-y-2">
            <div className="inline-block bg-blue-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              صنایع الکترونیک دیاکو (DI ACO Electronics)
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900">
              مستندات فنی، نقشه راه و پرونده بازسازی کامل نرم‌افزار ERP کارگاه و خدمات گارانتی
            </h1>
            <p className="text-xs text-slate-600 font-bold">
              نسخه ۲.۴.۰ | معماری تک‌صفحه‌ای (SPA) کاملاً واکنش‌گرا و راست‌چین (RTL) | استانداردهای مالی و تعمیرات
            </p>
          </div>

          <div className="text-left font-mono text-xs font-black text-slate-600 space-y-1 shrink-0 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div>تاریخ تنظیم: <span className="text-slate-900">۱۴۰۵/۰۵/۲۲</span></div>
            <div>ارز پایه: <span className="text-emerald-700">تومان (Toman)</span></div>
            <div>استاندارد واژگان: <span className="text-blue-700">طرف حساب</span></div>
          </div>
        </div>

        {/* SECTION 1: ARCHITECTURE OVERVIEW */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-r-4 border-blue-600 pr-3">
            <Code className="w-5 h-5 text-blue-600" />
            <h3 className="text-base font-black text-slate-900">۱. معماری تکتیکال و فناوری‌های استفاده شده</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-bold">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-slate-400 block text-[10px]">فریم‌ورک فرانت‌اند:</span>
              <span className="text-slate-900 font-mono block">React 18 + TypeScript + Vite</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-slate-400 block text-[10px]">استایل‌دهی و طراحی UI:</span>
              <span className="text-slate-900 font-mono block">Tailwind CSS + Lucide Icons + Motion</span>
            </div>
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
              <span className="text-slate-400 block text-[10px]">استاندارد ترمینولوژی:</span>
              <span className="text-emerald-700 font-mono block">حذف کامل کلمه «مشتری» / جایگزینی با «طرف حساب»</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: MODULES BREAKDOWN */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-r-4 border-emerald-600 pr-3">
            <Layers className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-black text-slate-900">۲. فهرست کامل ۱۹ ماژول و صفحات پیاده‌سازی شده (P001 تا P019)</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {[
              { id: 'P001', name: 'پذیرش دستگاه و استعلام گارانتی', desc: 'ثبت سریال، چک گارانتی شرکتی، پذیرش بدون گارانتی و فرم تحویل اولیه.' },
              { id: 'P002', name: 'مدیریت کاربران و دسترسی‌ها', desc: 'تعریف تکنسین، انباردار، مدیر مالی و تخصیص سطوح دسترسی پیشرفته.' },
              { id: 'P003', name: 'مدیریت طرف حساب', desc: 'پرونده تعاملی طرف‌های حساب حقیقی، حقوقی و همکاران، ثبت مانده حساب و شناسه ملی.' },
              { id: 'P004', name: 'مدیریت کالاها و تعرفه‌ها', desc: 'کاتالوگ قطعات، نرخ خدمات تعمیر، قیمت‌گذاری و تعرفه‌های گارانتی دیاکو.' },
              { id: 'P005', name: 'فاکتور فروش کالا', desc: 'فعالسازی چندگانه سریال‌ها، محاسبه خودکار گارانتی و صدور فاکتور سریع.' },
              { id: 'P006', name: 'رسید و پذیرش رسمی کارگاه', desc: 'صدور رسید رسمی پذیرش، امضای دیجیتال، چاپ A5/A4 و حرارتی، ارسال SMS لینک.' },
              { id: 'P007', name: 'صف تعمیرات و کارگاه', desc: 'مدیریت وضعیت قطعات (در انتظار، در حال تعمیر، تست نهایی، آماده تحویل).' },
              { id: 'P008', name: 'پرونده الکترونیک تعمیرات', desc: 'گردش کار جامع تعمیرات، ثبت ایرادات اعلامی طرف حساب و گزارش فنی تکنسین.' },
              { id: 'P009', name: 'عملیات تعمیر و مصرف قطعه', desc: 'ثبت قطعات مصرفی از انبار، ثبت گارانتی قطعه و هزینه دستمزد.' },
              { id: 'P010', name: 'تست نهایی کیفیت (QC)', desc: 'چک‌لیست تست کارکرد، تأییدیه کیفیت قبل از تحویل و انتقال به انبار تحویل.' },
              { id: 'P011', name: 'تحویل دستگاه به طرف حساب', desc: 'ثبت تحویل نهایی، عودت داغی قطعه، بستن پرونده و چاپ رسید عودت.' },
              { id: 'P012', name: 'تسویه حساب و ثبت هزینه', desc: 'محاسبه تخفیف، هزینه قطعات، دستمزد و تسویه نهایی نقد/کارتخوان/دفتری.' },
              { id: 'P013', name: 'جستجوی پیشرفته پرونده', desc: 'جستجو بر اساس شماره پذیرش، سریال، نام طرف حساب و شماره موبایل.' },
              { id: 'P014', name: 'تنظیمات عمومی کارگاه', desc: 'تنظیم نام کارگاه، آدرس، تلفن، متون رسید چاپی و سامانه پیامک.' },
              { id: 'P015', name: 'داشبورد مدیریتی و بنتو گرید', desc: 'نمای کلی کارگاه، هشدارهای فوری، نمودارهای مالی و کارت‌های سریع.' },
              { id: 'P016', name: 'سوابق و بایگانی فروش', desc: 'بایگانی فاکتورها، لغو فاکتور، مرجوعی جزئی/کامل و بستانکاری حساب طرف حساب.' },
              { id: 'P017', name: 'فاکتور خرید و انباردار', desc: 'ثبت فاکتورهای تامین کالا، تعریف تامین‌کنندگان و افزایش خودکار انبار.' },
              { id: 'P018', name: 'فاکتور استاندارد حسابداری', desc: 'فرم جامع صدور فاکتور فروش، پیش‌فاکتور، خرید، امانی، ضایعات و ارزش افزوده.' },
              { id: 'P019', name: 'مستندات و بک‌آ‌پ کامل سیستم', desc: 'تولید فایل نقشه راه، شناسنامه فنی و امکان دانلود و ذخیره PDF کامل جهت بازیابی.' }
            ].map((m) => (
              <div key={m.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-black text-slate-900 text-xs">{m.name}</span>
                  <span className="font-mono text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-bold">{m.id}</span>
                </div>
                <p className="text-[10.5px] text-slate-600 font-medium leading-relaxed">{m.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 3: DATA MODELS & TYPES */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-r-4 border-amber-500 pr-3">
            <Database className="w-5 h-5 text-amber-500" />
            <h3 className="text-base font-black text-slate-900">۳. مدل‌های اصلی داده (TypeScript Data Models)</h3>
          </div>

          <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-[11px] leading-relaxed overflow-x-auto space-y-2">
            <div className="text-slate-400">// Customer / Account Holder Schema</div>
            <div>interface Customer &#123; id: string; name: string; phone: string; type: 'person' | 'representative'; balance: number; address: string; &#125;</div>
            <div className="text-slate-400">// Product Catalog Schema</div>
            <div>interface Product &#123; id: string; code: string; name: string; price: number; stock: number; warrantyMonths: number; category: string; &#125;</div>
            <div className="text-slate-400">// Repair Dossier Schema</div>
            <div>interface RepairItem &#123; id: string; receptionNo: string; serial: string; itemName: string; customerName: string; customerPhone: string; status: 'pending' | 'repairing' | 'tested' | 'delivered'; defectType: string; cost: number; partsUsed: string[]; &#125;</div>
          </div>
        </div>

        {/* SECTION 4: DESIGN TOKENS & UI STANDARDS */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-r-4 border-purple-600 pr-3">
            <Palette className="w-5 h-5 text-purple-600" />
            <h3 className="text-base font-black text-slate-900">۴. استانداردهای بصری، رنگ‌ها و اصول رابط کاربری (UI Tokens)</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-bold text-center">
            <div className="p-3 bg-slate-900 text-white rounded-2xl">
              <span className="block text-[10px] text-slate-400">پس‌زمینه اصلی / متن</span>
              <span>Slate 900 / Slate 50</span>
            </div>
            <div className="p-3 bg-blue-600 text-white rounded-2xl">
              <span className="block text-[10px] text-blue-200">رنگ برند و دکمه‌ها</span>
              <span>Blue 600 / Blue 700</span>
            </div>
            <div className="p-3 bg-emerald-600 text-white rounded-2xl">
              <span className="block text-[10px] text-emerald-200">موفقیت و مالی</span>
              <span>Emerald 600 / Teal 500</span>
            </div>
            <div className="p-3 bg-amber-500 text-slate-950 rounded-2xl">
              <span className="block text-[10px] text-amber-900">هشدارها و SMS</span>
              <span>Amber 500 / Amber 600</span>
            </div>
          </div>
        </div>

        {/* SECTION 5: INSTRUCTIONS FOR CONTINUING / RECOVERING THE PROJECT */}
        <div className="space-y-3 bg-blue-50/60 border border-blue-200/80 p-5 rounded-2xl text-xs space-y-2">
          <div className="flex items-center gap-2 font-black text-blue-900 text-sm">
            <CheckCircle2 className="w-5 h-5 text-blue-600" />
            <span>راهنمای ادامه توسعه یا راه‌اندازی مجدد پروژه در صورت پاک شدن سیستم</span>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-blue-950 font-bold leading-relaxed pr-1">
            <li>فایل پروژه با فریم‌ورک React 18، Vite و TypeScript پیاده‌سازی شده است.</li>
            <li>برای راه‌اندازی مجدد کافیست دستورات <code className="bg-white px-1.5 py-0.5 rounded border border-blue-300 font-mono text-[11px]">npm install</code> و سپس <code className="bg-white px-1.5 py-0.5 rounded border border-blue-300 font-mono text-[11px]">npm run dev</code> اجرا شوند.</li>
            <li>تمام متون و کلمات مربوط به مشتریان با ترمینولوژی یکپارچه <strong>«طرف حساب»</strong> جایگزین گردیده‌اند.</li>
            <li>ماژول P018 فرم جامع فاکتور استاندارد حسابداری (فروش، پیش‌فاکتور، خرید، امانی و مرجوعی) را فراهم کرده است.</li>
            <li>تمامی کامپوننت‌ها در پوشه <code className="bg-white px-1.5 py-0.5 rounded border border-blue-300 font-mono text-[11px]">/src/components</code> و فایل اصلی در <code className="bg-white px-1.5 py-0.5 rounded border border-blue-300 font-mono text-[11px]">/src/App.tsx</code> قرار دارند.</li>
          </ol>
        </div>

        {/* DOCUMENT FOOTER */}
        <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-[10px] font-bold text-slate-500">
          <div>صنایع الکترونیک دیاکو - سیستم ERP و گارانتی</div>
          <div className="font-mono">DI ACO Electronics ERP Blueprint © 2026</div>
        </div>

      </div>
    </div>
  );
};
