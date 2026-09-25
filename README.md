# سامانه حسابداری شبکه‌ای دیاکو

> **اصلاح وضعیت (2026-09-25):** مالک پروژه تأیید کرد Cloudflare را روی کامپیوتر فعلی نصب کرده است. عبارت پایین‌تر که می‌گوید Cloudflare راه‌اندازی نشده، قدیمی/نادرست است و با این اصلاحیه جایگزین می‌شود. پس از نصب ویندوز، نرم‌افزار و تنظیمات اتصال باید دوباره نصب/اعمال شوند. نوع تونل و دامنه هنوز ثبت نشده‌اند. برای توضیح ساده اصطلاحات شبکه: [واژه‌نامه شبکه](NETWORK-GLOSSARY.md).

## مرز وضعیت فعلی و آینده

هنوز سرور عملیاتی شرکت وجود ندارد: یک کامپیوتر فعلی محیط توسعه/آزمایش است و موقتاً برنامه روی آن اجرا می‌شود. n8n نصب‌شده در Docker برای آزمون اتوماسیون‌هاست، نه سرویس وابسته برنامه حسابداری. برنامه فعلاً در شبکه داخلی استفاده می‌شود. مالک گفته نرم‌افزار/تنظیم Cloudflare را روی همین کامپیوتر نصب کرده؛ جزئیات دامنه و نوع تونل هنوز در مستندات ثبت نشده و پس از نصب ویندوز باید نرم‌افزار و تنظیمات لازم دوباره اعمال یا بازیابی شوند. راهنمای اصطلاحات در [NETWORK-GLOSSARY.md](NETWORK-GLOSSARY.md) است.

