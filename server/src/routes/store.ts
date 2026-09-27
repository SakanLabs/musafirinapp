import { Hono } from "hono";
import { db } from "../db";
import { 
  storeCategories, 
  storeProducts, 
  storeProductImages, 
  storeCarts, 
  storeCartItems, 
  storeOrders, 
  storeOrderItems, 
  storePayments, 
  storeShipments, 
  storeShipmentLogs, 
  user
} from "../db/schema";
import { eq, and, desc, asc, ilike } from "drizzle-orm";
import { requireAuth, requireAdminOrFinance } from "../middleware/auth";
import { uploadToMinio } from "../utils/pdf";
import { verify } from "hono/jwt";

async function unifiedAuth(c: any, next: any) {
  try {
    const authHeader = c.req.header("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const secret = process.env.SUPABASE_JWT_SECRET;
      if (token && secret) {
        try {
          const payload = await verify(token, secret) as any;
          if (payload && payload.aud === "authenticated" && payload.email) {
            const userId = payload.sub || payload.email;
            
            // Mirror Supabase user in local user table to satisfy foreign key constraint
            let localUser = await db.query.user.findFirst({
              where: eq(user.id, userId)
            });
            
            if (!localUser) {
              const [newLocalUser] = await db.insert(user).values({
                id: userId,
                name: payload.user_metadata?.full_name || payload.email.split('@')[0] || "User",
                email: payload.email,
                role: "user",
                userType: "direct"
              }).returning();
              if (newLocalUser) {
                localUser = newLocalUser;
              }
            }
            
            if (localUser) {
              const mockUser = {
                id: localUser.id,
                email: localUser.email,
                role: localUser.role
              };
              c.set("user", mockUser);
              return await next();
            } else {
              throw new Error("Failed to mirror Supabase user locally.");
            }
          }
        } catch (jwtErr) {
          console.error("JWT verify or mirror insert error:", jwtErr);
          // Let it fall back
        }
      }
    }
    await requireAuth(c, next);
  } catch (error) {
    console.error("Unified auth error:", error);
    return c.json({ error: "Unauthorized" }, 401);
  }
}

const app = new Hono<{ Variables: { user: any; session: any; userRole?: string } }>();

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

