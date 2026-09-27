import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  Loader2, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  MapPin, 
  Building2, 
  Package, 
  Truck,
  Plane,
  Home
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
    weight: string;
    images?: Array<{ imageUrl: string }>;
  };
}

interface ShipmentLog {
  id: number;
  activity: string;
  notes: string | null;
  createdAt: string;
}

interface Payment {
  id: number;
  amount: string;
  bankName: string;
  accountName: string;
  paymentProofUrl: string;
  createdAt: string;
}

interface Order {
  id: number;
  orderNumber: string;
  totalAmount: string;
  paymentStatus: string;
  shipmentStatus: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  createdAt: string;
  trackingNumber?: string | null;
  courierName?: string | null;
  items?: OrderItem[];
  payments?: Payment[];
  shipmentLogs?: ShipmentLog[];
}

export const Route = createFileRoute("/store/order/$orderId")({
  component: OrderDetailPage
});

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment upload states
  const [bankName, setBankName] = useState("Bank Syariah Indonesia (BSI)");
  const [accountName, setAccountName] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchOrderDetail = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<{ success: boolean; data: Order }>(`/api/store/orders/${orderId}`);
      if (res.success) {
        setOrder(res.data);
        setAmountPaid(parseFloat(res.data.totalAmount).toFixed(2));
      }
    } catch (e: any) {
      toast.error("Failed to load order details: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrderDetail();
  }, [orderId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUploadPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select transfer slip file first.");
      return;
    }
    if (!accountName || !amountPaid) {
      toast.error("Please fill recipient sender account owner name and transfer amount.");
      return;
    }

    try {
      setUploading(true);

      // 1. Upload to Object Storage via `/upload` Hono endpoint
      const formData = new FormData();
      formData.append('file', file);

      // We use fetch directly for multipart form-data to prevent JSON serialization in apiClient
      const authUrl = import.meta.env.DEV ? "http://localhost:3000" : "https://admin.musafirin.co";
      const uploadRes = await fetch(`${authUrl}/api/store/upload`, {
        method: 'POST',
        body: formData,
        // credentials cookies are sent automatically in Hono Better Auth session
      });
      const uploadJson = await uploadRes.json();
      if (!uploadJson.success || !uploadJson.imageUrl) {
        throw new Error(uploadJson.error || "Failed to upload image.");
      }

      const imageUrl = uploadJson.imageUrl;

      // 2. Submit payment proof record
      const paymentRes = await apiClient.post<any>(`/api/store/orders/${orderId}/payment`, {
        amount: amountPaid,
        bankName,
        accountName,
        paymentProofUrl: imageUrl,
        notes
      });
      if (paymentRes.success) {
        toast.success("Payment proof uploaded successfully! Reviewing shortly.");
        setFile(null);
        setAccountName("");
        await fetchOrderDetail();
      } else {
        toast.error(paymentRes.error || "Failed to submit payment");
      }
    } catch (err: any) {
      toast.error("Failed to process upload: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#111111] mb-2" />
        <span className="text-xs font-semibold text-gray-400">Loading order tracker...</span>
      </div>
    );
  }

  if (!order) return <div className="text-center py-10">Order not found.</div>;

  const logs = order.shipmentLogs || [];
  const items = order.items || [];
  const paymentProof = order.payments && order.payments.length > 0 ? order.payments[0] : null;

  const getLogisticsIcon = (activity: string) => {
    const act = String(activity).toLowerCase();
    if (act.includes('delivered') || act.includes('tiba')) return <Home className="h-4 w-4 text-white" />;
    if (act.includes('courier') || act.includes('kurir')) return <Truck className="h-4 w-4 text-white" />;
    if (act.includes('customs') || act.includes('bea cukai')) return <Building2 className="h-4 w-4 text-white" />;
    if (act.includes('flight') || act.includes('pesawat')) return <Plane className="h-4 w-4 text-white" />;
    return <Package className="h-4 w-4 text-white" />;
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <Link 
        to="/store/orders" 
        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[#111111] transition-colors uppercase tracking-wider"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Order History
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white shadow-xs border-gray-200">
            <CardContent className="p-6 space-y-6">
              <div className="flex justify-between items-start border-b border-gray-200 pb-5">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Invoice #</span>
                  <h2 className="text-xl font-bold text-gray-900 leading-tight">{order.orderNumber}</h2>
                </div>
                <div className="text-right space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Date Placed</span>
                  <span className="text-xs font-bold text-gray-700">
                    {new Date(order.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-4 border-b border-gray-200 pb-5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Order Items</span>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.id} className="flex gap-4 items-center">
                      <div className="h-12 w-12 bg-gray-50 rounded-xl overflow-hidden shrink-0 border border-gray-100 flex items-center justify-center">
                        {item.product?.images && item.product.images.length > 0 ? (
                          <img src={item.product.images[0].imageUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Package className="h-5 w-5 text-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold text-gray-900 truncate">{item.product?.name || "Saudi Souvenir"}</h4>
                        <span className="text-[10px] text-gray-400 font-semibold block">{item.product?.weight} kg x {item.quantity}</span>
                      </div>
                      <span className="text-xs font-bold text-gray-900 shrink-0">
                        Rp {(parseFloat(item.price) * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Address details */}
              <div className="space-y-2 border-b border-gray-200 pb-5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Indonesian Shipping Address</span>
                <div className="flex gap-3 text-xs text-gray-700 bg-gray-50 p-4 rounded-xl border border-gray-100 leading-relaxed font-semibold">
                  <MapPin className="h-5 w-5 text-[#fb923c] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-extrabold text-gray-900">{order.shippingName} ({order.shippingPhone})</p>
                    <p className="text-gray-500">{order.shippingAddress}</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-xs font-bold text-gray-700 bg-amber-50/55 p-4 rounded-xl border border-amber-100">
                <span className="uppercase tracking-widest text-amber-850">Total Amount Due</span>
                <span className="text-xl font-extrabold text-amber-700">
                  Rp {parseFloat(order.totalAmount).toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Payment Proof Portal */}
          {order.paymentStatus === 'unpaid' || order.paymentStatus === 'rejected' ? (
            <Card className="bg-white shadow-xs border-gray-200">
              <CardContent className="p-6 space-y-6">
                
                {order.paymentStatus === 'rejected' && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex gap-3 text-red-800 text-xs font-semibold">
                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
                    <div>
                      <h5 className="font-bold">Payment Proof Rejected</h5>
                      <p className="text-red-800/80 mt-0.5 leading-relaxed font-medium">
                        Please re-upload a clear slip with matching account owner details or amount values.
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-amber-850 uppercase tracking-widest block">PT. Musafirin BSI Account details</h3>
                  <div className="p-4 bg-amber-50/30 rounded-xl border border-amber-100 flex gap-4 text-xs font-semibold text-amber-900 leading-relaxed items-center">
                    <Building2 className="h-8 w-8 text-amber-600 shrink-0" />
                    <div>
                      <p className="text-[10px] text-amber-600 block uppercase font-bold tracking-wider">Target Bank Account</p>
                      <p className="text-sm font-extrabold text-amber-800">Bank Syariah Indonesia (BSI)</p>
                      <p className="text-sm font-black text-amber-900 select-all">7211-8899-00</p>
                      <p className="text-[10px] text-amber-500 block">Owner Name: <span className="font-bold">PT. Musafirin Crossborder Souvenir</span></p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleUploadPayment} className="space-y-4 border-t border-gray-200 pt-5">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Upload Bank Slip Transfer</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Sender Account Owner Name</label>
                      <Input
                        required
                        placeholder="Owner name printed on slip"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        className="h-9 text-xs focus-visible:ring-[#111111]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase block">Transferred Amount (Rp)</label>
                      <Input
                        required
                        type="number"
                        step="0.01"
                        placeholder="Rp Amount transferred"
                        value={amountPaid}
                        onChange={(e) => setAmountPaid(e.target.value)}
                        className="h-9 text-xs focus-visible:ring-[#111111]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase block">Notes (Optional)</label>
                    <Input
                      placeholder="Notes for accounting PIC..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="h-9 text-xs focus-visible:ring-[#111111]"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase block">Transfer Slip Image File</label>
                    <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-amber-500/50 bg-gray-50/50 transition-all relative overflow-hidden flex flex-col items-center justify-center space-y-2">
                      <UploadCloud className="h-8 w-8 text-gray-400" />
                      <span className="text-xs font-bold text-gray-700">Choose or drag & drop slip receipt image</span>
                      <span className="text-[9px] text-gray-400">JPG, PNG, or WEBP (Max 5MB)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      {file && (
                        <div className="bg-amber-500/10 text-amber-700 border border-amber-200/50 rounded-lg px-3 py-1 text-xs font-bold w-fit z-10">
                          Selected: {file.name}
                        </div>
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={uploading}
                    className="w-full h-10 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs mt-2"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-white" />
                        Submit Payment Slip
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-white shadow-xs border-gray-200">
              <CardContent className="p-6 space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Payment Slip Status</h3>
                
                {order.paymentStatus === 'pending_verification' && (
                  <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3 text-amber-800 text-xs font-semibold leading-relaxed">
                    <Clock className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold">Reviewing Uploaded Slip</h5>
                      <p className="text-amber-800/80 mt-0.5 font-medium">
                        Our cross-border finance team is reviewing your bank slip transaction now. The verification checks usually complete within 1-2 hours.
                      </p>
                    </div>
                  </div>
                )}

                {order.paymentStatus === 'verified' && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex gap-3 text-emerald-800 text-xs font-semibold leading-relaxed">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-bold">Payment Verified & Settled</h5>
                      <p className="text-emerald-800/80 mt-0.5 font-medium">
                        Thank you! Your souvenir order has been fully verified and paid. Packaging is actively underway at our Jeddah central warehouse.
                      </p>
                    </div>
                  </div>
                )}

                {paymentProof && (
                  <div className="border border-gray-150 p-4 rounded-2xl space-y-2 mt-2 bg-white shadow-xs">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Uploaded Slip Summary</span>
                    <div className="text-xs font-semibold text-gray-700 space-y-1">
                      <p>Account Sender: <span className="font-extrabold text-gray-900">{paymentProof.accountName}</span></p>
                      <p>Bank: <span className="font-bold">{paymentProof.bankName}</span></p>
                      <p>Amount Paid: <span className="font-extrabold text-gray-900">Rp {parseFloat(paymentProof.amount).toFixed(2)}</span></p>
                    </div>
                    <a 
                      href={paymentProof.paymentProofUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex text-[10px] font-extrabold text-amber-600 hover:text-amber-700 uppercase tracking-wider pt-2"
                    >
                      Inspect Uploaded Transfer Slip
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Tracking */}
        <div className="space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Cross-Border Tracking</h3>
          
          {order.trackingNumber && (
            <a
              href={`https://cekresi.com/?noresi=${order.trackingNumber}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors"
            >
              <Truck className="h-4 w-4 text-amber-600" />
              <span>Cek Resi: {order.trackingNumber}</span>
              {order.courierName && <span className="text-amber-500">({order.courierName})</span>}
            </a>
          )}

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-xs space-y-6">
            {logs.length === 0 ? (
              <div className="text-center py-10 space-y-2 select-none">
                <Package className="h-8 w-8 text-gray-300 mx-auto" />
                <p className="text-xs font-bold text-gray-700">Waiting for Packaging</p>
                <p className="text-[10px] text-gray-400">Chronological shipping steps logs will display immediately after verification.</p>
              </div>
            ) : (
              <div className="relative border-l border-gray-200 pl-6 ml-3 space-y-8 select-none">
                {logs.map((log, index) => {
                  const formattedLogTime = new Date(log.createdAt).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  const isLatest = index === 0;

                  return (
                    <div key={log.id} className="relative">
                      <div className={`absolute -left-9.5 top-0 h-7 w-7 rounded-full flex items-center justify-center border-2 ${
                        isLatest 
                          ? 'bg-amber-500 border-white text-white shadow-xs ring-4 ring-amber-500/10' 
                          : 'bg-gray-400 border-white text-white'
                      }`}>
                        {getLogisticsIcon(log.activity)}
                      </div>

                      <div className="space-y-1">
                        <h4 className={`text-xs font-bold leading-tight ${isLatest ? 'text-gray-900 text-sm' : 'text-gray-500'}`}>
                          {log.activity}
                        </h4>
                        <span className="text-[10px] text-gray-400 font-bold block">{formattedLogTime}</span>
                        {log.notes && (
                          <p className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-100 leading-normal font-semibold">
                            {log.notes}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
