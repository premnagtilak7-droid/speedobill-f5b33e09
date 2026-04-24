import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useGridDensity } from "@/hooks/useGridDensity";
import { supabase } from "@/integrations/supabase/client";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Plus, Users, Trash2, Search, Minus, Printer, MessageCircle, Send, X,
  UtensilsCrossed, Grid3X3, LayoutGrid, ShoppingCart, CalendarCheck, Check, Sparkles,
  Pause, Play, ArrowRightLeft, UserSearch, Gift, CreditCard, Mail, Store, Layers, Pencil, MoreVertical, FolderInput,
} from "lucide-react";
import { ChefHat } from "lucide-react";
import { toast } from "sonner";
import { writeAudit } from "@/lib/audit";
import TableMapSkeleton from "@/components/skeletons/TableMapSkeleton";
import { printReceipt } from "@/lib/print-receipt";

/* ────────── types ────────── */
interface Table { id: string; table_number: number; capacity: number; status: string; section_name: string; }
interface PriceVariant { label: string; price: number; }
interface MenuItem { id: string; name: string; category: string; price: number; image_url?: string | null; is_available: boolean; price_variants?: PriceVariant[] | null; }
interface OrderLine { key: string; name: string; price: number; quantity: number; source: "menu" | "custom"; }
interface HotelInfo { name: string; address: string | null; phone: string | null; tax_percent: number; gst_enabled: boolean; upi_qr_url: string | null; logo_url?: string | null; upi_id?: string | null; receipt_footer?: string | null; }
interface ChefProfile { user_id: string; full_name: string | null; }
interface FloorSection { id: string; name: string; color: string; icon: string; sort_order: number; }

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v);

/* Status colors per spec: Empty=green, Occupied=orange, Reserved=blue, Cleaning=yellow.
   Theme-aware tints — different background tint values for dark vs light mode. */
type StatusStyle = {
  tintDark: string; tintLight: string;
  stripe: string; dot: string; pill: string; pillText: string; label: string; glow: string;
};
const tableStyles: Record<string, StatusStyle> = {
  empty: {
    tintDark: "#0f2a1a",
    tintLight: "#FFFFFF",
    stripe: "#10B981",
    dot: "bg-emerald-400",
    pill: "bg-emerald-500/20 border-emerald-500/40",
    pillText: "text-emerald-600 dark:text-emerald-300",
    label: "Empty",
    glow: "hover:shadow-[0_10px_28px_-8px_rgba(16,185,129,0.45)]",
  },
  occupied: {
    tintDark: "#2a1a0f",
    tintLight: "#FFFFFF",
    stripe: "#F97316",
    dot: "bg-orange-400",
    pill: "bg-orange-500/20 border-orange-500/40",
    pillText: "text-orange-600 dark:text-orange-300",
    label: "Occupied",
    glow: "hover:shadow-[0_10px_28px_-8px_rgba(249,115,22,0.55)]",
  },
  reserved: {
    tintDark: "#0f1a2a",
    tintLight: "#FFFFFF",
    stripe: "#3B82F6",
    dot: "bg-blue-400",
    pill: "bg-blue-500/20 border-blue-500/40",
    pillText: "text-blue-600 dark:text-blue-300",
    label: "Reserved",
    glow: "hover:shadow-[0_10px_28px_-8px_rgba(59,130,246,0.45)]",
  },
  cleaning: {
    tintDark: "#2a240f",
    tintLight: "#FFFFFF",
    stripe: "#F59E0B",
    dot: "bg-amber-400",
    pill: "bg-amber-500/20 border-amber-500/40",
    pillText: "text-amber-600 dark:text-amber-300",
    label: "Cleaning",
    glow: "hover:shadow-[0_10px_28px_-8px_rgba(245,158,11,0.45)]",
  },
};

