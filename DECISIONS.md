# ثبت تصمیم‌ها

## D-001 — PostgreSQL
- تصمیم: PostgreSQL با کتابخانه pg.
- گزینه‌ها: SQLite، فایل محلی، دیتابیس ابری.
- دلیل: شبکه‌ای، چندکاربره، transaction و رشدپذیر.
- شرط: سرویس، اتصال و backup عملیاتی لازم است.
- تغییر: فقط با migration و آزمون restore.

## D-002 — Express/TypeScript و ماژول دامنه‌ای
- تصمیم: backend در Express/TypeScript و تفکیک بر اساس دامنه.
- گزینه‌ها: monolith بدون مرزبندی یا framework دیگر.
- دلیل: هم‌خوانی با کد و استقلال حسابداری، انبار، خدمات و غیره.
- شرط: قرارداد API حفظ شود.
- تغییر: با برنامه مهاجرت و ثبت breaking change.

## D-003 — React/Vite
- تصمیم: React + Vite.
- دلیل: ساختار موجود، توسعه سریع و build مستقل.
- شرط: assetهای production با build تولید شوند.
- تغییر: حفظ route و قرارداد API.

## D-004 — migration checksumدار
- تصمیم: migration شماره‌دار با checksum و advisory lock.
- گزینه ردشده: تغییر دستی schema.
- دلیل: جلوگیری از اجرای مجدد و تشخیص دستکاری.
- شرط: migration اعمال‌شده ویرایش نشود.
- تغییر: migration جدید اضافه شود.

## D-005 — backup رمزنگاری‌شده خارج از Git
- تصمیم: AES-256-GCM، مسیر runtime یا خارجی، Git ignore.
- گزینه ردشده: backup خام یا نگهداری در Git.
- دلیل: حفاظت داده و Credential.
- شرط: کلید، مقصد و retention جداگانه حفظ شوند؛ restore کامل هنوز باید آزموده شود.
- تغییر: پس از تعیین مقصد امن.

## D-006 — پورت canonical
- تصمیم: npm start و پیش‌فرض 5000 مرجع production است.
- گزینه‌های ردشده: 4173 نمونه env و server.ts قدیمی.
- دلیل: رفتار اسکریپت واقعی.
- شرط: PORT می‌تواند override شود.
- تغییر: پس از تصمیم نهایی استقرار.

## D-007 — عدم ثبت secret
- تصمیم: هیچ Password، Token، Key، Cookie یا Recovery Code در Git نباشد.
- دلیل: private بودن Repository حفاظت کافی نیست.
- شرط: پس از نصب مجدد از محل امن دریافت شود.
- تغییر: اتصال به secret manager رسمی، بدون ورود مقدار به Git.
