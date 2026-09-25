# تعویض یا نصب مجدد Windows

> **اصلاح وضعیت (2026-09-25):** Cloudflare روی کامپیوتر فعلی نصب است. جمله قبلی که می‌گفت نصب نشده، نادرست است. پس از نصب Windows، نرم‌افزار و تنظیمات اتصال دوباره نصب/اعمال می‌شوند. پیش از پاک‌سازی، اگر تونل از فایل تنظیم یا اعتبارنامه محلی استفاده می‌کند، آن را امن نگه دارید؛ در غیر این صورت با حساب Cloudflare اتصال را بازسازی کنید. نوع فعلی تونل هنوز ثبت نشده است.

## محدوده این راهنما

این راهنما برای بازیابی محیط توسعه/آزمایش روی کامپیوتر فعلی است، نه بازیابی سرور عملیاتی شرکت؛ چنین سروری هنوز وجود ندارد. برنامه فعلاً روی همین یک کامپیوتر توسعه/آزمایش و از شبکه داخلی استفاده می‌شود. n8n در Docker یک نصب آزمایشی جداست؛ فقط اگر workflowها یا داده‌های آزمایشی‌اش لازم‌اند volume آن را جداگانه حفظ کنید. Cloudflare هنوز نصب یا تنظیم نشده و در بازیابی فعلی نقشی ندارد.

`DATABASE_URL` از اطلاعات اتصال PostgreSQL ساخته می‌شود و چیزی برای دانلود نیست. `BACKUP_ENCRYPTION_KEY` کلیدی است که هنگام تنظیم پشتیبان رمزگذاری‌شده ساخته شده؛ مقدارش را باید از تنظیمات محلی/متغیرهای محیطی همان کامپیوتر پیدا کرد، نه GitHub. محل دقیق ذخیره‌سازی فعلی هنوز نیازمند بررسی روی دستگاه است. اگر کلید گم شده، فایل‌های بکاپ رمزگذاری‌شده قابل بازیابی نیستند. قبل از پاک‌کردن ویندوز، هر دو را در محل امن حفظ کنید و مقدارشان را در مخزن یا چت نگذارید.

**وضعیت: دستورهای پیش‌نیاز کامل‌اند؛ restore واقعی هنوز آزموده نشده و UI برنامه restore کامل ندارد. ویندوز را پاک نکن تا دیتابیس روی محیط جدا بازیابی و با داده نمونه خوانده شود.**

## چه چیزهایی کجا هستند

| داده | محل/وضعیت مشاهده‌شده | سرنوشت هنگام تعویض ویندوز |
|---|---|---|
| کد/مستندات | GitHub `https://github.com/mohseniamin64-cmd/Accountant`, branch `main`; commit این بسته پس از push در IMPLEMENTATION ثبت می‌شود | clone دوباره می‌شود؛ GitHub repo در زمان نگارش عمومی است |
| دیتابیس زنده | Docker `diaco-postgres`, PostgreSQL 16, named volume `diaco-postgres-data` | با پاک‌شدن Docker Desktop/WSL/دیسک ممکن است از دست برود؛ GitHub نسخه آن نیست |
| فایل‌های dump | `<project-root>\data\backups`; ریشه فعلی `%USERPROFILE%\Desktop\سامانه حسابداری شبکه ای`; 5 فایل `.enc` دیده شد، آخرین 1405/06/31 | همه را قبل از پاک‌سازی به دیسک مستقل کپی کن |
| فایل‌های upload | `<project-root>\data\uploads`; workspace بررسی‌شده خالی بود | روی نصب واقعی دوباره بررسی و اگر فایل دارد جدا کپی شود؛ dump پوشش نمی‌دهد |
| تنظیمات/کلید | `.env` واقعی در Git نیست؛ در ریشه این workspace هم پیدا نشد. `BACKUP_ENCRYPTION_KEY` از منبع امن باید بازیابی شود | بدون DB login/config و همان کلید backup قابل استفاده نیست |
| خروجی build و node_modules | `dist`, `node_modules`; Git-ignore می‌شوند | حذف شوند و با npm دوباره ساخته شوند |
| سرویس جانبی | `n8n` روی port 5678 مشاهده شد؛ مالکیت و اهمیت نامشخص | ممکن است داده/volume جدا داشته باشد؛ پیش از نصب مجدد تعیین تکلیف شود |

مسیر مطلق این workspace در زمان بررسی `C:\Users\Amin_PC\Desktop\سامانه حسابداری شبکه ای`; مسیر backup دقیق آن `C:\Users\Amin_PC\Desktop\سامانه حسابداری شبکه ای\data\backups`. هنگام clone در کاربر یا پوشه دیگر، `<project-root>` را با مقصد جدید جایگزین کن.

## پیش از پاک‌کردن Windows