// GET /api/store/categories - List active categories
app.get("/categories", async (c) => {
  try {
    const categories = await db.query.storeCategories.findMany({
      where: eq(storeCategories.isActive, true),
      orderBy: [asc(storeCategories.name)]
    });
    return c.json({ success: true, data: categories });
  } catch (error: any) {
    console.error("Failed to fetch store categories:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// GET /api/store/products - Browse products
app.get("/products", async (c) => {
  try {
    const { category, search, isPreOrder } = c.req.query();
    const conditions = [eq(storeProducts.isActive, true)];

    if (category) {
      const cat = await db.query.storeCategories.findFirst({
        where: eq(storeCategories.slug, category)
      });
      if (cat) {
        conditions.push(eq(storeProducts.categoryId, cat.id));
      }
    }

    if (search) {
      conditions.push(ilike(storeProducts.name, `%${search}%`));
    }

    if (isPreOrder === "true") {
      conditions.push(eq(storeProducts.isPreOrder, true));
    } else if (isPreOrder === "false") {
      conditions.push(eq(storeProducts.isPreOrder, false));
    }

    const products = await db.query.storeProducts.findMany({
      where: and(...conditions),
      with: {
        images: true
      },
      orderBy: [desc(storeProducts.createdAt)]
    });

    return c.json({ success: true, data: products });
  } catch (error: any) {
    console.error("Failed to fetch store products:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// GET /api/store/products/:id - Single product details
app.get("/products/:id", async (c) => {
  try {
    const productId = parseInt(c.req.param("id"));
    if (isNaN(productId)) {
      return c.json({ success: false, error: "Invalid product ID" }, 400);
    }

    const product = await db.query.storeProducts.findFirst({
      where: eq(storeProducts.id, productId),
      with: {
        images: true,
        category: true
      }
    });

    if (!product) {
      return c.json({ success: false, error: "Product not found" }, 404);
    }

    return c.json({ success: true, data: product });
  } catch (error: any) {
    console.error("Failed to fetch product details:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==========================================
// USER ENDPOINTS (AUTHENTICATED)
// ==========================================

// GET /api/store/cart - Get active cart and items
app.get("/cart", unifiedAuth, async (c) => {
  try {
    const currentUser = c.get("user") as any;
    
    // Find or create cart
    let cart = await db.query.storeCarts.findFirst({
      where: eq(storeCarts.userId, currentUser.id),
      with: {
        items: {
          with: {
            product: {
              with: {
                images: true
              }
            }
          }
        }
      }
    });

    if (!cart) {
      const [newCart] = await db.insert(storeCarts).values({
        userId: currentUser.id
      }).returning();
      
      return c.json({ success: true, data: { ...newCart, items: [] } });
    }

    return c.json({ success: true, data: cart });
  } catch (error: any) {
    console.error("Failed to fetch shopping cart:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// POST /api/store/cart/items - Add product to cart
app.post("/cart/items", unifiedAuth, async (c) => {
  try {
    const currentUser = c.get("user") as any;
    const { productId, quantity } = await c.req.json();

    if (!productId || !quantity || quantity <= 0) {
      return c.json({ success: false, error: "Product ID and valid quantity are required" }, 400);
    }

    // Get or create cart
    let cart = await db.query.storeCarts.findFirst({
      where: eq(storeCarts.userId, currentUser.id)
    });

    if (!cart) {
      const [newCart] = await db.insert(storeCarts).values({
        userId: currentUser.id
      }).returning();
      cart = newCart;
    }
    const activeCart = cart as any;

    // Check if product exists and is active
    const product = await db.query.storeProducts.findFirst({
      where: and(eq(storeProducts.id, productId), eq(storeProducts.isActive, true))
    });

    if (!product) {
      return c.json({ success: false, error: "Product not found or inactive" }, 404);
    }

    // Check stock
    if (product.stock < quantity && !product.isPreOrder) {
      return c.json({ success: false, error: "Insufficient stock" }, 400);
    }

    // Check if item already in cart
    const existingItem = await db.query.storeCartItems.findFirst({
      where: and(eq(storeCartItems.cartId, activeCart.id), eq(storeCartItems.productId, productId))
    });

    if (existingItem) {
      // Update quantity
      const newQty = existingItem.quantity + quantity;
      if (product.stock < newQty && !product.isPreOrder) {
        return c.json({ success: false, error: "Insufficient stock for total updated quantity" }, 400);
      }
      
      const [updatedItem] = await db.update(storeCartItems)
        .set({ quantity: newQty, updatedAt: new Date() })
        .where(eq(storeCartItems.id, existingItem.id))
        .returning();
      
      return c.json({ success: true, data: updatedItem });
    }

    // Insert cart item
    const [newItem] = await db.insert(storeCartItems).values({
      cartId: activeCart.id,
      productId,
      quantity
    }).returning();

    return c.json({ success: true, data: newItem });
  } catch (error: any) {
    console.error("Failed to add cart item:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// PUT /api/store/cart/items/:id - Update item quantity
app.put("/cart/items/:id", unifiedAuth, async (c) => {
  try {
    const itemId = parseInt(c.req.param("id"));
    const { quantity } = await c.req.json();

    if (isNaN(itemId) || !quantity || quantity <= 0) {
      return c.json({ success: false, error: "Invalid item or quantity parameter" }, 400);
    }

    // Find the cart item
    const cartItem = await db.query.storeCartItems.findFirst({
      where: eq(storeCartItems.id, itemId),
      with: {
        product: true
      }
    });

    if (!cartItem) {
      return c.json({ success: false, error: "Cart item not found" }, 404);
    }

    // Verify stock
    if (cartItem.product.stock < quantity && !cartItem.product.isPreOrder) {
      return c.json({ success: false, error: "Insufficient stock" }, 400);
    }

    const [updatedItem] = await db.update(storeCartItems)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(storeCartItems.id, itemId))
      .returning();

    return c.json({ success: true, data: updatedItem });
  } catch (error: any) {
    console.error("Failed to update cart item:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// DELETE /api/store/cart/items/:id - Remove item from cart
app.delete("/cart/items/:id", unifiedAuth, async (c) => {
  try {
    const itemId = parseInt(c.req.param("id"));
    if (isNaN(itemId)) {
      return c.json({ success: false, error: "Invalid item ID" }, 400);
    }

    await db.delete(storeCartItems).where(eq(storeCartItems.id, itemId));
    return c.json({ success: true, message: "Item removed from cart" });
  } catch (error: any) {
    console.error("Failed to delete cart item:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// POST /api/store/checkout - Convert cart to order
app.post("/checkout", unifiedAuth, async (c) => {
  try {
    const currentUser = c.get("user") as any;
    const { shippingName, shippingPhone, shippingAddress, currency } = await c.req.json();

    if (!shippingName || !shippingPhone || !shippingAddress) {
      return c.json({ success: false, error: "Shipping name, phone, and address are required" }, 400);
    }

    // Get user's cart
    const cart = await db.query.storeCarts.findFirst({
      where: eq(storeCarts.userId, currentUser.id),
      with: {
        items: {
          with: {
            product: true
          }
        }
      }
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return c.json({ success: false, error: "Shopping cart is empty" }, 400);
    }

    const activeCart = cart as any;

    // Verify stock levels first
    for (const item of activeCart.items) {
      if (item.product.stock < item.quantity && !item.product.isPreOrder) {
        return c.json({ success: false, error: `Product '${item.product.name}' is out of stock` }, 400);
      }
    }

    // Calculate pricing sum
    let totalAmount = 0;
    let hasPreOrder = false;
    
    activeCart.items.forEach((item: any) => {
      const price = parseFloat(item.product.promoPrice?.toString() || item.product.price.toString());
      totalAmount += price * item.quantity;
      if (item.product.isPreOrder) {
        hasPreOrder = true;
      }
    });

    // Flat rate shipping cost of SAR 50 for Saudi-Indonesia logistics MVP
    const shippingCost = 50; 
    const discountAmount = 0;
    const finalAmount = totalAmount + shippingCost - discountAmount;
    
    // Generate unique order number
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const orderNumber = `ORD-${new Date().getFullYear()}-${timestamp}-${random}`;

    // Insert order in transaction
    const orderResult = await db.transaction(async (tx) => {
      const [order] = await tx.insert(storeOrders).values({
        orderNumber,
        userId: currentUser.id,
        totalAmount: totalAmount.toString(),
        shippingCost: shippingCost.toString(),
        discountAmount: discountAmount.toString(),
        finalAmount: finalAmount.toString(),
        currency: currency || "SAR",
        paymentStatus: "unpaid",
        orderStatus: "pending",
        preOrderStatus: hasPreOrder ? "PO_OPEN" : undefined,
        shippingName,
        shippingPhone,
        shippingAddress,
        isPreOrder: hasPreOrder
      }).returning();

      // Insert order items
      for (const item of activeCart.items) {
        const price = parseFloat(item.product.promoPrice?.toString() || item.product.price.toString());
        await tx.insert(storeOrderItems).values({
          orderId: order!.id,
          productId: item.productId,
          quantity: item.quantity,
          price: price.toString(),
          subtotal: (price * item.quantity).toString()
        });

        // Deduct regular product stock
        if (!item.product.isPreOrder) {
          const newStock = item.product.stock - item.quantity;
          await tx.update(storeProducts)
            .set({ stock: newStock })
            .where(eq(storeProducts.id, item.productId));
        }
      }

      // Clear cart items
      await tx.delete(storeCartItems).where(eq(storeCartItems.cartId, activeCart.id));

      return order;
    });

    return c.json({ success: true, data: orderResult });
  } catch (error: any) {
    console.error("Checkout transaction failed:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// GET /api/store/orders - User's order listing
app.get("/orders", unifiedAuth, async (c) => {
  try {
    const currentUser = c.get("user") as any;

    const userOrders = await db.query.storeOrders.findMany({
      where: eq(storeOrders.userId, currentUser.id),
      orderBy: [desc(storeOrders.createdAt)]
    });

    return c.json({ success: true, data: userOrders });
  } catch (error: any) {
    console.error("Failed to fetch user orders:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// GET /api/store/orders/:id - User's order detailed timeline
app.get("/orders/:id", unifiedAuth, async (c) => {
  try {
    const orderId = parseInt(c.req.param("id"));
    const currentUser = c.get("user") as any;

    if (isNaN(orderId)) {
      return c.json({ success: false, error: "Invalid order ID" }, 400);
    }

    const order = await db.query.storeOrders.findFirst({
      where: and(eq(storeOrders.id, orderId), eq(storeOrders.userId, currentUser.id)),
      with: {
        items: {
          with: {
            product: true
          }
        },
        payments: true,
        shipments: {
          with: {
            logs: {
              orderBy: [desc(storeShipmentLogs.createdAt)]
            }
          }
        }
      }
    });

    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }

    return c.json({ success: true, data: order });
  } catch (error: any) {
    console.error("Failed to fetch order details:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// POST /api/store/orders/:id/payment - Upload manual bank payment proof
app.post("/orders/:id/payment", unifiedAuth, async (c) => {
  try {
    const orderId = parseInt(c.req.param("id"));
    const { amount, bankName, accountName, paymentProofUrl, notes } = await c.req.json();

    if (isNaN(orderId) || !amount || !bankName || !accountName || !paymentProofUrl) {
      return c.json({ success: false, error: "Missing required payment fields" }, 400);
    }

    const order = await db.query.storeOrders.findFirst({
      where: eq(storeOrders.id, orderId)
    });

    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }

    const [paymentRecord] = await db.insert(storePayments).values({
      orderId,
      amount: amount.toString(),
      bankName,
      accountName,
      paymentProofUrl,
      notes,
      status: "pending"
    }).returning();

    // Mark order payment status as partial/paid to indicate verification pending
    await db.update(storeOrders)
      .set({ paymentStatus: "partial", orderStatus: "processing" })
      .where(eq(storeOrders.id, orderId));

    return c.json({ success: true, data: paymentRecord });
  } catch (error: any) {
    console.error("Failed to save payment record:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// POST /api/store/upload - Upload file multipart parser
app.post("/upload", unifiedAuth, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file as File | undefined;

    if (!file) {
      return c.json({ success: false, error: "No file uploaded" }, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const timestamp = Date.now();
    const cleanFileName = `store/${timestamp}_${file.name.replace(/\s+/g, "_")}`;
    
    // Upload utilizing ensureBucketExists & uploadToMinio
    const fileUrl = await uploadToMinio(cleanFileName, buffer, file.type);

    return c.json({ success: true, url: fileUrl });
  } catch (error: any) {
    console.error("Multipart upload handler failed:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ==========================================
// ADMIN ENDPOINTS (REQUIRES requireAdminOrFinance)
// ==========================================

// GET /api/store/admin/orders - View all client orders
app.get("/admin/orders", requireAdminOrFinance, async (c) => {
  try {
    const orders = await db.query.storeOrders.findMany({
      orderBy: [desc(storeOrders.createdAt)],
      with: {
        items: {
          with: {
            product: true
          }
        },
        payments: true,
        shipments: {
          with: {
            logs: {
              orderBy: [desc(storeShipmentLogs.createdAt)]
            }
          }
        }
      }
    });

    return c.json({ success: true, data: orders });
  } catch (error: any) {
    console.error("Admin orders fetch failed:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// PUT /api/store/admin/orders/:id/payment-confirm - Approve or Reject payment
app.put("/admin/orders/:id/payment-confirm", requireAdminOrFinance, async (c) => {
  try {
    const orderId = parseInt(c.req.param("id"));
    const { status, paymentId } = await c.req.json(); // status: 'approved' or 'rejected'
    const currentUser = c.get("user") as any;

    if (isNaN(orderId) || !paymentId || !["approved", "rejected"].includes(status)) {
      return c.json({ success: false, error: "Invalid status parameters" }, 400);
    }

    await db.transaction(async (tx) => {
      // Update payment record status
      await tx.update(storePayments)
        .set({ 
          status, 
          verifiedBy: currentUser.id, 
          verifiedAt: new Date(), 
          updatedAt: new Date() 
        })
        .where(eq(storePayments.id, paymentId));

      // Update order status based on payment confirm
      if (status === "approved") {
        await tx.update(storeOrders)
          .set({ paymentStatus: "paid", orderStatus: "processing" })
          .where(eq(storeOrders.id, orderId));
      } else {
        await tx.update(storeOrders)
          .set({ paymentStatus: "failed", orderStatus: "pending" })
          .where(eq(storeOrders.id, orderId));
      }
    });

    return c.json({ success: true, message: `Payment successfully ${status}` });
  } catch (error: any) {
    console.error("Failed to update payment status:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// PUT /api/store/admin/orders/:id/shipment - Input AWB / Courier details & logs
app.put("/admin/orders/:id/shipment", requireAdminOrFinance, async (c) => {
  try {
    const orderId = parseInt(c.req.param("id"));
    const { trackingNumber, courierName, status, description, estimatedArrival } = await c.req.json();

    if (isNaN(orderId) || !trackingNumber || !courierName || !status || !description) {
      return c.json({ success: false, error: "Missing airway bill tracking parameters" }, 400);
    }

    // Get order
    const order = await db.query.storeOrders.findFirst({
      where: eq(storeOrders.id, orderId)
    });

    if (!order) {
      return c.json({ success: false, error: "Order not found" }, 404);
    }

    const shipmentResult = await db.transaction(async (tx) => {
      // Find existing shipment
      let shipment = await tx.query.storeShipments.findFirst({
        where: eq(storeShipments.orderId, orderId)
      });

      if (!shipment) {
        const [newShipment] = await tx.insert(storeShipments).values({
          orderId,
          trackingNumber,
          courierName,
          status,
          estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null
        }).returning();
        shipment = newShipment!;
      } else {
        await tx.update(storeShipments)
          .set({ 
            trackingNumber, 
            courierName, 
            status, 
            estimatedArrival: estimatedArrival ? new Date(estimatedArrival) : null,
            updatedAt: new Date() 
          })
          .where(eq(storeShipments.id, shipment.id));
      }

      // Add timeline log entry
      await tx.insert(storeShipmentLogs).values({
        shipmentId: shipment!.id,
        status,
        description
      });

      // Update main order's shipping details & orderStatus
      const nextOrderStatus = status === "DELIVERED" ? "completed" : "processing";
      await tx.update(storeOrders)
        .set({ 
          trackingNumber, 
          courierName, 
          orderStatus: nextOrderStatus,
          estimatedDelivery: estimatedArrival ? new Date(estimatedArrival) : null,
          preOrderStatus: order.isPreOrder && status === "DELIVERED" ? "COMPLETED" : order.preOrderStatus
        })
        .where(eq(storeOrders.id, orderId));

      return shipment;
    });

    return c.json({ success: true, data: shipmentResult });
  } catch (error: any) {
    console.error("Admin shipment tracking update failed:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// PUT /api/store/admin/orders/:id/pre-order-status - Global PO Status batches update
app.put("/admin/orders/:id/pre-order-status", requireAdminOrFinance, async (c) => {
  try {
    const orderId = parseInt(c.req.param("id"));
    const { status } = await c.req.json(); // e.g. PURCHASING, SHIPPING_FROM_SAUDI

    if (isNaN(orderId) || !status) {
      return c.json({ success: false, error: "Invalid parameters" }, 400);
    }

    await db.update(storeOrders)
      .set({ preOrderStatus: status, updatedAt: new Date() })
      .where(eq(storeOrders.id, orderId));

    return c.json({ success: true, message: `Pre-order status updated to ${status}` });
  } catch (error: any) {
    console.error("Failed to update pre-order status:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// GET /api/store/admin/products - List products with categorization
app.get("/admin/products", requireAdminOrFinance, async (c) => {
  try {
    const products = await db.query.storeProducts.findMany({
      orderBy: [desc(storeProducts.createdAt)],
      with: {
        images: true,
        category: true
      }
    });

    return c.json({ success: true, data: products });
  } catch (error: any) {
    console.error("Failed to fetch products for admin:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// POST /api/store/admin/products - CRUD Create product
app.post("/admin/products", requireAdminOrFinance, async (c) => {
  try {
    const body = await c.req.json();
    const { 
      name, 
      slug, 
      description, 
      categoryId, 
      sku, 
      stock, 
      price, 
      promoPrice, 
      weight, 
      dimensions, 
      isActive,
      isPreOrder,
      preOrderOpenDate,
      preOrderCloseDate,
      estimatedArrivalDate,
      imageUrls // Array of string image URLs
    } = body;

    if (!name || !slug || !categoryId || !sku || !price) {
      return c.json({ success: false, error: "Missing required product catalog fields" }, 400);
    }

    const productResult = await db.transaction(async (tx) => {
      const [product] = await tx.insert(storeProducts).values({
        name,
        slug,
        description,
        categoryId: parseInt(categoryId),
        sku,
        stock: stock ? parseInt(stock) : 0,
        price: price.toString(),
        promoPrice: promoPrice ? promoPrice.toString() : null,
        weight: weight ? weight.toString() : "0.00",
        dimensions,
        isActive: isActive !== undefined ? isActive : true,
        isPreOrder: isPreOrder || false,
        preOrderOpenDate: preOrderOpenDate ? new Date(preOrderOpenDate) : null,
        preOrderCloseDate: preOrderCloseDate ? new Date(preOrderCloseDate) : null,
        estimatedArrivalDate: estimatedArrivalDate ? new Date(estimatedArrivalDate) : null
      }).returning();

      // Insert product images if provided
      if (imageUrls && Array.isArray(imageUrls)) {
        for (let i = 0; i < imageUrls.length; i++) {
          await tx.insert(storeProductImages).values({
            productId: product!.id,
            imageUrl: imageUrls[i],
            thumbnail: i === 0,
            sortOrder: i
          });
        }
      }

      return product;
    });

    return c.json({ success: true, data: productResult });
  } catch (error: any) {
    console.error("Failed to create product:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// PUT /api/store/admin/products/:id - CRUD Update product
app.put("/admin/products/:id", requireAdminOrFinance, async (c) => {
  try {
    const productId = parseInt(c.req.param("id"));
    const body = await c.req.json();

    if (isNaN(productId)) {
      return c.json({ success: false, error: "Invalid product ID" }, 400);
    }

    const { 
      name, 
      slug, 
      description, 
      categoryId, 
      sku, 
      stock, 
      price, 
      promoPrice, 
      weight, 
      dimensions, 
      isActive,
      isPreOrder,
      preOrderOpenDate,
      preOrderCloseDate,
      estimatedArrivalDate,
      imageUrls
    } = body;

    const product = await db.query.storeProducts.findFirst({
      where: eq(storeProducts.id, productId)
    });

    if (!product) {
      return c.json({ success: false, error: "Product not found" }, 404);
    }

    await db.transaction(async (tx) => {
      await tx.update(storeProducts)
        .set({
          name: name || product.name,
          slug: slug || product.slug,
          description: description !== undefined ? description : product.description,
          categoryId: categoryId ? parseInt(categoryId) : product.categoryId,
          sku: sku || product.sku,
          stock: stock !== undefined ? parseInt(stock) : product.stock,
          price: price ? price.toString() : product.price,
          promoPrice: promoPrice !== undefined ? (promoPrice ? promoPrice.toString() : null) : product.promoPrice,
          weight: weight ? weight.toString() : product.weight,
          dimensions: dimensions !== undefined ? dimensions : product.dimensions,
          isActive: isActive !== undefined ? isActive : product.isActive,
          isPreOrder: isPreOrder !== undefined ? isPreOrder : product.isPreOrder,
          preOrderOpenDate: preOrderOpenDate !== undefined ? (preOrderOpenDate ? new Date(preOrderOpenDate) : null) : product.preOrderOpenDate,
          preOrderCloseDate: preOrderCloseDate !== undefined ? (preOrderCloseDate ? new Date(preOrderCloseDate) : null) : product.preOrderCloseDate,
          estimatedArrivalDate: estimatedArrivalDate !== undefined ? (estimatedArrivalDate ? new Date(estimatedArrivalDate) : null) : product.estimatedArrivalDate,
          updatedAt: new Date()
        })
        .where(eq(storeProducts.id, productId));

      // Re-save image references if provided
      if (imageUrls && Array.isArray(imageUrls)) {
        await tx.delete(storeProductImages).where(eq(storeProductImages.productId, productId));
        for (let i = 0; i < imageUrls.length; i++) {
          await tx.insert(storeProductImages).values({
            productId: productId,
            imageUrl: imageUrls[i],
            thumbnail: i === 0,
            sortOrder: i
          });
        }
      }
    });

    return c.json({ success: true, message: "Product updated successfully" });
  } catch (error: any) {
    console.error("Failed to update product:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// DELETE /api/store/admin/products/:id - CRUD Delete product
app.delete("/admin/products/:id", requireAdminOrFinance, async (c) => {
  try {
    const productId = parseInt(c.req.param("id"));
    if (isNaN(productId)) {
      return c.json({ success: false, error: "Invalid product ID" }, 400);
    }

    const product = await db.query.storeProducts.findFirst({
      where: eq(storeProducts.id, productId)
    });

    if (!product) {
      return c.json({ success: false, error: "Product not found" }, 404);
    }

    await db.delete(storeProducts).where(eq(storeProducts.id, productId));

    return c.json({ success: true, message: "Product deleted successfully" });
  } catch (error: any) {
    console.error("Failed to delete product:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// POST /api/store/admin/categories - CRUD Create category
app.post("/categories", requireAdminOrFinance, async (c) => {
  try {
    const { name, slug, description, isActive } = await c.req.json();

    if (!name || !slug) {
      return c.json({ success: false, error: "Name and slug are required" }, 400);
    }

    const [category] = await db.insert(storeCategories).values({
      name,
      slug,
      description,
      isActive: isActive !== undefined ? isActive : true
    }).returning();

    return c.json({ success: true, data: category });
  } catch (error: any) {
    console.error("Failed to create store category:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// PUT /api/store/admin/categories/:id - CRUD Update category
app.put("/categories/:id", requireAdminOrFinance, async (c) => {
  try {
    const catId = parseInt(c.req.param("id"));
    const { name, slug, description, isActive } = await c.req.json();

    if (isNaN(catId)) {
      return c.json({ success: false, error: "Invalid category ID" }, 400);
    }

    const [updatedCat] = await db.update(storeCategories)
      .set({
        name,
        slug,
        description,
        isActive,
        updatedAt: new Date()
      })
      .where(eq(storeCategories.id, catId))
      .returning();

    return c.json({ success: true, data: updatedCat });
  } catch (error: any) {
    console.error("Failed to update category:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

// DELETE /api/store/admin/categories/:id - CRUD Delete category
app.delete("/categories/:id", requireAdminOrFinance, async (c) => {
  try {
    const catId = parseInt(c.req.param("id"));

    if (isNaN(catId)) {
      return c.json({ success: false, error: "Invalid category ID" }, 400);
    }

    await db.delete(storeCategories).where(eq(storeCategories.id, catId));
    return c.json({ success: true, message: "Category deleted successfully" });
  } catch (error: any) {
    console.error("Failed to delete category:", error);
    return c.json({ success: false, error: error.message }, 500);
  }
});

export default app;
