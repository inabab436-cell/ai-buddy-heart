/**
 * Storefront language (Arabic default, English optional). Arabic source
 * strings are the keys; `t()` returns the English text when English is active.
 */
import { useEffect, useSyncExternalStore } from "react";

export type StoreLang = "ar" | "en";
const KEY = "cupai_store_lang";
let current: StoreLang = "ar";
let loaded = false;
let hydrated = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { if (window.localStorage.getItem(KEY) === "en") current = "en"; } catch { /* ignore */ }
}

export function getStoreLang(): StoreLang { if (!hydrated) return "ar"; load(); return current; }

export function setStoreLang(lang: StoreLang) {
  current = lang;
  try { window.localStorage.setItem(KEY, lang); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export function useStoreLang(): StoreLang {
  useEffect(() => {
    if (!hydrated) { hydrated = true; load(); if (current !== "ar") listeners.forEach((l) => l()); }
  }, []);
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => listeners.delete(cb); },
    getStoreLang,
    () => "ar",
  );
}

export const storeDir = () => (getStoreLang() === "en" ? "ltr" : "rtl");

export const EN: Record<string, string> = {
  "إخفاء تفاصيل الأوردر": "Hide order details",
  "إغلاق": "Close",
  "إنشاء الأوردر": "Place order",
  "اكتب الاسم ثنائي على الأقل (الاسم واسم الأب) بدون أرقام أو رموز.": "Enter at least first and last name, without numbers or symbols.",
  "الإجمالي": "Total",
  "الإجمالي النهائي": "Grand total",
  "الاسم *": "Name *",
  "الاسم ثنائي أو ثلاثي": "Full name",
  "التالي": "Next",
  "التوجه لإتمام الدفع": "Continue to payment",
  "الحد الأدنى للطلب": "Minimum order",
  "الدفع": "Payment",
  "الرجوع لرؤية تفاصيل الأوردر": "Show order details",
  "الرقم طويل: رقم الموبايل المصري 11 رقم.": "Number too long: Egyptian mobile numbers are 11 digits.",
  "الرقم ناقص: رقم الموبايل المصري 11 رقم.": "Number too short: Egyptian mobile numbers are 11 digits.",
  "السعر بعد الخصم": "Price after discount",
  "السعر قبل الخصم": "Price before discount",
  "السلة": "Cart",
  "الشحن": "Shipping",
  "العنوان *": "Address *",
  "العنوان ناقص: اكتب المحافظة والمنطقة والشارع.": "Incomplete address: add governorate, area and street.",
  "العنوان ناقص: اكتب المنطقة والشارع أو علامة مميزة.": "Incomplete address: add area and street or a landmark.",
  "الكل": "All",
  "الكميات التالية غير متاحة حالياً، ولم يتم حفظ الأوردر:": "These quantities are unavailable, the order was not saved:",
  "اللون:": "Colour:",
  "المبلغ المطلوب الآن": "Amount due now",
  "المتبقي من العرض": "Remaining in offer",
  "المتجر غير موجود": "Store not found",
  "المجموعة الجديدة": "New collection",
  "المحافظة - المنطقة - الشارع": "Governorate - Area - Street",
  "المقاس": "Size",
  "الملخص": "Summary",
  "انتهى العرض": "Offer ended",
  "بالطريقة التي تناسبك": "Your way",
  "بانتظار إتمام الدفع": "Awaiting payment",
  "بيانات الدفع": "Payment details",
  "تأكيد الأوردر": "Confirm order",
  "تتبع طلبي": "Track order",
  "تسوّق الآن": "Shop now",
  "تفاصيل المنتج": "Product details",
  "تم إنشاء الأوردر بنجاح ✅": "Order placed successfully ✅",
  "تم تأكيد الأوردر": "Order confirmed",
  "تم تسجيل الأوردر — فاضل إتمام الدفع": "Order received — payment pending",
  "تمت الإضافة للسلة ✓": "Added to cart ✓",
  "تمت الإضافة بالفعل": "Already added",
  "تواصل معنا": "Contact us",
  "جارٍ إنشاء الأوردر…": "Placing order…",
  "جارٍ التحقق من المخزون…": "Checking stock…",
  "خدمة العملاء": "Customer care",
  "خصم مطبّق": "Discount applied",
  "دفع آمن": "Secure payment",
  "رجوع": "Back",
  "رقم الأوردر:": "Order number:",
  "رقم الهاتف *": "Phone *",
  "رقم غير صحيح: لازم يبدأ بـ 010 أو 011 أو 012 أو 015 ويكون 11 رقم.": "Invalid number: must start with 010, 011, 012 or 015 and be 11 digits.",
  "زيادة": "Increase",
  "سعر الشحن غير محدد": "Shipping price not set",
  "سلة الشراء": "Shopping cart",
  "سلتك فارغة": "Your cart is empty",
  "شحن سريع": "Fast shipping",
  "شراء الآن": "Buy now",
  "طريقة الدفع": "Payment method",
  "عرض": "Offer",
  "عروض لفترة محدودة · ": "Limited-time offers · ",
  "على كل أوردر": "Per order",
  "في السلة ✓": "In cart ✓",
  "قريباً": "Coming soon",
  "قطع": "pieces",
  "قطعة": "piece",
  "قيمة الخصم": "Discount",
  "كل المنتجات": "All products",
  "لا توجد طرق دفع مفعّلة — سيتم التواصل معك للاتفاق على الدفع.": "No payment methods enabled — we'll contact you to arrange payment.",
  "لا توجد مناطق شحن محددة — سيتم التواصل معك لتحديد الشحن.": "No shipping zones set — we'll contact you about shipping.",
  "لا توجد منتجات منشورة بعد.": "No products published yet.",
  "لكل المحافظات": "To all governorates",
  "لم تُضِف أي منتجات بعد.": "You haven't added any products yet.",
  "مرة واحدة لكل عميل": "Once per customer",
  "ملاحظات": "Notes",
  "ملخص الأوردر": "Order summary",
  "منطقة الشحن": "Shipping zone",
  "نرد عليك في أسرع وقت": "We reply fast",
  "نفدت الكمية": "Sold out",
  "نقص": "Decrease",
  "نوع الاستخدام": "Usage",
  "ينتهي خلال": "Ends in",
  "لا يوجد متجر على الرابط": "No store at",
  "شحن لكل المحافظات · الدفع بالطريقة التي تناسبك": "Shipping nationwide · Pay your way",
  "وفّرت": "You saved",
  "على": "on",
  "اشترِ": "Buy",
  "وتوفّر": "and save",
  "اجعلها": "Make it",
  "آخر": "Last",
  "متبقي": "Only",
  "فقط": "left",
  "يوم": "d",
  "لازم تسجّل الدخول بالإيميل الأول عشان نقدر ننشئ الأوردر.": "Please sign in with your email first so we can place the order.",
  "الكمية المطلوبة غير متاحة حالياً.": "The requested quantity is currently unavailable.",
  "تعذّر إنشاء الأوردر. الرجاء المحاولة مرة أخرى.": "Couldn't place the order. Please try again.",
  "الكمية المطلوبة أكبر من المتاح في المخزون.": "Requested quantity exceeds available stock.",
  "لن يُعتبر الأوردر مدفوعاً قبل تأكيد الدفع": "The order isn't considered paid until payment is confirmed",
  "عبر": "via",
  "المطلوب": "Requested",
  "المتاح": "Available",
};

export function t(ar: string): string {
  return getStoreLang() === "en" ? (EN[ar] ?? ar) : ar;
}

export function StoreLangToggle() {
  const lang = useStoreLang();
  const next: StoreLang = lang === "en" ? "ar" : "en";
  return (
    <button
      type="button"
      onClick={() => setStoreLang(next)}
      aria-label={lang === "en" ? "العربية" : "English"}
      className="store-label inline-flex h-10 items-center px-2 transition hover:opacity-70"
    >
      {lang === "en" ? "ع" : "EN"}
    </button>
  );
}