1. جلوی ورود/ثبت کاربران را بگیر و یک backup تازه دستی بگیر. آخرین فایل فعلی چند روز از زمان بررسی عقب‌تر است.
2. status «موفق» و سپس verify را ببین. Verify ساختار dump را می‌خواند، اما restore کامل را ثابت نمی‌کند.
3. کل `data/backups` را به دو محل مستقل کپی کن؛ یکی روی دیسکی که C: نیست. تعداد، حجم و SHA-256 دو نسخه را مقایسه کن.
4. کلید `BACKUP_ENCRYPTION_KEY` را از Password Manager/محل امن خودت پیدا کن و مستقل ذخیره کن. مقدار را در GitHub/chat ننویس.
5. هر فایل واقعی `data/uploads`، تنظیم چاپ/درگاه لازم، فایل‌های service/task scheduler و تنظیم اتصال DB را شناسایی و جدا نگه دار. مقدار Secretها را داخل سند ثبت نکن.
6. نام دیتابیس/کاربر DB، نسخه PostgreSQL، روش شروع برنامه، IP ثابت/رزرو، firewall rules و تعلق n8n را یادداشت کن. رمزها را فقط در password manager نگهدار.
7. مهم‌تر: قبل از wipe، با متخصص یک restore واقعی backup تازه را روی DB جدا اجرا کن و چند رکورد/تعداد جدول را کنترل کن. در build فعلی دکمه verify، فایل موقت را حذف می‌کند و restore نمی‌کند؛ دستور restore امن برای اپراتور هنوز بسته‌بندی نشده است.

## پس از نصب Windows جدید

1. Git، Node.js/npm سازگار با `package-lock.json`، Docker Desktop و ابزارهای امنیتی/driver لازم را نصب کن. Node فعلی میزبان v26.3.0 بود؛ نسخه LTS مورد تأیید پروژه در `engines` pin نشده و باید پیش از production تثبیت شود.
2. از PowerShell در پوشه مقصد: `git clone --branch main https://github.com/mohseniamin64-cmd/Accountant.git diaco-accounting` و `Set-Location .\diaco-accounting`; اگر مخزن Private شده، قبلش با حساب مجاز authenticate کن. سپس `npm ci`.
3. PostgreSQL 16 container و named volume بساز/به volume مهاجرت‌یافته متصل کن. نصب مشاهده‌شده `POSTGRES_DB=diaco`, volume `diaco-postgres-data`, bind loopback 5432 داشت؛ user/password را از منبع امن بگیر، نه GitHub. نمونه ساخت container: `docker volume create diaco-postgres-data` و سپس `docker run -d --name diaco-postgres --restart unless-stopped --env-file <protected-env-file-outside-Git> -p 127.0.0.1:5432:5432 -v diaco-postgres-data:/var/lib/postgresql/data postgres:16-alpine`. آن env file محلی باید `POSTGRES_DB=diaco`, `POSTGRES_USER` و `POSTGRES_PASSWORD` را داشته باشد؛ ACL ویندوز را محدود کن و فایل را در Git یا command history ننویس. در نصب مشاهده‌شده همین port فقط loopback بود؛ آن را به LAN باز نکن.
4. `.env` محلی را از مقادیر منبع امن بازسازی کن (نام متغیرها در [ENVIRONMENT.md](ENVIRONMENT.md)). `DATABASE_URL`, encryption key، port و upload/backup paths را دوباره تنظیم کن.
5. `npm run build` و سپس `npm start`. شروع، migrationهای عقب‌مانده را می‌سنجد/اعمال می‌کند؛ اول روی DB بازیابی‌شده‌ی آزمون‌شده.
6. بازیابی archive encrypted: رمزگشایی AES-256-GCM با کلید اصلی و restore custom-format dump به یک database خالی. در حال حاضر برنامه خودکار این کار را انجام نمی‌دهد؛ از helper/script تأییدشده پس از ساخت/آزمون استفاده شود. روی DB عملیاتی با `--clean` یا overwrite کار نکن.
7. `data/uploads` را به مسیر تنظیم‌شده برگردان. login، تعداد/سند نمونه، تصویر/پیوست، گردش خرید/فروش read-only، `http://localhost:5000/api/health` و backup+verify تازه را کنترل کن.
8. سپس IP/firewall و URLهای کلاینت را تست کن، نشست‌های قدیمی را احیا نکن، و کاربرها را برای ورود مجدد مطلع کن.

## بازیابی از صفر

برای نصب خالی (بدون اطلاعات قبلی): `npm ci` → ساخت `.env` با اعتبارنامه جدید → PostgreSQL → `npm run build` → `npm start` → راه‌اندازی اولیه از UI. این ترتیب دیتابیس قبلی را برنمی‌گرداند. بازیابی داده موجود طبق بندهای بالا است.

## شرط اعلام بازیابی کامل

فقط پس از restore آزمایشی به DB جدا، sanity check داده‌های مالی/موجودی، بازیابی فایل‌های uploads، تأیید کلید و ثبت دستور دقیق می‌توان این سند را از «restore آزموده نشده» به «قابل‌بازیابی تأییدشده» تغییر داد.
