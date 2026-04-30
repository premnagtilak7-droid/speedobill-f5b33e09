/**
 * SpeedoBill — Guest QR self-ordering experience.
 * Routes:
 *   /order/:tableId           (legacy — direct table id)
 *   /dine/:hotelId/:tableId   (new branded alias — same payload)
 *
 * Flow:
 *   1. Welcome gate (name + phone, language) — required before menu.
 *   2. Beautiful Swiggy-style menu: mood chips, veg toggle, category tabs,
 *      polished cards with veg dot + price-variant chips.
 *   3. Item detail sheet (image, special instructions, qty) → cart.
 *   4. Floating cart bar → slide-up checkout with GST + loyalty.
 *   5. Place order → live-tracking timeline (Received → Preparing → Ready → Served).
 *   6. Floating "Call Waiter" FAB with 6 quick requests + UPI Pay Now sheet.
 */
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ShoppingCart, Plus, Minus, Search, X, Send, UtensilsCrossed,
  ChefHat, Loader2, Smile, CloudRain, Zap, Coffee, Bell, Droplets,
  User, Gift, Star, Sparkles, CheckCircle2, Clock, MapPin, Image as ImageIcon,
  Wallet, QrCode, Receipt, Sparkle, Trash2, Phone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import CustomerVIPCard from "@/components/loyalty/CustomerVIPCard";
import { PaymentMethodSheet } from "@/components/customer/PaymentFlow";

// ── Types ──────────────────────────────────────────────────────────────────
interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  is_available: boolean;
  image_url: string | null;
  hotel_id?: string;
  price_variants: any;
}
interface CartItem {
  id: string;
  baseId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}
interface CustomerProfile {
  name: string;
  phone: string;
  total_visits: number;
  loyalty_points: number;
  loyalty_tier: string;
  visit_count: number;
  rewards_claimed: number;
}
interface LoyaltyConfig {
  enabled: boolean;
  visit_goal: number;
  reward_type: string;
  reward_description: string;
  reward_value: number;
  min_bill_value: number;
}
interface HotelInfo {
  id?: string;
  name: string;
  logo_url: string | null;
  business_type: string | null;
  upi_id: string | null;
  upi_qr_url: string | null;
  tax_percent: number;
  gst_enabled: boolean;
  waiter_confirms_first: boolean;
  pay_upi_enabled?: boolean;
  pay_cash_enabled?: boolean;
  pay_card_enabled?: boolean;
  pay_razorpay_enabled?: boolean;
  pay_request_bill_enabled?: boolean;
  tip_options?: number[] | null;
  payment_verify_mode?: string | null;
  sound_box_enabled?: boolean;
  google_review_url?: string | null;
}

// ── Category → emoji + gradient (used when item has no image) ──────────────
const CATEGORY_STYLE: Array<{ match: RegExp; emoji: string; gradient: string }> = [
  { match: /(starter|appetiz|snack|chaat|pakoda|tikka)/i, emoji: "🥗", gradient: "from-emerald-400/30 to-lime-400/30" },
  { match: /(main|thali|combo|meal|biryani|curry|sabzi|gravy)/i, emoji: "🍛", gradient: "from-orange-400/30 to-amber-500/30" },
  { match: /(rice|pulao|fried rice)/i, emoji: "🍚", gradient: "from-yellow-400/30 to-amber-300/30" },
  { match: /(bread|roti|naan|paratha|kulcha)/i, emoji: "🫓", gradient: "from-amber-300/30 to-yellow-200/30" },
  { match: /(dessert|sweet|ice cream|kulfi|gulab|rasgulla|cake)/i, emoji: "🍰", gradient: "from-pink-400/30 to-rose-300/30" },
  { match: /(beverage|drink|tea|coffee|juice|shake|mocktail|lassi)/i, emoji: "☕", gradient: "from-sky-400/30 to-cyan-300/30" },
  { match: /(pizza)/i, emoji: "🍕", gradient: "from-red-400/30 to-orange-400/30" },
  { match: /(burger|sandwich|wrap|roll)/i, emoji: "🥪", gradient: "from-amber-400/30 to-orange-300/30" },
  { match: /(pasta|noodle|chinese)/i, emoji: "🍜", gradient: "from-orange-400/30 to-rose-300/30" },
  { match: /(soup)/i, emoji: "🍲", gradient: "from-amber-400/30 to-red-300/30" },
  { match: /(salad)/i, emoji: "🥗", gradient: "from-green-400/30 to-emerald-300/30" },
  { match: /(egg|omelette)/i, emoji: "🥚", gradient: "from-yellow-300/30 to-amber-200/30" },
  { match: /(chicken|mutton|fish|prawn|kebab|non[- ]?veg)/i, emoji: "🍗", gradient: "from-red-400/30 to-rose-400/30" },
];
function categoryVisual(category: string): { emoji: string; gradient: string } {
  for (const c of CATEGORY_STYLE) if (c.match.test(category)) return { emoji: c.emoji, gradient: c.gradient };
  return { emoji: "🍽️", gradient: "from-orange-400/30 to-amber-300/30" };
}

