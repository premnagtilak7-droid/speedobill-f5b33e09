# Pricing & Plan Management Overhaul

## What you'll see

1. **Public pricing access** — `/pricing` is viewable without logging in. Logged-in users still see it inside the dashboard layout. No more forced redirect to `/auth`.
2. **Updated plan content** matching your spec (Free 5 tables / Basic ₹199 / Premium ₹499 with new feature lists).
3. **Improved monthly/yearly toggle** with clear labels, a "Save ₹398 (2 months free)" badge on yearly, and yearly highlighted as recommended.
4. **Plan-limit upgrade modal** — when free users hit a limit (6th table, 21st menu item, 2nd staff, AI scanner, data export), a polished popup appears: "🔒 This feature requires Basic plan — Upgrade for just ₹199/month" with [Upgrade Now] [Maybe Later] buttons.
5. **Subscription expired banner** with alert sound — auto-shows on every dashboard page when status is `expired`. "Renew Now" / "Continue on Free" actions.
6. **Auto-downgrade is already in place** (the existing `resolveSubscription` returns `free` when expiry < now). I'll surface this clearly with the new banner — no destructive data changes, all data stays safe.

## Out of scope (not changed)

- **WhatsApp / Email expiry notifications**: Sending these requires a server-side cron job + WhatsApp Business API setup. I'll add a TODO note but not implement it now — let me know if you want me to wire up the cron + email afterwards.
- **Hard server-side enforcement of limits**: Limits will be enforced client-side via the upgrade modal (matches the "show popup" spec). Server-side hard locks would require database triggers — happy to add as a follow-up if needed.
- **Payment gateway integration**: Still uses license-key flow; "Get Basic/Premium" buttons continue to show the existing "Payment integration coming soon" toast.

## Technical changes

### Routing (`src/App.tsx`)
- Move `/pricing` route OUT of `ProtectedRoute`. Render `<PricingPage />` standalone.
- Inside `PricingPage`, detect auth state: if logged in, wrap content in `<AppLayout>`; if not, show with a minimal public header/footer.

### `src/pages/PricingPage.tsx`
- Replace plan data with new spec (Free=5 tables, Basic=₹199/₹1990, Premium=₹499/₹4990, updated feature bullets per your message).
- Default `yearly = true`, show savings badge "Save ₹398 (2 months free!)" next to toggle.
- Add "RECOMMENDED" sub-label when yearly is on.
- Detect logged-in state via `useAuth`; render with `AppLayout` wrapper when `user` exists, plain wrapper otherwise.
- Hide license-key activation section for non-logged-in users.

### New `src/components/UpgradePromptDialog.tsx`
- Reusable controlled dialog: props `{ open, onOpenChange, featureName, requiredPlan }`.
- Body: "🔒 {featureName} requires {requiredPlan} plan. Upgrade for just ₹199/month!"
- Buttons: "Upgrade Now" (navigates to `/pricing`) and "Maybe Later" (closes).

### New `src/hooks/usePlanLimits.tsx`
- Exports helpers: `useTableLimit()`, `useMenuLimit()`, `useStaffLimit()`, `useFeatureGate('ai_scanner' | 'data_export')`.
- Each returns `{ canUse: boolean, limit: number, showUpgrade: () => void }` based on subscription tier.
- Limits matrix:
  - Free: tables=5, menu=20, staff=1, ai=false, export=false
  - Basic: tables=20, menu=∞, staff=5, ai=true, export=true
  - Premium: tables=∞, menu=∞, staff=∞, ai=true, export=true

### Wire limits into existing pages
- `src/pages/Tables.tsx` — before adding a table, check `useTableLimit`; if blocked, show upgrade dialog.
- `src/pages/MenuPage.tsx` — before "Add menu item", check `useMenuLimit`.
- `src/pages/StaffPage.tsx` — before "Add Staff", check `useStaffLimit`.
- `src/components/menu/AiMenuScanner.tsx` — gate behind `useFeatureGate('ai_scanner')`.
- Data export buttons (`ReportsPage`, `DataExportDownload`) — gate behind `useFeatureGate('data_export')`.

### New `src/components/SubscriptionExpiredBanner.tsx`
- Mounted in `AppLayout`. When `status === "expired"`, plays one-time alert sound (reuse `notification-sounds.ts`), shows sticky top banner: "⚠️ Your subscription has expired! Account is on Free plan. Renew now to restore access." with [Renew Now] / [Continue on Free] buttons.
- Dismiss state stored in `sessionStorage` so it doesn't replay on every page.

### Subscription type tweak (`src/hooks/useSubscription.tsx`)
- `resolveSubscription` currently returns `free` when expiry passes. Change so that when a hotel HAD a paid tier and it just expired (within last 7 days), return status `expired` instead of `free`. After 7 days, becomes `free`. This drives the banner.

## File touch list

- Edit: `src/App.tsx`, `src/pages/PricingPage.tsx`, `src/hooks/useSubscription.tsx`, `src/components/AppLayout.tsx`, `src/pages/Tables.tsx`, `src/pages/MenuPage.tsx`, `src/pages/StaffPage.tsx`, `src/components/menu/AiMenuScanner.tsx`
- Create: `src/components/UpgradePromptDialog.tsx`, `src/hooks/usePlanLimits.tsx`, `src/components/SubscriptionExpiredBanner.tsx`

After approval I'll implement everything and verify the build.
