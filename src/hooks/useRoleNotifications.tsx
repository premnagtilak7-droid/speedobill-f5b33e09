/**
 * Role-based real-time notification system.
 * - Chef: new KOT tickets → loud bell + browser notification
 * - Waiter: order marked "ready" → soft ding + browser notification
 * - Owner: payment received → payment sound, voids → warning, license expiry → info
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  playLoudBell,
  playSoftDing,
  playWarningTone,
  playPaymentSound,
  sendBrowserNotif,
} from "@/lib/notification-sounds";

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: "order" | "ready" | "void" | "bill" | "info";
  createdAt: number;
}

type NotifCallback = (notif: AppNotification) => void;
const notifListeners = new Set<NotifCallback>();

export function onAppNotification(cb: NotifCallback) {
  notifListeners.add(cb);
  return () => { notifListeners.delete(cb); };
}

function emit(notif: AppNotification) {
  notifListeners.forEach((cb) => cb(notif));
}

function pushNotification(notif: AppNotification) {
  emit(notif);

  if (notif.type === "ready") {
    toast.success(notif.title, { description: notif.body, duration: 4000 });
    return;
  }

  if (notif.type === "void" || notif.type === "bill") {
    toast.warning(notif.title, { description: notif.body, duration: 4500 });
    return;
  }

  toast.info(notif.title, { description: notif.body, duration: 4000 });
}

export function useRoleNotifications() {
  const { hotelId, role, user } = useAuth();

  // ── Chef: new KOT tickets ──
  useEffect(() => {
    if (!hotelId || role !== "chef") return;
    const channel = supabase
      .channel(`chef-kot-notif-${hotelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "kot_tickets", filter: `hotel_id=eq.${hotelId}` },
        async (payload) => {
          const kot = payload.new as any;
          if (kot.status === "pending" && (!kot.assigned_chef_id || kot.assigned_chef_id === user?.id)) {
            // Get table number
            const { data: tbl } = await supabase
              .from("restaurant_tables")
              .select("table_number")
              .eq("id", kot.table_id)
              .maybeSingle();
            const tableNum = tbl?.table_number || "?";

            playLoudBell();
            sendBrowserNotif(
              "🔔 New Order — Kitchen",
              `Table ${tableNum} has a new order!`,
              `kot-${kot.id}`
            );
            pushNotification({
              id: kot.id,
              title: "New Order",
              body: `Table ${tableNum} — new order received`,
              type: "order",
              createdAt: Date.now(),
            });
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "kot_tickets", filter: `hotel_id=eq.${hotelId}` },
        async (payload) => {
          const nextRow = payload.new as any;
          const prevRow = payload.old as any;
          const becameVisibleToMe = nextRow.status === "pending"
            && nextRow.assigned_chef_id === user?.id
            && prevRow?.assigned_chef_id !== user?.id;

          if (!becameVisibleToMe) return;

          const { data: tbl } = await supabase
            .from("restaurant_tables")
            .select("table_number")
            .eq("id", nextRow.table_id)
            .maybeSingle();
          const tableNum = tbl?.table_number || "?";

          playLoudBell();
          sendBrowserNotif(
            "🔔 Assigned Order — Kitchen",
            `Table ${tableNum} was assigned to you!`,
            `kot-assigned-${nextRow.id}`
          );
          pushNotification({
            id: nextRow.id,
            title: "Assigned Order",
            body: `Table ${tableNum} was assigned to you`,
            type: "order",
            createdAt: Date.now(),
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [hotelId, role, user?.id]);

  // ── Waiter: order marked "ready" ──
  useEffect(() => {
    if (!hotelId || !user || (role !== "waiter" && role !== "owner" && role !== "manager")) return;
    const channel = supabase
      .channel(`waiter-ready-notif-${hotelId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "kot_tickets", filter: `hotel_id=eq.${hotelId}` },
        async (payload) => {
          const newRow = payload.new as any;
          const oldRow = payload.old as any;
          if (newRow.status === "ready" && oldRow?.status !== "ready") {
            // Check if this staff member was the assigned waiter for this KOT
            const isAssigned = newRow.assigned_waiter_id === user.id;
            // Fallback: check order.waiter_id if no assigned_waiter_id
            let shouldNotify = isAssigned;
            if (!shouldNotify && !newRow.assigned_waiter_id) {
              const { data: order } = await supabase
                .from("orders")
                .select("waiter_id")
                .eq("id", newRow.order_id)
                .maybeSingle();
              shouldNotify = order?.waiter_id === user.id;
            }

            if (shouldNotify) {
              const { data: tbl } = await supabase
                .from("restaurant_tables")
                .select("table_number")
                .eq("id", newRow.table_id)
                .maybeSingle();
              const tableNum = tbl?.table_number || "?";

              playSoftDing();
              sendBrowserNotif(
                "🍽️ Order Ready!",
                `Table ${tableNum} — food is ready for pickup`,
                `ready-${newRow.id}`
              );
              pushNotification({
                id: newRow.id,
                title: "Order Ready",
                body: `Table ${tableNum} — food is ready!`,
                type: "ready",
                createdAt: Date.now(),
              });
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [hotelId, role, user]);

  // ── Waiter: service calls (Call Waiter / Request Water) from QR menu ──
  useEffect(() => {
    if (!hotelId || (role !== "waiter" && role !== "owner" && role !== "manager")) return;
    const channel = supabase
      .channel(`service-calls-notif-${hotelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "service_calls", filter: `hotel_id=eq.${hotelId}` },
        (payload) => {
          const sc = payload.new as any;
          if (sc.status === "active") {
            const isWater = sc.call_type === "water";
            playLoudBell();
            sendBrowserNotif(
              isWater ? "💧 Water Request" : "🔔 Call Waiter",
              `Table ${sc.table_number} needs ${isWater ? "water" : "assistance"}!`,
              `service-${sc.id}`
            );
            pushNotification({
              id: sc.id,
              title: isWater ? "Water Request" : "Call Waiter",
              body: `Table ${sc.table_number} needs ${isWater ? "water" : "assistance"}`,
              type: "order",
              createdAt: Date.now(),
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [hotelId, role]);

  // ── Owner/Manager: high-value bills + void requests + customer QR orders ──
  useEffect(() => {
    if (!hotelId || (role !== "owner" && role !== "manager")) return;

    // Void reports
    const voidChannel = supabase
      .channel(`owner-voids-${hotelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "void_reports", filter: `hotel_id=eq.${hotelId}` },
        (payload) => {
          const v = payload.new as any;
          playWarningTone();
          sendBrowserNotif(
            "⚠️ Void Request",
            `${v.item_name} (₹${v.item_price}) voided — ${v.reason}`,
            `void-${v.id}`
          );
          pushNotification({
            id: v.id,
            title: "Void Request",
            body: `${v.item_name} (₹${v.item_price}) — ${v.reason}`,
            type: "void",
            createdAt: Date.now(),
          });
        }
      )
      .subscribe();

    // Bills / Payments
    const billChannel = supabase
      .channel(`owner-bills-${hotelId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `hotel_id=eq.${hotelId}` },
        (payload) => {
          const o = payload.new as any;
          if (o.status === "billed") {
            playPaymentSound();
            sendBrowserNotif(
              "💰 Payment Received",
              `₹${Number(o.total).toFixed(0)} bill completed`,
              `bill-${o.id}`
            );
            pushNotification({
              id: o.id,
              title: "Payment Received",
              body: `₹${Number(o.total).toFixed(0)} bill completed`,
              type: "bill",
              createdAt: Date.now(),
            });
          }
        }
      )
      .subscribe();

    // Customer QR orders (incoming via customer_orders table)
    const customerOrderChannel = supabase
      .channel(`owner-customer-orders-${hotelId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "customer_orders", filter: `hotel_id=eq.${hotelId}` },
        (payload) => {
          const co = payload.new as any;
          if (co.status === "incoming") {
            playLoudBell();
            sendBrowserNotif(
              "📱 New Customer Order",
              `Table ${co.table_number} — ₹${Number(co.total_amount).toFixed(0)}`,
              `cust-order-${co.id}`
            );
            pushNotification({
              id: co.id,
              title: "Customer QR Order",
              body: `Table ${co.table_number} placed ₹${Number(co.total_amount).toFixed(0)} order`,
              type: "order",
              createdAt: Date.now(),
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(voidChannel);
      supabase.removeChannel(billChannel);
      supabase.removeChannel(customerOrderChannel);
    };
  }, [hotelId, role]);

  // ── License expiry warning (owner only, one-time check) ──
  useEffect(() => {
    if (!hotelId || role !== "owner") return;
    (async () => {
      const { data: hotel } = await supabase
        .from("hotels")
        .select("subscription_expiry, subscription_tier")
        .eq("id", hotelId)
        .maybeSingle();
      if (!hotel?.subscription_expiry) return;
      const daysLeft = Math.ceil((new Date(hotel.subscription_expiry).getTime() - Date.now()) / 86400000);
      if (daysLeft <= 7 && daysLeft > 0) {
        pushNotification({
          id: `license-expiry-${hotelId}`,
          title: "⚠️ License Expiring Soon",
          body: `Your ${hotel.subscription_tier} plan expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`,
          type: "info",
          createdAt: Date.now(),
        });
      }
    })();
  }, [hotelId, role]);
}
