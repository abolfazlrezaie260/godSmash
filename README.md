# 🌍 GodSmash (v1.0) — شبیه‌ساز سه‌بعدی تخریب سیاره زمین (Solar Smash Clone)

نسخه اول (**Version 1.0**) بازی **GodSmash** با الهام از مکانیک‌های بازی **Solar Smash** طراحی و پیاده‌سازی شده است.

## ✨ ویژگی‌های نسخه اول (مطابق نیازمندی‌ها)
- **ورود مستقیم بدون منو (Zero-Menu Direct Launch):** بازی بلافاصله وارد فضای سه‌بعدی و نمای سیاره زمین می‌شود.
- **سیاره زمین سه‌بعدی با تغییر شکل واقعی (3D Deformable Earth):**
  - رندرینگ WebGL با استفاده از `Three.js` شامل قاره‌ها، اقیانوس‌ها، کلاهک‌های قطبی، لایه ابرهای متحرک، هاله اتمسفر (Fresnel Shader) و چراغ شهرها در شب.
  - ایجاد **دهانه‌های برخورد واقعی (3D Vertex Craters)** روی مش سه‌بعدی زمین و ایجاد گدازه‌های مذاب و ترک‌های تکتونیکی در محل اصابت.
- **تک‌سلاح: موشک هسته‌ای قاره‌پیما (ICBM-V1 50MT):**
  - شلیک موشک با کلیک یا لمس مستقیم هر نقطه از سطح کره زمین (`Raycasting`).
  - حرکت موشک روی مسیر منحنی بالستیک سه‌بعدی (Quadratic Bézier Trajectory) همراه با رد دود و پلاسما و نشانگر قفل هدف روی سطح زمین.
  - موج انفجار کروی، گوی آتشین، پرتاب سنگ‌های مذاب به مدار، لرزش دوربین و موتور صوتی سنتزشده (`Web Audio API`).

## 🚀 نحوه اجرا و استقرار در مخزن GitHub (`abolfazlrezaie260/godSmash`)

برای اجرای محلی کافی است فایل `index.html` را در مرورگر باز کنید یا یک سرور محلی اجرا نمایید:

```bash
npx serve .
```

### پوش کردن کدها به مخزن GitHub شما
در پوشه پروژه دستورات زیر را اجرا کنید:

```bash
git init
git add .
git commit -m "feat: implement GodSmash v1.0 (3D Earth + single ICBM missile, no menu)"
git branch -M main
git remote add origin https://github.com/abolfazlrezaie260/godSmash.git
git push -u origin main
```