const Tables = () => {
  const { user, hotelId, role } = useAuth();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const { density, setDensity } = useGridDensity("qb_tables_density");
  const isOwner = role === "owner";
  const [counterBillingEnabled, setCounterBillingEnabled] = useState(false);

  /* ── data ── */
  const [tables, setTables] = useState<Table[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [hotelInfo, setHotelInfo] = useState<HotelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [savingMode, setSavingMode] = useState<"save" | "kds" | "bill" | null>(null);
  const [chefs, setChefs] = useState<ChefProfile[]>([]);
  const [chefPickerOpen, setChefPickerOpen] = useState(false);

  /* ── dialogs ── */
  const [addOpen, setAddOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [newCount, setNewCount] = useState("1");
  const [newTableSection, setNewTableSection] = useState<string>("Main");
  const [reserveOpen, setReserveOpen] = useState(false);

  /* ── sections ── */
  const [sections, setSections] = useState<FloorSection[]>([]);
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const [secName, setSecName] = useState("");
  const [secIcon, setSecIcon] = useState("🍽️");
  const [secColor, setSecColor] = useState("#F97316");

  /* ── reservation form ── */
  const [resTableId, setResTableId] = useState("");
  const [resName, setResName] = useState("");
  const [resPhone, setResPhone] = useState("");
  const [resGuests, setResGuests] = useState("2");
  const [resNotes, setResNotes] = useState("");
  const [resTime, setResTime] = useState("");

  /* ── order state ── */
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderLine[]>([]);
  const [discountPercent, setDiscountPercent] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi" | "card" | "split">("cash");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [tableSplit, setTableSplit] = useState("none");
  const [showUpiQr, setShowUpiQr] = useState(false);

  /* ── variant picker ── */
  const [variantPickerItem, setVariantPickerItem] = useState<MenuItem | null>(null);

  /* ── split payment ── */
  const [splitPayOpen, setSplitPayOpen] = useState(false);
  const [splitCash, setSplitCash] = useState("");
  const [splitUpi, setSplitUpi] = useState("");
  const [splitCard, setSplitCard] = useState("");

  /* ── hold/resume ── */
  const [heldOrders, setHeldOrders] = useState<{ id: string; table_number: number; items: any[]; created_at: string }[]>([]);
  const [showHeld, setShowHeld] = useState(false);

  /* ── table transfer ── */
  const [showTransfer, setShowTransfer] = useState(false);

  /* ── CRM / Loyalty ── */
  const [customerLookupPhone, setCustomerLookupPhone] = useState("");
  const [lookedUpCustomer, setLookedUpCustomer] = useState<{ id: string; name: string; phone: string; loyalty_points: number } | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(false);

  /* ────────── data fetching ────────── */
  const fetchTables = useCallback(async () => {
    if (!hotelId) return;
    const { data } = await supabase
      .from("restaurant_tables").select("id, table_number, capacity, status, section_name")
      .eq("hotel_id", hotelId).order("table_number");
    setTables(data || []);
    setLoading(false);
  }, [hotelId]);

  const fetchSetupData = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    const [tablesRes, menuRes, hotelRes] = await Promise.all([
      supabase.from("restaurant_tables").select("id, table_number, capacity, status, section_name").eq("hotel_id", hotelId).order("table_number"),
      supabase.from("menu_items").select("id, name, category, price, image_url, is_available, price_variants").eq("hotel_id", hotelId).eq("is_available", true).order("category").order("name"),
      supabase.from("hotels").select("name, address, phone, tax_percent, gst_enabled, upi_qr_url, logo_url, upi_id, receipt_footer").eq("id", hotelId).maybeSingle(),
    ]);
    setTables(tablesRes.data || []);
    setMenuItems((menuRes.data || []) as unknown as MenuItem[]);
    setHotelInfo((hotelRes.data as HotelInfo | null) || null);
    setLoading(false);
  }, [hotelId]);

  useEffect(() => { void fetchSetupData(); }, [fetchSetupData]);

  // Fetch chefs for KDS assignment — use user_roles as source of truth
  useEffect(() => {
    if (!hotelId) return;
    (async () => {
      // 1. Get all user_ids with chef role
      const { data: roleRows } = await supabase.from("user_roles").select("user_id").eq("role", "chef");
      if (!roleRows || roleRows.length === 0) { setChefs([]); return; }
      const chefUserIds = roleRows.map(r => r.user_id);
      // 2. Get their profiles that belong to this hotel and are active
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .eq("hotel_id", hotelId)
        .eq("is_active", true)
        .in("user_id", chefUserIds);
      setChefs((profiles || []) as ChefProfile[]);
    })();
  }, [hotelId]);

  // Fetch counter billing setting
  useEffect(() => {
    if (!hotelId) return;
    supabase.from("hotels").select("counter_billing_enabled").eq("id", hotelId).maybeSingle()
      .then(({ data }) => { if (data) setCounterBillingEnabled(data.counter_billing_enabled); });
  }, [hotelId]);

  // Fetch sections
  const fetchSections = useCallback(async () => {
    if (!hotelId) return;
    const { data } = await supabase
      .from("floor_sections")
      .select("id, name, color, icon, sort_order")
      .eq("hotel_id", hotelId)
      .order("sort_order");
    setSections((data || []) as FloorSection[]);
  }, [hotelId]);

  useEffect(() => { void fetchSections(); }, [fetchSections]);

  useEffect(() => {
    if (!hotelId) return;
    const ch = supabase
      .channel("tables-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables", filter: `hotel_id=eq.${hotelId}` }, () => void fetchTables())
      .on("postgres_changes", { event: "*", schema: "public", table: "floor_sections", filter: `hotel_id=eq.${hotelId}` }, () => void fetchSections())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hotelId, fetchTables, fetchSections]);

  /* ────────── derived ────────── */
  const categories = useMemo(() => ["all", ...Array.from(new Set(menuItems.map((i) => i.category).filter(Boolean)))], [menuItems]);
  const filteredMenu = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return menuItems.filter((i) => {
      const cat = activeCategory === "all" || i.category === activeCategory;
      const search = !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
      return cat && search;
    });
  }, [menuItems, activeCategory, searchQuery]);

  const itemCount = useMemo(() => orderItems.reduce((s, i) => s + i.quantity, 0), [orderItems]);
  const subtotal = useMemo(() => orderItems.reduce((s, i) => s + i.price * i.quantity, 0), [orderItems]);
  const discountValue = Number(discountPercent || 0) || 0;
  const discountAmount = subtotal * Math.min(Math.max(discountValue, 0), 100) / 100;
  const taxPercent = hotelInfo?.gst_enabled ? Number(hotelInfo.tax_percent || 0) : 0;
  const taxAmount = ((subtotal - discountAmount) * taxPercent) / 100;
  const grandTotal = subtotal - discountAmount + taxAmount;

  /* ────────── panel helpers ────────── */
  const resetPanelState = () => {
    setSelectedTable(null); setSearchQuery(""); setActiveCategory("all");
    setActiveOrderId(null); setOrderItems([]); setDiscountPercent("0");
    setPaymentMethod("cash"); setCustomerPhone(""); setCustomName(""); setCustomPrice("");
    setTableSplit("none"); setShowUpiQr(false);
    setSplitPayOpen(false); setSplitCash(""); setSplitUpi(""); setSplitCard("");
  };

  const splitLabel = tableSplit === "none" ? null : tableSplit;

  /* ── track which seats have orders ── */
  const [seatFlags, setSeatFlags] = useState<Record<string, boolean>>({});

  const loadTableWorkspace = useCallback(async (table: Table) => {
    if (!hotelId) return;
    setSelectedTable(table); setPanelLoading(true);
    setActiveOrderId(null); setOrderItems([]); setDiscountPercent("0"); setPaymentMethod("cash"); setTableSplit("none");
    setSeatFlags({});
    try {
      // Check which seats have active orders
      const { data: allActive } = await supabase
        .from("orders").select("id, discount_percent, payment_method, split_label")
        .eq("hotel_id", hotelId).eq("table_id", table.id).eq("status", "active");
      const flags: Record<string, boolean> = {};
      (allActive || []).forEach((o) => { flags[o.split_label || "none"] = true; });
      setSeatFlags(flags);

      // If there's a non-split order, load it. Otherwise load first seat found.
      const firstOrder = (allActive || []).find((o) => !o.split_label) || (allActive || [])[0];
      if (!firstOrder) { setPanelLoading(false); return; }
      const { data: items } = await supabase.from("order_items").select("id, name, price, quantity, is_custom").eq("order_id", firstOrder.id);
      setActiveOrderId(firstOrder.id);
      setDiscountPercent(String(firstOrder.discount_percent ?? 0));
      setPaymentMethod((firstOrder.payment_method as "cash" | "upi") || "cash");
      setTableSplit(firstOrder.split_label || "none");
      setOrderItems((items || []).map((i) => ({ key: i.id, name: i.name, price: Number(i.price || 0), quantity: i.quantity || 1, source: i.is_custom ? "custom" as const : "menu" as const })));
    } catch (e: any) { toast.error(e.message || "Failed to open table"); } finally { setPanelLoading(false); }
  }, [hotelId]);

  const loadSeatOrder = useCallback(async (seat: string) => {
    if (!selectedTable || !hotelId) return;
    setTableSplit(seat);
    setActiveOrderId(null); setOrderItems([]); setDiscountPercent("0");
    const seatLabel = seat === "none" ? null : seat;
    try {
      let query = supabase
        .from("orders").select("id, discount_percent, payment_method, split_label")
        .eq("hotel_id", hotelId).eq("table_id", selectedTable.id).eq("status", "active")
        .order("created_at", { ascending: false }).limit(1);
      if (seatLabel) query = query.eq("split_label", seatLabel);
      else query = query.is("split_label", null);
      const { data: order } = await query.maybeSingle();
      if (!order) return; // blank slate for new seat — user can add items
      const { data: items } = await supabase.from("order_items").select("id, name, price, quantity, is_custom").eq("order_id", order.id);
      setActiveOrderId(order.id);
      setDiscountPercent(String(order.discount_percent ?? 0));
      setPaymentMethod((order.payment_method as "cash" | "upi") || "cash");
      setOrderItems((items || []).map((i) => ({ key: i.id, name: i.name, price: Number(i.price || 0), quantity: i.quantity || 1, source: i.is_custom ? "custom" as const : "menu" as const })));
    } catch {}
  }, [selectedTable, hotelId]);

  /* ────────── reservation ────────── */
  const handleReserve = async () => {
    if (!hotelId || !user || !resName.trim()) { toast.error("Enter customer name"); return; }
    const tableId = resTableId || null;
    const time = resTime || new Date().toISOString();
    const { error } = await supabase.from("reservations").insert({
      hotel_id: hotelId, customer_name: resName.trim(), customer_phone: resPhone,
      guest_count: Number(resGuests) || 2, table_id: tableId, notes: resNotes || null,
      reservation_time: time, created_by: user.id, status: "pending",
    });
    if (error) { toast.error(error.message); return; }
    if (tableId) {
      await supabase.from("restaurant_tables").update({ status: "reserved" }).eq("id", tableId);
    }
    toast.success("Table reserved!");
    setReserveOpen(false); setResTableId(""); setResName(""); setResPhone(""); setResGuests("2"); setResNotes(""); setResTime("");
    await fetchTables();
  };

  /* ────────── table actions ────────── */
  const addTables = async () => {
    const count = parseInt(newCount, 10);
    if (!count || count < 1 || !hotelId) return;
    const sectionToUse = (newTableSection || "Main").trim() || "Main";
    const maxNum = tables.length > 0 ? Math.max(...tables.map((t) => t.table_number)) : 0;
    const inserts = Array.from({ length: count }, (_, i) => ({
      hotel_id: hotelId,
      table_number: maxNum + i + 1,
      section_name: sectionToUse,
    }));
    const { error } = await supabase.from("restaurant_tables").insert(inserts);
    if (error) {
      console.error("Add tables failed:", error);
      toast.error("Couldn't add tables. Please try again.");
      return;
    }
    toast.success(`${count} table(s) added to ${sectionToUse}`);
    setAddOpen(false); setNewCount("1"); await fetchTables();
  };

  /* ────────── section actions ────────── */
  const addSection = async () => {
    if (!hotelId || !secName.trim()) { toast.error("Enter section name"); return; }
    const payload = {
      hotel_id: hotelId,
      name: secName.trim(),
      icon: secIcon || "🍽️",
      color: secColor || "#F97316",
      sort_order: sections.length,
    };
    // Try once, retry on transient network failure
    let { error } = await supabase.from("floor_sections").insert(payload);
    if (error && /failed to fetch|network/i.test(error.message || "")) {
      await new Promise((r) => setTimeout(r, 800));
      ({ error } = await supabase.from("floor_sections").insert(payload));
    }
    if (error) {
      console.error("Add section failed:", error);
      const isNetwork = /failed to fetch|network/i.test(error.message || "");
      toast.error(isNetwork ? "Network hiccup — please try again." : "Couldn't add section. Please try again.");
      return;
    }
    toast.success(`Section "${secName.trim()}" added`);
    setSecName(""); setSecIcon("🍽️"); setSecColor("#F97316");
    await fetchSections();
  };

  const deleteSection = async (id: string, name: string) => {
    if (!confirm(`Delete section "${name}"? Tables in it stay but lose their section.`)) return;
    const { error } = await supabase.from("floor_sections").delete().eq("id", id);
    if (error) { toast.error("Couldn't delete section"); return; }
    toast.success("Section deleted");
    await fetchSections();
  };

  const moveTableToSection = async (tableId: string, sectionName: string) => {
    const { error } = await supabase
      .from("restaurant_tables")
      .update({ section_name: sectionName })
      .eq("id", tableId);
    if (error) {
      console.error("Move table failed:", error);
      toast.error("Couldn't move table.");
      return;
    }
    toast.success(`Moved to ${sectionName}`);
    await fetchTables();
  };


  const deleteTable = async (id: string) => {
    const { error } = await supabase.from("restaurant_tables").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    // Auto-renumber all remaining tables sequentially
    if (hotelId) {
      const { data: remaining } = await supabase
        .from("restaurant_tables").select("id, table_number")
        .eq("hotel_id", hotelId).order("table_number");
      if (remaining) {
        const updates = remaining.map((t, idx) => ({ id: t.id, newNum: idx + 1 })).filter((u, idx) => remaining[idx].table_number !== u.newNum);
        for (const u of updates) {
          await supabase.from("restaurant_tables").update({ table_number: u.newNum }).eq("id", u.id);
        }
      }
    }
    toast.success("Table deleted & renumbered"); await fetchTables();
  };

  const markCleaningDone = async (tableId: string) => {
    await supabase.from("restaurant_tables").update({ status: "empty" }).eq("id", tableId);
    toast.success("Table is now empty"); await fetchTables();
  };

  /* ────────── order item helpers ────────── */
  const addMenuItemToOrder = (item: MenuItem) => {
    const variants = (item.price_variants as PriceVariant[] | null)?.filter(v => v.label && v.price > 0) || [];
    if (variants.length > 0) {
      setVariantPickerItem(item);
      return;
    }
    addItemDirectly(item.id, item.name, Number(item.price || 0));
  };
  const addItemDirectly = (itemId: string, name: string, price: number, variantLabel?: string) => {
    const k = variantLabel ? `menu-${itemId}-${variantLabel}` : `menu-${itemId}`;
    const displayName = variantLabel ? `${name} (${variantLabel})` : name;
    setOrderItems((prev) => {
      const existing = prev.find((l) => l.key === k);
      if (existing) return prev.map((l) => l.key === k ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { key: k, name: displayName, price, quantity: 1, source: "menu" as const }];
    });
  };
  const updateQuantity = (key: string, delta: number) => {
    setOrderItems((prev) => prev.map((i) => i.key === key ? { ...i, quantity: i.quantity + delta } : i).filter((i) => i.quantity > 0));
  };
  const removeLineItem = (key: string) => setOrderItems((prev) => prev.filter((i) => i.key !== key));
  const addCustomItem = () => {
    const price = Number(customPrice);
    if (!customName.trim() || !Number.isFinite(price) || price <= 0) { toast.error("Enter valid custom item"); return; }
    setOrderItems((prev) => [...prev, { key: `custom-${Date.now()}`, name: customName.trim(), price, quantity: 1, source: "custom" }]);
    setCustomName(""); setCustomPrice("");
  };

  /* ────────── receipt ────────── */
  const buildReceiptText = () => {
    if (!selectedTable) return "";
    const l: string[] = [];
    l.push("═".repeat(32));
    l.push((hotelInfo?.name || "SPEEDOBILL").toUpperCase());
    if (hotelInfo?.address) l.push(hotelInfo.address);
    if (hotelInfo?.phone) l.push(`Tel: ${hotelInfo.phone}`);
    l.push("═".repeat(32));
    l.push(`Table: ${selectedTable.table_number}${splitLabel ? ` (Seat ${splitLabel})` : ""}`);
    l.push(`Date: ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`);
    l.push(`Payment: ${paymentMethod.toUpperCase()}`);
    l.push("─".repeat(32));
    l.push("Item                 Qty  Amount");
    l.push("─".repeat(32));
    orderItems.forEach((i) => {
      l.push(`${i.name.slice(0, 20).padEnd(20)} ${String(i.quantity).padStart(3)} ${`₹${(i.price * i.quantity).toFixed(2)}`.padStart(8)}`);
    });
    l.push("─".repeat(32));
    l.push(`Subtotal:           ${formatCurrency(subtotal)}`);
    if (discountValue > 0) l.push(`Discount (${discountValue}%):    -${formatCurrency(discountAmount)}`);
    if (taxPercent > 0) l.push(`GST (${taxPercent}%):         ${formatCurrency(taxAmount)}`);
    l.push("═".repeat(32));
    l.push(`TOTAL:              ${formatCurrency(grandTotal)}`);
    l.push("═".repeat(32));
    if (hotelInfo?.upi_id) {
      l.push(`UPI: ${hotelInfo.upi_id}`);
    }
    l.push(hotelInfo?.receipt_footer || "   Thank you! Visit again.");
    return l.join("\n");
  };

  const handlePrint = () => {
    if (!orderItems.length) { toast.error("Add items first"); return; }
    const receipt = buildReceiptText();
    const upiQrUrl = hotelInfo?.upi_id
      ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${hotelInfo.upi_id}&pn=${encodeURIComponent(hotelInfo?.name || "Hotel")}&am=${grandTotal.toFixed(2)}&cu=INR`)}`
      : undefined;
    void printReceipt({
      text: receipt,
      title: `Receipt · Table ${selectedTable?.table_number ?? ""}`,
      logoUrl: hotelInfo?.logo_url || undefined,
      upiQrUrl,
      upiAmount: grandTotal,
    });
  };

  const handleWhatsApp = () => {
    if (!orderItems.length) { toast.error("Add items first"); return; }
    const phone = customerPhone.replace(/\D/g, "");
    if (!phone) { toast.error("Enter WhatsApp number"); return; }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(buildReceiptText())}`, "_blank");
  };

  const handleSplitBill = () => {
    if (!orderItems.length) { toast.error("Add items first"); return; }
    const n = Number(window.prompt("Split into how many guests?", "2"));
    if (!n || n < 2) return;
    const each = grandTotal / n;
    toast.success(`Split: ${n} guests × ${formatCurrency(each)} each`);
  };

  /* ────────── hold order ────────── */
  const holdCurrentOrder = async () => {
    if (!selectedTable || !hotelId || !user || !orderItems.length) { toast.error("Add items first"); return; }
    await supabase.from("held_orders").insert({
      hotel_id: hotelId, table_id: selectedTable.id, table_number: selectedTable.table_number,
      held_by: user.id, held_by_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Staff",
      items: orderItems as any, discount_percent: discountValue, split_label: splitLabel, status: "held",
    } as any);
    toast.success("Order held ✓");
    setOrderItems([]); setActiveOrderId(null);
    await fetchHeldOrders();
  };

  const fetchHeldOrders = useCallback(async () => {
    if (!hotelId) return;
    const { data } = await supabase.from("held_orders").select("id, table_number, items, created_at")
      .eq("hotel_id", hotelId).eq("status", "held").order("created_at", { ascending: false });
    setHeldOrders((data || []) as any[]);
  }, [hotelId]);

  // Fetch held orders on mount AND when toggled, so badge count is always accurate
  useEffect(() => { void fetchHeldOrders(); }, [fetchHeldOrders]);
  useEffect(() => { if (showHeld) void fetchHeldOrders(); }, [showHeld, fetchHeldOrders]);

  const resumeHeldOrder = async (held: any) => {
    setOrderItems((held.items || []).map((i: any, idx: number) => ({ ...i, key: i.key || `resumed-${idx}` })));
    setActiveOrderId(null);
    await supabase.from("held_orders").update({ status: "resumed", resumed_at: new Date().toISOString() }).eq("id", held.id);
    toast.success(`Resumed order from T-${held.table_number}`);
    setShowHeld(false);
    await fetchHeldOrders();
  };

  /* ────────── table transfer ────────── */
  const transferToTable = async (targetTableId: string) => {
    if (!activeOrderId || !selectedTable) return;
    await supabase.from("orders").update({ table_id: targetTableId }).eq("id", activeOrderId);
    // Update KOT tickets too
    await supabase.from("kot_tickets").update({ table_id: targetTableId }).eq("order_id", activeOrderId);
    // Mark old table empty if no other orders
    const { data: remaining } = await supabase.from("orders").select("id").eq("table_id", selectedTable.id).eq("status", "active").limit(1);
    if (!remaining || remaining.length === 0) {
      await supabase.from("restaurant_tables").update({ status: "empty" }).eq("id", selectedTable.id);
    }
    await supabase.from("restaurant_tables").update({ status: "occupied" }).eq("id", targetTableId);
    toast.success("Bill transferred!");
    setShowTransfer(false); resetPanelState(); await fetchTables();
  };

  /* ────────── CRM lookup ────────── */
  const lookupCustomer = async () => {
    if (!hotelId || !customerLookupPhone.trim()) return;
    const { data } = await supabase.from("customers").select("id, name, phone, loyalty_points")
      .eq("hotel_id", hotelId).eq("phone", customerLookupPhone.trim()).maybeSingle();
    if (data) {
      setLookedUpCustomer(data as any);
      toast.success(`Found: ${data.name}`);
    } else {
      setLookedUpCustomer(null);
      toast.info("No customer found. They'll be created on first bill.");
    }
  };

  /* ────────── persist order ────────── */
  const persistOrder = async (sendToKds: boolean, assignedChefId?: string | null) => {
    if (!selectedTable || !hotelId || !user || !orderItems.length) { toast.error("Add items first"); return; }
    setSavingMode(sendToKds ? "kds" : "save");
    try {
      let orderId = activeOrderId;
      if (orderId) {
        await supabase.from("orders").update({ total: grandTotal, discount_percent: discountValue, payment_method: paymentMethod, split_label: splitLabel }).eq("id", orderId);
        await supabase.from("order_items").delete().eq("order_id", orderId);
      } else {
        const { data: created, error } = await supabase.from("orders").insert({
          hotel_id: hotelId, table_id: selectedTable.id, waiter_id: user.id, total: grandTotal,
          discount_percent: discountValue, payment_method: paymentMethod, order_source: "dine-in", status: "active", split_label: splitLabel,
        }).select("id").single();
        if (error) throw error;
        orderId = created.id; setActiveOrderId(orderId);
      }
      await supabase.from("order_items").insert(orderItems.map((i) => ({ order_id: orderId, name: i.name, price: i.price, quantity: i.quantity, is_custom: i.source === "custom" })));
      await supabase.from("restaurant_tables").update({ status: "occupied" }).eq("id", selectedTable.id);
      if (sendToKds && orderId) {
        const { data: existingKot } = await supabase
          .from("kot_tickets")
          .select("id")
          .eq("order_id", orderId)
          .in("status", ["pending", "preparing", "ready"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const kotPayload: any = {
          hotel_id: hotelId,
          order_id: orderId,
          table_id: selectedTable.id,
          status: "pending",
          assigned_waiter_id: user.id,
          assigned_chef_id: assignedChefId ?? null,
          claimed_by: null,
          claimed_at: null,
          started_at: null,
          ready_at: null,
          completed_at: null,
        };

        let kotId = existingKot?.id ?? null;

        if (kotId) {
          const { error: updateKotError } = await supabase.from("kot_tickets").update(kotPayload).eq("id", kotId);
          if (updateKotError) throw updateKotError;
          await supabase.from("kot_items").delete().eq("kot_id", kotId);
        } else {
          const { data: kot, error: insertKotError } = await supabase.from("kot_tickets").insert(kotPayload).select("id").single();
          if (insertKotError) throw insertKotError;
          kotId = kot.id;
        }

        if (kotId) {
          const { error: insertKotItemsError } = await supabase.from("kot_items").insert(
            orderItems.map((i) => ({ kot_id: kotId, name: i.name, price: i.price, quantity: i.quantity }))
          );
          if (insertKotItemsError) throw insertKotItemsError;
        }
      }
      if (sendToKds && !assignedChefId && chefs.length === 0) {
        toast.warning("No chef is linked to this hotel yet. Order was sent as unassigned KDS.");
      }

      const assignedChefName = assignedChefId
        ? chefs.find((chef) => chef.user_id === assignedChefId)?.full_name || "Chef"
        : null;

      toast.success(sendToKds ? (assignedChefName ? `Sent to ${assignedChefName} ✓` : "Sent to KDS ✓") : "Order saved ✓");

      // Audit: order placed
      if (orderId) {
        void writeAudit({
          hotelId,
          action: "order_placed",
          performedBy: user.id,
          performerName: user.email || null,
          tableNumber: selectedTable.table_number,
          orderId,
          details: `${orderItems.length} item(s) • ₹${grandTotal.toFixed(2)}${sendToKds ? " • sent to KDS" : ""}`,
        });
      }

      // Update seat flags
      setSeatFlags((prev) => ({ ...prev, [tableSplit]: true }));
      await fetchTables();
      setSelectedTable((p) => p ? { ...p, status: "occupied" } : p);
    } catch (e: any) { toast.error(e.message || "Save failed"); } finally { setSavingMode(null); }
  };

   /* ── settle / bill ── */
  const settleBill = async (isComplimentary = false) => {
    if (!selectedTable || !activeOrderId || !hotelId) { toast.error("No active order to settle"); return; }

    // Validate split payment totals
    if (paymentMethod === "split" && !isComplimentary) {
      const total = (parseFloat(splitCash) || 0) + (parseFloat(splitUpi) || 0) + (parseFloat(splitCard) || 0);
      if (Math.abs(total - grandTotal) > 1) {
        toast.error(`Split total ₹${total.toFixed(0)} doesn't match bill ₹${grandTotal.toFixed(0)}`);
        return;
      }
    }

    setSavingMode("bill");
    try {
      // Loyalty rule: ₹10 spent = 1 point. Redemption: 1 point = ₹1 off.
      const pointsEarned = isComplimentary ? 0 : Math.floor(grandTotal / 10);
      let finalTotal = isComplimentary ? 0 : grandTotal;
      let pointsAfter = lookedUpCustomer?.loyalty_points ?? 0;

      if (!isComplimentary && lookedUpCustomer && redeemPoints && lookedUpCustomer.loyalty_points > 0) {
        const redeemable = Math.min(lookedUpCustomer.loyalty_points, grandTotal);
        finalTotal = grandTotal - redeemable;
        pointsAfter = lookedUpCustomer.loyalty_points - redeemable + pointsEarned;
        toast.success(`Redeemed ₹${redeemable} in points!`);
      } else if (!isComplimentary && lookedUpCustomer) {
        pointsAfter = lookedUpCustomer.loyalty_points + pointsEarned;
      }

      // Update customer: points + visit count + total spend + last visit timestamp
      if (lookedUpCustomer) {
        const { data: existingCust } = await supabase
          .from("customers")
          .select("total_visits, total_spend, visit_count")
          .eq("id", lookedUpCustomer.id)
          .maybeSingle();
        const prevVisits = Number(existingCust?.total_visits || 0);
        const prevSpend = Number(existingCust?.total_spend || 0);
        const prevVisitCount = Number(existingCust?.visit_count || 0);
        await supabase.from("customers").update({
          loyalty_points: pointsAfter,
          total_visits: isComplimentary ? prevVisits : prevVisits + 1,
          visit_count: isComplimentary ? prevVisitCount : prevVisitCount + 1,
          total_spend: isComplimentary ? prevSpend : prevSpend + finalTotal,
          last_visit_at: new Date().toISOString(),
        }).eq("id", lookedUpCustomer.id);
      }

      const pmLabel = isComplimentary ? "complimentary" : paymentMethod === "split"
        ? `split:cash=${splitCash || 0},upi=${splitUpi || 0},card=${splitCard || 0}`
        : paymentMethod;

      const orderUpdate: any = { status: "billed", billed_at: new Date().toISOString(), total: finalTotal, payment_method: pmLabel };
      if (lookedUpCustomer) orderUpdate.customer_id = lookedUpCustomer.id;
      await supabase.from("orders").update(orderUpdate).eq("id", activeOrderId);

      if (finalTotal > 0) {
        await supabase.from("sales").insert({ hotel_id: hotelId, order_id: activeOrderId, amount: finalTotal });
      }

      try { await supabase.rpc("deduct_stock_for_order", { _order_id: activeOrderId }); } catch {}

      const { data: remaining } = await supabase.from("orders").select("id").eq("table_id", selectedTable.id).eq("status", "active").limit(1);
      if (!remaining || remaining.length === 0) {
        await supabase.from("restaurant_tables").update({ status: "cleaning" }).eq("id", selectedTable.id);
      }

      // Audit: bill generated
      void writeAudit({
        hotelId,
        action: "order_billed",
        performedBy: user.id,
        performerName: user.email || null,
        tableNumber: selectedTable.table_number,
        orderId: activeOrderId,
        details: `Bill ₹${finalTotal.toFixed(2)} (${pmLabel})${isComplimentary ? " — complimentary" : ""}`,
      });

      toast.success(isComplimentary ? "Complimentary bill settled ✓" : `Bill settled! ${lookedUpCustomer ? `+${pointsEarned} loyalty pts` : ""}`);
      resetPanelState(); await fetchTables();
    } catch (e: any) { toast.error(e.message); } finally { setSavingMode(null); }
  };

  /* ── e-bill via email ── */
  const handleEmailBill = () => {
    if (!orderItems.length) { toast.error("Add items first"); return; }
    const receipt = buildReceiptText();
    const subject = encodeURIComponent(`Bill from ${hotelInfo?.name || "SpeedoBill"}`);
    const body = encodeURIComponent(receipt);
    window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
    toast.success("Email client opened");
  };

  /* ────────── render menu card ────────── */
  const renderMenuCard = (item: MenuItem) => {
    const variants = (item.price_variants as PriceVariant[] | null)?.filter(v => v.label && v.price > 0) || [];
    const hasVariants = variants.length > 0;
    // Sum qty across all variant keys for this item
    const qty = orderItems.filter(l => l.key.startsWith(`menu-${item.id}`)).reduce((s, l) => s + l.quantity, 0);
    const priceLabel = hasVariants
      ? `₹${Math.min(...variants.map(v => v.price))}+`
      : formatCurrency(Number(item.price));

    if (density === "compact") {
      return (
        <button key={item.id} onClick={() => addMenuItemToOrder(item)}
          className="group relative flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border/40 glass-card p-3 text-center hover-lift aspect-square">
          {qty > 0 && <div className="absolute -right-1 -top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-qty-badge-in">{qty}</div>}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-muted overflow-hidden">
            {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <UtensilsCrossed className="h-5 w-5 text-muted-foreground/50" />}
          </div>
          <p className="w-full text-xs font-semibold text-foreground leading-tight line-clamp-2">{item.name}</p>
          <p className="text-sm font-bold text-primary">{priceLabel}</p>
        </button>
      );
    }
    return (
      <button key={item.id} onClick={() => addMenuItemToOrder(item)}
        className="group relative overflow-hidden rounded-2xl glass-card p-3 text-center hover-lift aspect-square flex flex-col items-center justify-center gap-2">
        {qty > 0 && <div className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground shadow animate-qty-badge-in">{qty}</div>}
        <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted overflow-hidden">
          {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <UtensilsCrossed className="h-7 w-7 text-muted-foreground/40" />}
        </div>
        <p className="w-full text-sm font-semibold text-foreground leading-tight line-clamp-2">{item.name}</p>
        <p className="text-base font-bold text-primary">{priceLabel}</p>
      </button>
    );
  };

  /* ════════════════════ RENDER ════════════════════ */
  const pageBg = isDark ? "#0A0F1E" : "#F8FAFC";
  const cardBg = isDark ? "#131C35" : "#FFFFFF";
  const cardBorder = isDark ? "#1E2D4A" : "#E2E8F0";
  const cardShadow = isDark ? "none" : "0 2px 8px rgba(0,0,0,0.08)";
  const headingColor = isDark ? "#FFFFFF" : "#0F172A";
  const subTextColor = isDark ? "#94A3B8" : "#64748B";

  return (
    <div
      className="mx-auto max-w-7xl space-y-4 p-4 md:p-6 -m-4 md:-m-6 min-h-[calc(100vh-4rem)]"
      style={{ background: pageBg }}
    >
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 md:pt-6 px-4 md:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold" style={{ color: headingColor }}>Tables</h1>
          <p className="text-sm" style={{ color: subTextColor }}>Tap a table to order · Cleaning → tap to mark empty</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 flex-wrap justify-end">
          {isOwner && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSectionsOpen(true)}
              className="shrink-0 border-indigo-500/60 bg-transparent text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-300"
            >
              <Layers className="mr-1 h-4 w-4" /> Sections
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setReserveOpen(true)}
            className="shrink-0 border-orange-500/60 bg-transparent text-orange-500 hover:bg-orange-500/10 hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-300"
          >
            <CalendarCheck className="mr-1 h-4 w-4" /> Reserve
          </Button>
          {isOwner && (
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="shrink-0 shadow-md border-0"
              style={{ backgroundColor: "#F97316", color: "#FFFFFF" }}
            >
              <Plus className="mr-1 h-4 w-4" /> Add Table
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 md:px-6 space-y-4 pb-6">
        {/* Counter billing banner */}
        {counterBillingEnabled && (
          <div className="flex items-center justify-between rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-orange-500 dark:text-orange-400" />
              <span className="text-sm font-medium" style={{ color: headingColor }}>Counter Billing is ON — use Counter for takeaway orders</span>
            </div>
            <Button
              size="sm"
              onClick={() => window.location.href = "/counter"}
              className="gap-1.5 bg-orange-500 text-white hover:bg-orange-600"
            >
              <Store className="h-3.5 w-3.5" /> Go to Counter
            </Button>
          </div>
        )}

        {/* status legend */}
        <div
          className="flex flex-wrap gap-3 rounded-2xl border px-4 py-3"
          style={{ background: cardBg, borderColor: cardBorder, boxShadow: cardShadow }}
        >
          {Object.entries(tableStyles).map(([status, s]) => (
            <div
              key={status}
              className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
              style={{ background: `${s.stripe}1a`, borderColor: `${s.stripe}55` }}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.stripe }} />
              <span className="font-medium" style={{ color: headingColor }}>{s.label}</span>
            </div>
          ))}
        </div>

        {/* section tabs */}
        {sections.length > 0 && (
          <div
            className="flex flex-wrap gap-2 rounded-2xl border px-3 py-2"
            style={{ background: cardBg, borderColor: cardBorder, boxShadow: cardShadow }}
          >
            <button
              onClick={() => setSectionFilter("all")}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${sectionFilter === "all" ? "scale-105" : "opacity-70"}`}
              style={{
                background: sectionFilter === "all" ? "#F97316" : "transparent",
                color: sectionFilter === "all" ? "#FFFFFF" : headingColor,
                borderColor: sectionFilter === "all" ? "#F97316" : cardBorder,
              }}
            >
              <LayoutGrid className="h-3 w-3" /> All ({tables.length})
            </button>
            {sections.map((sec) => {
              const count = tables.filter((t) => t.section_name === sec.name).length;
              const active = sectionFilter === sec.name;
              return (
                <button
                  key={sec.id}
                  onClick={() => setSectionFilter(sec.name)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-all ${active ? "scale-105" : "opacity-80 hover:opacity-100"}`}
                  style={{
                    background: active ? sec.color : `${sec.color}1a`,
                    color: active ? "#FFFFFF" : headingColor,
                    borderColor: active ? sec.color : `${sec.color}66`,
                  }}
                >
                  <span>{sec.icon}</span> {sec.name} ({count})
                </button>
              );
            })}
          </div>
        )}

        {/* table grid */}
        {loading ? (
          <TableMapSkeleton />
        ) : tables.length === 0 ? (
          <div
            className="py-16 text-center rounded-2xl border"
            style={{ background: cardBg, borderColor: cardBorder, boxShadow: cardShadow }}
          >
            <Users className="mx-auto mb-3 h-12 w-12 opacity-50" style={{ color: subTextColor }} />
            <p className="text-sm" style={{ color: subTextColor }}>No tables yet. Add some to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {(sectionFilter === "all" ? tables : tables.filter((t) => t.section_name === sectionFilter)).map((table) => {
              const s = tableStyles[table.status] || tableStyles.empty;
              const tint = isDark ? s.tintDark : s.tintLight;
              return (
                <div
                  key={table.id}
                  onClick={() => table.status === "cleaning" ? markCleaningDone(table.id) : void loadTableWorkspace(table)}
                  className={`group relative cursor-pointer rounded-2xl overflow-hidden border transition-all duration-200 hover:-translate-y-[2px] ${s.glow} animate-pop-in`}
                  style={{ background: tint, borderColor: cardBorder, boxShadow: cardShadow }}
                >
                  <div className="h-[3px] w-full" style={{ background: s.stripe }} />
                  <div className="p-4 text-center">
                    <p className="text-[28px] font-extrabold leading-none tnum" style={{ color: headingColor }}>{table.table_number}</p>
                    <div className="mt-2 flex items-center justify-center gap-1 text-xs" style={{ color: subTextColor }}>
                      <Users className="h-3 w-3" /> {table.capacity}
                    </div>
                    <span className={`mt-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${s.pill} ${s.pillText}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                      {s.label}
                    </span>
                    {table.status === "cleaning" && (
                      <div className="mt-2 flex items-center justify-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-300">
                        <Check className="h-3 w-3" /> Tap to mark empty
                      </div>
                    )}
                  </div>
                  {isOwner && (
                    <button
                      onClick={(e) => { e.stopPropagation(); void deleteTable(table.id); }}
                      className="absolute right-1.5 top-2.5 rounded-full bg-black/40 backdrop-blur p-1 text-red-400 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/20"
                      aria-label="Delete table"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Tables Dialog ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Add Tables</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="number" placeholder="Number of tables" value={newCount} onChange={(e) => setNewCount(e.target.value)} min="1" max="50" />
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Section</label>
              <Select value={newTableSection} onValueChange={setNewTableSection}>
                <SelectTrigger><SelectValue placeholder="Select section" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Main">🍽️ Main</SelectItem>
                  {sections.map((sec) => (
                    <SelectItem key={sec.id} value={sec.name}>{sec.icon} {sec.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sections.length === 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground">Tip: Create sections (Ground Floor, Terrace, VIP…) from the <button type="button" onClick={() => { setAddOpen(false); setSectionsOpen(true); }} className="underline text-orange-500">Sections</button> button.</p>
              )}
            </div>
            <Button className="w-full" onClick={addTables} style={{ backgroundColor: "#F97316", color: "#FFFFFF" }}>Add Tables</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Sections Manager Dialog ── */}
      <Dialog open={sectionsOpen} onOpenChange={setSectionsOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Layers className="h-5 w-5 text-indigo-500" /> Manage Sections / Floors</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* existing sections */}
            <div className="space-y-2">
              {sections.length === 0 ? (
                <p className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                  No sections yet. Create your first one below — e.g., Ground Floor, Terrace, VIP, Bar Area.
                </p>
              ) : (
                sections.map((sec) => {
                  const count = tables.filter((t) => t.section_name === sec.name).length;
                  return (
                    <div
                      key={sec.id}
                      className="flex items-center justify-between rounded-lg border p-2.5"
                      style={{ background: `${sec.color}10`, borderColor: `${sec.color}55` }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg" style={{ background: sec.color }}>
                          {sec.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{sec.name}</p>
                          <p className="text-[11px] text-muted-foreground">{count} table{count === 1 ? "" : "s"}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteSection(sec.id, sec.name)}
                        className="rounded-full p-1.5 text-red-500 hover:bg-red-500/10"
                        aria-label={`Delete ${sec.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* add new */}
            <div className="rounded-lg border border-dashed p-3 space-y-2.5">
              <p className="text-xs font-semibold text-muted-foreground">+ Add New Section</p>
              <div className="flex gap-2">
                <Input
                  placeholder="🍽️"
                  value={secIcon}
                  onChange={(e) => setSecIcon(e.target.value.slice(0, 4))}
                  className="w-16 text-center text-lg"
                  maxLength={4}
                />
                <Input
                  placeholder="e.g. Ground Floor, Terrace, VIP"
                  value={secName}
                  onChange={(e) => setSecName(e.target.value)}
                  className="flex-1"
                />
                <input
                  type="color"
                  value={secColor}
                  onChange={(e) => setSecColor(e.target.value)}
                  className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent"
                  aria-label="Section color"
                />
              </div>
              {/* quick presets */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { n: "Ground Floor", i: "🏢" },
                  { n: "First Floor", i: "🏬" },
                  { n: "Terrace", i: "🌇" },
                  { n: "Rooftop", i: "🌃" },
                  { n: "Garden", i: "🌳" },
                  { n: "AC Section", i: "❄️" },
                  { n: "VIP", i: "👑" },
                  { n: "Bar Area", i: "🍸" },
                  { n: "Private Dining", i: "🚪" },
                ].map((p) => (
                  <button
                    key={p.n}
                    type="button"
                    onClick={() => { setSecName(p.n); setSecIcon(p.i); }}
                    className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] hover:bg-muted"
                  >
                    {p.i} {p.n}
                  </button>
                ))}
              </div>
              <Button
                onClick={addSection}
                className="w-full"
                style={{ backgroundColor: "#F97316", color: "#FFFFFF" }}
                disabled={!secName.trim()}
              >
                <Plus className="mr-1 h-4 w-4" /> Add Section
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Reservation Dialog ── */}
      <Dialog open={reserveOpen} onOpenChange={setReserveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reserve a Table</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={resTableId} onValueChange={setResTableId}>
              <SelectTrigger><SelectValue placeholder="Select table (optional)" /></SelectTrigger>
              <SelectContent>
                {tables.filter((t) => t.status === "empty").map((t) => (
                  <SelectItem key={t.id} value={t.id}>Table {t.table_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Customer Name *" value={resName} onChange={(e) => setResName(e.target.value)} />
            <Input placeholder="Phone Number" value={resPhone} onChange={(e) => setResPhone(e.target.value)} />
            <Input placeholder="Guests" type="number" min="1" value={resGuests} onChange={(e) => setResGuests(e.target.value)} />
            <Input type="datetime-local" value={resTime} onChange={(e) => setResTime(e.target.value)} />
            <Input placeholder="Notes (optional)" value={resNotes} onChange={(e) => setResNotes(e.target.value)} />
            <Button className="w-full" onClick={handleReserve}>Confirm Reservation</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Order Panel (Sheet) ── */}
      <Sheet open={Boolean(selectedTable)} onOpenChange={(open) => !open && resetPanelState()}>
        <SheetContent side="right" className="w-full max-w-full p-0 sm:max-w-full md:max-w-[92vw] lg:max-w-[1200px] [&>button]:hidden">
          {selectedTable && (
            <div className="flex h-full flex-col">
              {/* header */}
              <div className="border-b border-border px-4 py-3 md:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-foreground">Table {selectedTable.table_number}</h2>
                      {splitLabel && <Badge className="bg-blue-500/15 text-blue-600 text-[10px]">Seat {splitLabel}</Badge>}
                      {activeOrderId && <Badge className="bg-primary/15 text-primary text-[10px]">Active</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">Select seat → add items → save/KDS → settle</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {/* Seat selector */}
                    <div className="flex items-center rounded-lg border border-border overflow-hidden">
                      {["none", "A", "B", "C", "D"].map((s) => (
                        <button key={s} onClick={() => void loadSeatOrder(s)}
                          className={`relative px-2.5 py-1.5 text-[11px] font-medium transition-colors ${tableSplit === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>
                          {s === "none" ? "All" : s}
                          {seatFlags[s] && tableSplit !== s && <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />}
                        </button>
                      ))}
                    </div>
                    <Badge variant="outline" className="border-primary/30 bg-primary/10 text-primary text-xs">{itemCount}</Badge>
                    <button onClick={() => setDensity("compact")} aria-label="Compact"
                      className={`rounded-lg border p-1.5 transition-colors ${density === "compact" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                      <Grid3X3 className="h-4 w-4" />
                    </button>
                    <button onClick={() => setDensity("visual")} aria-label="Visual"
                      className={`rounded-lg border p-1.5 transition-colors ${density === "visual" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button onClick={resetPanelState} className="rounded-lg border border-border p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {panelLoading ? (
                <div className="flex flex-1 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
              ) : (
                <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-[1.5fr_1fr]">
                  {/* LEFT: menu */}
                  <div className="overflow-y-auto border-b border-border p-3 lg:border-b-0 lg:border-r md:p-4">
                    <div className="sticky top-0 z-10 mb-3 space-y-2 bg-card pb-2">
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search menu..." className="pl-9 h-9" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {categories.map((cat) => (
                          <button key={cat} onClick={() => setActiveCategory(cat)}
                            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
                            {cat === "all" ? "All" : cat}
                          </button>
                        ))}
                      </div>
                    </div>
                    {filteredMenu.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No items match.</div>
                    ) : (
                      <div className={`grid gap-2.5 ${density === "compact" ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4" : "grid-cols-2 md:grid-cols-3"}`}>
                        {filteredMenu.map(renderMenuCard)}
                      </div>
                    )}
                  </div>

                  {/* RIGHT: order & billing */}
                  <div className="overflow-y-auto bg-background/30 p-3 md:p-4">
                    <div className="space-y-3">
                      {/* custom item */}
                      <div className="rounded-xl border border-border bg-card p-3">
                        <p className="mb-2 text-xs font-semibold text-foreground">Custom Item</p>
                        <div className="flex gap-2">
                          <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="Name" className="flex-1 h-8 text-xs" />
                          <Input value={customPrice} onChange={(e) => setCustomPrice(e.target.value)} placeholder="₹" type="number" className="w-20 h-8 text-xs" />
                          <Button size="icon" variant="outline" className="h-8 w-8" onClick={addCustomItem}><Plus className="h-3.5 w-3.5" /></Button>
                        </div>
                      </div>

                      {/* order items */}
                      <div className="rounded-xl border border-border bg-card p-3">
                        <div className="mb-2 flex items-center gap-2">
                          <ShoppingCart className="h-4 w-4 text-primary" />
                          <p className="text-xs font-semibold text-foreground">Order {splitLabel ? `(Seat ${splitLabel})` : ""}</p>
                          <Badge variant="secondary" className="text-[10px]">{itemCount}</Badge>
                        </div>
                        {orderItems.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Tap menu items to start.</div>
                        ) : (
                          <div className="space-y-2">
                            {orderItems.map((item) => (
                              <div key={item.key} className="flex items-center justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium text-foreground">{item.name}</p>
                                  <p className="text-[10px] text-muted-foreground">{item.source === "custom" ? "Custom" : "Menu"}</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => updateQuantity(item.key, -1)} className="rounded border border-border p-0.5 text-muted-foreground hover:bg-muted"><Minus className="h-3 w-3" /></button>
                                  <span className="w-5 text-center text-xs font-bold">{item.quantity}</span>
                                  <button onClick={() => updateQuantity(item.key, 1)} className="rounded border border-border p-0.5 text-muted-foreground hover:bg-muted"><Plus className="h-3 w-3" /></button>
                                  <span className="w-16 text-right text-xs font-medium">{formatCurrency(item.price * item.quantity)}</span>
                                  <button onClick={() => removeLineItem(item.key)} className="p-0.5 text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                                </div>
                              </div>
                            ))}
                            {/* totals */}
                            <div className="space-y-1 border-t border-border pt-2 text-xs">
                              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Discount</span>
                                <div className="flex items-center gap-1"><Input value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} type="number" min="0" max="100" className="h-7 w-16 text-right text-xs" /><span>%</span></div>
                              </div>
                              <div className="flex justify-between text-muted-foreground"><span>Tax ({taxPercent}%)</span><span>{formatCurrency(taxAmount)}</span></div>
                              <div className="flex justify-between border-t border-border pt-1.5 text-base font-bold text-foreground"><span>Total</span><span>{formatCurrency(grandTotal)}</span></div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* CRM / Loyalty Lookup */}
                      <div className="rounded-xl border border-border bg-card p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <UserSearch className="h-4 w-4 text-primary" />
                          <p className="text-xs font-semibold text-foreground">Customer Lookup</p>
                        </div>
                        <div className="flex gap-2 mb-2">
                          <Input value={customerLookupPhone} onChange={(e) => setCustomerLookupPhone(e.target.value)} placeholder="Phone number" className="flex-1 h-8 text-xs" />
                          <Button size="sm" variant="outline" className="h-8" onClick={lookupCustomer}><Search className="h-3.5 w-3.5" /></Button>
                        </div>
                        {lookedUpCustomer && (
                          <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-foreground">{lookedUpCustomer.name}</span>
                              <Badge className="bg-primary/15 text-primary text-[10px] gap-1"><Gift className="h-3 w-3" />{lookedUpCustomer.loyalty_points} pts</Badge>
                            </div>
                            {lookedUpCustomer.loyalty_points > 0 && (
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input type="checkbox" checked={redeemPoints} onChange={(e) => setRedeemPoints(e.target.checked)} className="rounded" />
                                <span className="text-[11px] text-muted-foreground">Redeem {lookedUpCustomer.loyalty_points} points (₹{lookedUpCustomer.loyalty_points})</span>
                              </label>
                            )}
                          </div>
                        )}
                      </div>

                      {/* bill actions */}
                      <div className="rounded-xl border border-border bg-card p-3">
                        <p className="mb-2 text-xs font-semibold text-foreground">Bill Actions</p>
                        <div className="space-y-2">
                          {/* payment method */}
                          <div className="grid grid-cols-4 gap-1.5">
                            {(["cash", "upi", "card", "split"] as const).map((m) => (
                              <button key={m} onClick={() => { setPaymentMethod(m); setShowUpiQr(m === "upi"); if (m === "split") setSplitPayOpen(true); else setSplitPayOpen(false); }}
                                className={`rounded-lg border px-2 py-2 text-[11px] font-medium capitalize transition-colors ${paymentMethod === m ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
                                {m === "upi" ? "UPI" : m === "split" ? "Split" : m}
                              </button>
                            ))}
                          </div>

                          {/* Split Payment Panel */}
                          {splitPayOpen && paymentMethod === "split" && (
                            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                              <p className="text-xs font-semibold text-foreground flex items-center gap-1"><CreditCard className="h-3.5 w-3.5" /> Split Payment</p>
                              <div className="grid grid-cols-3 gap-2">
                                <div>
                                  <label className="text-[10px] text-muted-foreground">Cash</label>
                                  <Input type="number" value={splitCash} onChange={e => setSplitCash(e.target.value)} placeholder="₹0" className="h-8 text-xs" />
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground">UPI</label>
                                  <Input type="number" value={splitUpi} onChange={e => setSplitUpi(e.target.value)} placeholder="₹0" className="h-8 text-xs" />
                                </div>
                                <div>
                                  <label className="text-[10px] text-muted-foreground">Card</label>
                                  <Input type="number" value={splitCard} onChange={e => setSplitCard(e.target.value)} placeholder="₹0" className="h-8 text-xs" />
                                </div>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Split Total</span>
                                <span className={`font-bold ${Math.abs(((parseFloat(splitCash)||0)+(parseFloat(splitUpi)||0)+(parseFloat(splitCard)||0)) - grandTotal) > 1 ? "text-destructive" : "text-green-600"}`}>
                                  ₹{((parseFloat(splitCash)||0)+(parseFloat(splitUpi)||0)+(parseFloat(splitCard)||0)).toFixed(0)} / {formatCurrency(grandTotal)}
                                </span>
                              </div>
                            </div>
                          )}

                          {showUpiQr && (hotelInfo?.upi_qr_url || hotelInfo?.upi_id) && (
                            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-center">
                              <p className="mb-2 text-xs font-medium text-foreground">Scan to Pay</p>
                              {hotelInfo?.upi_qr_url ? (
                                <img src={hotelInfo.upi_qr_url} alt="UPI QR" className="mx-auto h-40 w-40 rounded-lg object-contain" />
                              ) : hotelInfo?.upi_id ? (
                                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`upi://pay?pa=${hotelInfo.upi_id}&pn=${encodeURIComponent(hotelInfo.name || "Hotel")}&am=${grandTotal.toFixed(2)}&cu=INR`)}`} alt="UPI QR" className="mx-auto h-40 w-40 rounded-lg object-contain" />
                              ) : null}
                              {hotelInfo?.upi_id && <p className="mt-1 text-[10px] text-muted-foreground">{hotelInfo.upi_id}</p>}
                            </div>
                          )}
                          {showUpiQr && !hotelInfo?.upi_qr_url && !hotelInfo?.upi_id && (
                            <div className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                              No UPI configured. Go to Settings → add UPI ID or QR image.
                            </div>
                          )}

                          {/* WhatsApp + E-Bill */}
                          <div className="flex gap-2">
                            <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="WhatsApp number" className="flex-1 h-8 text-xs" />
                            <Button size="sm" variant="outline" className="h-8" onClick={handleWhatsApp}><MessageCircle className="mr-1 h-3.5 w-3.5" /> Send</Button>
                            <Button size="sm" variant="outline" className="h-8" onClick={handleEmailBill}><Mail className="h-3.5 w-3.5" /></Button>
                          </div>

                          {/* save / kds / hold */}
                          <div className="grid grid-cols-3 gap-2">
                            <Button size="sm" className="h-9" onClick={() => void persistOrder(false)} disabled={savingMode !== null}>
                              {savingMode === "save" ? "..." : "Save"}
                            </Button>
                            <Button size="sm" variant="outline" className="h-9" onClick={() => {
                              if (chefs.length > 0) setChefPickerOpen(true);
                              else {
                                toast.warning("No active chef is linked to this hotel. Sending order as unassigned.");
                                void persistOrder(true);
                              }
                            }} disabled={savingMode !== null || !orderItems.length}>
                              <Send className="mr-1 h-3.5 w-3.5" /> KDS
                            </Button>
                            <Button size="sm" variant="outline" className="h-9 text-warning border-warning/30 hover:bg-warning/10" onClick={holdCurrentOrder}>
                              <Pause className="mr-1 h-3.5 w-3.5" /> Hold
                            </Button>
                          </div>

                          {/* resume held / transfer */}
                          <div className="grid grid-cols-2 gap-2">
                            <Button size="sm" variant="outline" className="h-9 relative" onClick={() => { setShowHeld(!showHeld); void fetchHeldOrders(); }}>
                              <Play className="mr-1 h-3.5 w-3.5" /> Resume
                              {heldOrders.length > 0 && (
                                <Badge className="absolute -top-2 -right-2 h-5 min-w-5 px-1 text-[10px] bg-warning text-warning-foreground">{heldOrders.length}</Badge>
                              )}
                            </Button>
                            {activeOrderId && (
                              <Button size="sm" variant="outline" className="h-9" onClick={() => setShowTransfer(!showTransfer)}>
                                <ArrowRightLeft className="mr-1 h-3.5 w-3.5" /> Transfer
                              </Button>
                            )}
                          </div>

                          {/* held orders list */}
                          {showHeld && heldOrders.length > 0 && (
                            <div className="rounded-lg border border-border bg-muted/30 p-2 space-y-1.5 max-h-40 overflow-y-auto">
                              {heldOrders.map(h => {
                                const heldMs = Date.now() - new Date(h.created_at).getTime();
                                const mins = Math.floor(heldMs / 60000);
                                const timeAgo = mins < 1 ? "Just now" : mins < 60 ? `${mins}m ago` : `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
                                return (
                                  <button key={h.id} onClick={() => resumeHeldOrder(h)}
                                    className="w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs hover:bg-primary/10 transition-colors border border-border">
                                    <div className="flex flex-col items-start gap-0.5">
                                      <span className="font-medium text-foreground">T-{h.table_number} · {(h.items || []).length} items</span>
                                      <span className={`text-[10px] ${mins >= 15 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                                        🕐 {timeAgo}
                                      </span>
                                    </div>
                                    <Badge variant="outline" className="text-[10px]"><Play className="h-3 w-3 mr-1" />Resume</Badge>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          {showHeld && heldOrders.length === 0 && (
                            <div className="rounded-lg border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
                              No held orders
                            </div>
                          )}

                          {/* transfer target */}
                          {showTransfer && (
                            <div className="rounded-lg border border-border bg-muted/30 p-2">
                              <p className="text-[11px] text-muted-foreground mb-1.5">Transfer bill to:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {tables.filter(t => t.id !== selectedTable?.id && t.status === "empty").map(t => (
                                  <button key={t.id} onClick={() => transferToTable(t.id)}
                                    className="rounded-lg border border-table-empty/50 bg-table-empty/10 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-table-empty/20 transition-colors">
                                    T-{t.table_number}
                                  </button>
                                ))}
                                {tables.filter(t => t.id !== selectedTable?.id && t.status === "empty").length === 0 && (
                                  <p className="text-[11px] text-muted-foreground">No empty tables available</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* print / complimentary / settle */}
                          <div className="grid grid-cols-4 gap-2">
                            <Button size="sm" variant="outline" className="h-9" onClick={handlePrint}><Printer className="mr-1 h-3.5 w-3.5" /> Print</Button>
                            <Button size="sm" variant="ghost" className="h-9" onClick={handleSplitBill}><Sparkles className="mr-1 h-3.5 w-3.5" /> Split</Button>
                            <Button size="sm" variant="outline" className="h-9 text-amber-600 border-amber-500/30 hover:bg-amber-500/10" 
                              onClick={() => { if (window.confirm("Mark as Complimentary (₹0)?")) settleBill(true); }}
                              disabled={!activeOrderId || savingMode !== null}>
                              <Gift className="mr-1 h-3.5 w-3.5" /> Free
                            </Button>
                            <Button size="sm" variant="default" className="h-9 bg-success hover:bg-success/90 text-success-foreground" onClick={() => settleBill(false)} disabled={!activeOrderId || savingMode !== null}>
                              {savingMode === "bill" ? "..." : "Settle"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Variant Picker Dialog */}
      <Dialog open={!!variantPickerItem} onOpenChange={(open) => { if (!open) setVariantPickerItem(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base">{variantPickerItem?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-2">Select a variant:</p>
          <div className="space-y-2">
            {((variantPickerItem?.price_variants as PriceVariant[] | null) || [])
              .filter(v => v.label && v.price > 0)
              .map((v) => (
                <Button
                  key={v.label}
                  variant="outline"
                  className="w-full justify-between h-11"
                  onClick={() => {
                    addItemDirectly(variantPickerItem!.id, variantPickerItem!.name, v.price, v.label);
                    setVariantPickerItem(null);
                  }}
                >
                  <span className="capitalize font-medium">{v.label}</span>
                  <span className="font-bold text-primary">{formatCurrency(v.price)}</span>
                </Button>
              ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Chef Assignment Picker for KDS */}
      <Dialog open={chefPickerOpen} onOpenChange={setChefPickerOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2"><ChefHat className="h-5 w-5 text-primary" /> Assign to Chef</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mb-2">Choose which chef should prepare this order:</p>
          <div className="space-y-2">
            {chefs.map(c => (
              <Button key={c.user_id} variant="outline" className="w-full justify-start h-11 gap-3" onClick={() => {
                setChefPickerOpen(false);
                void persistOrder(true, c.user_id);
              }}>
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                  {(c.full_name || "C")[0].toUpperCase()}
                </div>
                <span className="font-medium">{c.full_name || "Chef"}</span>
              </Button>
            ))}
            <Button variant="ghost" className="w-full text-muted-foreground text-xs" onClick={() => {
              setChefPickerOpen(false);
              void persistOrder(true, null);
            }}>
              Send without assigning
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default React.memo(Tables);
