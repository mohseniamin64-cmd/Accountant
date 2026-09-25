# نمایه API

Express در `server/app.ts` routerها را نصب می‌کند. APIها زیر `/api` هستند مگر مسیر استثنا. این نمایه خانواده route است، نه قرارداد کامل request/response؛ schema و permission را در route و UI همان commit بخوانید. وجود endpoint تضمین دسترسی/موفقیت نیست.

| Prefix | دامنه |
|---|---|
| `/api/auth` | ورود، خروج، وضعیت نشست و lock |
| `/api/users`, `/api/roles` | کاربران، نقش‌ها، وضعیت و نشست‌ها |
| `/api/parties` | طرف‌حساب‌ها، فیلتر و آرشیو |
| `/api/products` | کالا، قطعه، خدمات، سریال/گارانتی |
| `/api/organization` | شعب و انبارها |
| `/api/purchases`, `/api/sales` | فاکتور، ردیف، قطعی و برگشت |
| `/api/inventory` | موجودی، انتقال و تعدیل |
| `/api/production` | BOM و دستور تولید |
| `/api/service` | پذیرش و پرونده خدمات؛ مسیر عمومی جداست |
| `/api/service/public` | رهگیری عمومی محدود |
| `/api/treasury` | صندوق، بانک، دریافت/پرداخت، چک و تخصیص |
| `/api/accounting` | حساب‌ها، دفتر، اسناد، دوره مالی و گزارش |
| `/api/audit` | گزارش امنیت/ممیزی |
| `/api/backups` | تنظیم، اجرا، فهرست و verify فایل backup؛ restore کامل ندارد |
| `/api/settings` | تنظیمات سازمان/سامانه |
| `/api/sms`, `/api/sms/gateway` | پیامک/درگاه |
| `/api/setup` | نصب اولیه |
| `/api` bootstrap/logo/recovery | بررسی bootstrap، تصویر لوگو و لانچر recovery محلی |

## قراردادهای عمومی

- اعتبارسنجی و مجوز باید سمت server enforcement شوند؛ UI hiding به‌تنهایی امنیت نیست.
- خطای 404 endpoint و validation 4xx را از هم تشخیص دهید. نمونه گزارش طرف‌حساب در تصویر، `PATCH /users/{id}/status` بود؛ با route واقعی `/parties` تطبیق دهید.
- audit نباید password, bearer token, session cookie یا key را ثبت کند.
- نام دقیق endpointهای جزئی و payload با code در `server/modules/<module>/routes.ts` و schemaهای همان module مشخص است؛ این جدول نسخه‌دار و خلاصه است.
