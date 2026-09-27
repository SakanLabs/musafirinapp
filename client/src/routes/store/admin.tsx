import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Eye,
  Trash2,
  Edit3,
  ShoppingBag,
  CreditCard,
  Truck,
  Loader2,
  Layers,
  Calendar,
  Search,
  Check,
  X,
  TrendingUp,
  Package
} from "lucide-react";
import { authService } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import { toast } from "sonner";

// Enums type mapping
type StorePaymentStatus = 'unpaid' | 'partial' | 'paid' | 'verified' | 'failed';
type StoreOrderStatus = 'pending' | 'processing' | 'completed' | 'cancelled';
type PreOrderStatus = 'PO_OPEN' | 'PO_CLOSED' | 'PURCHASING' | 'SHIPPING_FROM_SAUDI' | 'ARRIVED_INDONESIA' | 'LOCAL_DELIVERY' | 'COMPLETED';
type ShipmentStatus = 'PENDING' | 'PACKING' | 'READY_TO_SHIP' | 'SHIPPED_FROM_SAUDI' | 'ARRIVED_INDONESIA' | 'CUSTOMS_CLEARANCE' | 'LOCAL_COURIER' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED_DELIVERY' | 'RETURNED';

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
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
  sku: string;
  stock: number;
  price: string;
  promoPrice: string | null;
  weight: string;
  dimensions: string | null;
  isActive: boolean;
  isPreOrder: boolean;
  preOrderOpenDate: string | null;
  preOrderCloseDate: string | null;
  estimatedArrivalDate: string | null;
  images?: ProductImage[];
  category?: Category;
}

interface OrderItem {
  id: number;
  productId: number;
  quantity: number;
  price: string;
  subtotal: string;
  product?: Product;
}

interface Payment {
  id: number;
  amount: string;
  bankName: string;
  accountName: string;
  paymentProofUrl: string;
  notes: string | null;
  status: string; // 'pending', 'approved', 'rejected'
}

interface ShipmentLog {
  id: number;
  status: ShipmentStatus;
  description: string;
  createdAt: string;
}

interface Shipment {
  id: number;
  trackingNumber: string;
  courierName: string;
  status: ShipmentStatus;
  estimatedArrival: string | null;
  logs?: ShipmentLog[];
}

interface Order {
  id: number;
  orderNumber: string;
  userId: string;
  totalAmount: string;
  shippingCost: string;
  discountAmount: string;
  finalAmount: string;
  currency: string;
  paymentStatus: StorePaymentStatus;
  orderStatus: StoreOrderStatus;
  preOrderStatus: PreOrderStatus | null;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  trackingNumber: string | null;
  courierName: string | null;
  estimatedDelivery: string | null;
  isPreOrder: boolean;
  createdAt: string;
  items?: OrderItem[];
  payments?: Payment[];
  shipments?: Shipment[];
}

export const Route = createFileRoute("/store/admin")({
  beforeLoad: async () => {
    // Check if user is authenticated and is admin/owner/finance
    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
      throw redirect({ to: "/login" });
    }
    const currentUser = await authService.getCurrentUser();
    const role = currentUser?.role || "user";
    if (!["admin", "owner", "finance"].includes(role)) {
      throw redirect({ to: "/store" });
    }
  },
  component: StoreAdminPage
});

