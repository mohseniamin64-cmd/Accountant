# مسیر پروژه

هدف سامانه حسابداری شبکه‌ای دیاکو پوشش کاربران و نقش‌ها، طرف‌حساب، کالا و انبار، خرید و فروش، تولید، خدمات و گارانتی، خزانه، حسابداری، سال مالی، تنظیمات و backup است.

## مسیر طی‌شده

1. پایه React/Vite و Express/TypeScript ایجاد شد.
2. PostgreSQL و migrationهای checksumدار اضافه شد.
3. دامنه‌های کسب‌وکار در server/modules تفکیک شدند.
4. احراز هویت، session، audit و recovery محلی اضافه شد.
5. backup رمزنگاری‌شده و مستندات حاکمیتی ایجاد شد.
6. بازبینی کد و وضعیت فعلی در PROJECT_STATUS.md ثبت شد.
7. این بسته برای ادامه پروژه پس از حذف چت یا تعویض سیستم اضافه شد.

## وضعیت فعلی

- شاخه مرجع: main
- مرجع GitHub: https://github.com/mohseniamin64-cmd/Accountant
- قابلیت‌های کد گسترده‌اند، اما همه آن‌ها در نصب زنده اثبات نشده‌اند.
- آخرین وضعیت ثبت‌شده: test، build، health، migration و restore کامل در این بازبینی اجرا نشده‌اند.
- production طبق اسکریپت فعلی پورت پیش‌فرض 5000 دارد؛ مقدار نمونه توسعه 4173 است.
- Credentialها، backupهای runtime و فایل‌های upload عمداً داخل Git نیستند.

## مراحل آینده

1. ثبت نسخه دقیق Node.js، npm، PostgreSQL و Windows در ENVIRONMENT.md.
2. تهیه .env محلی از منبع امن.
3. اجرای lint، test، build و migration در محیط کنترل‌شده.
4. اجرای health و smoke test دامنه‌ها.
5. آزمون backup و restore در محیط جداگانه.
6. آزمون واقعی بارکدخوان، چاپگر و SMS.
7. تعیین reverse proxy، TLS، DNS، firewall، سرویس Windows و مانیتورینگ.
8. رفع موارد SECURITY-NEXT-STEPS.md و ثبت release.