// ── Mood → category mapping ────────────────────────────────────────────────
const MOOD_MAP: Record<string, { icon: any; label: string; emoji: string; categories: string[]; color: string }> = {
  hungry: { icon: Zap, label: "Hungry", emoji: "😋",
    categories: ["Main Course", "Mains", "Biryani", "Rice", "Thali", "Combos", "Meals", "Non-Veg", "Chinese"],
    color: "from-red-400 to-orange-500" },
  snack:  { icon: Coffee, label: "Light Snack", emoji: "☕",
    categories: ["Snacks", "Starters", "Pakoda", "Chaat", "Tea", "Coffee", "Beverages"],
    color: "from-amber-400 to-yellow-400" },
  celeb:  { icon: Sparkle, label: "Celebration", emoji: "🎉",
    categories: ["Desserts", "Sweets", "Special", "Premium", "Beverages", "Mocktails", "Shakes"],
    color: "from-pink-400 to-purple-500" },
  date:   { icon: Smile, label: "Date Night", emoji: "💑",
    categories: ["Pasta", "Pizza", "Continental", "Desserts", "Mocktails", "Beverages"],
    color: "from-rose-400 to-red-400" },
  family: { icon: User, label: "Family", emoji: "👨‍👩‍👧",
    categories: ["Thali", "Combos", "Family Pack", "Rice", "Breads", "Main Course"],
    color: "from-emerald-400 to-teal-400" },
  late:   { icon: CloudRain, label: "Late Night", emoji: "🌙",
    categories: ["Maggi", "Snacks", "Coffee", "Tea", "Sandwich", "Burger"],
    color: "from-indigo-400 to-purple-500" },
};

// ── Service request quick options ──────────────────────────────────────────
const WAITER_REQUESTS = [
  { id: "water",    icon: "💧", label: "Need Water" },
  { id: "cutlery",  icon: "🍽️", label: "Need Cutlery" },
  { id: "cleaning", icon: "🧹", label: "Table Cleaning" },
  { id: "menu",     icon: "📋", label: "Need Menu" },
  { id: "bill",     icon: "💰", label: "Request Bill" },
  { id: "other",    icon: "❓", label: "Other" },
] as const;

const VEG_KEYWORDS = ["chicken","mutton","fish","egg","prawn","beef","pork","lamb","crab","kebab","tikka","biryani non","nonveg","non-veg","non veg"];
function isVeg(itemName: string): boolean {
  const n = itemName.toLowerCase();
  return !VEG_KEYWORDS.some(k => n.includes(k));
}

