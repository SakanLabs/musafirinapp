import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  ChevronRight, 
  Package, 
  FileText 
} from "lucide-react";
import { toast } from "sonner";

interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  price: string;
  subtotal: string;
  product?: {
    name: string;
  };
}

interface Shipment {
  id: number;
  airwayBillCode: string | null;
  localCourier: string | null;
}

interface Order {
  id: number;
  orderNumber: string;
  userId: string;
  totalAmount: string;
  paymentStatus: string;
  shipmentStatus: string;
  createdAt: string;
  trackingNumber?: string | null;
  courierName?: string | null;
  items?: OrderItem[];
  shipments?: Shipment[];
}

export const Route = createFileRoute("/store/orders")({
  component: OrdersPage
});

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<{ success: boolean; data: Order[] }>("/api/store/orders");
      if (res.success) {
        setOrders(res.data || []);
      }
    } catch (e: any) {
      toast.error("Failed to load souvenir orders: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const getPaymentBadge = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === 'verified' || s === 'completed') return <Badge className="bg-emerald-100 text-emerald-800 border-none font-bold">Paid / Verified</Badge>;
    if (s === 'pending_verification') return <Badge className="bg-amber-100 text-amber-800 border-none font-bold">Reviewing Payment</Badge>;
    if (s === 'failed' || s === 'rejected') return <Badge className="bg-red-100 text-red-800 border-none font-bold">Rejected / Failed</Badge>;
    return <Badge className="bg-slate-100 text-slate-600 border-none font-bold">Unpaid</Badge>;
  };

  const getLogisticsBadge = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === 'delivered') return <Badge className="bg-emerald-100 text-emerald-800 border-none font-bold">Delivered</Badge>;
    if (s === 'customs_clearance' || s === 'local_delivery' || s === 'shipped') return <Badge className="bg-blue-100 text-blue-800 border-none font-bold">In Transit</Badge>;
    if (s === 'processing' || s === 'packing') return <Badge className="bg-amber-100 text-amber-800 border-none font-bold">Processing</Badge>;
    return <Badge className="bg-slate-100 text-slate-600 border-none font-bold">Pending Approval</Badge>;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="bg-white border border-gray-150 rounded-2xl p-5 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white border border-gray-150 rounded-2xl p-12 text-center shadow-xs space-y-4 max-w-xl mx-auto">
          <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto text-[#111111]">
            <Package className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-900">No Souvenir Orders Found</h3>
            <p className="text-xs text-gray-500 font-medium">Your historic cross-border purchases will display here.</p>
          </div>
          <Link 
            to="/store"
            className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#111111] hover:bg-[#222222] text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
          >
            Start Browsing
          </Link>
        </div>
      ) : (
        <div className="space-y-4 max-w-4xl mx-auto">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Order History</h3>
          
          <div className="space-y-4">
            {orders.map((o) => {
              const itemsCount = o.items?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
              const formattedDate = new Date(o.createdAt).toLocaleDateString("id-ID", {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              return (
                <Card key={o.id} className="p-5 hover:shadow-xs transition-all bg-white shadow-xs border-gray-200">
                  <CardContent className="p-0 flex flex-col md:flex-row gap-5 justify-between">
                    <div className="flex-1 space-y-3">
                      
                      {/* Meta header */}
                      <div className="flex flex-wrap gap-2 items-center text-xs font-bold text-gray-400">
                        <span>{o.orderNumber}</span>
                        <span>•</span>
                        <span>{formattedDate}</span>
                      </div>

                      {/* Status badges */}
                      <div className="flex flex-wrap gap-4 pt-1">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mr-1">Payment:</span>
                          {getPaymentBadge(o.paymentStatus)}
                        </div>
                        <div className="flex items-center gap-1 ml-2">
                          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mr-1">Shipment:</span>
                          {getLogisticsBadge(o.shipmentStatus)}
                        </div>
                      </div>

                      {/* Items brief */}
                      <div className="bg-gray-50/50 p-3.5 rounded-xl border border-gray-100 inline-flex flex-col text-gray-700 w-full max-w-lg space-y-1.5 mt-1">
                        <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block">Purchased Products ({itemsCount} Unit)</span>
                        <div className="space-y-1 text-xs">
                          {o.items?.map((item, idx) => (
                            <div key={idx} className="flex justify-between font-medium">
                              <span className="text-gray-600">{item.product?.name || "Saudi Souvenir"} x {item.quantity}</span>
                              <span className="text-gray-900 font-semibold">Rp {(parseFloat(item.price) * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* AWB info */}
                      {o.shipments && o.shipments[0]?.airwayBillCode && (
                        <div className="text-xs text-gray-500 flex items-center gap-1.5 pt-1 select-none font-semibold">
                          <Package className="h-4 w-4 text-[#111111] shrink-0" />
                          <span>Resi Airway Bill (AWB):</span>
                          <span className="bg-gray-100 px-2 py-0.5 rounded-md font-bold text-gray-700">
                            {o.shipments[0].airwayBillCode}
                          </span>
                          {o.shipments[0].localCourier && (
                            <span className="text-[10px] font-bold text-gray-400">({o.shipments[0].localCourier})</span>
                          )}
                        </div>
                      )}

                    </div>

                    {/* Right-hand side pricing and tracking button */}
                    <div className="md:text-right flex flex-col justify-between shrink-0">
                      
                      {/* Price breakdown */}
                      <div className="mb-4 md:mb-0 space-y-0.5">
                        <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold block">Total Paid</span>
                        <span className="text-2xl font-extrabold text-amber-600 block">
                          Rp {parseFloat(o.totalAmount).toFixed(2)}
                        </span>
                      </div>

                      <div className="pt-4 md:pt-0">
                        {o.trackingNumber ? (
                          <a
                            href={`https://cekresi.com/?noresi=${o.trackingNumber}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 w-fit md:ml-auto cursor-pointer"
                          >
                            <Package className="h-3.5 w-3.5" />
                            Cek Resi
                            <ChevronRight className="h-3.5 w-3.5 opacity-80" />
                          </a>
                        ) : (
                          <Link
                            to="/store/order/$orderId"
                            params={{ orderId: o.id.toString() }}
                            className="px-4 py-2 bg-zinc-950 hover:bg-zinc-900 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 w-fit md:ml-auto cursor-pointer"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Track Logistics
                            <ChevronRight className="h-3.5 w-3.5 opacity-80" />
                          </Link>
                        )}
                      </div>

                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
