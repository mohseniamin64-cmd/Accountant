# اجرای واقعی و قابل‌ردیابی

- ساختار repository، package.json، config، main، migrations و moduleها بازبینی شده‌اند.
- commit مرجع پیش از این بسته: 948024f با پیام تکمیل workflowهای حسابداری و خدمات.
- شاخه main با origin/main همگام بود.
- در بازبینی مستنداتی 2026-09-25، برنامه، دیتابیس، migration، health، test و build اجرا نشده بودند.

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

## راستی‌آزمایی بسته مستندات — 2026-09-25

lint، test و build پروژه اجرا و موفق شدند. این نتیجه فقط سلامت static/type/test/build را نشان می‌دهد؛ health زنده، migration روی دیتابیس موجود و restore کامل backup هنوز باید در محیط کنترل‌شده اجرا شوند.
