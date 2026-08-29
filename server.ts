import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), "db.json");

app.use(express.json({ limit: "25mb" }));

type Session = { userId: string; lastSeen: number; createdAt: number };
const sessions = new Map<string, Session>();
const SESSION_IDLE_MS = 10 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, stored = "") {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

function validPassword(password: string) {
  return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
}

function cookies(req: express.Request) {
  return Object.fromEntries((req.headers.cookie || "").split(";").filter(Boolean).map(part => {
    const [key, ...value] = part.trim().split("=");
    return [key, decodeURIComponent(value.join("="))];
  }));
}

// Load the database state
function loadState() {
  if (fs.existsSync(DB_PATH)) {
    try {
      const content = fs.readFileSync(DB_PATH, "utf-8");
      return JSON.parse(content);
    } catch (e) {
      console.error("Error reading db.json, using defaults", e);
    }
  }
  
  // Default Seed Data
  return {
    isSetupCompleted: false,
    setupCompanyName: 'دیاکو الکترونیک',
    setupCompanyEnName: 'Diaco Electronics',
    setupServerName: 'Diaco-Server',
    setupServerIp: '192.168.1.100',
    setupCurrency: 'تومان',
    setupWarrantyDuration: '12 ماه',
    setupMaxStayDays: '15 روز',
    users: [
      { id: '1', fullName: 'هادی محمدزاده', username: 'admin', role: 'admin', isActive: true, lastLoginDate: '۱۴۰۵/۰۴/۰۷ - ۱۴:۳۲' },
      { id: '2', fullName: 'اکبر', username: 'akbar', role: 'reception', isActive: true, lastLoginDate: '۱۴۰۵/۰۴/۰۷ - ۱۵:۱۰' },
      { id: '3', fullName: 'مهدی', username: 'mehdi', role: 'technician', isActive: true, lastLoginDate: '۱۴۰۵/۰۴/۰۶ - ۰۹:۱۵' },
      { id: '4', fullName: 'علی', username: 'ali', role: 'delivery', isActive: true, lastLoginDate: '۱۴۰۵/۰۴/۰۷ - ۱۱:۰۰' }
    ],
    warrantyDb: [
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
      },
      {
        serial: 'TST-5011',
        itemName: 'دستگاه تستر دینام و باتری دیجیتال (DEC-T100-TST)',
        customerName: 'کامپیوتر آریا (رضایی)',
        customerPhone: '09123456789',
        defectType: '',
        status: 'active',
        expiryDate: '۱۴۰۶/۰۲/۱۵',
        registeredAt: '۱۴۰۵/۰۲/۱۵',
        statusNotes: 'فعالسازی گارانتی پس از فروش. قیمت واحد: ۳,۹۰۰,۰۰۰ تومان - شماره فاکتور: INV-1405-101'
      },
      {
        serial: 'TST-5012',
        itemName: 'دستگاه تستر دینام و باتری دیجیتال (DEC-T100-TST)',
        customerName: 'کامپیوتر آریا (رضایی)',
        customerPhone: '09123456789',
        defectType: '',
        status: 'active',
        expiryDate: '۱۴۰۶/۰۲/۱۵',
        registeredAt: '۱۴۰۵/۰۲/۱۵',
        statusNotes: 'فعالسازی گارانتی پس از فروش. قیمت واحد: ۳,۹۰۰,۰۰۰ تومان - شماره فاکتور: INV-1405-101'
      },
      {
        serial: 'CH-8011',
        itemName: 'شارژر باتری صنعتی ۱۰ آمپر دیاکو (DEC-1210-CH)',
        customerName: 'کامپیوتر آریا (رضایی)',
        customerPhone: '09123456789',
        defectType: '',
        status: 'active',
        expiryDate: '۱۴۰۶/۰۸/۱۵',
        registeredAt: '۱۴۰۵/۰۲/۱۵',
        statusNotes: 'فعالسازی گارانتی پس از فروش. قیمت واحد: ۴,۲۰۰,۰۰۰ تومان - شماره فاکتور: INV-1405-101'
      },
      {
        serial: 'CH-9021',
        itemName: 'شارژر باتری صنعتی ۲۰ آمپر دیاکو (DEC-2420-CH)',
        customerName: 'زهرا صادقی',
        customerPhone: '09120004455',
        defectType: '',
        status: 'active',
        expiryDate: '۱۴۰۶/۰۹/۱۰',
        registeredAt: '۱۴۰۵/۰۳/۱۰',
        statusNotes: 'فعالسازی گارانتی پس از فروش. قیمت واحد: ۷,۸۰۰,۰۰۰ تومان - شماره فاکتور: INV-1405-102'
      }
    ],
    sales: [
      {
        id: 'INV-1405-101',
        invoiceNumber: 'INV-1405-101',
        saleDate: '۱۴۰۵/۰۲/۱۵',
        customer: {
          name: 'کامپیوتر آریا (رضایی)',
          phone: '09123456789',
          type: 'representative',
          address: 'تهران، مجتمع کامپیوتر پایتخت، طبقه سوم، واحد ۳۰۲',
          email: 'info@aria-co.ir'
        },
        items: [
          {
            product: {
              name: 'دستگاه تستر دینام و باتری دیجیتال',
              model: 'DEC-T100-TST',
              warrantyDuration: '12',
              suggestedPrice: '۳,۹۰۰,۰۰۰ تومان',
              category: 'تجهیزات تست'
            },
            serials: ['TST-5011', 'TST-5012'],
            unitPrice: 3900000,
            unitPriceStr: '۳,۹۰۰,۰۰۰'
          },
          {
            product: {
              name: 'شارژر باتری صنعتی ۱۰ آمپر دیاکو',
              model: 'DEC-1210-CH',
              warrantyDuration: '18',
              suggestedPrice: '۴,۲۰۰,۰۰۰ تومان',
              category: 'شارژر باتری'
            },
            serials: ['CH-8011'],
            unitPrice: 4200000,
            unitPriceStr: '۴,۲۰۰,۰۰۰'
          }
        ],
        discount: 500000,
        notes: 'تحویل حضوری به نماینده شرکت'
      },
      {
        id: 'INV-1405-102',
        invoiceNumber: 'INV-1405-102',
        saleDate: '۱۴۰۵/۰۳/۱۰',
        customer: {
          name: 'زهرا صادقی',
          phone: '09120004455',
          type: 'person',
          address: 'مشهد، بلوار سجاد، خیابان بزرگمهر',
          email: 'z.sadeghi@yahoo.com'
        },
        items: [
          {
            product: {
              name: 'شارژر باتری صنعتی ۲۰ آمپر دیاکو',
              model: 'DEC-2420-CH',
              warrantyDuration: '18',
              suggestedPrice: '۷,۸۰۰,۰۰۰ تومان',
              category: 'شارژر باتری'
            },
            serials: ['CH-9021'],
            unitPrice: 7800000,
            unitPriceStr: '۷,۸۰۰,۰۰۰'
          }
        ],
        discount: 0,
        notes: 'ارسال از طریق شرکت کالارسان تیپاکس'
      }
    ],
    customers: [
      { name: 'کامپیوتر آریا (رضایی)', phone: '09123456789', type: 'representative', email: 'info@aria-co.ir', address: 'تهران، مجتمع کامپیوتر پایتخت، طبقه سوم، واحد ۳۰۲' },
      { name: 'مرتضی قاسمی (همکار)', phone: '09198765432', type: 'person', email: 'ghasemi.m@gmail.com', address: 'اصفهان، خیابان طالقانی، پاساژ بازار بزرگ' },
      { name: 'فناوران داده رایان', phone: '09351112233', type: 'representative', email: 'sales@rayanfann.com', address: 'شیراز، خیابان ملاصدرا، ساختمان اندیشه' },
      { name: 'زهرا صادقی', phone: '09120004455', type: 'person', email: 'z.sadeghi@yahoo.com', address: 'مشهد، بلوار سجاد، خیابان بزرگمهر' }
    ],
    bankAccounts: [
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
    ],
    products: [
      { 
        name: 'شارژر باتری صنعتی ۱۰ آمپر دیاکو', 
        model: 'DEC-1210-CH', 
        startSerial: '10001',
        code: 'DEC-1210-CH', 
        warrantyDuration: '18', 
        suggestedPrice: '۴,۲۰۰,۰۰۰ تومان',
        isActive: true,
        category: 'شارژر باتری',
        description: 'شارژر هوشمند باتری‌های اسیدی و ژلی با سیستم قطع خودکار',
        productionPrice: '۲,۸۰۰,۰۰۰ تومان',
        sellingPrice: '۴,۲۰۰,۰۰۰ تومان',
        priceStartDate: '۱۴۰۵/۰۱/۱۵',
        image: '⚡'
      },
      { 
        name: 'شارژر باتری صنعتی ۲۰ آمپر دیاکو', 
        model: 'DEC-2420-CH', 
        startSerial: '10051',
        code: 'DEC-2420-CH', 
        warrantyDuration: '18', 
        suggestedPrice: '۷,۸۰۰,۰۰۰ تومان',
        isActive: true,
        category: 'شارژر باتری',
        description: 'شارژر صنعتی اتوماتیک ۲۴ ولت با مدار محافظ اتصال کوتاه و اضافه بار',
        productionPrice: '۵,۲۰۰,۰۰۰ تومان',
        sellingPrice: '۷,۸۰۰,۰۰۰ تومان',
        priceStartDate: '۱۴۰۵/۰۲/۰۱',
        image: '🔋'
      },
      { 
        name: 'شارژر باتری صنعتی ۳۰ آمپر دیاکو', 
        model: 'DEC-2430-CH', 
        startSerial: '10101',
        code: 'DEC-2430-CH', 
        warrantyDuration: '24', 
        suggestedPrice: '۱۲,۵۰۰,۰۰۰ تومان',
        isActive: true,
        category: 'شارژر باتری',
        description: 'شارژر باتری دائم کار سنگین مجهز به نمایشگر ولتاژ و جریان آنالوگ',
        productionPrice: '۸,۵۰۰,۰۰۰ تومان',
        sellingPrice: '۱۲,۵۰۰,۰۰۰ تومان',
        priceStartDate: '۱۴۰۵/۰۲/۱۰',
        image: '🔌'
      },
      { 
        name: 'دستگاه تستر دینام و باتری دیجیتال', 
        model: 'DEC-T100-TST', 
        code: 'T100-DEC', 
        warrantyDuration: '12', 
        suggestedPrice: '۳,۹۰۰,۰۰۰ تومان',
        isActive: true,
        category: 'تجهیزات تست',
        description: 'آنالایزر و تستر هوشمند سلامت دینام و باتری خودروهای سبک و سنگین',
        productionPrice: '۲,۴۰۰,۰۰۰ تومان',
        sellingPrice: '۳,۹۰۰,۰۰۰ تومان',
        priceStartDate: '۱۴۰۵/۰۱/۲۰',
        image: '📟'
      },
      { 
        name: 'برد کنترلر هوشمند شارژر باتری', 
        model: 'DEC-CTRL-V4', 
        code: 'CTRL-V4-DEC', 
        warrantyDuration: '6', 
        suggestedPrice: '۱,۶۵۰,۰۰۰ تومان',
        isActive: false,
        category: 'بردهای الکترونیکی',
        description: 'برد کنترل مرکزی شارژرهای سری DEC با قابلیت تنظیم سطح ولتاژ قطع',
        productionPrice: '۹۵۰,۰۰۰ تومان',
        sellingPrice: '۱,۶۵۰,۰۰۰ تومان',
        priceStartDate: '۱۴۰۵/۰۳/۰۱',
        image: '🧩'
      },
      {
        name: 'باتری', 
        model: '1000', 
        code: 'BT', 
        warrantyDuration: '12', 
        suggestedPrice: '۲,۵۰۰,۰۰۰ تومان',
        isActive: true,
        category: 'باتری',
        description: 'باتری با کیفیت بالا سری ۱۰۰۰',
        productionPrice: '۱,۵۰۰,۰۰۰ تومان',
        sellingPrice: '۲,۵۰۰,۰۰۰ تومان',
        priceStartDate: '۱۴۰۵/۰۴/۰۱',
        image: '🔋'
      }
    ],
    suppliers: [
      {
        id: 'SUP-01',
        name: 'شرکت بازرگانی الکترونیک نوین (حسینی)',
        phone: '02188997766',
        company: 'الکترونیک نوین پارت',
        address: 'تهران، خیابان جمهوری، پاساژ توکل، طبقه منفی یک، پلاک ۴۲',
        email: 'info@novinpart.ir',
        code: 'SUP-101'
      },
      {
        id: 'SUP-02',
        name: 'صنایع باتری و انرژی پارس (مهندس کریمی)',
        phone: '09121112233',
        company: 'پارس انرژی',
        address: 'اصفهان، شهرک صنعتی جی، خیابان چهارم',
        email: 'sales@parsenergy.co',
        code: 'SUP-102'
      },
      {
        id: 'SUP-03',
        name: 'تأمین تجهیزات آزمایشگاهی دیاکو پارت',
        phone: '02166443322',
        company: 'دیاکو پارت مرکزی',
        address: 'تهران، خیابان لاله زار جنوبی، پاساژ الکتریک',
        code: 'SUP-103'
      }
    ],
    purchases: [
      {
        id: 'PUR-1405-01',
        invoiceNumber: 'PUR-1405-01',
        purchaseDate: '۱۴۰۵/۰۲/۰۱',
        supplier: {
          id: 'SUP-01',
          name: 'شرکت بازرگانی الکترونیک نوین (حسینی)',
          phone: '02188997766',
          company: 'الکترونیک نوین پارت',
          address: 'تهران، خیابان جمهوری، پاساژ توکل، طبقه منفی یک، پلاک ۴۲'
        },
        items: [
          {
            product: {
              name: 'شارژر باتری صنعتی ۱۰ آمپر دیاکو',
              model: 'DEC-1210-CH',
              category: 'شارژر باتری',
              warrantyDuration: '18'
            },
            quantity: 5,
            unitPurchasePrice: 2800000,
            unitPurchasePriceStr: '۲,۸۰۰,۰۰۰',
            serials: ['CH-8011', 'CH-8012', 'CH-8013', 'CH-8014', 'CH-8015']
          }
        ],
        paymentMethod: 'cash',
        discount: 200000,
        tax: 0,
        totalPayable: 13800000,
        notes: 'خرید پارت اول شارژرهای ۱۰ آمپر جهت انبار فروش',
        status: 'completed',
        createdAt: '۱۴۰۵/۰۲/۰۱ - ۰۹:۳۰'
      }
    ],
    inventory: [
      {
        id: 'INV-STK-1',
        serial: 'CH-8011',
        productName: 'شارژر باتری صنعتی ۱۰ آمپر دیاکو',
        productModel: 'DEC-1210-CH',
        category: 'شارژر باتری',
        purchaseInvoiceNumber: 'PUR-1405-01',
        purchaseDate: '۱۴۰۵/۰۲/۰۱',
        unitPurchasePrice: 2800000,
        supplierName: 'شرکت بازرگانی الکترونیک نوین (حسینی)',
        supplierPhone: '02188997766',
        status: 'sold',
        saleInvoiceNumber: 'INV-1405-101',
        saleDate: '۱۴۰۵/۰۲/۱۵'
      },
      {
        id: 'INV-STK-2',
        serial: 'CH-8012',
        productName: 'شارژر باتری صنعتی ۱۰ آمپر دیاکو',
        productModel: 'DEC-1210-CH',
        category: 'شارژر باتری',
        purchaseInvoiceNumber: 'PUR-1405-01',
        purchaseDate: '۱۴۰۵/۰۲/۰۱',
        unitPurchasePrice: 2800000,
        supplierName: 'شرکت بازرگانی الکترونیک نوین (حسینی)',
        supplierPhone: '02188997766',
        status: 'available'
      },
      {
        id: 'INV-STK-3',
        serial: 'CH-8013',
        productName: 'شارژر باتری صنعتی ۱۰ آمپر دیاکو',
        productModel: 'DEC-1210-CH',
        category: 'شارژر باتری',
        purchaseInvoiceNumber: 'PUR-1405-01',
        purchaseDate: '۱۴۰۵/۰۲/۰۱',
        unitPurchasePrice: 2800000,
        supplierName: 'شرکت بازرگانی الکترونیک نوین (حسینی)',
        supplierPhone: '02188997766',
        status: 'available'
      },
      {
        id: 'INV-STK-4',
        serial: 'CH-8014',
        productName: 'شارژر باتری صنعتی ۱۰ آمپر دیاکو',
        productModel: 'DEC-1210-CH',
        category: 'شارژر باتری',
        purchaseInvoiceNumber: 'PUR-1405-01',
        purchaseDate: '۱۴۰۵/۰۲/۰۱',
        unitPurchasePrice: 2800000,
        supplierName: 'شرکت بازرگانی الکترونیک نوین (حسینی)',
        supplierPhone: '02188997766',
        status: 'available'
      },
      {
        id: 'INV-STK-5',
        serial: 'CH-8015',
        productName: 'شارژر باتری صنعتی ۱۰ آمپر دیاکو',
        productModel: 'DEC-1210-CH',
        category: 'شارژر باتری',
        purchaseInvoiceNumber: 'PUR-1405-01',
        purchaseDate: '۱۴۰۵/۰۲/۰۱',
        unitPurchasePrice: 2800000,
        supplierName: 'شرکت بازرگانی الکترونیک نوین (حسینی)',
        supplierPhone: '02188997766',
        status: 'available'
      }
    ]
  };
}

