import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  ShoppingBag, 
  Search, 
  Loader2, 
  Layers, 
  Sparkles,
  ArrowRight
} from "lucide-react";
import { toast } from "sonner";

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

interface ProductImage {
  id: number;
  imageUrl: string;
  thumbnail: boolean;
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
}

export const Route = createFileRoute("/store/")({
  component: StoreIndexPage
});

function StoreIndexPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [cartPending, setCartPending] = useState<number | null>(null);

  // Fetch catalog data
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        setLoading(true);
        const catRes = await apiClient.get<{ success: boolean; data: Category[] }>("/api/store/categories");
        const prodRes = await apiClient.get<{ success: boolean; data: Product[] }>("/api/store/products");
        
        if (catRes.success) setCategories(catRes.data);
        if (prodRes.success) setProducts(prodRes.data);
      } catch (e: any) {
        toast.error("Failed to load souvenirs catalog: " + e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCatalog();
  }, []);

  const handleAddToCart = async (productId: number, e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigating to detail page if card clicked
    try {
      setCartPending(productId);
      const res = await apiClient.post<any>("/api/store/cart/items", {
        productId,
        quantity: 1
      });
      if (res.success) {
        toast.success("Souvenir added to cart successfully!");
        // Dispatch global sync event
        window.dispatchEvent(new Event("cart-updated"));
      }
    } catch (err: any) {
      toast.error("Failed to add souvenir: " + err.message);
    } finally {
      setCartPending(null);
    }
  };

  // Filter products locally for extreme speed
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCat === "all" || p.categoryId === categories.find(c => c.slug === selectedCat)?.id;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Banner / Hero Card */}
      <Card className="relative overflow-hidden border border-[#e5e7eb] rounded-2xl bg-zinc-950 text-white p-8 md:p-12 shadow-sm">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-15 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-amber-400 via-amber-600 to-zinc-950 pointer-events-none"></div>
        <div className="max-w-xl space-y-4 relative z-10">
          <Badge className="bg-[#fb923c] text-white border-none text-[10px] font-bold tracking-wider px-3 py-1 rounded-full uppercase flex items-center gap-1.5 w-fit select-none">
            <Sparkles className="h-3 w-3" />
            Saudi Cross-Border Souvenirs
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight font-sans text-white">
            Atur Oleh-oleh Saudi Tanpa Ribet Bawa Koper
          </h2>
          <p className="text-sm text-zinc-400 font-medium leading-relaxed">
            Pesan kurma Madinah premium, sajadah raudah original, tasbih oud, abaya eksklusif, dan wewangian aromatik khas Saudi langsung dikirim ke rumah Anda di Indonesia.
          </p>
        </div>
      </Card>

      {/* Interactive Pill Categories Switcher & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between border-b border-[#e5e7eb] pb-5">
        <div className="bg-[#f5f5f5] rounded-full p-1 flex space-x-1 border border-[#e5e7eb]/60 overflow-x-auto max-w-full scrollbar-none shrink-0">
          <button
            onClick={() => setSelectedCat("all")}
            className={`px-4.5 py-1.5 text-xs font-semibold rounded-full transition-all shrink-0 ${
              selectedCat === "all"
                ? "bg-white text-[#111111] shadow-xs"
                : "text-gray-500 hover:text-[#111111]"
            }`}
          >
            All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCat(cat.slug)}
              className={`px-4.5 py-1.5 text-xs font-semibold rounded-full transition-all shrink-0 ${
                selectedCat === cat.slug
                  ? "bg-white text-[#111111] shadow-xs"
                  : "text-gray-500 hover:text-[#111111]"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search souvenirs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 border-[#e5e7eb] bg-white rounded-md text-xs font-semibold focus-visible:ring-[#111111]"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-7 w-7 animate-spin text-[#111111] mb-2" />
          <span className="text-xs font-semibold text-gray-400">Loading catalog items...</span>
        </div>
      ) : (
        <div className="w-full">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <div className="text-sm font-bold text-[#111111]">No souvenirs matches your filters</div>
              <p className="text-xs text-gray-400 mt-1 font-medium">Try resetting your category or search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredProducts.map((p) => {
                const thumbnail = p.images && p.images.length > 0 ? p.images[0].imageUrl : null;
                const formattedPrice = parseFloat(p.price).toFixed(2);
                const formattedPromo = p.promoPrice ? parseFloat(p.promoPrice).toFixed(2) : null;
                
                return (
                  <Link
                    key={p.id}
                    to="/store/product/$productId"
                    params={{ productId: p.id.toString() }}
                    className="group border border-[#e5e7eb]/80 bg-white rounded-2xl overflow-hidden hover:border-[#111111]/30 hover:shadow-xs transition-all flex flex-col h-full"
                  >
                    {/* Image Area */}
                    <div className="relative aspect-square bg-[#f5f5f5] flex items-center justify-center overflow-hidden border-b border-gray-100">
                      {thumbnail ? (
                        <img 
                          src={thumbnail} 
                          alt={p.name} 
                          className="h-full w-full object-cover group-hover:scale-103 transition-transform duration-300"
                        />
                      ) : (
                        <ShoppingBag className="h-10 w-10 text-gray-300" />
                      )}

                      {/* pre-order indicator */}
                      {p.isPreOrder && (
                        <span className="absolute top-3 left-3 bg-[#eff6ff] text-[#1d4ed8] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#dbeafe] select-none">
                          PRE-ORDER
                        </span>
                      )}
                    </div>

                    {/* Meta Area */}
                    <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-[#111111] leading-tight group-hover:text-zinc-600 transition-colors">
                          {p.name}
                        </h4>
                        <div className="text-[10px] text-gray-400 font-semibold">{p.weight} kg</div>
                      </div>

                      <div className="flex items-end justify-between pt-1">
                        <div className="space-y-0.5">
                          {formattedPromo ? (
                            <div>
                              <div className="text-sm font-bold text-[#111111]">Rp {formattedPromo}</div>
                              <div className="text-[10px] text-red-500 font-bold line-through">Rp {formattedPrice}</div>
                            </div>
                          ) : (
                            <div className="text-sm font-bold text-[#111111]">Rp {formattedPrice}</div>
                          )}
                        </div>

                        <Button
                          size="sm"
                          onClick={(e) => handleAddToCart(p.id, e)}
                          disabled={cartPending === p.id}
                          className="h-8 px-3 text-[10px] font-bold bg-[#111111] hover:bg-[#242424] text-white rounded-xl transition-all shrink-0 flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          {cartPending === p.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            "Buy"
                          )}
                          <ArrowRight className="h-3 w-3 opacity-80" />
                        </Button>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
