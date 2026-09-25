# اجرای واقعی و قابل‌ردیابی

- ساختار repository، package.json، config، main، migrations و moduleها بازبینی شده‌اند.
- commit مرجع پیش از این بسته: 948024f با پیام تکمیل workflowهای حسابداری و خدمات.
- شاخه main با origin/main همگام بود.
- در شروع بازبینی، برنامه، دیتابیس، migration و health اجرا نشده بودند. lint/test/build در پایان طبق جدول «راستی‌آزمایی» اجرا شدند.

## دستورهای canonical

1. npm install
2. npm run db:migrate
3. npm run lint
4. npm test
5. npm run build
6. npm start

تنظیمات معتبر DATABASE_URL و کلید backup باید پیش از مراحل وابسته تأمین شوند. اجرای migration روی دیتابیس موجود بدون backup ممنوع است. خروجی و تاریخ اجرای واقعی باید بعداً در همین فایل ثبت شود.

## مسیرهای پیاده‌سازی‌شده

migrationهای 001 تا 016، session و auth، audit و recovery محلی، backup scheduler و triggerهای manual، scheduled، end_of_day، server_shutdown و drive_connected، و routeهای API برای bootstrap، auth، organization، parties، inventory، products، settings، users، roles، purchases، sales، production، service، treasury، accounting، backups و SMS در کد وجود دارند.

این سند بین «در کد وجود دارد» و «در محیط زنده آزموده شده» تفاوت می‌گذارد.

## مسیر گزارش‌شده و user acceptance

- Login RTL/center و required-field messages اصلاح شدند؛ کاربر ورود را موفق گزارش کرد.
- تنظیم lock خودکار نشست و اعمال روی نشست فعال از UI تأیید شد؛ timeout باعث شد بعضی navigationها باز بمانند ولی save رد شود و بعداً رفع گزارش شد.
- backup encryption key پس از خطای missing key تنظیم و save شد؛ `pg_dump ENOENT` رخ داد؛ بعداً backup و ساختار-verify موفق گزارش شد. رفع دقیق ENOENT تاریخی ثبت نشده.
- پیامک token درگاه بعداً نمایش داده شد؛ ارسال فیزیکی آزمایش نشده.
- شعبه/انبار، کالای test و طرف‌حساب ایجاد و مشاهده شدند؛ کدهای auto بر اساس گزارش کاربر درست شدند.
- users: online/offline/session count و خروج یک نشست توسط کاربر دیده شد؛ active/inactive ورود را قطع/برقرار کرد.
- چند UI: شکل طرف‌حساب/کالا/فاکتور، الگوی مودال و رنگ عملیات تغییر کردند؛ تأیید بصری per-screen است.
- party disable confirmation مسیر `/users/{id}/status` را در screenshot نشان داد؛ رفع قطعی آن از transcript معلوم نیست.

## راستی‌آزمایی بسته مستندات — 2026-09-25، workspace Windows

- `npm run lint`: موفق (`tsc --noEmit`).
- `npm test`: موفق، 26 فایل و 114 تست. زمان ثبت Vitest حدود 6.40s.
- `npm run build`: موفق؛ Vite، bundle `dist/server.cjs` و کپی assetها تکمیل شد.
- هشدار build: چند chunk frontend بیش از 500 kB است؛ blocking نیست.
- در این مرحله `npm run db:migrate`, سرور، health، اتصال به DB از برنامه، SMS، backup جدید یا restore اجرا نشدند.
- خروجی build زیر `dist` از Git ignore است.
