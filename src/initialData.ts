import { WarrantyItem, BOMFormula } from './types';

export const INITIAL_WARRANTY_DB: WarrantyItem[] = [
  {
    serial: 'W-9082',
    itemName: 'کارت گرافیک ASUS ROG RTX 4070 Ti',
    customerName: 'کامپیوتر آریا (رضایی)',
    customerPhone: '09123456789',
    defectType: 'سوختگی بر اثر نوسان ولتاژ',
    status: 'under_repair',
    statusNotes: 'خازن‌های ثانویه مسیر تغذیه تعویض شدند. در حال تست استرس.',
    expiryDate: '۱۴۰۷/۰۴/۱۵',
    registeredAt: '۱۴۰۵/۰۴/۰۵',
    technicianName: 'مهندس احمدی',
    photoUrl: 'https://images.unsplash.com/photo-1591488320449-011701bb6704?w=400&auto=format&fit=crop&q=60'
  },
  {
    serial: 'W-1234',
    itemName: 'مادربورد MSI MAG Z790 DDR5',
    customerName: 'مرتضی قاسمی (همکار)',
    customerPhone: '09198765432',
    defectType: 'شکستگی فیزیکی پین‌های سوکت پردازنده',
    status: 'rejected',
    statusNotes: 'ابطال گارانتی به دلیل صدمه مکانیکی آشکار در پین‌های سوکت CPU.',
    expiryDate: '۱۴۰۶/۱۲/۲۰',
    registeredAt: '۱۴۰۵/۰۴/۰۶',
    technicianName: 'مهندس حسینی',
    photoUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400&auto=format&fit=crop&q=60'
  },
  {
    serial: 'W-4402',
    itemName: 'پاور گرین ۸۵۰ وات Gold Overclock',
    customerName: 'فناوران داده رایان',
    customerPhone: '09351112233',
    defectType: 'صدای شدید فن و بوی سوختگی الکترونیکی',
    status: 'pending',
    expiryDate: '۱۴۰۸/۰۹/۰۱',
    registeredAt: '۱۴۰۵/۰۴/۰۷'
  },
  {
    serial: 'W-5001',
    itemName: 'حافظه SSD سامسونگ 990 Pro 2TB',
    customerName: 'زهرا صادقی',
    customerPhone: '09120004455',
    defectType: 'عدم شناسایی در بایوس سیستم',
    status: 'replaced',
    statusNotes: 'تعویض با یک عدد قطعه کاملاً نو با شماره سریال جدید W-9912.',
    expiryDate: '۱۴۰۹/۰۲/۱۰',
    registeredAt: '۱۴۰۵/۰۴/۰۲',
    technicianName: 'مهندس احمدی'
  }
];

export const DEFECT_PRESETS = [
  'سوختگی مدار / عدم روشن شدن',
  'صدای غیرعادی / لرزش شدید',
  'افت شدید کارایی / فریز سیستم',
  'عدم شناسایی توسط سایر سخت‌افزارها',
  'آسیب فیزیکی برد / اتصالات شکسته',
  'سایر موارد (توضیح در بخش شرح عیب)'
];

export const INITIAL_BANK_ACCOUNTS = [
  {
    id: 'BNK-101',
    bankName: 'بانک ملت',
    accountHolder: 'دیاکو الکترونیک (مدیر ارشد)',
    accountNumber: '8841029311',
    cardNumber: '6104-3378-9012-4450',
    shebaNumber: 'IR80 0120 0000 0008 8410 2931 10',
    branchName: 'شعبه مرکزی ولیعصر - کد 6512',
    accountType: 'جاری',
    balance: 145000000,
    currency: 'تومان',
    isActive: true,
    posConnected: true,
    notes: 'حساب اصلی دریافت وجوه فروش و کارتخوان فروشگاه',
    createdAt: '۱۴۰۵/۰۱/۱۰'
  },
  {
    id: 'BNK-102',
    bankName: 'بانک سامان',
    accountHolder: 'شرکت دیاکو الکترونیک پارس',
    accountNumber: '810-800-4590123-1',
    cardNumber: '6219-8610-4490-1122',
    shebaNumber: 'IR45 0560 0810 8000 4590 1230 01',
    branchName: 'شعبه میرداماد - کد 810',
    accountType: 'قرض‌الحسنه',
    balance: 82000000,
    currency: 'تومان',
    isActive: true,
    posConnected: false,
    notes: 'حساب پرداخت تسویه‌حساب تأمین‌کنندگان و خرید قطعات',
    createdAt: '۱۴۰۵/۰۱/۱۵'
  },
  {
    id: 'BNK-103',
    bankName: 'بانک پاسارگاد',
    accountHolder: 'صندوق تنخواه‌گردان کارگاه دیاکو',
    accountNumber: '210-9012-14050-1',
    cardNumber: '5022-2910-3344-9876',
    shebaNumber: 'IR92 0570 0210 9012 1405 0000 01',
    branchName: 'شعبه مطهری - کد 210',
    accountType: 'کوتاه مدت',
    balance: 28500000,
    currency: 'تومان',
    isActive: true,
    posConnected: true,
    notes: 'تنخواه کارگاه تعمیرات و هزینه‌های جاری قطعات مصرفی',
    createdAt: '۱۴۰۵/۰۲/۰۱'
  }
];

export const INITIAL_BOMS: BOMFormula[] = [];



