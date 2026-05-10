import { Hono } from "hono";
import { db } from "../db";
import { customLaRequests, user } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";

const app = new Hono();

app.use("/*", requireAdmin);

// GET /api/custom-la
app.get("/", async (c) => {
  try {
    const requests = await db.query.customLaRequests.findMany({
      orderBy: [desc(customLaRequests.createdAt)],
      with: {
        // Assuming no relations right now, we can fetch all
      }
    });
    
    return c.json({ success: true, data: requests });
  } catch (error) {
    console.error("Failed to fetch custom LA requests:", error);
    return c.json({ success: false, error: "Failed to fetch custom LA requests" }, 500);
  }
});

const generateBookingCode = (prefix: string) => {
  return `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
};

// POST /api/custom-la
app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    
    // In admin creation, clientId might be provided. If not, we could handle it, but assume admin provides it or creates simple client.
    // For simplicity, if clientId is not provided, we will just set a default or dummy, but schema requires clientId. 
    // Let's assume admin passes clientId.
    
    const newRequest = await db.insert(customLaRequests).values({
      number: generateBookingCode("CLA"),
      clientId: body.clientId,
      customerName: body.customerName,
      customerPhone: body.customerPhone,
      customerEmail: body.customerEmail,
      travelName: body.travelName,
      status: "pending",
      totalAmountSAR: body.totalAmountSAR,
      totalPax: body.totalPax,
      meta: body.meta || {}, 
    }).returning();
    
    return c.json({ success: true, data: newRequest[0] });
  } catch (error) {
    console.error("Failed to create custom LA request:", error);
    return c.json({ success: false, error: "Failed to create custom LA request" }, 500);
  }
});

// GET /api/custom-la/:id
app.get("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const request = await db.query.customLaRequests.findFirst({
      where: eq(customLaRequests.id, id)
    });
    
    if (!request) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }
    
    return c.json({ success: true, data: request });
  } catch (error) {
    console.error("Failed to fetch custom LA request:", error);
    return c.json({ success: false, error: "Failed to fetch custom LA request" }, 500);
  }
});

// PUT /api/custom-la/:id/status
app.put("/:id/status", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const { status } = await c.req.json();
    
    const updated = await db.update(customLaRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(customLaRequests.id, id))
      .returning();
      
    if (updated.length === 0) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }
    
    return c.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error("Failed to update status:", error);
    return c.json({ success: false, error: "Failed to update status" }, 500);
  }
});

export default app;
