# Popoye Insurance — Admin Dashboard UI Specification

**Status**: Approved design reference (stakeholder-supplied)
**Scope**: Internal admin web application. Desktop-first, professional, data-dense, for operations/finance teams handling 10k–50k+ monthly records. Must NOT look like the customer payment page.

## Layout

```
┌────────────────────────────────────┐
│ TOP HEADER                          │
├────────────┬───────────────────────┤
│ SIDEBAR    │ MAIN CONTENT           │
│ (dark)     │ (#F7F8F9)              │
└────────────┴───────────────────────┘
```
Sidebar width 240–260px, main content = remaining width.

## Colors
`#D1041F` primary, `#A80319` dark, `#184CB2` secondary, `#123A8A` secondary dark, `#096D4B` success, `#D97706` warning, `#F7F8F9` background, `#FFFFFF` surface, `#13272E` text, `#47484A` secondary text, `#6A7678` muted, `#E7EAEC` border.

## Sidebar (248px, dark navy `#13272E`, 100vh, fixed/sticky)
- Brand area 72px with logo (white variant on dark), bottom border `rgba(255,255,255,0.08)`.
- Nav: Dashboard, Customers, Policies, Payments, Campaigns, Reports, Settings (+ future Users, Audit Logs, Provider Configuration).
- Items 42–46px, radius 8px, margin 3px 10px. Icons: LayoutDashboard, Users, FileText, CreditCard, MessageSquare, BarChart3, Settings — **no emoji**.
- Active: background `#D1041F`, white text/icon, weight 600. Inactive: `#CBD5D8`, hover `rgba(255,255,255,0.08)`.

## Top header (64–72px, white, border-bottom `#E7EAEC`)
Left: page title/breadcrumb. Right: notifications, admin user (avatar, name, role), dropdown, logout.

## Main content
Padding 24–32px, uses full desktop width.

## Page header
Title 24px/700 `#13272E`; subtitle 13–14px `#6A7678`. Actions: date filter, search, export.

## Summary cards (dashboard + payments)
4 white cards, border `#E7EAEC`, radius 12px, padding 20px, shadow `0 2px 6px rgba(19,39,46,0.05)`. Small label, large number, optional amount/change. Semantic accents only: green (Paid `#096D4B`), blue/orange (Unpaid/Pending), red (Failed `#D1041F`). Not full-color cards.

## Payments transactions table (primary screen)
Columns: Customer Name, Mobile, Vehicle No, Premium, Order ID, Payment Status, Payment Method, Transaction ID, Payment Date, Policy Status, Actions.
- Container white, border `#E7EAEC`, radius 12px; header `#F7F8F9` 44px, 12px/600 `#6A7678`; rows 56–64px, border `#F0F2F3`, body 13–14px `#13272E`.
- Customer column: name (600) + mobile below (12px `#6A7678`).
- Premium: `₹699`, weight 700.
- Status badges (pill, 9999px, 5px 10px, 11–12px/600): PAID `#E5F5EF`/`#096D4B`; UNPAID `#FFF4E5`/`#D97706`; PENDING `#E8F0FF`/`#184CB2`; FAILED `#FCE7EA`/`#D1041F`.
- Policy status separate from payment status: Pending/Processing/Issued/Failed semantic badges.

## Search & filters
Search 40–44px, 280–320px, radius 8px, search icon left — by name, mobile, vehicle, order ID, transaction ID. Filters: date range, payment status, policy status, method, product (compact).

## Export
"Export to Excel" — white bg, border `#184CB2`, text `#184CB2`, download icon, hover `#E8F0FF`. Secondary "Download Report" neutral outline.

## Pagination
Bottom right: rows per page 25/50/100, Previous / pages / Next (compact).

## Row actions
View + kebab menu: View Order, View Payment Attempts, Copy Payment URL, Resend WhatsApp, View Audit Log. Not overcrowded.

## Order detail drawer
Right-side drawer (or detail page) on row click: Customer Details, Vehicle Details, Policy Details, Order Details, Payment Details, Payment Attempts, WhatsApp Notifications, Audit Timeline.

## Payment timeline (vertical)
Order Created → Payment Initiated → Payment Pending → Payment Successful → WhatsApp Confirmation Sent → Policy Processing → Policy Issued. Done `#096D4B`, pending `#184CB2`, failed `#D1041F`.

## Dashboard home
Summary cards, payment trend, status distribution, recent payments, failed/pending payments, recent WhatsApp activity. Not overloaded.

## Charts
Daily collection, status distribution, renewals vs success. Palette: primary `#D1041F`, secondary `#184CB2`, success `#096D4B`. No random colors.

## Customers / Policies / Campaigns / Settings
- Customers: name, mobile, vehicle count, active policies, pending renewals, last payment; search by name/mobile/vehicle.
- Policies: customer, vehicle, policy number, type, expiry, premium, payment status, policy status; filters.
- Campaigns: campaign name, provider (generic, e.g. WhatsApp Provider), template, target/sent/delivered/failed, created date, status.
- Settings: Business, Branding, Payment, WhatsApp, Email, SMS, Storage, Notifications, Security, Users, Roles, Audit. Providers shown generically (Cashfree/Razorpay; AiSensy/Meta). Credentials never shown as plaintext.

## Responsiveness
Desktop 1280/1440/1920, min 1024. At 1440: sidebar 248px, 4-col cards. At 1024: sidebar 220px, 2-col cards. Below 860px: sidebar collapses to drawer, cards 1–2 col, table adapts.

## Design language
Professional, reliable, modern, clean, financial, operational. Avoid glassmorphism/neon/gradients/excessive rounded cards/huge type/excessive shadows/animation/stock-dashboard look.

## Architecture constraint
Configurable platform — do not hard-code Cashfree, AiSensy, Popoye business info, templates, gateway, product, or methods. Dashboard consumes backend configuration. Provider abstractions: PaymentGatewayProvider (Cashfree/Razorpay/…), WhatsAppProvider (AiSensy/Meta/…).

## Reference
Implementation: `admin-web/` (Vite + React). Backend contract: `contracts/api.md` (admin auth, orders, dashboard).