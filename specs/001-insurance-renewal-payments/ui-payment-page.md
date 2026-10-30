# Popoye Insurance — Customer Payment Page UI Specification

**Status**: Approved design reference (stakeholder-supplied)
**Scope**: The page a customer opens after tapping PAY NOW in a WhatsApp renewal message. Mobile-first, 360–430px phones, max-width 480px on desktop.

## Key requirements

- **Not an admin dashboard.** Mobile-first, clean, trustworthy, conversion-focused, for non-technical customers.
- Customer must immediately understand: who they're paying, which vehicle, how much, expiry date, how to pay.

## Visual style

- Popoye red (`#D1041F`), white cards, light grey background (`#F7F8F9`), dark charcoal text (`#13272E`), green success (`#096D4B`), blue accents (`#184CB2`), rounded cards, subtle shadows, large dominant amount, strong red PAY button, compact layout.
- Typography: Inter, fallback `-apple-system/BlinkMacSystemFont/"Segoe UI"/sans-serif`. Body 14–16px; name 18px/700; section heading 16px/700; premium 30–32px/800; labels 12–13px/500; button 16px/700.

## Page structure

1. **Top header** (~68px): white, Popoye logo left (actual asset if available), optional "Secured" indicator right.
2. **Security banner** (red `#D1041F`, ~52–60px): lock/shield icon + "Secure Insurance Renewal" / "Your payment is 100% secure".
3. **Customer Details card** (16px margin, radius 12–14px, shadow `0 2px 6px rgba(19,39,46,0.06)`): Name, Mobile, Vehicle Number, Vehicle, Policy Expiry. Two-column label/value; labels 12–13px `#6A7678`, values 13–14px/600 `#13272E`, vehicle number 700. Use a consistent professional icon library (Lucide/Material), **no emoji**.
4. **Payment Amount card**: heading + dominant amount (30–32px/800 `#13272E`). **Not editable**; amount always from the backend order.
5. **Choose Payment Method** (stacked cards, 64–72px, radius 10–12px):
   - UPI (first, recommended): green border `#096D4B`, background `#F7FFFC`, "Recommended" badge (`#E5F5EF`/`#096D4B`), subtitle "GPay · PhonePe · Paytm".
   - Scan & Pay: subtitle "Scan QR using any UPI app", QR icon.
   - Debit / Credit Card: "Visa, Mastercard, RuPay", card icon.
   - Net Banking: "All major banks supported", bank icon.
6. **Pay button**: full width, 52–56px, radius 9–10px, background `#D1041F`, white text 16px/700, e.g. "Pay ₹699", shadow `0 3px 8px rgba(209,4,31,0.18)`, hover/pressed `#A80319`, disabled `#CBC4C4`.
7. **Trust footer** (10–11px, `#6A7678`): Secure Payment | Trusted Gateway | 100% Secure.

## Payment states

- **PAYMENT_PENDING**: "Payment Processing — Your payment is being verified." No PAY button while confirming.
- **PAID**: success page — large green check (`#096D4B` on `#E5F5EF`), "Payment Successful!", transaction ID, amount, method, date/time, vehicle number; actions Download Receipt + Share on WhatsApp.
- **FAILED**: "Payment Failed", not completed, **Try Again**.
- **EXPIRED**: "Payment Link Expired", contact Popoye.
- **ALREADY_PAID**: "Payment Already Completed", transaction details, no PAY.
- **INVALID**: "Invalid Payment Request", contact Popoye.

## QR payment screen (Scan & Pay)

Heading "Pay using UPI"; large centered QR; "Scan QR using any UPI app"; supported app badges (GPay/PhonePe/Paytm — icons, not screenshots); divider "OR"; primary button "Open UPI Apps"; amount + order ID. **QR must be generated from trusted backend/payment-provider data — never from a browser-controlled amount.**

## UX & rules

- Journey: VERIFY DETAILS → CHOOSE PAYMENT → PAY → CONFIRMATION. No unnecessary navigation or admin functionality.
- Never trust the browser for amount, identity, order status, payment success, or transaction ID — all from the backend/payment provider.
- Accessibility: WCAG AA contrast where practical, ≥44px touch targets, accessible labels, status not conveyed by color alone.
- Avoid: gradients, glassmorphism, neon, excessive animations, huge logos, emoji icons, generic gateway look, excessive shadows.

## Reference

Implementation: `payment-web/` (Vite + React). Backend contract: `contracts/api.md` (GET /p/:token, POST /p/:token/pay, GET /p/:token/status, GET /p/:token/upi-qr).