مخزن اصلی کد پروژه: [Accountant](https://github.com/mohseniamin64-cmd/Accountant)، شاخه `main`. وضعیت مخزن در زمان نگارش طبق اعلام مالک عمومی است؛ دسترسی و visibility ممکن است بعداً عوض شود.

## هدف

سامانه فارسی تحت وب برای حسابداری، خزانه، طرف‌حساب‌ها، کالا و خدمات، شعب و انبار، خرید و فروش، تولید، خدمات پس از فروش و گارانتی، تنظیمات، پشتیبان‌گیری، کاربران و ممیزی؛ طراحی برای اجرا روی سرور شرکت و استفاده در شبکه محلی.

## وضعیت فعلی

مخزن کد و مستندات را نگه می‌دارد. دیتابیس زنده، Docker volume، `.env` واقعی، کلید رمزگذاری، پیوست‌ها، sessionها و فایل‌های backup داخل GitHub نیستند. کد وجود دارد اما ظرفیت یا سلامت نصب تضمین نشده است. آخرین ارزیابی میدانی این مستندات: PostgreSQL 16 در Docker volume `diaco-postgres-data` فعال بود؛ برنامه روی پورت‌های 3000، 4173 و 5000 در حال گوش‌دادن نبود؛ پنج فایل رمزگذاری‌شده در پوشه `data/backups` دیده شد. این مشاهده فقط وضعیت همان کامپیوتر در 2026-09-25 را نشان می‌دهد.

**نکته بازیابی:** مخزن به‌تنهایی نسخه پشتیبان اطلاعات شرکت نیست. برنامه «اعتبارسنجی» dump را انجام می‌دهد، ولی مسیر بازیابی کامل و آزموده‌شده ندارد. پیش از پاک‌کردن ویندوز، راهنمای [WINDOWS-REINSTALL.md](WINDOWS-REINSTALL.md) و [BACKUP-RESTORE.md](BACKUP-RESTORE.md) را بخوانید. تا زمان اجرای یک restore واقعی در محیط جدا، بازیابی عملی تأییدشده نیست.

## معماری در یک نگاه

- Frontend: React 19، TypeScript، Vite 6، React Router.
- Backend: Node.js و Express 4، APIهای REST زیر `/api`.
- Database: PostgreSQL؛ در نصب مشاهده‌شده image `postgres:16-alpine` با Docker volume پایدار.
- Production: `npm run build` سپس `npm start`؛ پورت پیش‌فرض production برابر 5000 و توسعه 3000 است. `.env.example` مقدار قدیمی 4173 دارد.
- وضعیت شبکه، Docker و تنظیمات نصب در [ARCHITECTURE.md](ARCHITECTURE.md) و [DEPLOYMENT.md](DEPLOYMENT.md).

## مطالعه و تحویل کار

ترتیب پیشنهادی:

1. [PROJECT_STATUS.md](PROJECT_STATUS.md) و [ROADMAP.md](ROADMAP.md)
2. [DECISIONS.md](DECISIONS.md) و دفتر تفصیلی [تصمیم‌های DEC-001 تا DEC-026](docs/project-governance/decisions.md)
3. [ARCHITECTURE.md](ARCHITECTURE.md)، [API.md](API.md)، [DATABASE.md](DATABASE.md)، [ENVIRONMENT.md](ENVIRONMENT.md)
4. [IMPLEMENTATION.md](IMPLEMENTATION.md)، [TROUBLESHOOTING.md](TROUBLESHOOTING.md)، [RUNBOOK.md](RUNBOOK.md)
5. [WINDOWS-REINSTALL.md](WINDOWS-REINSTALL.md)، [BACKUP-RESTORE.md](BACKUP-RESTORE.md)، [SECURITY-NEXT-STEPS.md](SECURITY-NEXT-STEPS.md)
6. [راهنمای کاربری](docs/user-manual.md)، [طرح ظرفیت](docs/project-governance/capacity-lab.md)، [نقطه شروع برای عامل بعدی](START_HERE.md)

`SYSTEM-RECOVERY.md` نیز یادداشت بازیابی کوتاه موجود در مخزن است؛ دستور کامل‌تر و محدودیت‌های واقعی در `WINDOWS-REINSTALL.md` مرجع نهایی‌اند.

اسناد قدیمی‌تر و تخصصی در پوشه [`docs`](docs/) نگهداری می‌شوند؛ تیک تاریخی برنامه‌ها به معنای آزمون امروز نیست.

## راه‌اندازی توسعه‌دهنده

نیاز است: Git، Node.js/npm سازگار با lockfile، Docker Desktop یا PostgreSQL 16، و دسترسی به یک دیتابیس مجاز. ابتدا [ENVIRONMENT.md](ENVIRONMENT.md) را برای ایجاد تنظیمات محلی بخوانید؛ هیچ مقدار واقعی در این مخزن نیست.

در PowerShell از پوشه پروژه:

```powershell
npm ci
npm run build
npm start
```

برای توسعه از `npm run dev` استفاده کنید. راه‌اندازی backend به `DATABASE_URL` نیاز دارد و migrationهای معوق را اجرا می‌کند؛ روی دیتابیس موجود بدون پشتیبان معتبر آن را اجرا نکنید. در بررسی این بسته در 2026-09-25، `npm run lint`, `npm test` و `npm run build` موفق شدند؛ `npm test` شامل 26 فایل/114 تست بود. Build هشدار chunk بزرگ‌تر از 500 kB داد. health، migration روی دیتابیس زنده و restore کامل اجرا نشده‌اند.

## تاریخچه و راستی‌آزمایی

مسیر گفتگوها به شکل نقل‌قول کامل ذخیره نشده؛ دانش پایدار و لازم برای ادامه به تصمیم‌ها، اجراها، خطاها، وضعیت و کارهای بعدی تبدیل شده است. جزئیات رویدادهایی که زمان یا علت قطعی‌شان از مخزن قابل اثبات نبود، صریحاً «گزارش تاریخی/نیازمند تأیید» هستند.

پیش از انتشار این مستندات، تاریخچه ۱۱ commit با الگوهای رایج secret جستجو شد؛ موردی مطابق الگو یافت نشد. این بررسی تضمین نبود همه انواع secret نیست. در هر صورت هیچ credential واقعی نباید commit شود؛ اگر قبلاً وارد تاریخچه شده، حذف فایل کافی نیست و باید credential را از منبع اصلی لغو/تعویض کرد.

مراجع دستورها در `package.json`، migrations در `server/db/migrations`، تنظیمات نمونه در `.env.example` و کد سرور در `server/` هستند. مقدارهای `.env`، password، token، کلید backup، cookie یا recovery code را در issue، GitHub یا این مستندات ننویسید.
