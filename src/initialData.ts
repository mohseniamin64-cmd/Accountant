import { WarrantyItem } from './types';

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

export const INITIAL_BOMS: import('./types').BOMFormula[] = [
  {
    id: 'BOM-001',
    title: 'فرمول استاندارد ساخت شارژر ۱۰ آمپر دیاکو',
    productCode: 'DEC-1210-CH',
    productName: 'شارژر باتری صنعتی ۱۰ آمپر دیاکو',
    productModel: 'DEC-1210-CH',
    version: '1.0',
    outputQuantity: 1,
    outputUnit: 'دستگاه',
    overheadCost: 100000,
    laborCost: 100000,
    totalDirectCost: 2600000,
    totalEstimatedCost: 2800000,
    description: 'فرمول تولید تیپ صنعتی با ترانسفورماتور تمام مس و برد محافظ هوشمند نسخه ۴',
    isActive: true,
    createdAt: '۱۴۰۵/۰۱/۱۵',
    components: [
      {
        id: 'CMP-01',
        name: 'ترانسفورماتور هسته توروئیدی ۱۲ ولت ۱۰ آمپر تمام مس',
        code: 'TR-1210-CU',
        unit: 'عدد',
        quantity: 1,
        unitCost: 1200000,
        wastePercentage: 0,
        notes: 'هسته سیم‌پیچی شده مس استاندارد'
      },
      {
        id: 'CMP-02',
        name: 'برد کنترلر هوشمند شارژر باتری (DEC-CTRL-V4)',
        code: 'CTRL-V4-DEC',
        unit: 'عدد',
        quantity: 1,
        unitCost: 580000,
        wastePercentage: 1,
        notes: 'تست‌شده در واحد کنترل کیفیت'
      },
      {
        id: 'CMP-03',
        name: 'پل دیود صنعتی ۵۰ آمپر هیت‌سینک‌دار',
        code: 'DIO-50A-HS',
        unit: 'عدد',
        quantity: 1,
        unitCost: 180000,
        wastePercentage: 0
      },
      {
        id: 'CMP-04',
        name: 'بدنه فلزی رنگ کوره‌ای الکترواستاتیک با دستگیره',
        code: 'CAS-1210-MT',
        unit: 'عدد',
        quantity: 1,
        unitCost: 320000,
        wastePercentage: 0
      },
      {
        id: 'CMP-05',
        name: 'کابل انبر باتری مس خالص با روکش عایق نسوز',
        code: 'CBL-BAT-50',
        unit: 'متر',
        quantity: 2,
        unitCost: 80000,
        wastePercentage: 2,
        notes: '۲ متر (یک جفت مثبت و منفی)'
      },
      {
        id: 'CMP-06',
        name: 'فن خنک‌کننده بلبرینگی ۱۲ ولت ۸×۸ دوربالا',
        code: 'FAN-12V-80',
        unit: 'عدد',
        quantity: 1,
        unitCost: 110000,
        wastePercentage: 0
      },
      {
        id: 'CMP-07',
        name: 'مجموعه پیچ، مهره، بست کمربندی و وارنیش حرارتی',
        code: 'ACC-SET-10',
        unit: 'بسته',
        quantity: 1,
        unitCost: 50000,
        wastePercentage: 0
      }
    ]
  },
  {
    id: 'BOM-002',
    title: 'فرمول تولید دستگاه تستر دیجیتال دینام و باتری',
    productCode: 'T100-DEC',
    productName: 'دستگاه تستر دینام و باتری دیجیتال',
    productModel: 'DEC-T100-TST',
    version: '1.2',
    outputQuantity: 1,
    outputUnit: 'دستگاه',
    overheadCost: 100000,
    laborCost: 100000,
    totalDirectCost: 2200000,
    totalEstimatedCost: 2400000,
    description: 'خط مونتاژ و کالیبراسیون تستر تشخیصی باتری با پردازنده ARM و پراب کلوین',
    isActive: true,
    createdAt: '۱۴۰۵/۰۱/۲۰',
    components: [
      {
        id: 'CMP-11',
        name: 'برد پردازشگر مرکزی میکروکنترلر تستر T100',
        code: 'MCU-T100-V2',
        unit: 'عدد',
        quantity: 1,
        unitCost: 950000,
        wastePercentage: 1
      },
      {
        id: 'CMP-12',
        name: 'نمایشگر LCD کاراکتری ۱۶×۲ با بک‌لایت آبی صنعتی',
        code: 'LCD-1602-BL',
        unit: 'عدد',
        quantity: 1,
        unitCost: 250000,
        wastePercentage: 0
      },
      {
        id: 'CMP-13',
        name: 'لودسل و مقاومت بار تخلیه ۱۰۰ آمپر استیل ضدزنگ',
        code: 'RES-100A-ST',
        unit: 'عدد',
        quantity: 1,
        unitCost: 480000,
        wastePercentage: 0
      },
      {
        id: 'CMP-14',
        name: 'پراب و کلمپ گیره‌ای سنگین ۴ سیمه کلوین با روکش طلا',
        code: 'PRB-KLV-4W',
        unit: 'جفت',
        quantity: 1,
        unitCost: 320000,
        wastePercentage: 0
      },
      {
        id: 'CMP-15',
        name: 'قاب تزریق پلاستیک ABS مقاوم صنعتی ضدضربه و ضدروغن',
        code: 'CAS-T100-ABS',
        unit: 'عدد',
        quantity: 1,
        unitCost: 180000,
        wastePercentage: 0
      },
      {
        id: 'CMP-16',
        name: 'بازر هشدار صوتی و نشانگرهای LED پانل جلو',
        code: 'BZZ-LED-SET',
        unit: 'بسته',
        quantity: 1,
        unitCost: 20000,
        wastePercentage: 0
      }
    ]
  }
];


