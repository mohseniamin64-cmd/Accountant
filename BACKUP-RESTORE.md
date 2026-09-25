# پشتیبان و بازیابی

## فرمت واقعی

`server/modules/backup/service.ts` ابتدا PostgreSQL custom-format dump با `pg_dump`, سپس رمزنگاری AES-256-GCM می‌سازد. فایل magic `DIACOBK1`, IV دوازده‌بایتی و auth tag شانزده‌بایتی دارد؛ کلید محیطی `BACKUP_ENCRYPTION_KEY` باید Base64 متناظر 32 بایت باشد. Secret واقعی در مستند نوشته نمی‌شود: «این Credential باید از محل امن یا Dashboard مربوطه دوباره دریافت شود».

نام فایل با شرکت/سری نصب/نسخه/زمان شمسی/ترتیب روزانه ساخته می‌شود. مسیر پیش‌فرض `data/backups`; ابزار dump می‌تواند executable محلی یا در شرایط `ENOENT` و env مشخص، Docker `BACKUP_DOCKER_CONTAINER` باشد.

## خروجی قبلی و مشاهده‌شده

در workspace فعلی `%USERPROFILE%\Desktop\سامانه حسابداری شبکه ای\data\backups` پنج فایل `.enc`، جدیدترین به تاریخ شمسی 1405/06/31، و حجم مجموع حدود 1.8 MB دیده شد. این‌ها در Git ignore شده‌اند؛ از راه GitHub قابل بازیابی نیستند و تازگی/سلامت واقعی‌شان تأیید تازه نشده.

## ساخت و انتقال backup

1. در برنامه backup دستی بگیر و run را `succeeded` ببین.
2. `verify` اجرا کن: hash SHA-256 بررسی، فایل decrypt موقت می‌شود و `pg_restore --list` را می‌گذراند؛ dump موقت پاک می‌شود.
3. کل پوشه `data/backups` را به وسیله فیزیکی/میزبان مستقل کپی کن. پوشه `data/uploads` را هم جداگانه بگیر.
4. کلید را از password manager/مخزن امن نگه‌دار، جدا از backup. SHA-256 و اندازه دو کپی را مقایسه کن.

`verify` معادل restore نیست و recovery UI در کد حاضر یافت نشد.

## Restore واقعی: شکاف فعلی

فایل encrypted را باید با همان key به custom-format dump رمزگشایی کرد و با `pg_restore` داخل PostgreSQL سازگار و **database خالی** بارگذاری کرد. ابزار decrypt/restore امنِ بسته‌بندی‌شده در مخزن فعلی وجود ندارد؛ password DB, database name/user نیز در repo نیست. هیچ command آماده‌ای که بدون ریسک overwrite روی production قابل اجرا باشد ارائه نشده است.

تا وقتی این شکاف رفع نشده و restore واقعی در DB آزمایشی ثبت نشده، پروژه/داده «قابل‌بازیابی تأییدشده» اعلام نشود. برای آزمون:

1. یک PostgreSQL 16 جدا و DB خالی، شبکه‌ای ایزوله از production، آماده کنید.
2. با ابزار recovery بازبینی‌شده، `.enc` را به dump موقت رمزگشایی کنید؛ dump موقت شامل همه داده‌هاست، دسترسی NTFS را محدود کنید و پس از restore با اطمینان پاک کنید.
3. `pg_restore --no-owner --no-privileges --dbname=<test-db> <temporary-custom.dump>` فقط با مقصد آزمایشی خالی و user مجاز اجرا شود؛ `--clean` نزنید.
4. خروجی/خطا را بررسی و تعداد اسناد، جمع بدهکار/بستانکار، موجودی، serial، طرف‌حساب‌ها، audit و فایل uploads را با snapshot قبل مقایسه کنید.
5. DB آزمایشی و dump خام را طبق سیاست حفاظت داده پاک/نگهداری امن کنید؛ نتیجه و نسخه برنامه/PostgreSQL را ثبت کنید.

جزئیات key/storage، وضعیت Windows و شرط توقف را در [WINDOWS-REINSTALL.md](WINDOWS-REINSTALL.md) ببینید. این مراحل هنوز restore اجراشده نیستند؛ ابزار decrypt و آزمون ایزوله کار باز است.
