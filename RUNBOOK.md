# راهنمای عملیاتی

## شروع روزانه

1. وضعیت PostgreSQL و دسترسی پورت را بررسی کنید.
2. environment محلی را از منبع امن بارگذاری کنید.
3. npm run lint و npm test را در تغییرات مهم اجرا کنید.
4. health endpoint را از host و یک client شبکه تست کنید.
5. ورود، یک عملیات کم‌خطر، audit و logout را smoke test کنید.
6. آخرین backup و ظرفیت دیسک مقصد را بررسی کنید.

## استقرار کد

git pull
npm install
npm run lint
npm test
npm run build
npm start

روی دیتابیس موجود، پیش از migration backup معتبر بگیرید. start خودش migrationهای معوق را کنترل می‌کند؛ برای تغییرات حساس ابتدا npm run db:migrate را در پنجره نگهداری اجرا کنید.

## پایش

- process اجرای production
- PostgreSQL connectivity
- فضای data/uploads و data/backups
- خطاهای migration و backup
- health و routeهای اصلی
- خطاهای auth و audit
- دسترسی شبکه و TLS

## خرابی

- اگر برنامه بالا نمی‌آید: log و config validation را بررسی کنید؛ secret را چاپ نکنید.
- اگر دیتابیس قطع است: سرویس، host، port و connection را از منبع امن بررسی کنید.
- اگر backup مشکل دارد: کلید، مقصد، hash و فضای دیسک را بررسی کنید؛ restore روی محیط اصلی انجام ندهید.
- اگر داده مشکوک است: write را متوقف، backup سالم را حفظ و موضوع را ثبت کنید.

پاک‌سازی دیتابیس، setup دوباره، تغییر migration اعمال‌شده، commit فایل .env یا قرار دادن backup خام در Git ممنوع است.