// Write database to file
function saveState(state: any) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(state, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing db.json", e);
  }
}

// Cache state in memory
let dbState = loadState();

// Older AI Studio backups did not contain real credentials. Force the secure
// first-run wizard instead of silently accepting a fake admin account.
if (dbState.isSetupCompleted && !dbState.users?.some((user: any) => user.passwordHash)) {
  dbState.isSetupCompleted = false;
  dbState.users = [];
}
dbState.auditLog ||= [];
if (!dbState.bankAccounts || dbState.bankAccounts.length === 0) {
  dbState.bankAccounts = [
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
}

// Save back to disk if not exists
if (!fs.existsSync(DB_PATH)) {
  saveState(dbState);
}

function publicUser(user: any) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function audit(req: express.Request, action: string, entity: string, details: any = {}) {
  const authUser = (req as any).authUser;
  dbState.auditLog.push({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    userId: authUser?.id || null,
    username: authUser?.username || "system",
    role: authUser?.role || "system",
    ip: req.ip,
    userAgent: req.headers["user-agent"] || "",
    action,
    entity,
    details
  });
  saveState(dbState);
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  let token = cookies(req).diaco_session;
  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(" ");
    if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
      token = parts[1];
    }
  }
  if (!token && typeof req.query.token === "string") {
    token = req.query.token;
  }
  const session = token ? sessions.get(token) : undefined;
  if (!token || !session || Date.now() - session.lastSeen > SESSION_IDLE_MS) {
    if (token) sessions.delete(token);
    return res.status(401).json({ error: "نشست شما پایان یافته است. دوباره وارد شوید." });
  }
  const user = dbState.users.find((item: any) => item.id === session.userId && item.isActive);
  if (!user) return res.status(401).json({ error: "حساب کاربری غیرفعال یا نامعتبر است." });
  session.lastSeen = Date.now();
  (req as any).authUser = user;
  (req as any).sessionToken = token;
  next();
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if ((req as any).authUser?.role !== "admin") return res.status(403).json({ error: "این عملیات فقط برای مدیر مجاز است." });
  next();
}

