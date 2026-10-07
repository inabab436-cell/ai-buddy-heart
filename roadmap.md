# Roadmap

- [x] Open onboarding immediately after merchant registration, including Google registration.
- [x] Improve the Google continuation screen design

- [ ] Audit and remove site-visible AI/agent references and explicit imagery; report exact changes without altering functionality.

- [x] Copy GitHub project files + install deps
- [x] Fix preview/build errors
- [x] Redesign the mobile dashboard shortcuts and add concise orders, active customers, and net pending earnings summaries
- [ ] Fix "الاسم لم يطابق أي منتج في الكتالوج" leak: fuzzy/token-based product matching in src/lib/order-availability.ts
- [ ] Fuzzy color/size matching (stop exact-equality "غير متاح" false negatives)
- [ ] pickProduct in order-catalog-match.ts must resolve ambiguity instead of returning null (silent no stock deduction)
- [x] Add order tracking by order number (limited) + phone verification (full details)
- [x] Replace the store header search icon with a "تتبع طلبي" text button and restyle the tracking page to match the storefront design
- [ ] Remove regex/keyword dependence in payment-confirmation detection -> LLM-driven intent
- [x] Reorganize dashboard sections, collapsible routed notifications, agent controls, earnings, and quick stock additions
- [x] Redesign the public waitlist page with a calm, smart, orderly visual direction and CUPAI naming
- [x] Align the waitlist page with the main CUPAI design and add a live three-day launch countdown
- [x] Add the complete customer chat to the brand owner's website preview, connected to the same agent
- [x] Browser/device push notifications (Firebase Cloud Messaging) for new orders, missing info, and human handoff
- [x] Remove product-image analysis and simplify image upload with manual colour assignment
- [x] Unify product image uploads and remove confusing unnamed colour/image groups
- [x] Redesign the merchant dashboard with a clean responsive sidebar and organized quick access
- [x] Simplify add/edit product forms into colour groups with size quantities and one shared image upload
- [x] Remove the earnings feature, dashboard card, page, navigation, and staff permission
- [x] English language switch on the merchant storefront
- [x] Merchant account as its own dashboard page with more settings
- [x] Customers chat without signing in, with a long-lived remembered session
- [x] Shipping-company Excel export button on the orders page
- [x] Remove customer sign-in entirely (Google panel, OTP, login UI) — guests only, per owner decision
- [x] Admin plan upgrade: store subscription start/end dates (monthly from activation), show to admin + merchant, warn merchant of store restriction on expiry until renewal
- [ ] Checkout: remove "لازم تسجّل الدخول بالإيميل" block — guests can place orders
- [ ] Orders page cleanup: remove long instructions, hide selection checkboxes until toggled, add edit-order button
- [ ] Enforce subscription expiry: restrict store (storefront/agent/merchant actions) once period ends until renewal
