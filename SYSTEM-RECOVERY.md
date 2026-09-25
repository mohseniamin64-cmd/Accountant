# بازیابی پس از تعویض ویندوز یا خرابی سیستم

## باقی می‌ماند

کد، migrationها، تنظیمات نمونه و مستندات در GitHub؛ تاریخچه commit و تصمیم‌ها؛ و اطلاعاتی که در backup خارج از سیستم حفظ شده باشد.

## از بین می‌رود یا تضمین نمی‌شود

.env و Credentialهای local، node_modules، dist و .runtime، data/uploads و data/backups در صورت نداشتن کپی جداگانه، دیتابیس local، sessionهای فعال، تنظیمات Windows Service، firewall، DNS، reverse proxy و گواهی‌ها مگر جداگانه ثبت شده باشند.

## ترتیب بازیابی

1. ویندوز به‌روز، حساب محدود و Firewall را آماده کنید.
2. Git، Node.js سازگار، npm و PostgreSQL را نصب کنید.
3. repository را از GitHub clone و شاخه main را کنترل کنید.
4. npm install اجرا کنید.
5. PostgreSQL database/user و دسترسی شبکه را طبق اطلاعات امن بسازید.
6. .env را از منبع امن بازسازی کنید؛ مقدار واقعی در Git نرود.
7. backup را ابتدا در محیط جداگانه restore کنید.
8. npm run db:migrate را روی محیط کنترل‌شده اجرا کنید.
9. npm run lint، npm test و npm run build را اجرا کنید.
10. npm start را با PORT تصمیم‌گرفته‌شده اجرا کنید.
11. health، login، audit، عملیات تستی، backup و logout را بررسی کنید.
12. reverse proxy، TLS، firewall، DNS، printer، barcode و SMS را جداگانه وصل و تست کنید.
13. نتیجه، نسخه‌ها و موارد باقی‌مانده را در ENVIRONMENT.md و PROJECT_STATUS.md ثبت کنید.

## سرویس‌های نیازمند اتصال مجدد

PostgreSQL، secret source، storage backup خارجی، reverse proxy/TLS، DNS، سرویس SMS، چاپگر و بارکدخوان. هر Credential باید از محل امن یا Dashboard مربوطه دوباره دریافت شود.

## معیار موفقیت

clone، migration بدون خطا، build موفق، health سالم، login و audit سالم، backup قابل‌بازخوانی، restore آزمایشی موفق و تست شبکه ثبت‌شده.