// ── Storage helpers (per-hotel guest profile) ──────────────────────────────
const guestKey = (hotelId: string) => `sb_guest_${hotelId}`;
function loadGuest(hotelId: string): { name: string; phone: string } | null {
  try {
    const raw = localStorage.getItem(guestKey(hotelId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function saveGuest(hotelId: string, data: { name: string; phone: string }) {
  try { localStorage.setItem(guestKey(hotelId), JSON.stringify(data)); } catch {}
}

// ═══════════════════════════════════════════════════════════════════════════
const CustomerOrder = () => {
  // Both /order/:tableId and /dine/:hotelId/:tableId routes resolve here.
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;

  // Data
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [table, setTable] = useState<any>(null);
  const [hotel, setHotel] = useState<HotelInfo | null>(null);
  const [loyaltyConfig, setLoyaltyConfig] = useState<LoyaltyConfig | null>(null);
  const [loading, setLoading] = useState(true);

  // Cart + UI
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [vegOnly, setVegOnly] = useState(false);
  const [orderInstructions, setOrderInstructions] = useState("");

  // Detail sheet
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);
  const [detailVariant, setDetailVariant] = useState<{ label: string; price: number } | null>(null);
  const [detailQty, setDetailQty] = useState(1);
  const [detailNotes, setDetailNotes] = useState("");

  // Guest
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  // Loyalty
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(0);

  // Order placement + tracking
  const [submitting, setSubmitting] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);
  const [placedStatus, setPlacedStatus] = useState<string>("incoming");

  // Call waiter / pay
  const [callOpen, setCallOpen] = useState(false);
  const [callOther, setCallOther] = useState("");
  const [callSending, setCallSending] = useState<string | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  // Review (after served)
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewSkipped, setReviewSkipped] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // ───── Load table + menu ─────
  useEffect(() => {
    if (!tableId) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("qr-order", {
          body: { action: "get_table_menu", table_id: tableId },
        });
        if (error || !data?.table) {
          toast.error("Invalid table. Please scan a valid QR code.");
          setLoading(false);
          return;
        }
        setTable(data.table);
        setMenu(data.menu || []);
        if (data.loyalty_config) setLoyaltyConfig(data.loyalty_config);
        if (data.hotel) setHotel(data.hotel);

        // Restore prior guest if seen at this hotel before
        const prior = loadGuest(data.table.hotel_id);
        if (prior?.name && prior?.phone) {
          setCustomerName(prior.name);
          setCustomerPhone(prior.phone);
          setWelcomeOpen(false);
        }
      } catch {
        toast.error("Failed to load menu.");
      }
      setLoading(false);
    })();
  }, [tableId]);

  // ───── Customer lookup (debounced) ─────
  const lookupCustomer = useCallback(async (phone: string) => {
    if (!table || phone.length < 10) {
      setCustomerProfile(null);
      setLoyaltyDiscount(0);
      return;
    }
    setLookingUp(true);
    try {
      const { data } = await supabase.functions.invoke("qr-order", {
        body: { action: "lookup_customer", hotel_id: table.hotel_id, phone },
      });
      if (data?.customer) {
        setCustomerProfile(data.customer as CustomerProfile);
        if (!customerName && data.customer.name) setCustomerName(data.customer.name);
        const visits = data.customer.total_visits || 0;
        if ((visits + 1) % 10 === 0 && visits > 0) {
          setLoyaltyDiscount(50);
        } else {
          setLoyaltyDiscount(0);
        }
      } else {
        setCustomerProfile(null);
        setLoyaltyDiscount(0);
      }
    } catch {
      setCustomerProfile(null);
      setLoyaltyDiscount(0);
    }
    setLookingUp(false);
  }, [table, customerName]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (customerPhone.length >= 10) lookupCustomer(customerPhone);
    }, 500);
    return () => clearTimeout(t);
  }, [customerPhone, lookupCustomer]);

  // ───── Categories + filters ─────
  const categories = useMemo(() => ["All", ...new Set(menu.map(m => m.category))], [menu]);
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: menu.length };
    for (const m of menu) counts[m.category] = (counts[m.category] || 0) + 1;
    return counts;
  }, [menu]);

  const filteredMenu = useMemo(() => {
    let items = menu;
    if (vegOnly) items = items.filter(m => isVeg(m.name));
    if (activeCategory !== "All") items = items.filter(m => m.category === activeCategory);
    if (search) items = items.filter(m => m.name.toLowerCase().includes(search.toLowerCase()));
    if (selectedMood && activeCategory === "All" && !search) {
      const moodCats = (MOOD_MAP[selectedMood]?.categories || []).map(c => c.toLowerCase());
      const hot = items.filter(m => moodCats.includes(m.category.toLowerCase()));
      const rest = items.filter(m => !moodCats.includes(m.category.toLowerCase()));
      return [...hot, ...rest];
    }
    return items;
  }, [menu, activeCategory, search, selectedMood, vegOnly]);

  const moodHighlightedIds = useMemo(() => {
    if (!selectedMood) return new Set<string>();
    const moodCats = (MOOD_MAP[selectedMood]?.categories || []).map(c => c.toLowerCase());
    return new Set(menu.filter(m => moodCats.includes(m.category.toLowerCase())).map(m => m.id));
  }, [selectedMood, menu]);

  // ───── Cart ops ─────
  const addToCart = (item: MenuItem, variant?: { label: string; price: number } | null, qty = 1, notes?: string) => {
    const cartId = variant ? `${item.id}_${variant.label}` : item.id;
    const cartName = variant ? `${item.name} (${variant.label})` : item.name;
    const cartPrice = variant ? variant.price : item.price;
    setCart(prev => {
      const existing = prev.find(c => c.id === cartId && (c.notes || "") === (notes || ""));
      if (existing) {
        return prev.map(c =>
          c === existing ? { ...c, quantity: c.quantity + qty } : c,
        );
      }
      return [...prev, { id: cartId, baseId: item.id, name: cartName, price: cartPrice, quantity: qty, notes }];
    });
    try { navigator.vibrate?.(15); } catch {}
  };

  const updateQtyByCartId = (cartId: string, delta: number) => {
    setCart(prev =>
      prev.map(c => c.id === cartId ? { ...c, quantity: Math.max(0, c.quantity + delta) } : c)
        .filter(c => c.quantity > 0)
    );
  };

  const removeFromCart = (cartId: string) =>
    setCart(prev => prev.filter(c => c.id !== cartId));

  const cartCountFor = (baseId: string) =>
    cart.filter(c => c.baseId === baseId).reduce((s, c) => s + c.quantity, 0);

  const cartSubtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
  const discountAmount = loyaltyDiscount > 0 ? (cartSubtotal * loyaltyDiscount) / 100 : 0;
  const taxableBase = cartSubtotal - discountAmount;
  const taxRate = hotel?.gst_enabled ? Number(hotel?.tax_percent ?? 5) : 0;
  const taxAmount = (taxableBase * taxRate) / 100;
  const cartTotal = taxableBase + taxAmount;
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  // ───── Detail sheet open helper ─────
  const openDetail = (item: MenuItem) => {
    const v = Array.isArray(item.price_variants) && item.price_variants.length > 0
      ? { label: item.price_variants[0].label, price: Number(item.price_variants[0].price) }
      : null;
    setDetailItem(item);
    setDetailVariant(v);
    setDetailQty(1);
    setDetailNotes("");
  };
  const closeDetail = () => setDetailItem(null);
  const confirmDetailAdd = () => {
    if (!detailItem) return;
    addToCart(detailItem, detailVariant, detailQty, detailNotes.trim() || undefined);
    closeDetail();
    toast.success(`Added ${detailQty} × ${detailItem.name}`, { duration: 1400 });
  };

  // ───── Welcome submit ─────
  const submitWelcome = () => {
    const name = customerName.trim();
    const phone = customerPhone.trim();
    if (name.length < 2) { toast.error("Please enter your name"); return; }
    if (phone.length < 10) { toast.error("Please enter a valid phone number"); return; }
    if (table) saveGuest(table.hotel_id, { name, phone });
    setWelcomeOpen(false);
  };

  // ───── Place order ─────
  const placeOrder = async () => {
    if (!table || cart.length === 0) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("qr-order", {
        body: {
          action: "place_order",
          table_id: table.id,
          hotel_id: table.hotel_id,
          table_number: table.table_number,
          items: cart.map(c => ({ name: c.name, price: c.price, quantity: c.quantity })),
          customer_name: customerName || null,
          customer_phone: customerPhone || null,
          special_instructions: orderInstructions || null,
        },
      });
      if (error || !data?.success) {
        toast.error("Failed to place order. Please try again.");
        setSubmitting(false);
        return;
      }
      setPlacedOrderId(data.order_id || "pending");
      setPlacedStatus("incoming");
      setCart([]);
      setOrderInstructions("");
      setCartOpen(false);
    } catch {
      toast.error("Failed to place order. Please try again.");
    }
    setSubmitting(false);
  };

  // ───── Realtime tracking after placement ─────
  useEffect(() => {
    if (!placedOrderId || placedOrderId === "pending") return;
    const channel = supabase.channel(`co-track-${placedOrderId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "customer_orders", filter: `id=eq.${placedOrderId}`,
      }, (payload) => {
        const next: any = payload.new;
        if (next?.status) {
          setPlacedStatus(next.status);
          try { navigator.vibrate?.([60, 30, 60]); } catch {}
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [placedOrderId]);

  // ───── Send waiter call ─────
  const sendWaiterCall = async (request_type: string, message?: string) => {
    if (!table) return;
    setCallSending(request_type);
    try {
      const { data, error } = await supabase.functions.invoke("qr-order", {
        body: {
          action: "waiter_call",
          table_id: table.id,
          hotel_id: table.hotel_id,
          table_number: table.table_number,
          request_type,
          message: message || "",
          guest_name: customerName || "",
        },
      });
      if (error || !data?.success) {
        toast.error("Couldn't send your request. Please try again.");
      } else {
        toast.success(`🔔 Waiter notified — Table ${table.table_number}`, { duration: 2400 });
        setCallOpen(false);
        setCallOther("");
      }
    } catch {
      toast.error("Couldn't send your request. Please try again.");
    }
    setCallSending(null);
  };

  // ───── Submit review ─────
  const submitReview = async () => {
    if (!table || reviewRating < 1) {
      toast.error("Please pick a star rating");
      return;
    }
    setReviewSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("qr-order", {
        body: {
          action: "submit_review",
          hotel_id: table.hotel_id,
          order_id: placedOrderId && placedOrderId !== "pending" ? placedOrderId : null,
          rating: reviewRating,
          comment: reviewComment.trim(),
        },
      });
      if (error || !data?.success) {
        toast.error("Couldn't submit review. Please try again.");
      } else {
        setReviewSubmitted(true);
        try { navigator.vibrate?.([30, 20, 30]); } catch {}
      }
    } catch {
      toast.error("Couldn't submit review. Please try again.");
    }
    setReviewSubmitting(false);
  };

  // ═════════════════ RENDER ═════════════════

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-orange-500 mx-auto" />
          <p className="text-muted-foreground">Loading menu…</p>
        </div>
      </div>
    );
  }

  if (!table) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
            <X className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold">Invalid Table</h1>
          <p className="text-muted-foreground">This QR code is not valid. Please scan the QR code on your table.</p>
        </div>
      </div>
    );
  }

  // ─── Order placed → live tracking ───
  if (placedOrderId) {
    return (
      <OrderTrackingScreen
        hotelName={hotel?.name || "Restaurant"}
        tableNumber={table.table_number}
        sectionName={table.section_name}
        status={placedStatus}
        loyaltyDiscount={loyaltyDiscount}
        upiId={hotel?.upi_id || ""}
        upiQrUrl={hotel?.upi_qr_url || ""}
        googleReviewUrl={hotel?.google_review_url || ""}
        reviewSubmitted={reviewSubmitted}
        reviewSkipped={reviewSkipped}
        reviewRating={reviewRating}
        reviewComment={reviewComment}
        reviewSubmitting={reviewSubmitting}
        onSetReviewRating={setReviewRating}
        onSetReviewComment={setReviewComment}
        onSubmitReview={submitReview}
        onSkipReview={() => setReviewSkipped(true)}
        onOrderMore={() => { setPlacedOrderId(null); setPlacedStatus("incoming"); setReviewSubmitted(false); setReviewSkipped(false); setReviewRating(0); setReviewComment(""); }}
        onCallWaiter={() => setCallOpen(true)}
        onRequestBill={() => sendWaiterCall("bill")}
        onPayNow={() => setPayOpen(true)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50/60 via-white to-amber-50/40 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">

      {/* ════ WELCOME GATE ════ */}
      <AnimatePresence>
        {welcomeOpen && (
          <WelcomeGate
            hotel={hotel}
            tableNumber={table.table_number}
            sectionName={table.section_name}
            customerName={customerName}
            setCustomerName={setCustomerName}
            customerPhone={customerPhone}
            setCustomerPhone={setCustomerPhone}
            onSubmit={submitWelcome}
          />
        )}
      </AnimatePresence>

      {/* ════ HEADER ════ */}
      <div className="sticky top-0 z-40 bg-white/85 dark:bg-gray-900/85 backdrop-blur-xl border-b border-orange-100 dark:border-gray-800">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          {hotel?.logo_url ? (
            <img src={hotel.logo_url} alt={hotel.name} className="w-9 h-9 rounded-xl object-cover ring-1 ring-orange-200" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <UtensilsCrossed className="h-4 w-4 text-white" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground leading-none">Table {table.table_number}{table.section_name ? ` · ${table.section_name}` : ""}</p>
            <h1 className="text-sm font-bold text-foreground truncate">{hotel?.name || "Welcome"}</h1>
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative p-2.5 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg active:scale-95 transition-transform min-h-[44px] min-w-[44px]"
            aria-label="Open cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <motion.span
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white"
              >{cartCount}</motion.span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="max-w-lg mx-auto px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search dishes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 h-10 bg-white dark:bg-gray-800 border-orange-200 dark:border-gray-700 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* ════ MAIN ════ */}
      <div className="max-w-lg mx-auto px-4 py-4 space-y-5 pb-32">

        {/* Welcome-back strip */}
        {customerProfile && !welcomeOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/25 flex items-center justify-center">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm">Welcome back, {customerProfile.name}! 👋</p>
                <p className="text-[11px] text-white/90">
                  Your {(customerProfile.total_visits || 0) + 1}{getOrdinal((customerProfile.total_visits || 0) + 1)} visit · {Math.floor(customerProfile.loyalty_points || 0)} pts
                </p>
              </div>
              {loyaltyDiscount > 0 && (
                <div className="text-right">
                  <Gift className="h-5 w-5 mx-auto" />
                  <p className="text-[10px] font-bold">{loyaltyDiscount}% OFF</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Mood chips */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">What's the mood?</p>
            <button
              onClick={() => setVegOnly(v => !v)}
              className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full transition-all ${
                vegOnly ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${vegOnly ? "bg-white" : "bg-emerald-500"}`} />
              VEG ONLY
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
            {Object.entries(MOOD_MAP).map(([key, mood]) => {
              const active = selectedMood === key;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedMood(active ? null : key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition-all active:scale-95 min-h-[40px] ${
                    active
                      ? `bg-gradient-to-r ${mood.color} text-white shadow-md`
                      : "bg-white dark:bg-gray-800 text-foreground/80 border border-gray-200 dark:border-gray-700"
                  }`}
                >
                  <span className="text-base">{mood.emoji}</span>
                  {mood.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-4 px-4">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => { setActiveCategory(cat); if (cat !== "All") setSelectedMood(null); }}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all min-h-[36px] ${
                activeCategory === cat
                  ? "bg-foreground text-background shadow-md"
                  : "bg-white dark:bg-gray-800 text-foreground/70 border border-gray-200 dark:border-gray-700"
              }`}
            >{cat}</button>
          ))}
        </div>

        {/* Menu list */}
        <div className="space-y-3">
          {filteredMenu.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <UtensilsCrossed className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No items match this filter</p>
            </div>
          ) : filteredMenu.map(item => {
            const variants = Array.isArray(item.price_variants) && item.price_variants.length > 0 ? item.price_variants : null;
            const veg = isVeg(item.name);
            const inCart = cartCountFor(item.id);
            const highlighted = moodHighlightedIds.has(item.id);
            return (
              <motion.div
                key={item.id} layout
                whileTap={{ scale: 0.99 }}
                onClick={() => openDetail(item)}
                className={`relative p-3 rounded-2xl border bg-white dark:bg-gray-800 shadow-sm cursor-pointer transition-all ${
                  highlighted
                    ? "ring-2 ring-orange-300 border-orange-300"
                    : "border-gray-100 dark:border-gray-700"
                }`}
              >
                <div className="flex gap-3">
                  {/* Image */}
                  <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-xl overflow-hidden bg-orange-100 dark:bg-gray-700 shrink-0">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-orange-300" />
                      </div>
                    )}
                    {highlighted && (
                      <span className="absolute top-1 left-1 bg-orange-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">⭐ PICK</span>
                    )}
                  </div>
                  {/* Body */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1 inline-flex items-center justify-center w-3.5 h-3.5 border-[1.5px] rounded-sm shrink-0 ${
                          veg ? "border-emerald-600" : "border-red-600"
                        }`}
                        title={veg ? "Veg" : "Non-Veg"}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${veg ? "bg-emerald-600" : "bg-red-600"}`} />
                      </span>
                      <p className="font-semibold text-sm leading-tight flex-1">{item.name}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.category}</p>

                    {/* Price + Add */}
                    <div className="mt-auto flex items-end justify-between pt-2">
                      <div>
                        {variants ? (
                          <div className="flex flex-wrap gap-1">
                            {variants.map((v: any) => (
                              <span key={v.label} className="text-[10px] bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded font-semibold">
                                {v.label} ₹{v.price}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="font-bold text-base text-foreground">₹{item.price}</p>
                        )}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); openDetail(item); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 min-h-[36px] ${
                          inCart > 0
                            ? "bg-emerald-500 text-white"
                            : "bg-white dark:bg-gray-700 text-orange-600 dark:text-orange-400 border-[1.5px] border-orange-500"
                        }`}
                      >
                        {inCart > 0 ? `${inCart} IN CART` : "ADD +"}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ════ Floating Call Waiter FAB ════ */}
      {!cartOpen && !detailItem && (
        <button
          onClick={() => setCallOpen(true)}
          className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-2xl flex items-center justify-center active:scale-95 transition-transform ring-4 ring-orange-200/60"
          aria-label="Call waiter"
          title="Call Waiter"
        >
          <Bell className="h-6 w-6" />
        </button>
      )}

      {/* ════ Floating cart bar ════ */}
      <AnimatePresence>
        {cartCount > 0 && !cartOpen && !detailItem && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-30 p-3 pb-[max(12px,env(safe-area-inset-bottom))]"
          >
            <button
              onClick={() => setCartOpen(true)}
              className="w-full max-w-lg mx-auto flex items-center justify-between bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl px-5 py-3.5 shadow-2xl active:scale-[0.98]"
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                <span className="font-bold">{cartCount} item{cartCount > 1 ? "s" : ""}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">₹{cartTotal.toFixed(0)}</span>
                <span className="text-sm opacity-90">View Cart →</span>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ Item Detail Sheet ════ */}
      <AnimatePresence>
        {detailItem && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={closeDetail}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 280 }}
              className="absolute bottom-0 left-0 right-0 max-h-[92vh] bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Image */}
              <div className="relative">
                {detailItem.image_url ? (
                  <img src={detailItem.image_url} alt={detailItem.name} className="w-full h-52 object-cover" />
                ) : (
                  <div className="w-full h-52 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                    <ImageIcon className="h-12 w-12 text-orange-300" />
                  </div>
                )}
                <button
                  onClick={closeDetail}
                  className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/95 shadow-lg flex items-center justify-center"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 inline-flex items-center justify-center w-4 h-4 border-[2px] rounded-sm shrink-0 ${
                      isVeg(detailItem.name) ? "border-emerald-600" : "border-red-600"
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${isVeg(detailItem.name) ? "bg-emerald-600" : "bg-red-600"}`} />
                    </span>
                    <h2 className="text-xl font-bold flex-1">{detailItem.name}</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{detailItem.category}</p>
                </div>

                {/* Variants */}
                {Array.isArray(detailItem.price_variants) && detailItem.price_variants.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Choose Portion</p>
                    <div className="flex flex-wrap gap-2">
                      {detailItem.price_variants.map((v: any) => {
                        const active = detailVariant?.label === v.label;
                        return (
                          <button
                            key={v.label}
                            onClick={() => setDetailVariant({ label: v.label, price: Number(v.price) })}
                            className={`flex-1 min-w-[120px] px-4 py-3 rounded-xl border-2 transition-all font-semibold text-sm ${
                              active ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700"
                                     : "border-gray-200 dark:border-gray-700 text-foreground/80"
                            }`}
                          >
                            <div>{v.label}</div>
                            <div className="text-base">₹{v.price}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Special instructions */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Special instructions</label>
                  <Textarea
                    rows={2}
                    placeholder="e.g. less spicy, no onion"
                    value={detailNotes}
                    onChange={(e) => setDetailNotes(e.target.value.slice(0, 200))}
                    className="mt-1.5 rounded-xl resize-none"
                  />
                </div>

                {/* Qty selector */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-semibold">Quantity</span>
                  <div className="flex items-center gap-3 bg-muted rounded-xl px-2">
                    <button
                      onClick={() => setDetailQty(q => Math.max(1, q - 1))}
                      className="p-2 rounded-lg active:scale-90"
                    ><Minus className="h-4 w-4" /></button>
                    <span className="w-6 text-center font-bold">{detailQty}</span>
                    <button
                      onClick={() => setDetailQty(q => Math.min(99, q + 1))}
                      className="p-2 rounded-lg active:scale-90"
                    ><Plus className="h-4 w-4" /></button>
                  </div>
                </div>

                <Button
                  onClick={confirmDetailAdd}
                  className="w-full h-13 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-2xl text-base font-bold shadow-lg"
                  style={{ height: 52 }}
                >
                  <Plus className="h-5 w-5 mr-1" />
                  Add to Cart · ₹{((detailVariant?.price ?? detailItem.price) * detailQty).toFixed(0)}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ Cart Sheet ════ */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={() => setCartOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 max-h-[90vh] bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Sticky header */}
              <div className="sticky top-0 bg-white dark:bg-gray-900 px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 z-10">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-3" />
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold">Your Cart · Table {table.table_number}</h2>
                  <button onClick={() => setCartOpen(false)} className="p-2 rounded-xl hover:bg-gray-100">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-10">
                    <ShoppingCart className="h-12 w-12 mx-auto opacity-30 mb-3" />
                    <p className="text-muted-foreground">Your cart is empty</p>
                  </div>
                ) : (
                  <>
                    {/* Items */}
                    <div className="space-y-3">
                      {cart.map(item => (
                        <div key={item.id + (item.notes || "")} className="flex items-start gap-3 pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{item.name}</p>
                            <p className="text-xs text-muted-foreground">₹{item.price} × {item.quantity}</p>
                            {item.notes && (
                              <p className="text-[11px] text-orange-600 mt-0.5 italic">"{item.notes}"</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <p className="font-bold text-sm">₹{(item.price * item.quantity).toFixed(0)}</p>
                            <div className="flex items-center gap-0.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                              <button onClick={() => updateQtyByCartId(item.id, -1)} className="p-1.5 active:scale-90">
                                <Minus className="h-3.5 w-3.5 text-orange-600" />
                              </button>
                              <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                              <button onClick={() => updateQtyByCartId(item.id, 1)} className="p-1.5 active:scale-90">
                                <Plus className="h-3.5 w-3.5 text-orange-600" />
                              </button>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1.5 text-muted-foreground hover:text-red-500"
                            aria-label="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Special instructions */}
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Any allergies or requests?
                      </label>
                      <Textarea
                        rows={2}
                        placeholder="e.g. nut allergy, extra napkins…"
                        value={orderInstructions}
                        onChange={(e) => setOrderInstructions(e.target.value.slice(0, 500))}
                        className="mt-1.5 rounded-xl resize-none"
                      />
                    </div>

                    {/* VIP card */}
                    {customerProfile && loyaltyConfig?.enabled && (
                      <CustomerVIPCard
                        customerName={customerProfile.name}
                        visitCount={customerProfile.visit_count || 0}
                        loyaltyConfig={loyaltyConfig}
                        rewardsClaimed={customerProfile.rewards_claimed || 0}
                      />
                    )}

                    {/* Bill */}
                    <div className="bg-muted/40 rounded-2xl p-4 space-y-2">
                      <Row label="Subtotal" value={`₹${cartSubtotal.toFixed(0)}`} />
                      {loyaltyDiscount > 0 && (
                        <Row label={`🎁 Loyalty (${loyaltyDiscount}%)`} value={`-₹${discountAmount.toFixed(0)}`} accent="text-emerald-600" />
                      )}
                      {taxRate > 0 && <Row label={`GST (${taxRate}%)`} value={`₹${taxAmount.toFixed(2)}`} />}
                      <div className="flex items-baseline justify-between pt-2 border-t border-border/40">
                        <span className="text-base font-bold">Total</span>
                        <span className="text-2xl font-black text-orange-600">₹{cartTotal.toFixed(0)}</span>
                      </div>
                    </div>

                    <Button
                      onClick={placeOrder} disabled={submitting || cart.length === 0}
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-2xl text-base font-bold shadow-lg"
                      style={{ height: 56 }}
                    >
                      {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                        <><Send className="h-5 w-5 mr-2" />Place Order · ₹{cartTotal.toFixed(0)}</>
                      )}
                    </Button>

                    {hotel?.waiter_confirms_first && (
                      <p className="text-[11px] text-center text-muted-foreground">
                        Your order will be reviewed by the waiter before being sent to the kitchen.
                      </p>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ Call Waiter Sheet ════ */}
      <AnimatePresence>
        {callOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-black/60 backdrop-blur-sm"
            onClick={() => setCallOpen(false)}
          >
            <motion.div
              initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
                <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-3" />
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <Bell className="h-5 w-5 text-orange-500" /> How can we help?
                </h2>
                <p className="text-xs text-muted-foreground">Table {table.table_number} — your waiter will be notified.</p>
              </div>
              <div className="p-5 grid grid-cols-2 gap-3">
                {WAITER_REQUESTS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => sendWaiterCall(r.id)}
                    disabled={callSending === r.id}
                    className="flex flex-col items-center gap-1.5 p-4 rounded-2xl bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-100 dark:border-orange-900/40 active:scale-95 transition-transform disabled:opacity-50 min-h-[88px]"
                  >
                    <span className="text-2xl">{r.icon}</span>
                    <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
                      {callSending === r.id ? "Sending…" : r.label}
                    </span>
                  </button>
                ))}
              </div>
              <div className="px-5 pb-5 space-y-2">
                <Textarea
                  rows={2}
                  placeholder="Or type a message…"
                  value={callOther}
                  onChange={(e) => setCallOther(e.target.value.slice(0, 200))}
                  className="rounded-xl resize-none"
                />
                <Button
                  onClick={() => sendWaiterCall("other", callOther)}
                  disabled={!callOther.trim() || callSending === "other"}
                  className="w-full"
                >
                  {callSending === "other" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Message"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ════ Payment Sheet (UPI/Cash/Card/Razorpay/Request Bill) ════ */}
      <AnimatePresence>
        {payOpen && hotel?.id && (
          <PaymentMethodSheet
            hotel={{ ...hotel, id: hotel.id }}
            tableId={table.id}
            tableNumber={table.table_number}
            amount={cartTotal}
            customerName={customerName}
            customerPhone={customerPhone}
            orderId={placedOrderId}
            onClose={() => setPayOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default CustomerOrder;

// ═══════════════════════════════════════════════════════════════════════════
// Subcomponents
// ═══════════════════════════════════════════════════════════════════════════

function getOrdinal(n: number): string {
  const s = ["th","st","nd","rd"], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function Row({ label, value, accent = "" }: { label: string; value: string; accent?: string }) {
  return (
    <div className={`flex justify-between text-sm ${accent}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

// ── WelcomeGate ────────────────────────────────────────────────────────────
function WelcomeGate({
  hotel, tableNumber, sectionName,
  customerName, setCustomerName,
  customerPhone, setCustomerPhone,
  onSubmit,
}: {
  hotel: HotelInfo | null;
  tableNumber: number;
  sectionName?: string;
  customerName: string;
  setCustomerName: (v: string) => void;
  customerPhone: string;
  setCustomerPhone: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 overflow-y-auto"
    >
      {/* Decorative food bg pattern */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle at 25% 25%, white 1px, transparent 1px), radial-gradient(circle at 75% 75%, white 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      <div className="relative min-h-screen flex flex-col items-center justify-center px-6 py-10 text-white">
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="w-full max-w-sm space-y-6"
        >
          {/* Logo */}
          <div className="text-center">
            {hotel?.logo_url ? (
              <img src={hotel.logo_url} alt={hotel.name} className="w-20 h-20 rounded-3xl object-cover mx-auto ring-4 ring-white/40 shadow-2xl" />
            ) : (
              <div className="w-20 h-20 rounded-3xl bg-white/25 backdrop-blur-sm flex items-center justify-center mx-auto ring-4 ring-white/40 shadow-2xl">
                <UtensilsCrossed className="h-10 w-10 text-white" />
              </div>
            )}
            <h1 className="text-3xl font-black mt-4 leading-tight">
              Welcome to{hotel?.name ? "" : "!"}
            </h1>
            {hotel?.name && (
              <p className="text-2xl font-bold text-white/95 mt-0.5">{hotel.name}</p>
            )}
            <div className="inline-flex items-center gap-1.5 mt-3 bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
              <MapPin className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">
                Table {tableNumber}{sectionName ? ` · ${sectionName}` : ""}
              </span>
            </div>
          </div>

          {/* Form card */}
          <div className="bg-white text-foreground rounded-3xl p-5 shadow-2xl space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-center">
              Tell us about you
            </p>

            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Your name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value.slice(0, 50))}
                className="pl-10 h-12 rounded-xl"
                autoFocus
              />
            </div>

            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Phone number"
                type="tel"
                inputMode="numeric"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                className="pl-10 h-12 rounded-xl"
              />
            </div>

            <p className="text-[10px] text-center text-muted-foreground">
              We use your phone for order updates & loyalty rewards. No spam.
            </p>

            <Button
              onClick={onSubmit}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-2xl text-base font-bold shadow-lg"
              style={{ height: 52 }}
            >
              Start Ordering →
            </Button>
          </div>

          <p className="text-center text-[11px] text-white/80">
            Powered by <span className="font-bold">SpeedoBill</span>
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ── PayNowSheet (UPI QR + I have paid) ─────────────────────────────────────
function PayNowSheet({
  hotel, tableNumber, amount, onClose, onPaid,
}: {
  hotel: HotelInfo | null;
  tableNumber: number;
  amount: number;
  onClose: () => void;
  onPaid: () => void;
}) {
  const upiId = hotel?.upi_id || "";
  const upiUri = upiId
    ? `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(hotel?.name || "Restaurant")}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(`Table ${tableNumber}`)}`
    : "";
  const qrSrc = upiUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(upiUri)}`
    : (hotel?.upi_qr_url || "");

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="absolute bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
          <div className="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Wallet className="h-5 w-5 text-orange-500" /> Pay ₹{amount.toFixed(0)}
          </h2>
        </div>

        <div className="p-5 space-y-4">
          {qrSrc ? (
            <>
              <div className="bg-white p-4 rounded-2xl border-2 border-orange-200 mx-auto w-fit">
                <img src={qrSrc} alt="UPI QR code" className="w-56 h-56" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold">Scan with any UPI app</p>
                <p className="text-xs text-muted-foreground">PhonePe · GPay · Paytm · BHIM</p>
                {upiId && (
                  <p className="text-[11px] font-mono bg-muted/40 px-2 py-1 rounded inline-block mt-1">{upiId}</p>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-6 space-y-2">
              <QrCode className="h-12 w-12 mx-auto text-muted-foreground opacity-40" />
              <p className="text-sm font-semibold">UPI not configured</p>
              <p className="text-xs text-muted-foreground">Please ask the waiter for the bill.</p>
            </div>
          )}

          <Button onClick={onPaid} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold" style={{ height: 52 }}>
            <CheckCircle2 className="h-5 w-5 mr-2" /> I have paid
          </Button>
          <Button onClick={onClose} variant="outline" className="w-full rounded-2xl">Cancel</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── OrderTrackingScreen ────────────────────────────────────────────────────
const STATUS_STAGES: Array<{ key: string; label: string; emoji: string }> = [
  { key: "incoming",  label: "Order Received",   emoji: "📝" },
  { key: "confirmed", label: "Being Prepared",   emoji: "👨‍🍳" },
  { key: "ready",     label: "Ready to Serve",   emoji: "🍽️" },
  { key: "served",    label: "Served — Enjoy!",  emoji: "😋" },
];
function statusIndex(s: string): number {
  if (s === "rejected" || s === "cancelled") return -1;
  if (s === "billed" || s === "served") return 3;
  if (s === "ready") return 2;
  if (s === "confirmed" || s === "preparing") return 1;
  return 0;
}

function OrderTrackingScreen({
  hotelName, tableNumber, sectionName, status, loyaltyDiscount,
  upiId, upiQrUrl,
  onOrderMore, onCallWaiter, onRequestBill, onPayNow,
}: {
  hotelName: string; tableNumber: number; sectionName?: string;
  status: string; loyaltyDiscount: number;
  upiId: string; upiQrUrl: string;
  onOrderMore: () => void; onCallWaiter: () => void; onRequestBill: () => void; onPayNow: () => void;
}) {
  const idx = statusIndex(status);
  const rejected = status === "rejected" || status === "cancelled";

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-amber-50 dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-md mx-auto p-6 pt-10 pb-32 space-y-6">
        {/* Hero */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-2"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {rejected ? "Order Cancelled" : "Order Placed! 🎉"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {hotelName} · Table {tableNumber}{sectionName ? ` · ${sectionName}` : ""}
          </p>
          {loyaltyDiscount > 0 && (
            <p className="text-xs font-semibold text-emerald-600">🎁 {loyaltyDiscount}% loyalty discount applied</p>
          )}
        </motion.div>

        {/* Timeline */}
        {!rejected && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg p-5 space-y-1 border border-emerald-100 dark:border-gray-800">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Live Status
            </p>
            {STATUS_STAGES.map((stage, i) => {
              const done = i < idx;
              const current = i === idx;
              return (
                <div key={stage.key} className="flex items-center gap-3 py-2">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${
                    done ? "bg-emerald-500 text-white"
                         : current ? "bg-orange-500 text-white animate-pulse"
                                   : "bg-muted text-muted-foreground"
                  }`}>
                    {done ? <CheckCircle2 className="h-4 w-4" /> : <span>{stage.emoji}</span>}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${done || current ? "text-foreground" : "text-muted-foreground"}`}>
                      {stage.label}
                    </p>
                    {current && <p className="text-[11px] text-orange-600">Updating in real time…</p>}
                  </div>
                </div>
              );
            })}
            <p className="text-[11px] text-center text-muted-foreground pt-3 border-t border-border/40 mt-2">
              Estimated time: 20–25 minutes
            </p>
          </div>
        )}

        {rejected && (
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-lg p-5 text-center border border-red-200">
            <p className="text-sm">Sorry, this order was not accepted. Please ask the waiter for help.</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2">
          <Button onClick={onOrderMore} className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-bold" style={{ height: 52 }}>
            <Plus className="h-5 w-5 mr-2" /> Order More Items
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={onCallWaiter} variant="outline" className="rounded-2xl font-semibold" style={{ height: 48 }}>
              <Bell className="h-4 w-4 mr-1.5" /> Call Waiter
            </Button>
            <Button onClick={onRequestBill} variant="outline" className="rounded-2xl font-semibold" style={{ height: 48 }}>
              <Receipt className="h-4 w-4 mr-1.5" /> Request Bill
            </Button>
          </div>
          {(upiId || upiQrUrl) && (
            <Button onClick={onPayNow} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold" style={{ height: 48 }}>
              <Wallet className="h-4 w-4 mr-1.5" /> Pay Online via UPI
            </Button>
          )}
        </div>

        <p className="text-center text-[11px] text-muted-foreground pt-2">
          Powered by <span className="font-bold">SpeedoBill</span>
        </p>
      </div>
    </div>
  );
}