function safeState() {
  return { ...dbState, users: dbState.users.map(publicUser), auditLog: undefined };
}

// REST API Endpoints
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", setupRequired: !dbState.isSetupCompleted });
});

app.post("/api/setup", (req, res) => {
  if (dbState.isSetupCompleted) return res.status(409).json({ error: "راه‌اندازی اولیه قبلاً انجام شده است." });
  const { fullName, username, password, companyName, companyEnName, serverName, serverIp, currency, warrantyDuration, maxStayDays } = req.body || {};
  if (!fullName?.trim() || !username?.trim() || !validPassword(password || "")) {
    return res.status(400).json({ error: "نام، نام کاربری و رمز ۸ نویسه‌ای شامل حرف بزرگ، حرف کوچک و عدد الزامی است." });
  }
  dbState = {
    ...dbState,
    isSetupCompleted: true,
    setupCompanyName: companyName || "دیاکو الکترونیک",
    setupCompanyEnName: companyEnName || "Diaco Electronics",
    setupServerName: serverName || "Diaco-Server",
    setupServerIp: serverIp || "192.168.1.100",
    setupCurrency: currency || "تومان",
    setupWarrantyDuration: warrantyDuration || "12 ماه",
    setupMaxStayDays: maxStayDays || "15 روز",
    users: [{
      id: crypto.randomUUID(), fullName: fullName.trim(), username: username.trim().toLowerCase(),
      passwordHash: hashPassword(password), role: "admin", isActive: true,
      isRootAdmin: true, lastLoginDate: "بدون ورود"
    }]
  };
  audit(req, "SETUP_COMPLETED", "system", { username: username.trim().toLowerCase() });
  res.status(201).json({ success: true });
});

