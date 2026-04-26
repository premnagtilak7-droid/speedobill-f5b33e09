import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import { KioskProvider, useKioskMode } from "@/hooks/useKioskMode";
import StaffKiosk from "@/components/kiosk/StaffKiosk";
import KioskLockGuard from "@/components/kiosk/KioskLockGuard";
import ProtectedRoute from "@/components/ProtectedRoute";
import RoleGuard from "@/components/RoleGuard";
import PlanGuard from "@/components/PlanGuard";
import AppLayout from "@/components/AppLayout";
import { lazy, useEffect, Suspense } from "react";
import SpeedoBot from "@/components/SpeedoBot";
import PwaSplashOnboarding from "@/components/PwaSplashOnboarding";
import { AudioNotificationProvider } from "@/contexts/AudioNotificationContext";
import OrderRealtimeAlert from "@/components/OrderRealtimeAlert";
import { isPWA } from "@/lib/platform";

const PageFallback = () => (
  <div className="min-h-screen bg-[#0f1629] flex items-center justify-center">
    <div className="text-orange-500 text-xl">Loading...</div>
  </div>
);

import ScrollToTop from "@/components/ScrollToTop";

// Eager load auth pages + critical entry routes for stability
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import LandingPage from "./pages/LandingPage";
import MenuPage from "./pages/MenuPage";
import Dashboard from "./pages/Dashboard";
const ManagerDashboard = lazy(() => import("./pages/ManagerDashboard"));
const CaptainDashboard = lazy(() => import("./pages/CaptainDashboard"));
import VoidReports from "./pages/VoidReports";
import DailyClosing from "./pages/DailyClosing";
import StaffPage from "./pages/StaffPage";
import BillingHistory from "./pages/BillingHistory";
import IntegrationsPage from "./pages/IntegrationsPage";
import CustomersPage from "./pages/CustomersPage";
const CustomerProfile = lazy(() => import("./pages/CustomerProfile"));
import InventoryHub from "./pages/InventoryHub";