function StoreAdminPage() {
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "logistics" | "preorders" | "categories">("products");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [productSearch, setProductSearch] = useState("");
  const [orderSearch, setOrderSearch] = useState("");

  // Product CRUD Drawer/Modal state
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    name: "",
    slug: "",
    description: "",
    categoryId: "",
    sku: "",
    stock: 0,
    price: "",
    promoPrice: "",
    weight: "0.00",
    dimensions: "",
    isActive: true,
    isPreOrder: false,
    preOrderOpenDate: "",
    preOrderCloseDate: "",
    estimatedArrivalDate: "",
    imageUrls: [""]
  });

  // Order Details Modal state
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Manual payment proof detail uploader confirmation state
  const [paymentProofOpen, setPaymentProofOpen] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState<Payment | null>(null);

  // Shipment AWB edit dialog state
  const [shipmentModalOpen, setShipmentModalOpen] = useState(false);
  const [shipmentForm, setShipmentForm] = useState({
    trackingNumber: "",
    courierName: "",
    status: "PENDING" as ShipmentStatus,
    description: "",
    estimatedArrival: ""
  });

  // Categories CRUD Dialog State
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    slug: "",
    description: ""
  });

  // Fetch Core Data
  const fetchData = async () => {
    try {
      setLoading(true);
      const prodRes = await apiClient.get<{ success: boolean; data: Product[] }>("/api/store/admin/products");
      const catRes = await apiClient.get<{ success: boolean; data: Category[] }>("/api/store/categories");
      const ordRes = await apiClient.get<{ success: boolean; data: Order[] }>("/api/store/admin/orders");

      if (prodRes.success) setProducts(prodRes.data);
      if (catRes.success) setCategories(catRes.data);
      if (ordRes.success) setOrders(ordRes.data);
    } catch (e: any) {
      toast.error("Failed to load store management workspace: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // helper to generate slug automatically from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
  };

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setProductForm({
      name: "",
      slug: "",
      description: "",
      categoryId: categories[0]?.id.toString() || "",
      sku: "",
      stock: 10,
      price: "",
      promoPrice: "",
      weight: "0.50",
      dimensions: "",
      isActive: true,
      isPreOrder: false,
      preOrderOpenDate: "",
      preOrderCloseDate: "",
      estimatedArrivalDate: "",
      imageUrls: [""]
    });
    setProductModalOpen(true);
  };

  const handleOpenEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      slug: p.slug,
      description: p.description || "",
      categoryId: p.categoryId.toString(),
      sku: p.sku,
      stock: p.stock,
      price: p.price,
      promoPrice: p.promoPrice || "",
      weight: p.weight,
      dimensions: p.dimensions || "",
      isActive: p.isActive,
      isPreOrder: p.isPreOrder,
      preOrderOpenDate: p.preOrderOpenDate ? new Date(p.preOrderOpenDate).toISOString().substring(0, 16) : "",
      preOrderCloseDate: p.preOrderCloseDate ? new Date(p.preOrderCloseDate).toISOString().substring(0, 16) : "",
      estimatedArrivalDate: p.estimatedArrivalDate ? new Date(p.estimatedArrivalDate).toISOString().substring(0, 16) : "",
      imageUrls: p.images && p.images.length > 0 ? p.images.map(img => img.imageUrl) : [""]
    });
    setProductModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...productForm,
        imageUrls: productForm.imageUrls.filter(Boolean),
        preOrderOpenDate: productForm.isPreOrder && productForm.preOrderOpenDate ? productForm.preOrderOpenDate : null,
        preOrderCloseDate: productForm.isPreOrder && productForm.preOrderCloseDate ? productForm.preOrderCloseDate : null,
        estimatedArrivalDate: productForm.isPreOrder && productForm.estimatedArrivalDate ? productForm.estimatedArrivalDate : null
      };

      if (editingProduct) {
        await apiClient.put(`/api/store/admin/products/${editingProduct.id}`, payload);
        toast.success("Product updated successfully!");
      } else {
        await apiClient.post("/api/store/admin/products", payload);
        toast.success("Product created successfully!");
      }
      setProductModalOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Failed to save product: " + e.message);
    }
  };

  const handleProductDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await apiClient.delete(`/api/store/admin/products/${id}`);
      toast.success("Product deleted successfully!");
      fetchData();
    } catch (e: any) {
      toast.error("Failed to delete product: " + e.message);
    }
  };

  // Payment Confirmation Action
  const handlePaymentConfirm = async (paymentId: number, status: 'approved' | 'rejected') => {
    if (!selectedOrder) return;
    try {
      await apiClient.put(`/api/store/admin/orders/${selectedOrder.id}/payment-confirm`, {
        paymentId,
        status
      });
      toast.success(`Payment proof ${status === 'approved' ? 'approved & verified!' : 'rejected'}`);
      setPaymentProofOpen(false);
      setOrderModalOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Failed to confirm payment: " + e.message);
    }
  };

  // Shipment Update Action
  const handleShipmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      await apiClient.put(`/api/store/admin/orders/${selectedOrder.id}/shipment`, shipmentForm);
      toast.success("Logistics shipment status updated successfully!");
      setShipmentModalOpen(false);
      setOrderModalOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Failed to update shipment status: " + e.message);
    }
  };

  // Pre-Order batch status updates
  const handlePOBatchUpdate = async (orderId: number, nextStatus: PreOrderStatus) => {
    try {
      await apiClient.put(`/api/store/admin/orders/${orderId}/pre-order-status`, { status: nextStatus });
      toast.success(`Pre-order batch status set to ${nextStatus}`);
      fetchData();
    } catch (e: any) {
      toast.error("Failed to update pre-order status: " + e.message);
    }
  };

  // Categories CRUD handlers
  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCategory) {
        await apiClient.put(`/api/store/categories/${editingCategory.id}`, categoryForm);
        toast.success("Category updated successfully!");
      } else {
        await apiClient.post("/api/store/categories", categoryForm);
        toast.success("Category created successfully!");
      }
      setCategoryModalOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error("Failed to save category: " + e.message);
    }
  };

  const handleCategoryDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      await apiClient.delete(`/api/store/categories/${id}`);
      toast.success("Category deleted successfully!");
      fetchData();
    } catch (e: any) {
      toast.error("Failed to delete category: " + e.message);
    }
  };

  // Filtered lists
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredOrders = orders.filter(o =>
    o.orderNumber.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.shippingName.toLowerCase().includes(orderSearch.toLowerCase())
  );

  // Estimated stats helper
  const totalGMV = orders.filter(o => o.paymentStatus === 'paid' || o.paymentStatus === 'verified').reduce((acc, curr) => acc + parseFloat(curr.finalAmount), 0);
  const pendingOrdersCount = orders.filter(o => o.orderStatus === 'pending').length;
  const transitOrdersCount = orders.filter(o => o.orderStatus === 'processing' && o.trackingNumber !== null).length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Tab actions header */}
      <div className="flex justify-between items-center bg-[#f8f9fa] border border-[#e5e7eb] p-4 rounded-xl">
        <h3 className="font-bold text-sm text-[#111111] uppercase tracking-wider">
          Store Operations Workspace
        </h3>

        <div className="flex items-center space-x-2">
          {activeTab === 'products' && (
            <Button
              onClick={handleOpenAddProduct}
              className="bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold px-4 h-9 rounded-md transition-all shadow-xs flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Product
            </Button>
          )}
          {activeTab === 'categories' && (
            <Button
              onClick={() => {
                setEditingCategory(null);
                setCategoryForm({ name: "", slug: "", description: "" });
                setCategoryModalOpen(true);
              }}
              className="bg-[#111111] hover:bg-[#242424] text-white text-xs font-semibold px-4 h-9 rounded-md transition-all shadow-xs flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Category
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="text-xs h-9 border-[#e5e7eb] text-[#111111] font-semibold hover:bg-gray-50 bg-white"
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Summary Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <Card className="p-5 border border-[#e5e7eb] rounded-xl bg-white shadow-3xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total GMV (Verified)</span>
            <div className="text-xl font-bold tracking-tight text-[#111111]">Rp {totalGMV.toFixed(2)}</div>
          </div>
          <div className="p-3 bg-[#eff6ff] rounded-lg text-[#1d4ed8]">
            <TrendingUp className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-5 border border-[#e5e7eb] rounded-xl bg-white shadow-3xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Products Registered</span>
            <div className="text-xl font-bold tracking-tight text-[#111111]">{products.length} Items</div>
          </div>
          <div className="p-3 bg-[#f5f5f5] rounded-lg text-[#111111]">
            <ShoppingBag className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-5 border border-[#e5e7eb] rounded-xl bg-white shadow-3xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Pending Orders Review</span>
            <div className="text-xl font-bold tracking-tight text-[#111111]">{pendingOrdersCount} Queue</div>
          </div>
          <div className="p-3 bg-[#fffbeb] rounded-lg text-[#d97706]">
            <CreditCard className="h-5 w-5" />
          </div>
        </Card>

        <Card className="p-5 border border-[#e5e7eb] rounded-xl bg-white shadow-3xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Active Shipments</span>
            <div className="text-xl font-bold tracking-tight text-[#111111]">{transitOrdersCount} Transit</div>
          </div>
          <div className="p-3 bg-[#ecfdf5] rounded-lg text-[#047857]">
            <Truck className="h-5 w-5" />
          </div>
        </Card>
      </div>

      {/* Signature nav-pill-group Tab Navigation */}
      <div className="flex justify-start mb-6">
        <div className="bg-[#f5f5f5] rounded-full p-1 flex space-x-1 border border-[#e5e7eb]/60">
          <button
            onClick={() => setActiveTab("products")}
            className={`px-5 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${activeTab === "products"
              ? "bg-white text-[#111111] shadow-xs"
              : "text-gray-500 hover:text-[#111111]"
              }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Products
          </button>

          <button
            onClick={() => setActiveTab("orders")}
            className={`px-5 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${activeTab === "orders"
              ? "bg-white text-[#111111] shadow-xs"
              : "text-gray-500 hover:text-[#111111]"
              }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            Orders
          </button>

          <button
            onClick={() => setActiveTab("logistics")}
            className={`px-5 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${activeTab === "logistics"
              ? "bg-white text-[#111111] shadow-xs"
              : "text-gray-500 hover:text-[#111111]"
              }`}
          >
            <Truck className="h-3.5 w-3.5" />
            Shipping
          </button>

          <button
            onClick={() => setActiveTab("preorders")}
            className={`px-5 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${activeTab === "preorders"
              ? "bg-white text-[#111111] shadow-xs"
              : "text-gray-500 hover:text-[#111111]"
              }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Pre-Orders
          </button>

          <button
            onClick={() => setActiveTab("categories")}
            className={`px-5 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${activeTab === "categories"
              ? "bg-white text-[#111111] shadow-xs"
              : "text-gray-500 hover:text-[#111111]"
              }`}
          >
            <Layers className="h-3.5 w-3.5" />
            Categories
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-[#111111] mb-2" />
          <span className="text-xs font-semibold text-gray-500">Retrieving store data...</span>
        </div>
      ) : (
        <div className="w-full">
          {/* TAB 1: PRODUCTS CATALOG */}
          {activeTab === "products" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-[#f8f9fa] border border-[#e5e7eb] p-3 rounded-lg">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name or SKU..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-9 h-9 border-[#e5e7eb] bg-white rounded-md text-xs font-semibold focus-visible:ring-[#111111]"
                  />
                </div>
                <div className="text-xs text-gray-500 font-semibold">{filteredProducts.length} items matched</div>
              </div>

              <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#e5e7eb] text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-6">Product Details</th>
                      <th className="py-3.5 px-4">SKU</th>
                      <th className="py-3.5 px-4">Category</th>
                      <th className="py-3.5 px-4">Pricing</th>
                      <th className="py-3.5 px-4">Stock</th>
                      <th className="py-3.5 px-4">Logistics Weights</th>
                      <th className="py-3.5 px-4">Sales Mode</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb] text-xs font-medium text-gray-700">
                    {filteredProducts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-400 font-semibold">
                          No store products found matching search filters.
                        </td>
                      </tr>
                    ) : (
                      filteredProducts.map((p) => {
                        const thumbnail = p.images && p.images.length > 0 ? p.images.find(img => img.thumbnail)?.imageUrl || p.images[0].imageUrl : null;

                        return (
                          <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-4 px-6 flex items-center space-x-3.5">
                              <div className="h-11 w-11 rounded-lg border border-[#e5e7eb] overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
                                {thumbnail ? (
                                  <img src={thumbnail} alt={p.name} className="h-full w-full object-cover" />
                                ) : (
                                  <ShoppingBag className="h-5 w-5 text-gray-300" />
                                )}
                              </div>
                              <div>
                                <div className="font-bold text-[#111111] text-sm">{p.name}</div>
                                <div className="text-[10px] text-gray-400 mt-0.5">slug: {p.slug}</div>
                              </div>
                            </td>
                            <td className="py-4 px-4 font-mono text-[11px] font-semibold text-gray-500">{p.sku}</td>
                            <td className="py-4 px-4">
                              <Badge className="bg-gray-100 text-gray-700 text-[10px] px-2 py-0.5 rounded border border-gray-200/50">
                                {p.category?.name || "Uncategorized"}
                              </Badge>
                            </td>
                            <td className="py-4 px-4">
                              {p.promoPrice ? (
                                <div>
                                  <span className="font-bold text-[#111111]">Rp {p.promoPrice}</span>
                                  <span className="text-[10px] text-red-500 font-bold line-through ml-1.5">Rp {p.price}</span>
                                </div>
                              ) : (
                                <span className="font-bold text-[#111111]">Rp {p.price}</span>
                              )}
                            </td>
                            <td className="py-4 px-4">
                              {p.isPreOrder ? (
                                <span className="text-gray-400 font-semibold">—</span>
                              ) : (
                                <span className={`font-bold ${p.stock < 5 ? "text-red-600 bg-red-50 px-1.5 py-0.5 rounded" : "text-gray-800"}`}>
                                  {p.stock} Unit
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 font-semibold text-gray-500">
                              {p.weight} kg {p.dimensions ? `(${p.dimensions})` : ""}
                            </td>
                            <td className="py-4 px-4">
                              {p.isPreOrder ? (
                                <Badge className="bg-[#eff6ff] text-[#1d4ed8] border-[#dbeafe] text-[10px] font-bold px-2 py-0.5 rounded-full border">
                                  Pre-Order
                                </Badge>
                              ) : (
                                <Badge className="bg-[#ecfdf5] text-[#047857] border-[#d1fae5] text-[10px] font-bold px-2 py-0.5 rounded-full border">
                                  Regular Stock
                                </Badge>
                              )}
                            </td>
                            <td className="py-4 px-6 text-right space-x-1.5 shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleOpenEditProduct(p)}
                                className="h-8 w-8 p-0 rounded-full border border-transparent hover:border-[#e5e7eb] hover:bg-[#f8f9fa] transition-all flex items-center justify-center text-[#111111]"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleProductDelete(p.id)}
                                className="h-8 w-8 p-0 rounded-full border border-transparent hover:border-[#e5e7eb] hover:bg-red-50 transition-all flex items-center justify-center text-red-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: ORDERS QUEUE */}
          {activeTab === "orders" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-[#f8f9fa] border border-[#e5e7eb] p-3 rounded-lg">
                <div className="relative w-72">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by order # or client name..."
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="pl-9 h-9 border-[#e5e7eb] bg-white rounded-md text-xs font-semibold focus-visible:ring-[#111111]"
                  />
                </div>
                <div className="text-xs text-gray-500 font-semibold">{filteredOrders.length} orders matched</div>
              </div>

              <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#e5e7eb] text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-6">Order Number</th>
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Client Name</th>
                      <th className="py-3.5 px-4">Amount Sum</th>
                      <th className="py-3.5 px-4">Payment</th>
                      <th className="py-3.5 px-4">Logistics Step</th>
                      <th className="py-3.5 px-4">Sales Mode</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb] text-xs font-medium text-gray-700">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-gray-400 font-semibold">
                          No customer souvenir orders found.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((o) => {
                        let payBadge = "bg-[#f3f4f6] text-gray-800 border-gray-200";
                        if (o.paymentStatus === 'paid' || o.paymentStatus === 'verified') payBadge = "bg-[#ecfdf5] text-[#047857] border-[#d1fae5]";
                        if (o.paymentStatus === 'partial') payBadge = "bg-[#fffbeb] text-[#d97706] border-[#fef3c7]";
                        if (o.paymentStatus === 'failed') payBadge = "bg-[#fef2f2] text-[#b91c1c] border-[#fee2e2]";

                        let orderBadge = "bg-[#f3f4f6] text-gray-800 border-gray-200";
                        if (o.orderStatus === 'completed') orderBadge = "bg-[#eff6ff] text-[#1d4ed8] border-[#dbeafe]";
                        if (o.orderStatus === 'processing') orderBadge = "bg-[#fffbeb] text-[#d97706] border-[#fef3c7]";
                        if (o.orderStatus === 'cancelled') orderBadge = "bg-[#fef2f2] text-[#b91c1c] border-[#fee2e2]";

                        return (
                          <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-4 px-6 font-bold font-mono text-[#111111]">{o.orderNumber}</td>
                            <td className="py-4 px-4 text-gray-500 font-semibold">{new Date(o.createdAt).toLocaleDateString("en-CA")}</td>
                            <td className="py-4 px-4">
                              <div className="font-bold text-[#111111]">{o.shippingName}</div>
                              <div className="text-[10px] text-gray-400 mt-0.5">{o.shippingPhone}</div>
                            </td>
                            <td className="py-4 px-4 font-bold text-[#111111]">{o.currency} {parseFloat(o.finalAmount).toFixed(2)}</td>
                            <td className="py-4 px-4">
                              <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${payBadge}`}>
                                {o.paymentStatus.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="py-4 px-4">
                              <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${orderBadge}`}>
                                {o.orderStatus.toUpperCase()}
                              </Badge>
                            </td>
                            <td className="py-4 px-4 font-semibold text-gray-500">
                              {o.isPreOrder ? "Pre-Order" : "Direct Stock"}
                            </td>
                            <td className="py-4 px-6 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedOrder(o);
                                  setOrderModalOpen(true);
                                }}
                                className="text-xs h-8 border-[#e5e7eb] font-bold text-[#111111] hover:bg-gray-50 bg-white"
                              >
                                Manage Order
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: LOGISTICS & SHIPPING BOARD */}
          {activeTab === "logistics" && (
            <div className="space-y-4">
              <div className="bg-[#f8f9fa] border border-[#e5e7eb] p-3 rounded-lg text-xs font-semibold text-gray-500">
                Manage global airway bills, tracking numbers, and add transit timeline milestones for Saudi Arabia → Indonesia shipment containers.
              </div>

              <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#e5e7eb] text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-6">Order Number</th>
                      <th className="py-3.5 px-4">Recipient</th>
                      <th className="py-3.5 px-4">Airway Bill (AWB)</th>
                      <th className="py-3.5 px-4">Courier Name</th>
                      <th className="py-3.5 px-4">Delivery Status</th>
                      <th className="py-3.5 px-4">Latest Logs Milestone</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb] text-xs font-medium text-gray-700">
                    {orders.filter(o => o.paymentStatus === 'paid' || o.paymentStatus === 'verified').length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-gray-400 font-semibold">
                          No paid/verified orders in queue for logistics shipping.
                        </td>
                      </tr>
                    ) : (
                      orders.filter(o => o.paymentStatus === 'paid' || o.paymentStatus === 'verified').map((o) => {
                        const activeShipment = o.shipments && o.shipments.length > 0 ? o.shipments[0] : null;
                        const latestLog = activeShipment?.logs && activeShipment.logs.length > 0 ? activeShipment.logs[0] : null;

                        return (
                          <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-4 px-6 font-bold font-mono text-[#111111]">{o.orderNumber}</td>
                            <td className="py-4 px-4">
                              <div className="font-bold text-[#111111]">{o.shippingName}</div>
                              <div className="text-[10px] text-gray-400">{o.shippingPhone}</div>
                            </td>
                            <td className="py-4 px-4 font-mono font-bold text-gray-500">
                              {o.trackingNumber || (
                                <span className="text-red-500 text-xs font-semibold">AWB Missing</span>
                              )}
                            </td>
                            <td className="py-4 px-4 font-semibold text-gray-700">{o.courierName || "—"}</td>
                            <td className="py-4 px-4">
                              <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${activeShipment?.status === "DELIVERED"
                                ? "bg-[#ecfdf5] text-[#047857] border-[#d1fae5]"
                                : "bg-[#eff6ff] text-[#1d4ed8] border-[#dbeafe]"
                                }`}>
                                {activeShipment?.status || "AWITING SHIPPING"}
                              </Badge>
                            </td>
                            <td className="py-4 px-4">
                              {latestLog ? (
                                <div>
                                  <div className="font-bold text-gray-800">{latestLog.status}</div>
                                  <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-xs">{latestLog.description}</div>
                                </div>
                              ) : (
                                <span className="text-gray-400 italic">No logs published</span>
                              )}
                            </td>
                            <td className="py-4 px-6 text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedOrder(o);
                                  setShipmentForm({
                                    trackingNumber: o.trackingNumber || "",
                                    courierName: o.courierName || "",
                                    status: (activeShipment?.status || "PENDING") as ShipmentStatus,
                                    description: "",
                                    estimatedArrival: o.estimatedDelivery ? new Date(o.estimatedDelivery).toISOString().substring(0, 10) : ""
                                  });
                                  setShipmentModalOpen(true);
                                }}
                                className="text-xs h-8 border-[#e5e7eb] font-bold text-[#111111] hover:bg-gray-50 bg-white flex items-center gap-1 ml-auto"
                              >
                                <Truck className="h-3.5 w-3.5" />
                                Update Shipping
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PRE-ORDER BATCH MANAGER */}
          {activeTab === "preorders" && (
            <div className="space-y-4">
              <div className="bg-[#f8f9fa] border border-[#e5e7eb] p-3 rounded-lg text-xs font-semibold text-gray-500">
                Track pre-order products orders and adjust their international shipping status batches (Jeddah purchasing, airport departure, arrived in Indonesia).
              </div>

              <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#e5e7eb] text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-6">Order Number</th>
                      <th className="py-3.5 px-4">Pre-Order Products Details</th>
                      <th className="py-3.5 px-4">Qty</th>
                      <th className="py-3.5 px-4">Client Name</th>
                      <th className="py-3.5 px-4">PO Status Batch</th>
                      <th className="py-3.5 px-6 text-right">Quick Transition Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb] text-xs font-medium text-gray-700">
                    {orders.filter(o => o.isPreOrder).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-gray-400 font-semibold">
                          No active pre-order orders logged.
                        </td>
                      </tr>
                    ) : (
                      orders.filter(o => o.isPreOrder).map((o) => {
                        const poItems = o.items || [];

                        return (
                          <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                            <td className="py-4 px-6 font-bold font-mono text-[#111111]">{o.orderNumber}</td>
                            <td className="py-4 px-4 font-bold text-gray-800">
                              {poItems.map(item => item.product?.name || "Pre-Order Souvenir").join(", ")}
                            </td>
                            <td className="py-4 px-4 font-semibold text-gray-500">
                              {poItems.reduce((acc, curr) => acc + curr.quantity, 0)} Pcs
                            </td>
                            <td className="py-4 px-4">
                              <div className="font-bold text-[#111111]">{o.shippingName}</div>
                              <div className="text-[10px] text-gray-400">{o.shippingPhone}</div>
                            </td>
                            <td className="py-4 px-4">
                              <Badge className="bg-[#eff6ff] text-[#1d4ed8] border-[#dbeafe] text-[10px] font-bold px-2.5 py-0.5 rounded-full border">
                                {o.preOrderStatus || "PO_OPEN"}
                              </Badge>
                            </td>
                            <td className="py-4 px-6 text-right">
                              <div className="flex space-x-1.5 justify-end">
                                <select
                                  value={o.preOrderStatus || "PO_OPEN"}
                                  onChange={(e) => handlePOBatchUpdate(o.id, e.target.value as PreOrderStatus)}
                                  className="border border-[#e5e7eb] rounded p-1 text-[11px] font-bold bg-white text-gray-700 focus-visible:ring-[#111111] focus-visible:outline-none"
                                >
                                  <option value="PO_OPEN">PO Open</option>
                                  <option value="PO_CLOSED">PO Closed</option>
                                  <option value="PURCHASING">Purchasing Saudi</option>
                                  <option value="SHIPPING_FROM_SAUDI">Shipping Jeddah</option>
                                  <option value="ARRIVED_INDONESIA">Arrived Indo</option>
                                  <option value="LOCAL_DELIVERY">Local Courier</option>
                                  <option value="COMPLETED">Completed</option>
                                </select>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 5: CATEGORIES DESK */}
          {activeTab === "categories" && (
            <div className="space-y-4">
              <div className="bg-white border border-[#e5e7eb] rounded-xl overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-[#e5e7eb] text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      <th className="py-3.5 px-6">Category Name</th>
                      <th className="py-3.5 px-4">Category Slug</th>
                      <th className="py-3.5 px-4">Description</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e5e7eb] text-xs font-medium text-gray-700">
                    {categories.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-gray-400 font-semibold">
                          No categories defined yet.
                        </td>
                      </tr>
                    ) : (
                      categories.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="py-4 px-6 font-bold text-[#111111]">{c.name}</td>
                          <td className="py-4 px-4 font-mono font-semibold text-gray-500">{c.slug}</td>
                          <td className="py-4 px-4 text-gray-500 font-medium">{c.description || "—"}</td>
                          <td className="py-4 px-4">
                            {c.isActive ? (
                              <Badge className="bg-[#ecfdf5] text-[#047857] border-[#d1fae5] text-[10px] font-bold px-2 py-0.5 rounded-full border">
                                Active
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-400 border-gray-200 text-[10px] font-bold px-2 py-0.5 rounded-full border">
                                Inactive
                              </Badge>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right space-x-1.5 shrink-0">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditingCategory(c);
                                setCategoryForm({
                                  name: c.name,
                                  slug: c.slug,
                                  description: c.description || ""
                                });
                                setCategoryModalOpen(true);
                              }}
                              className="h-8 w-8 p-0 rounded-full border border-transparent hover:border-[#e5e7eb] hover:bg-[#f8f9fa] transition-all flex items-center justify-center text-[#111111]"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCategoryDelete(c.id)}
                              className="h-8 w-8 p-0 rounded-full border border-transparent hover:border-[#e5e7eb] hover:bg-red-50 transition-all flex items-center justify-center text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          MODALS & DRAWERS
      ========================================== */}

      {/* PRODUCT CREATION/EDIT MODAL */}
      {productModalOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl border border-[#e5e7eb] shadow-xl overflow-hidden max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#e5e7eb] bg-gray-50/70">
              <h3 className="font-bold text-sm text-[#111111] flex items-center gap-1.5">
                <ShoppingBag className="h-4 w-4 text-[#111111]" />
                {editingProduct ? `Edit Souvenir Product: ${editingProduct.name}` : "Register New Saudi Souvenir Product"}
              </h3>
              <button
                onClick={() => setProductModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleProductSubmit} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 text-xs font-semibold text-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">Product Name *</label>
                  <Input
                    required
                    placeholder="E.g. Kurma Ajwa Madinah Premium"
                    value={productForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setProductForm(prev => ({
                        ...prev,
                        name,
                        slug: generateSlug(name)
                      }));
                    }}
                    className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">Product Slug *</label>
                  <Input
                    required
                    placeholder="E.g. kurma-ajwa-madinah-premium"
                    value={productForm.slug}
                    onChange={(e) => setProductForm(prev => ({ ...prev, slug: e.target.value }))}
                    className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] font-mono text-[11px]"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="block text-xs font-medium text-gray-500">Description</label>
                  <textarea
                    placeholder="Product catalog description details..."
                    value={productForm.description}
                    onChange={(e) => setProductForm(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full border border-[#e5e7eb] rounded p-2 text-xs font-medium focus-visible:ring-[#111111] focus-visible:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">Category *</label>
                  <select
                    value={productForm.categoryId}
                    onChange={(e) => setProductForm(prev => ({ ...prev, categoryId: e.target.value }))}
                    className="w-full h-9 border border-[#e5e7eb] rounded px-3 text-xs bg-white focus-visible:ring-[#111111] focus-visible:outline-none"
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">SKU Code *</label>
                  <Input
                    required
                    placeholder="E.g. KRM-AJW-001"
                    value={productForm.sku}
                    onChange={(e) => setProductForm(prev => ({ ...prev, sku: e.target.value }))}
                    className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] font-mono text-[11px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">Base Price (Rp) *</label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    placeholder="E.g. 75.00"
                    value={productForm.price}
                    onChange={(e) => setProductForm(prev => ({ ...prev, price: e.target.value }))}
                    className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">Promo Price (Rp)</label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Leave empty if no discount"
                    value={productForm.promoPrice}
                    onChange={(e) => setProductForm(prev => ({ ...prev, promoPrice: e.target.value }))}
                    className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">Weight (kg) *</label>
                  <Input
                    required
                    type="number"
                    step="0.01"
                    placeholder="E.g. 1.00"
                    value={productForm.weight}
                    onChange={(e) => setProductForm(prev => ({ ...prev, weight: e.target.value }))}
                    className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">Dimensions</label>
                  <Input
                    placeholder="E.g. 20x15x10 cm"
                    value={productForm.dimensions}
                    onChange={(e) => setProductForm(prev => ({ ...prev, dimensions: e.target.value }))}
                    className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-medium text-gray-500">Stock Count</label>
                  <Input
                    type="number"
                    disabled={productForm.isPreOrder}
                    value={productForm.isPreOrder ? 0 : productForm.stock}
                    onChange={(e) => setProductForm(prev => ({ ...prev, stock: parseInt(e.target.value) || 0 }))}
                    className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] disabled:bg-gray-100"
                  />
                </div>

                <div className="flex items-center space-x-2 py-4">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={productForm.isActive}
                    onChange={(e) => setProductForm(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="h-4 w-4 border-[#e5e7eb] text-[#111111] focus:ring-[#111111]"
                  />
                  <label htmlFor="isActive" className="text-xs text-gray-700 font-bold">Active in Store Catalog</label>
                </div>

                <div className="flex items-center space-x-2 py-4">
                  <input
                    type="checkbox"
                    id="isPreOrder"
                    checked={productForm.isPreOrder}
                    onChange={(e) => setProductForm(prev => ({ ...prev, isPreOrder: e.target.checked }))}
                    className="h-4 w-4 border-[#e5e7eb] text-[#111111] focus:ring-[#111111]"
                  />
                  <label htmlFor="isPreOrder" className="text-xs text-gray-700 font-bold text-[#1d4ed8]">Flag as Pre-Order item</label>
                </div>
              </div>

              {/* Pre-Order Specific Parameters */}
              {productForm.isPreOrder && (
                <Card className="p-4 border border-[#eff6ff] rounded-xl bg-[#eff6ff]/20 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-blue-800">PO Open Date</label>
                    <Input
                      type="datetime-local"
                      value={productForm.preOrderOpenDate}
                      onChange={(e) => setProductForm(prev => ({ ...prev, preOrderOpenDate: e.target.value }))}
                      className="h-9 border-[#dbeafe] bg-white rounded focus-visible:ring-[#111111]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-blue-800">PO Close Date</label>
                    <Input
                      type="datetime-local"
                      value={productForm.preOrderCloseDate}
                      onChange={(e) => setProductForm(prev => ({ ...prev, preOrderCloseDate: e.target.value }))}
                      className="h-9 border-[#dbeafe] bg-white rounded focus-visible:ring-[#111111]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-blue-800">Estimated Arrival (ETA)</label>
                    <Input
                      type="datetime-local"
                      value={productForm.estimatedArrivalDate}
                      onChange={(e) => setProductForm(prev => ({ ...prev, estimatedArrivalDate: e.target.value }))}
                      className="h-9 border-[#dbeafe] bg-white rounded focus-visible:ring-[#111111]"
                    />
                  </div>
                </Card>
              )}

              {/* High-definition image URLs */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-medium text-gray-500">Product High-Resolution Image URLs *</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setProductForm(prev => ({ ...prev, imageUrls: [...prev.imageUrls, ""] }))}
                    className="text-[#1d4ed8] hover:bg-blue-50 text-[10px] font-bold h-7 px-2"
                  >
                    + Add image URL
                  </Button>
                </div>
                {productForm.imageUrls.map((url, index) => (
                  <div key={index} className="flex space-x-2">
                    <Input
                      required={index === 0}
                      placeholder={`https://example.com/image-${index + 1}.jpg`}
                      value={url}
                      onChange={(e) => {
                        const newUrls = [...productForm.imageUrls];
                        newUrls[index] = e.target.value;
                        setProductForm(prev => ({ ...prev, imageUrls: newUrls }));
                      }}
                      className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] flex-1 text-xs font-medium font-mono"
                    />
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          const newUrls = productForm.imageUrls.filter((_, idx) => idx !== index);
                          setProductForm(prev => ({ ...prev, imageUrls: newUrls }));
                        }}
                        className="text-red-500 hover:bg-red-50 h-9 w-9 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-[#e5e7eb]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setProductModalOpen(false)}
                  className="text-xs h-9 border-[#e5e7eb] text-gray-600 font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#111111] hover:bg-[#242424] text-white text-xs h-9 px-5 rounded-md font-semibold"
                >
                  {editingProduct ? "Save Product changes" : "Register Product"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILED ORDER MANAGEMENT DIALOG */}
      {orderModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl border border-[#e5e7eb] shadow-xl overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#e5e7eb] bg-gray-50/70">
              <div>
                <h3 className="font-bold text-sm text-[#111111]">
                  Order Dashboard: {selectedOrder.orderNumber}
                </h3>
                <p className="text-[10px] text-gray-400 font-semibold mt-0.5">
                  Placed by Pilgrim: {selectedOrder.shippingName} ({new Date(selectedOrder.createdAt).toLocaleDateString("en-CA")})
                </p>
              </div>
              <button
                onClick={() => setOrderModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 text-xs font-semibold text-gray-700">

              {/* Order breakdown */}
              <Card className="p-5 border border-[#e5e7eb] rounded-xl bg-white shadow-none">
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 block">Ordered Items & Catalog Breakdown</h4>
                <div className="divide-y divide-[#e5e7eb]">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="py-3 flex justify-between items-center">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 rounded border border-[#e5e7eb] overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
                          {item.product?.images && item.product.images.length > 0 ? (
                            <img src={item.product.images[0].imageUrl} alt={item.product.name} className="h-full w-full object-cover" />
                          ) : (
                            <ShoppingBag className="h-4 w-4 text-gray-300" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[#111111]">{item.product?.name || "Premium Souvenir"}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">SKU: {item.product?.sku}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-[#111111]">{item.quantity} Qty × {selectedOrder.currency} {parseFloat(item.price).toFixed(2)}</div>
                        <div className="text-[10px] text-gray-400 mt-0.5">subtotal: {selectedOrder.currency} {parseFloat(item.subtotal).toFixed(2)}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-[#f8f9fa] border-t border-[#e5e7eb]/80 p-4 mt-3 rounded-lg space-y-2 text-xs">
                  <div className="flex justify-between items-center text-gray-500 font-semibold">
                    <span>Items Subtotal:</span>
                    <span>{selectedOrder.currency} {parseFloat(selectedOrder.totalAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-500 font-semibold">
                    <span>Saudi → Indonesia Shipping flat rate:</span>
                    <span>{selectedOrder.currency} {parseFloat(selectedOrder.shippingCost).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center font-bold text-sm text-[#111111] border-t border-[#e5e7eb] pt-2 mt-1">
                    <span>Grand Total:</span>
                    <span>{selectedOrder.currency} {parseFloat(selectedOrder.finalAmount).toFixed(2)}</span>
                  </div>
                </div>
              </Card>

              {/* Shipping Address details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-5 border border-[#e5e7eb] rounded-xl bg-white shadow-none">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 block">Indonesian Shipping Address</h4>
                  <div className="space-y-1.5 text-xs text-[#374151] font-medium">
                    <div><span className="font-bold text-gray-500 text-[10px] uppercase block mb-0.5">Recipient Full Name</span>{selectedOrder.shippingName}</div>
                    <div className="pt-1.5"><span className="font-bold text-gray-500 text-[10px] uppercase block mb-0.5">WhatsApp Phone Number</span>{selectedOrder.shippingPhone}</div>
                    <div className="pt-1.5"><span className="font-bold text-gray-500 text-[10px] uppercase block mb-0.5">Physical Destination Address</span>{selectedOrder.shippingAddress}</div>
                  </div>
                </Card>

                {/* Logistics status summary */}
                <Card className="p-5 border border-[#e5e7eb] rounded-xl bg-white shadow-none flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 block">Tracking & Airway Bill Details</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center font-medium">
                        <span className="text-gray-400">Logistics Status:</span>
                        <Badge className="bg-[#eff6ff] text-[#1d4ed8] text-[10px] border border-[#dbeafe] font-bold px-2 rounded-full">
                          {selectedOrder.orderStatus.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center font-medium">
                        <span className="text-gray-400">Airway Bill (AWB):</span>
                        <span className="font-mono font-bold text-gray-700">{selectedOrder.trackingNumber || "Not assigned"}</span>
                      </div>
                      <div className="flex justify-between items-center font-medium">
                        <span className="text-gray-400">Local Courier:</span>
                        <span className="font-bold text-gray-700">{selectedOrder.courierName || "Not assigned"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action triggers */}
                  <div className="pt-4 flex space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShipmentForm({
                          trackingNumber: selectedOrder.trackingNumber || "",
                          courierName: selectedOrder.courierName || "",
                          status: (selectedOrder.shipments && selectedOrder.shipments.length > 0 ? selectedOrder.shipments[0].status : "PENDING") as ShipmentStatus,
                          description: "",
                          estimatedArrival: selectedOrder.estimatedDelivery ? new Date(selectedOrder.estimatedDelivery).toISOString().substring(0, 10) : ""
                        });
                        setShipmentModalOpen(true);
                      }}
                      className="text-xs h-8 border-[#e5e7eb] font-bold text-[#111111] hover:bg-gray-50 bg-white flex-1 flex items-center justify-center gap-1"
                    >
                      <Truck className="h-3.5 w-3.5" />
                      Update Shipment
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Bank proof of payment verification module */}
              <Card className="p-5 border border-amber-200 bg-amber-50/20 rounded-xl shadow-none">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-3 block flex items-center gap-1">
                  <CreditCard className="h-4 w-4" />
                  Pilgrim Bank Proof of Payment Uploads
                </h4>

                {selectedOrder.payments && selectedOrder.payments.length > 0 ? (
                  <div className="space-y-4">
                    {selectedOrder.payments.map((payment) => (
                      <div key={payment.id} className="bg-white border border-[#e5e7eb] p-4 rounded-lg shadow-none flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-medium">
                            <div><span className="font-bold text-gray-400 text-[10px] block uppercase">Bank Name</span>{payment.bankName}</div>
                            <div><span className="font-bold text-gray-400 text-[10px] block uppercase">Account Owner</span>{payment.accountName}</div>
                            <div><span className="font-bold text-gray-400 text-[10px] block uppercase">Transferred Amount</span>{selectedOrder.currency} {parseFloat(payment.amount).toFixed(2)}</div>
                            <div>
                              <span className="font-bold text-gray-400 text-[10px] block uppercase">Proof Status</span>
                              <Badge className={`text-[9px] font-bold px-2 py-0.5 rounded border ${payment.status === 'approved'
                                ? "bg-green-100 text-green-700 border-green-200"
                                : payment.status === 'rejected'
                                  ? "bg-red-100 text-red-700 border-red-200"
                                  : "bg-amber-100 text-amber-700 border-amber-200"
                                }`}>
                                {payment.status.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                          {payment.notes && (
                            <div className="p-2 bg-gray-50 border border-gray-100 rounded text-[11px] font-medium text-gray-600">
                              <span className="font-bold block text-[10px] text-gray-400 uppercase">Notes</span>
                              {payment.notes}
                            </div>
                          )}
                        </div>

                        {/* Payment Verification Buttons */}
                        <div className="flex items-center space-x-2 shrink-0">
                          <a
                            href={payment.paymentProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-white hover:bg-gray-50 border border-[#e5e7eb] text-[#111111] text-[11px] font-bold h-8 px-3 rounded flex items-center justify-center gap-1 transition-all"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Image Slip
                          </a>

                          {payment.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => {
                                  setConfirmingPayment(payment);
                                  setPaymentProofOpen(true);
                                }}
                                className="bg-[#10b981] hover:bg-[#059669] text-white text-[11px] font-bold h-8 px-3 rounded"
                              >
                                <Check className="h-3.5 w-3.5 mr-1" />
                                Verify
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handlePaymentConfirm(payment.id, "rejected")}
                                className="bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold h-8 px-3 rounded"
                              >
                                <X className="h-3.5 w-3.5 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-400 font-semibold text-xs">
                    No proof of payment slips uploaded by user yet for this order.
                  </div>
                )}
              </Card>

              {/* Shipment Logs Transit Timeline */}
              {selectedOrder.shipments && selectedOrder.shipments.length > 0 && selectedOrder.shipments[0].logs && (
                <Card className="p-5 border border-[#e5e7eb] rounded-xl bg-white shadow-none">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 block">Logistics Shipment Transit Logs</h4>

                  {selectedOrder.shipments[0].logs.length === 0 ? (
                    <div className="text-center py-4 text-gray-400 italic">No shipment transit steps logged yet.</div>
                  ) : (
                    <div className="relative pl-6 border-l border-gray-200 space-y-5 text-xs">
                      {selectedOrder.shipments[0].logs.map((log) => (
                        <div key={log.id} className="relative">
                          {/* dot indicator */}
                          <span className={`absolute -left-[30px] top-0.5 h-4 w-4 rounded-full border-2 bg-white flex items-center justify-center ${log.status === "DELIVERED"
                            ? "border-[#10b981] text-[#10b981]"
                            : "border-blue-500 text-blue-500"
                            }`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                          </span>

                          <div className="flex flex-col">
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-[#111111]">{log.status}</span>
                              <span className="text-[10px] text-gray-400 font-semibold font-mono">{new Date(log.createdAt).toLocaleString("en-CA")}</span>
                            </div>
                            <span className="text-[11px] font-medium text-gray-500 mt-1">{log.description}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION FOR MANUAL PAYMENT MODAL */}
      {paymentProofOpen && confirmingPayment && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md border border-[#e5e7eb] shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-[#e5e7eb] bg-gray-50/70">
              <h4 className="font-bold text-sm text-[#111111] flex items-center gap-1.5">
                <Check className="h-4 w-4 text-[#10b981]" />
                Verify Bank Transfer Payment
              </h4>
            </div>
            <div className="p-4 md:p-6 space-y-4 text-xs font-semibold text-gray-700">
              <p className="text-gray-500 font-medium">
                Verify this transfer proof slip details. Ensure the transfer sum matches the invoice target amount perfectly before clicking confirm.
              </p>

              <div className="bg-gray-50 border border-gray-100 p-3 rounded-lg space-y-1.5 text-xs font-medium">
                <div><span className="text-[10px] font-bold text-gray-400 uppercase">Bank:</span> {confirmingPayment.bankName}</div>
                <div><span className="text-[10px] font-bold text-gray-400 uppercase">Owner:</span> {confirmingPayment.accountName}</div>
                <div><span className="text-[10px] font-bold text-gray-400 uppercase">Amount:</span> Rp {parseFloat(confirmingPayment.amount).toFixed(2)}</div>
              </div>

              <div className="h-48 border border-gray-200 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                <img
                  src={confirmingPayment.paymentProofUrl}
                  alt="Bank Proof Slip"
                  className="h-full w-full object-contain cursor-zoom-in"
                  onClick={() => window.open(confirmingPayment.paymentProofUrl)}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setPaymentProofOpen(false)}
                  className="text-xs h-9 border-[#e5e7eb] text-gray-600 font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handlePaymentConfirm(confirmingPayment.id, "approved")}
                  className="bg-[#10b981] hover:bg-[#059669] text-white text-xs h-9 px-4 rounded font-semibold"
                >
                  Confirm & Approve
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOGISTICS UPDATE AWB MODAL */}
      {shipmentModalOpen && selectedOrder && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md border border-[#e5e7eb] shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#e5e7eb] bg-gray-50/70">
              <h3 className="font-bold text-sm text-[#111111] flex items-center gap-1.5">
                <Truck className="h-4 w-4 text-[#111111]" />
                Update Shipping & Logistics
              </h3>
              <button
                onClick={() => setShipmentModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleShipmentSubmit} className="p-4 md:p-6 space-y-4 text-xs font-semibold text-gray-700">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Airway Bill (AWB) / Tracking Number *</label>
                <Input
                  required
                  placeholder="E.g. AWB12891901"
                  value={shipmentForm.trackingNumber}
                  onChange={(e) => setShipmentForm(prev => ({ ...prev, trackingNumber: e.target.value }))}
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Courier Name *</label>
                <Input
                  required
                  placeholder="E.g. JNE, SiCepat, DHL"
                  value={shipmentForm.courierName}
                  onChange={(e) => setShipmentForm(prev => ({ ...prev, courierName: e.target.value }))}
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Estimated Arrival (ETA)</label>
                <Input
                  type="date"
                  value={shipmentForm.estimatedArrival}
                  onChange={(e) => setShipmentForm(prev => ({ ...prev, estimatedArrival: e.target.value }))}
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Logistics Shipment Status *</label>
                <select
                  value={shipmentForm.status}
                  onChange={(e) => setShipmentForm(prev => ({ ...prev, status: e.target.value as ShipmentStatus }))}
                  className="w-full h-9 border border-[#e5e7eb] rounded px-3 text-xs bg-white focus-visible:ring-[#111111] focus-visible:outline-none"
                >
                  <option value="PENDING">Pending (Packing)</option>
                  <option value="PACKING">Item Packing</option>
                  <option value="READY_TO_SHIP">Ready for Departure</option>
                  <option value="SHIPPED_FROM_SAUDI">Shipped from Saudi Arabia</option>
                  <option value="ARRIVED_INDONESIA">Arrived in Indonesia</option>
                  <option value="CUSTOMS_CLEARANCE">Customs Clearance Soekarno-Hatta</option>
                  <option value="LOCAL_COURIER">Entrusted to Local Courier</option>
                  <option value="OUT_FOR_DELIVERY">Out for Delivery</option>
                  <option value="DELIVERED">Delivered (Completed)</option>
                  <option value="FAILED_DELIVERY">Failed Delivery</option>
                  <option value="RETURNED">Returned</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Milestone Description (Visible to pilgrim) *</label>
                <textarea
                  required
                  placeholder="E.g. Container checked out from Jeddah cargo hold, departure scheduled."
                  value={shipmentForm.description}
                  onChange={(e) => setShipmentForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-[#e5e7eb] rounded p-2 text-xs font-medium focus-visible:ring-[#111111] focus-visible:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#e5e7eb]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShipmentModalOpen(false)}
                  className="text-xs h-9 border-[#e5e7eb] text-gray-600 font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#111111] hover:bg-[#242424] text-white text-xs h-9 px-4 rounded-md font-semibold"
                >
                  Update & Post log
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CATEGORY CRUD DIALOG */}
      {categoryModalOpen && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md border border-[#e5e7eb] shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#e5e7eb] bg-gray-50/70">
              <h3 className="font-bold text-sm text-[#111111] flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[#111111]" />
                {editingCategory ? "Edit Category Details" : "Create Product Category"}
              </h3>
              <button
                onClick={() => setCategoryModalOpen(false)}
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <form onSubmit={handleCategorySubmit} className="p-4 md:p-6 space-y-4 text-xs font-semibold text-gray-700">
              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Category Name *</label>
                <Input
                  required
                  placeholder="E.g. Perfume, Food, Religious"
                  value={categoryForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setCategoryForm(prev => ({
                      ...prev,
                      name,
                      slug: generateSlug(name)
                    }));
                  }}
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Slug *</label>
                <Input
                  required
                  placeholder="E.g. perfume, food, religious"
                  value={categoryForm.slug}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, slug: e.target.value }))}
                  className="h-9 border-[#e5e7eb] rounded focus-visible:ring-[#111111] font-mono text-[11px]"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-medium text-gray-500">Description</label>
                <textarea
                  placeholder="Category catalog description..."
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full border border-[#e5e7eb] rounded p-2 text-xs font-medium focus-visible:ring-[#111111] focus-visible:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t border-[#e5e7eb]">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCategoryModalOpen(false)}
                  className="text-xs h-9 border-[#e5e7eb] text-gray-600 font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-[#111111] hover:bg-[#242424] text-white text-xs h-9 px-4 rounded-md font-semibold"
                >
                  {editingCategory ? "Save changes" : "Create Category"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