app.post("/api/auth/login", (req, res) => {
  const username = String(req.body?.username || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const key = `${req.ip}:${username}`;
  const attempt = loginAttempts.get(key);
  if (attempt?.lockedUntil && attempt.lockedUntil > Date.now()) {
    return res.status(429).json({ error: "به علت ورود ناموفق، حساب موقتاً قفل است. ۱۵ دقیقه بعد تلاش کنید." });
  }
  const user = dbState.users.find((item: any) => item.username.toLowerCase() === username);
  if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
    const count = (attempt?.count || 0) + 1;
    loginAttempts.set(key, { count, lockedUntil: count >= MAX_LOGIN_ATTEMPTS ? Date.now() + LOGIN_WINDOW_MS : 0 });
    audit(req, "LOGIN_FAILED", "auth", { username });
    return res.status(401).json({ error: "نام کاربری یا رمز عبور صحیح نیست." });
  }
  loginAttempts.delete(key);
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { userId: user.id, createdAt: Date.now(), lastSeen: Date.now() });
  user.lastLoginDate = new Date().toISOString();
  saveState(dbState);
  (req as any).authUser = user;
  audit(req, "LOGIN_SUCCESS", "auth");
  res.setHeader("Set-Cookie", `diaco_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200`);
  res.json({ token, user: publicUser(user), idleTimeoutMinutes: SESSION_IDLE_MS / 60000 });
});

