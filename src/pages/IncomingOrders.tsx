import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIncomingOrders, stopTitleFlash } from "@/hooks/useIncomingOrders";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Bell, Check, Clock, ShoppingCart } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const IncomingOrders = () => {
  const { hotelId } = useAuth();
  const { incomingOrders, dismissOrder } = useIncomingOrders();

  if (!hotelId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" /> Incoming Customer Orders
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {incomingOrders.length} QR order(s) waiting for confirmation
        </p>
      </div>

      {incomingOrders.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No incoming customer orders right now</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {incomingOrders.map((order) => (
            <Card key={order.id} className="overflow-hidden border-primary/30 animate-pop-in">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">T{order.table_number}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Table {order.table_number}</p>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-primary/15 text-primary border-primary/30">
                    NEW
                  </Badge>
                </div>

                <div className="space-y-1.5 border-t pt-2">
                  {(order.items as any[])?.map((item: any, i: number) => (
                    <div key={i} className="flex items-start justify-between text-sm">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-muted-foreground">×{item.quantity} · ₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-sm font-bold">₹{order.total_amount}</span>
                  <Button size="sm" className="gap-1" onClick={() => {
                    dismissOrder(order.id);
                    stopTitleFlash();
                    toast.success(`Order from Table ${order.table_number} confirmed`);
                  }}>
                    <Check className="h-3.5 w-3.5" /> Confirm
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default IncomingOrders;
