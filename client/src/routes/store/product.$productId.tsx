import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  ArrowLeft, 
  ShoppingBag, 
  ShoppingCart, 
  Loader2, 
  Calendar, 
  Layers, 
  Scale, 
  Info,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";

interface ProductImage {
  id: number;
  imageUrl: string;
  thumbnail: boolean;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

interface Product {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  categoryId: number;
  price: string;
  promoPrice: string | null;
  weight: string;
  isActive: boolean;
  isPreOrder: boolean;
  estimatedArrivalDate: string | null;
  images?: ProductImage[];
  category?: Category;
}

export const Route = createFileRoute("/store/product/$productId")({
  component: ProductDetailPage
});

function ProductDetailPage() {
  const { productId } = Route.useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [cartPending, setCartPending] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const res = await apiClient.get<{ success: boolean; data: Product }>(`/api/store/products/${productId}`);
        if (res.success) {
          setProduct(res.data);
          if (res.data.images && res.data.images.length > 0) {
            const thumb = res.data.images.find(i => i.thumbnail) || res.data.images[0];
            setActiveImage(thumb.imageUrl);
          }
        } else {
          toast.error("Oleh-oleh not found");
        }
      } catch (e: any) {
        toast.error("Failed to load details: " + e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [productId]);

  const handleAddToCart = async () => {
    try {
      setCartPending(true);
      const res = await apiClient.post<any>("/api/store/cart/items", {
        productId: parseInt(productId),
        quantity
      });
      if (res.success) {
        toast.success(`Added ${quantity} item(s) to cart successfully!`);
        window.dispatchEvent(new Event("cart-updated"));
      } else {
        toast.error(res.error || "Failed to add items");
      }
    } catch (err: any) {
      toast.error("Failed to add: " + err.message);
    } finally {
      setCartPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#111111] mb-2" />
        <span className="text-xs font-semibold text-gray-400">Loading details...</span>
      </div>
    );
  }

  if (!product) return <div className="text-center py-10">Oleh-oleh not found.</div>;

  const formattedPrice = parseFloat(product.price).toFixed(2);
  const formattedPromo = product.promoPrice ? parseFloat(product.promoPrice).toFixed(2) : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <Link 
        to="/store" 
        className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-[#111111] transition-colors uppercase tracking-wider"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Souvenirs
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Gallery */}
        <div className="space-y-4">
          <div className="aspect-square bg-[#f5f5f5] rounded-2xl border border-gray-100 overflow-hidden flex items-center justify-center relative p-2 shadow-xs">
            {activeImage ? (
              <img 
                src={activeImage} 
                alt={product.name} 
                className="h-full w-full object-contain rounded-xl" 
              />
            ) : (
              <ShoppingBag className="h-16 w-16 text-gray-300" />
            )}

            {product.isPreOrder && (
              <span className="absolute top-4 left-4 bg-blue-50 text-blue-700 text-[9px] font-bold px-2 py-0.5 rounded-full border border-blue-100 select-none">
                PRE-ORDER
              </span>
            )}
          </div>

          {/* Thumbnails */}
          {product.images && product.images.length > 1 && (
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
              {product.images.map((img) => (
                <button
                  key={img.id}
                  onClick={() => setActiveImage(img.imageUrl)}
                  className={`h-20 w-20 rounded-xl overflow-hidden bg-white border shrink-0 transition-all cursor-pointer ${
                    activeImage === img.imageUrl 
                      ? 'border-[#111111] ring-2 ring-gray-100' 
                      : 'border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <img src={img.imageUrl} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Specs Details */}
        <div className="space-y-6">
          <div className="space-y-2 border-b border-gray-200 pb-5">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
              {product.category?.name || "Saudi Souvenir"}
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight leading-tight">
              {product.name}
            </h1>
            <div className="flex items-center gap-3 pt-2">
              {formattedPromo ? (
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">Rp {formattedPromo}</span>
                  <span className="text-sm text-red-500 font-bold line-through">Rp {formattedPrice}</span>
                </div>
              ) : (
                <span className="text-2xl font-bold text-gray-900">Rp {formattedPrice}</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-5 rounded-2xl border border-gray-150 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gray-50 text-gray-500 rounded-xl">
                <Scale className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-semibold block">Cargo Weight</span>
                <span className="text-xs font-bold text-gray-700">{product.weight} kg</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-gray-50 text-gray-500 rounded-xl">
                <Layers className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-semibold block">Stock Status</span>
                <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> In Stock
                </span>
              </div>
            </div>
          </div>

          {product.isPreOrder && (
            <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3 text-blue-800 text-xs font-semibold">
              <Calendar className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h5 className="font-bold">Pre-Order Option</h5>
                <p className="text-[11px] text-blue-800/80 leading-relaxed font-medium">
                  Prepared on-demand in Saudi Arabia and cargoed. Estimated arrival in Indonesia: 
                  <span className="font-bold ml-1">
                    {product.estimatedArrivalDate ? new Date(product.estimatedArrivalDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                  </span>.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Info className="h-4 w-4 text-gray-400" />
              Description
            </h3>
            <p className="text-sm text-gray-600 font-medium leading-relaxed bg-white p-5 rounded-2xl border border-gray-150 shadow-xs">
              {product.description || "No specific description available."}
            </p>
          </div>

          <div className="border-t border-gray-200 pt-5 space-y-4">
            <div className="flex items-center gap-4">
              <div className="space-y-1 shrink-0">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Quantity</label>
                <div className="flex items-center border border-gray-250 rounded-xl bg-white h-10 overflow-hidden shadow-xs">
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 h-full hover:bg-gray-50 text-gray-600 font-semibold cursor-pointer"
                  >
                    -
                  </button>
                  <span className="px-4 text-sm font-bold text-gray-800 min-w-10 text-center select-none">
                    {quantity}
                  </span>
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 h-full hover:bg-gray-50 text-gray-600 font-semibold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-bold text-white uppercase select-none block">Checkout</label>
                <Button
                  onClick={handleAddToCart}
                  disabled={cartPending}
                  className="w-full h-10 bg-[#111111] hover:bg-[#222222] text-white font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer text-xs"
                >
                  {cartPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-white" />
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 text-white" />
                      Add to Cart
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
