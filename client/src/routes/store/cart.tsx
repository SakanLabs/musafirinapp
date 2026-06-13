import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  Trash2, 
  Loader2, 
  ShoppingBag, 
  MapPin, 
  Phone, 
  User, 
  CreditCard,
  ChevronRight
} from "lucide-react";
import { toast } from "sonner";

const FLAT_SHIPPING_FEE = 50.00; // Flat rate cargo cost

export const Route = createFileRoute("/store/cart")({
  component: CartPage
});

function CartPage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatePendingId, setUpdatePendingId] = useState<number | null>(null);
  const [checkoutPending, setCheckoutPending] = useState(false);

  // Recipient Shipping Form state (pre-filled from localStorage if exists)
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  const fetchCartItems = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get<any>("/api/store/cart");
      if (res.success) {
        setCart(res.data);
      }
    } catch (e: any) {
      toast.error("Failed to load shopping cart: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCartItems();

    // Try pre-filling address from localStorage address profile
    try {
      const savedProfileStr = localStorage.getItem("musafirin_user_address");
      if (savedProfileStr) {
        const saved = JSON.parse(savedProfileStr);
        if (saved.recipientName) setRecipientName(saved.recipientName);
        if (saved.recipientPhone) setRecipientPhone(saved.recipientPhone);
        if (saved.shippingAddress) setShippingAddress(saved.shippingAddress);
        if (saved.province) setProvince(saved.province);
        if (saved.city) setCity(saved.city);
        if (saved.postalCode) setPostalCode(saved.postalCode);
      }
    } catch (err) {
      // Silent catch
    }
  }, []);

  const handleUpdateQty = async (itemId: number, currentQty: number, increment: boolean) => {
    const newQty = increment ? currentQty + 1 : currentQty - 1;
    if (newQty < 1) return;

    try {
      setUpdatePendingId(itemId);
      const res = await apiClient.put<any>(`/api/store/cart/items/${itemId}`, { quantity: newQty });
      if (res.success) {
        await fetchCartItems();
        window.dispatchEvent(new Event("cart-updated"));
      } else {
        toast.error(res.error || "Failed to update quantity");
      }
    } catch (err: any) {
      toast.error("Failed to update quantity: " + err.message);
    } finally {
      setUpdatePendingId(null);
    }
  };

  const handleRemoveItem = async (itemId: number) => {
    try {
      setUpdatePendingId(itemId);
      const res = await apiClient.delete<any>(`/api/store/cart/items/${itemId}`);
      if (res.success) {
        toast.success("Item removed from cart");
        await fetchCartItems();
        window.dispatchEvent(new Event("cart-updated"));
      } else {
        toast.error(res.error || "Failed to delete item");
      }
    } catch (err: any) {
      toast.error("Failed to delete item: " + err.message);
    } finally {
      setUpdatePendingId(null);
    }
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName || !recipientPhone || !shippingAddress || !province || !city || !postalCode) {
      toast.error("Please fill out recipient cargo address completely.");
      return;
    }

    try {
      setCheckoutPending(true);
      const fullIndonesianAddress = `${shippingAddress}, Kota/Kab: ${city}, Provinsi: ${province}, Kode Pos: ${postalCode}`;

      const res = await apiClient.post<any>("/api/store/checkout", {
        shippingName: recipientName,
        shippingPhone: recipientPhone,
        shippingAddress: fullIndonesianAddress,
        currency: 'IDR'
      });
      if (res.success && res.data) {
        toast.success("Checkout placed successfully!");
        window.dispatchEvent(new Event("cart-updated"));
        // Redirect to detail page of the created order
        navigate({ to: `/store/order/${res.data.id}` });
      } else {
        toast.error(res.error || "Checkout failed");
      }
    } catch (err: any) {
      toast.error("Checkout failed: " + err.message);
    } finally {
      setCheckoutPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#111111] mb-2" />
        <span className="text-xs font-semibold text-gray-400">Loading cart...</span>
      </div>
    );
  }

  const items = cart?.items || [];
  const itemsSubtotal = items.reduce((acc: number, curr: any) => {
    const itemPrice = parseFloat(curr.product?.promoPrice || curr.product?.price || '0');
    return acc + (itemPrice * curr.quantity);
  }, 0);
  const finalTotal = itemsSubtotal > 0 ? itemsSubtotal + FLAT_SHIPPING_FEE : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {items.length === 0 ? (
        <div className="bg-white border border-gray-150 rounded-2xl p-12 text-center shadow-xs space-y-4 max-w-xl mx-auto">
          <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto text-[#111111]">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-gray-900">Your Cart is Empty</h3>
            <p className="text-xs text-gray-500 font-medium">Add high-quality Saudi souvenirs from our catalog first.</p>
          </div>
          <Link 
            to="/store"
            className="inline-flex items-center gap-1.5 px-6 py-2.5 bg-[#111111] hover:bg-[#222222] text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
          >
            Start Shopping
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* Left Column: Items */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Checkout Items</h3>
            
            <div className="space-y-3">
              {items.map((item: any) => {
                const product = item.product;
                if (!product) return null;
                const price = parseFloat(product.promoPrice || product.price);
                const formattedItemSub = (price * item.quantity).toFixed(2);
                const isPending = updatePendingId === item.id;
                
                return (
                  <Card key={item.id} className="overflow-hidden bg-white shadow-xs border-gray-200">
                    <CardContent className="p-4 flex gap-4 items-center">
                      <div className="h-16 w-16 bg-zinc-50 rounded-xl overflow-hidden shrink-0 border border-gray-100 flex items-center justify-center">
                        {product.images && product.images.length > 0 ? (
                          <img src={product.images[0].imageUrl} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <ShoppingBag className="h-6 w-6 text-gray-300" />
                        )}
                      </div>

                      <div className="flex-1 space-y-1">
                        <h4 className="text-xs font-bold text-gray-900 leading-tight">
                          {product.name}
                        </h4>
                        <span className="text-[10px] text-gray-400 font-semibold block">
                          Rp {price.toFixed(2)} / unit • {product.weight} kg
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden shadow-xs h-8">
                          <button
                            disabled={isPending}
                            onClick={() => handleUpdateQty(item.id, item.quantity, false)}
                            className="px-2.5 h-full hover:bg-gray-50 text-gray-600 font-bold disabled:opacity-50 cursor-pointer text-xs"
                          >
                            -
                          </button>
                          <span className="px-3 text-xs font-bold text-gray-800 text-center select-none min-w-8">
                            {item.quantity}
                          </span>
                          <button
                            disabled={isPending}
                            onClick={() => handleUpdateQty(item.id, item.quantity, true)}
                            className="px-2.5 h-full hover:bg-gray-50 text-gray-600 font-bold disabled:opacity-50 cursor-pointer text-xs"
                          >
                            +
                          </button>
                        </div>

                        <span className="text-xs font-bold text-gray-900 w-16 text-right select-none">
                          Rp {formattedItemSub}
                        </span>

                        <button
                          disabled={isPending}
                          onClick={() => handleRemoveItem(item.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Right Column: Address and summary */}
          <div className="space-y-6">
            <div className="space-y-4 bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-xs">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Shipping Address (Indonesia)</h3>
              
              <form onSubmit={handleCheckout} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Recipient Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      required
                      placeholder="Recipient Full Name"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="pl-9 h-9 text-xs focus-visible:ring-[#111111]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">WhatsApp Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      required
                      placeholder="e.g. 08123456789"
                      value={recipientPhone}
                      onChange={(e) => setRecipientPhone(e.target.value)}
                      className="pl-9 h-9 text-xs focus-visible:ring-[#111111]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Address Details</label>
                  <div className="relative font-sans text-xs">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <textarea
                      required
                      rows={2}
                      placeholder="Street name, house number, kelurahan, kecamatan"
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                      className="pl-9 pr-3 py-2 w-full border border-gray-200 rounded-md text-xs font-semibold focus:outline-none focus:border-[#111111] bg-white resize-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Province</label>
                    <Input
                      required
                      placeholder="Jawa Barat"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className="h-9 text-xs focus-visible:ring-[#111111]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">City</label>
                    <Input
                      required
                      placeholder="Bandung"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="h-9 text-xs focus-visible:ring-[#111111]"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Postal Code</label>
                  <Input
                    required
                    placeholder="40111"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    className="h-9 text-xs focus-visible:ring-[#111111]"
                  />
                </div>
              </form>
            </div>

            <div className="space-y-4 bg-white p-4 md:p-6 rounded-2xl border border-gray-200 shadow-xs">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest block">Invoice Summary</h3>
              
              <div className="space-y-2 text-xs font-semibold text-gray-600">
                <div className="flex justify-between">
                  <span>Souvenirs Subtotal</span>
                  <span className="text-gray-900">Rp {itemsSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <span>International Cargo Shipping</span>
                    <span className="text-[9px] text-gray-400 font-bold block">Saudi to Indonesia Flat Rate</span>
                  </div>
                  <span className="text-gray-900">Rp {FLAT_SHIPPING_FEE.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between text-sm font-bold text-gray-900">
                  <span>Grand Total</span>
                  <span className="text-amber-600 font-extrabold">Rp {finalTotal.toFixed(2)}</span>
                </div>
              </div>

              <Button
                onClick={handleCheckout}
                disabled={checkoutPending}
                className="w-full h-11 bg-zinc-950 hover:bg-zinc-900 text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs mt-4"
              >
                {checkoutPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <>
                    <CreditCard className="h-4 w-4 text-white" />
                    Place Souvenir Order
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