app.get("/api/auth/session", requireAuth, (req, res) => {
  res.json({ user: publicUser((req as any).authUser), idleTimeoutMinutes: SESSION_IDLE_MS / 60000 });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  audit(req, "LOGOUT", "auth");
  sessions.delete((req as any).sessionToken);
  res.setHeader("Set-Cookie", "diaco_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
  res.json({ success: true });
});

app.get("/api/state", requireAuth, (req, res) => {
  res.json(safeState());
});

app.post("/api/state", requireAuth, (req, res) => {
  const user = (req as any).authUser;
  const allowedByRole: Record<string, string[]> = {
    admin: ["setupCompanyName", "setupCompanyEnName", "setupServerName", "setupServerIp", "setupCurrency", "setupWarrantyDuration", "setupMaxStayDays", "warrantyDb", "sales", "customers", "products", "bankAccounts", "suppliers", "purchases", "inventory"],
    reception: ["warrantyDb", "customers", "bankAccounts"],
    technician: ["warrantyDb", "inventory"],
    delivery: ["warrantyDb", "sales", "customers", "bankAccounts"]
  };
  const allowed = allowedByRole[user.role] || ["warrantyDb"];
  const changes = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  dbState = { ...dbState, ...changes };
  saveState(dbState);
  audit(req, "STATE_UPDATED", "database", { keys: Object.keys(changes) });
  res.json({ success: true });
});

app.post("/api/users", requireAuth, requireAdmin, (req, res) => {
  const { fullName, username, password, role = "reception", isActive = true } = req.body || {};
  const normalized = String(username || "").trim().toLowerCase();
  if (!fullName?.trim() || !normalized || !validPassword(password || "")) return res.status(400).json({ error: "اطلاعات کاربر یا رمز عبور معتبر نیست." });
  if (dbState.users.some((item: any) => item.username.toLowerCase() === normalized)) return res.status(409).json({ error: "نام کاربری تکراری است." });
  const user = { id: crypto.randomUUID(), fullName: fullName.trim(), username: normalized, passwordHash: hashPassword(password), role, isActive: !!isActive, isRootAdmin: false, lastLoginDate: "بدون ورود" };
  dbState.users.push(user);
  audit(req, "USER_CREATED", "user", { userId: user.id, username: user.username, role: user.role });
  res.status(201).json({ user: publicUser(user) });
});

app.patch("/api/users/:id", requireAuth, requireAdmin, (req, res) => {
  const target = dbState.users.find((item: any) => item.id === req.params.id);
  if (!target) return res.status(404).json({ error: "کاربر پیدا نشد." });
  const before = publicUser(target);
  if (req.body?.username) {
    const normalized = String(req.body.username).trim().toLowerCase();
    if (dbState.users.some((item: any) => item.id !== target.id && item.username.toLowerCase() === normalized)) return res.status(409).json({ error: "نام کاربری تکراری است." });
    target.username = normalized;
  }
  if (req.body?.fullName) target.fullName = String(req.body.fullName).trim();
  if (req.body?.role && !target.isRootAdmin) target.role = req.body.role;
  if (typeof req.body?.isActive === "boolean" && !target.isRootAdmin) {
    target.isActive = req.body.isActive;
    if (!target.isActive) for (const [token, session] of sessions) if (session.userId === target.id) sessions.delete(token);
  }
  audit(req, "USER_UPDATED", "user", { userId: target.id, before, after: publicUser(target) });
  res.json({ user: publicUser(target) });
});

app.patch("/api/users/:id/password", requireAuth, requireAdmin, (req, res) => {
  const target = dbState.users.find((item: any) => item.id === req.params.id);
  if (!target) return res.status(404).json({ error: "کاربر پیدا نشد." });
  if (!validPassword(req.body?.password || "")) return res.status(400).json({ error: "رمز باید حداقل ۸ نویسه و شامل حرف بزرگ، حرف کوچک و عدد باشد." });
  target.passwordHash = hashPassword(req.body.password);
  for (const [token, session] of sessions) if (session.userId === target.id) sessions.delete(token);
  audit(req, "PASSWORD_RESET", "user", { userId: target.id });
  res.json({ success: true });
});

// Vite & Static Asset Handling
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

startServer();