// Lazy load remaining app pages — prefetch after initial render
const Tables = lazy(() => import("./pages/Tables"));
const Analytics = lazy(() => import("./pages/Analytics"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const DataExportDownload = lazy(() => import("./pages/DataExportDownload"));
const KitchenView = lazy(() => import("./pages/KitchenView"));
const StaffPerformance = lazy(() => import("./pages/StaffPerformance"));
const AuditLog = lazy(() => import("./pages/AuditLog"));
const TableQR = lazy(() => import("./pages/TableQR"));
const ExpensesPage = lazy(() => import("./pages/ExpensesPage"));
const OrderHistory = lazy(() => import("./pages/OrderHistory"));
const CreatorAdmin = lazy(() => import("./pages/CreatorAdmin"));
const ChefKDS = lazy(() => import("./pages/ChefKDS"));
const CustomerOrder = lazy(() => import("./pages/CustomerOrder"));
const MenuRedirect = lazy(() => import("./pages/MenuRedirect"));
const IncomingOrders = lazy(() => import("./pages/IncomingOrders"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const CounterOrderPage = lazy(() => import("./pages/CounterOrder"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsConditions = lazy(() => import("./pages/TermsConditions"));
const SupportPage = lazy(() => import("./pages/SupportPage"));
const LayoutDesigner = lazy(() => import("./pages/LayoutDesigner"));
const InventoryPage = lazy(() => import("./pages/InventoryPage"));
const RecipesPage = lazy(() => import("./pages/RecipesPage"));
const VendorsPage = lazy(() => import("./pages/VendorsPage"));
const WastagePage = lazy(() => import("./pages/WastagePage"));
const StockAnalytics = lazy(() => import("./pages/StockAnalytics"));
const OnlineOrders = lazy(() => import("./pages/OnlineOrders"));
const SupplyStore = lazy(() => import("./pages/SupplyStore"));
const LoyaltySettings = lazy(() => import("./pages/LoyaltySettings"));
const StaffProfile = lazy(() => import("./pages/StaffProfile"));
const WaiterOrders = lazy(() => import("./pages/WaiterOrders"));
const OrderTracker = lazy(() => import("./pages/OrderTracker"));

// Public marketing feature pages
const BillingFeature = lazy(() => import("./pages/features/BillingFeature"));
const InventoryFeature = lazy(() => import("./pages/features/InventoryFeature"));
const ReportsFeature = lazy(() => import("./pages/features/ReportsFeature"));
const PayrollFeature = lazy(() => import("./pages/features/PayrollFeature"));
const CustomersFeature = lazy(() => import("./pages/features/CustomersFeature"));

// Public marketing add-on pages
const WaiterCallingAddon = lazy(() => import("./pages/addons/WaiterCallingAddon"));
const QrPayAddon = lazy(() => import("./pages/addons/QrPayAddon"));
const SmsMarketingAddon = lazy(() => import("./pages/addons/SmsMarketingAddon"));
const FeedbackAddon = lazy(() => import("./pages/addons/FeedbackAddon"));

// Prefetch critical routes after first paint
if (typeof window !== "undefined") {
  requestIdleCallback?.(() => {
    import("./pages/Dashboard");
    import("./pages/Tables");
    import("./pages/KitchenView");
    import("./pages/Analytics");
    import("./pages/SettingsPage");
    import("./pages/DataExportDownload");
    import("./pages/OrderHistory");
  }) ?? setTimeout(() => {
    import("./pages/Dashboard");
    import("./pages/Tables");
    import("./pages/KitchenView");
  }, 2000);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AppRoutes = () => {
  const { user, role, loading } = useAuth();
  const { isKiosk } = useKioskMode();
  const location = useLocation();
  const navigate = useNavigate();

  const isCreator = user?.email === "speedobill7@gmail.com";
  const defaultAuthenticatedRoute = isCreator && role === "owner"
    ? "/creator-admin"
    : role === "chef"
      ? "/kds"
      : role === "captain"
        ? "/captain"
        : role === "waiter"
          ? "/tables"
          : role === "manager"
            ? "/manager"
            : role === "owner"
              ? "/dashboard"
              : "/tables";

  useEffect(() => {
    if (
      !loading &&
      user &&
      isCreator &&
      role === "owner" &&
      !isKiosk &&
      location.pathname !== "/creator-admin" &&
      location.pathname !== "/auth" &&
      location.pathname !== "/reset-password" &&
      !location.pathname.startsWith("/order/") &&
      !location.pathname.startsWith("/menu/")
    ) {
      navigate("/creator-admin", { replace: true });
    }
  }, [loading, user, isCreator, role, isKiosk, location.pathname, navigate]);

  // Kiosk Mode + owner logged in (or no user yet) → show full-screen Staff selection grid
  if (isKiosk && (role === "owner" || !user)) {
    return <StaffKiosk />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <ScrollToTop />
      <KioskLockGuard />
      <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route
          path="/"
          element={
            user
              ? <Navigate to={defaultAuthenticatedRoute} replace />
              : isPWA()
                ? <Navigate to="/auth" replace />
                : <LandingPage />
          }
        />
        <Route path="/auth" element={user ? <Navigate to={defaultAuthenticatedRoute} replace /> : <Auth />} />
        <Route path="/auth/staff" element={user ? <Navigate to={defaultAuthenticatedRoute} replace /> : <Auth />} />
        <Route path="/kitchen" element={<Navigate to="/kds" replace />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsConditions />} />
        <Route path="/support" element={<SupportPage />} />
        <Route path="/order/:tableId" element={<CustomerOrder />} />
        <Route path="/dine/:hotelId/:tableId" element={<CustomerOrder />} />
        <Route path="/menu/:hotelId/:tableNumber" element={<MenuRedirect />} />
        <Route path="/track/:orderId" element={<OrderTracker />} />
        <Route path="/features/billing" element={<BillingFeature />} />
        <Route path="/features/inventory" element={<InventoryFeature />} />
        <Route path="/features/reports" element={<ReportsFeature />} />
        <Route path="/features/payroll" element={<PayrollFeature />} />
        <Route path="/features/customers" element={<CustomersFeature />} />
        <Route path="/addons/waiter-calling" element={<WaiterCallingAddon />} />
        <Route path="/addons/qr-pay" element={<QrPayAddon />} />
        <Route path="/addons/sms-marketing" element={<SmsMarketingAddon />} />
        <Route path="/addons/feedback" element={<FeedbackAddon />} />
        <Route path="/creator-admin" element={<ProtectedRoute><RoleGuard allowed={["owner"]} redirectTo="/tables"><CreatorAdmin /></RoleGuard></ProtectedRoute>} />

        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/pricing" element={<RoleGuard allowed={["owner", "manager"]}><PricingPage /></RoleGuard>} />
          <Route path="/download-data-export" element={<RoleGuard allowed={["owner", "manager"]}><DataExportDownload /></RoleGuard>} />
        </Route>

        <Route element={<ProtectedRoute requireActiveSubscription><AppLayout /></ProtectedRoute>}>
          {/* Shared routes — all roles */}
          <Route path="/tables" element={<RoleGuard allowed={["owner", "manager", "waiter", "captain"]}><Tables /></RoleGuard>} />
          <Route path="/counter" element={<RoleGuard allowed={["owner", "manager", "waiter", "captain"]}><CounterOrderPage /></RoleGuard>} />
          <Route path="/my-orders" element={<RoleGuard allowed={["owner", "manager", "waiter", "captain"]}><WaiterOrders /></RoleGuard>} />
          {/* /kitchen removed — KDS is the single kitchen display */}
          <Route path="/menu" element={<RoleGuard allowed={["owner", "manager", "waiter", "chef", "captain"]}><MenuPage /></RoleGuard>} />
          <Route path="/kds" element={<RoleGuard allowed={["owner", "manager", "chef"]}><PlanGuard featureName="Kitchen Display System (KDS)"><ChefKDS /></PlanGuard></RoleGuard>} />

          {/* Captain console */}
          <Route path="/captain" element={<RoleGuard allowed={["owner", "manager", "captain"]}><CaptainDashboard /></RoleGuard>} />

          {/* Owner + Manager shared routes */}
          <Route path="/dashboard" element={<RoleGuard allowed={["owner", "manager"]}><Dashboard /></RoleGuard>} />
          <Route path="/manager" element={<RoleGuard allowed={["owner", "manager"]}><ManagerDashboard /></RoleGuard>} />
          <Route path="/incoming-orders" element={<RoleGuard allowed={["owner", "manager", "waiter", "captain"]}><IncomingOrders /></RoleGuard>} />
          <Route path="/analytics" element={<RoleGuard allowed={["owner", "manager"]}><PlanGuard featureName="Analytics & Reports"><Analytics /></PlanGuard></RoleGuard>} />
          <Route path="/reports" element={<RoleGuard allowed={["owner", "manager"]}><PlanGuard featureName="Analytics & Reports"><ReportsPage /></PlanGuard></RoleGuard>} />
          <Route path="/order-history" element={<RoleGuard allowed={["owner", "manager", "waiter"]}><OrderHistory /></RoleGuard>} />
          <Route path="/void-reports" element={<RoleGuard allowed={["owner", "manager"]}><VoidReports /></RoleGuard>} />
          <Route path="/staff" element={<RoleGuard allowed={["owner", "manager"]}><StaffPage /></RoleGuard>} />
          <Route path="/staff-performance" element={<RoleGuard allowed={["owner", "manager"]}><StaffPerformance /></RoleGuard>} />
          <Route path="/table-qr" element={<RoleGuard allowed={["owner", "manager"]}><TableQR /></RoleGuard>} />
          <Route path="/inventory-hub" element={<RoleGuard allowed={["owner", "manager"]}><PlanGuard featureName="Inventory Hub"><InventoryHub /></PlanGuard></RoleGuard>} />
          <Route path="/customers" element={<RoleGuard allowed={["owner", "manager"]}><CustomersPage /></RoleGuard>} />
          <Route path="/customers/:id" element={<RoleGuard allowed={["owner", "manager"]}><CustomerProfile /></RoleGuard>} />
          <Route path="/daily-closing" element={<RoleGuard allowed={["owner", "manager"]}><DailyClosing /></RoleGuard>} />
          <Route path="/online-orders" element={<RoleGuard allowed={["owner", "manager"]}><OnlineOrders /></RoleGuard>} />

          {/* Owner-only routes */}
          <Route path="/expenses" element={<RoleGuard allowed={["owner"]}><ExpensesPage /></RoleGuard>} />
          <Route path="/billing-history" element={<RoleGuard allowed={["owner"]}><BillingHistory /></RoleGuard>} />
          <Route path="/audit-log" element={<RoleGuard allowed={["owner"]}><AuditLog /></RoleGuard>} />
          <Route path="/layout-designer" element={<RoleGuard allowed={["owner"]}><LayoutDesigner /></RoleGuard>} />
          <Route path="/inventory" element={<RoleGuard allowed={["owner"]}><InventoryPage /></RoleGuard>} />
          <Route path="/recipes" element={<RoleGuard allowed={["owner"]}><RecipesPage /></RoleGuard>} />
          <Route path="/vendors" element={<RoleGuard allowed={["owner"]}><VendorsPage /></RoleGuard>} />
          <Route path="/wastage" element={<RoleGuard allowed={["owner"]}><WastagePage /></RoleGuard>} />
          <Route path="/stock-analytics" element={<RoleGuard allowed={["owner"]}><PlanGuard featureName="Stock Analytics"><StockAnalytics /></PlanGuard></RoleGuard>} />
          <Route path="/integrations" element={<RoleGuard allowed={["owner"]}><IntegrationsPage /></RoleGuard>} />
          <Route path="/supply-store" element={<RoleGuard allowed={["owner"]}><SupplyStore /></RoleGuard>} />
          <Route path="/loyalty-settings" element={<RoleGuard allowed={["owner"]}><LoyaltySettings /></RoleGuard>} />
          <Route path="/settings" element={<RoleGuard allowed={["owner"]}><SettingsPage /></RoleGuard>} />

          {/* Staff self-profile — waiter, chef, manager */}
          <Route path="/staff-profile" element={<RoleGuard allowed={["owner", "manager", "waiter", "chef"]}><StaffProfile /></RoleGuard>} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <SubscriptionProvider>
            <KioskProvider>
              <AudioNotificationProvider>
                <OrderRealtimeAlert />
                <PwaSplashOnboarding />
                <AppRoutes />
                <SpeedoBot />
              </AudioNotificationProvider>
            </KioskProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
