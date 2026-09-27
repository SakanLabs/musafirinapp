import { createFileRoute, redirect, Outlet, Link, useLocation } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { PageLayout } from "@/components/layout/PageLayout";
import { authService, type UserRole } from "@/lib/auth";
import { apiClient } from "@/lib/api";
import { ShoppingBag, ShoppingCart, ClipboardList, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/store")({
  beforeLoad: async () => {
    // Check if user is authenticated
    const isAuthenticated = await authService.isAuthenticated();
    if (!isAuthenticated) {
      throw redirect({ to: "/login" });
    }
  },
  component: StoreLayout
});

function StoreLayout() {
  const location = useLocation();
  const [role, setRole] = useState<UserRole>("user");
  const [cartCount, setCartCount] = useState(0);

  // Fetch role and cart quantity count
  useEffect(() => {
    authService.getCurrentUser().then(user => {
      if (user) setRole(user.role);
    });

    const fetchCartCount = async () => {
      try {
        const res = await apiClient.get<any>("/api/store/cart");
        if (res.success && res.data && res.data.items) {
          const totalQty = res.data.items.reduce((acc: number, curr: any) => acc + curr.quantity, 0);
          setCartCount(totalQty);
        }
      } catch (e) {
        // Silent catch
      }
    };
    fetchCartCount();

    // Listen to quick custom cart update events
    const handleCartUpdate = () => fetchCartCount();
    window.addEventListener("cart-updated", handleCartUpdate);
    return () => window.removeEventListener("cart-updated", handleCartUpdate);
  }, [location.pathname]);

  const isAdmin = ["admin", "owner", "finance"].includes(role);

  // segment indicators
  const isBrowseActive = location.pathname === "/store" || location.pathname === "/store/" || location.pathname.startsWith("/store/product");
  const isCartActive = location.pathname === "/store/cart";
  const isOrdersActive = location.pathname === "/store/orders" || location.pathname.startsWith("/store/order/");
  const isAdminActive = location.pathname === "/store/admin";

  return (
    <PageLayout
      title="Musafirin Store"
      subtitle="Exquisite Saudi Souvenirs & Cross-Border Logistics Hub"
      actions={
        <div className="flex items-center space-x-1.5 bg-[#f5f5f5] rounded-full p-1 border border-[#e5e7eb]/60">
          {/* <Link
            to="/store"
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${isBrowseActive
                ? "bg-white text-[#111111] shadow-xs"
                : "text-gray-500 hover:text-[#111111]"
              }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            Browse Souvenirs
          </Link>

          <Link
            to="/store/cart"
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 relative ${isCartActive
                ? "bg-white text-[#111111] shadow-xs"
                : "text-gray-500 hover:text-[#111111]"
              }`}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            My Cart
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full text-[9px] font-bold h-4 w-4 flex items-center justify-center border border-white animate-pulse">
                {cartCount}
              </span>
            )}
          </Link>

          <Link
            to="/store/orders"
            className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${isOrdersActive
                ? "bg-white text-[#111111] shadow-xs"
                : "text-gray-500 hover:text-[#111111]"
              }`}
          >
            <ClipboardList className="h-3.5 w-3.5" />
            My Orders
          </Link> */}

          {isAdmin && (
            <Link
              to="/store/admin"
              className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all flex items-center gap-1.5 ${isAdminActive
                ? "bg-[#111111] text-white shadow-xs"
                : "text-gray-500 hover:text-[#111111]"
                }`}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Store Admin
            </Link>
          )}
        </div>
      }
    >
      <Outlet />
    </PageLayout>
  );
}
