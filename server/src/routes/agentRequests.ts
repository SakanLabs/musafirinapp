import { Hono } from "hono";
import { db } from "../db";
import * as schema from "../db/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { requireAuth, requireAgent, requireAdmin } from "../middleware/auth";
import { generateAgentRequestInvoicePDF, uploadToMinio } from "../utils/pdf";
import fs from "fs";
import { notifyAdminNewBooking } from "../lib/notification";

const app = new Hono<{ Variables: { user: any; session: any; userRole?: string; userType?: string } }>();

// ============================================================
// Helper: Generate request number
// ============================================================
const generateRequestNumber = () => {
  const year = new Date().getFullYear();
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `AR-${year}-${rand}`;
};

// Helper: Add timeline entry
async function addTimelineEntry(
  requestId: number,
  eventType: string,
  title: string,
  description: string | null,
  actorId: string,
  actorRole: 'agent' | 'admin',
  meta?: any,
) {
  await db.insert(schema.agentRequestTimeline).values({
    requestId,
    eventType,
    title,
    description,
    actorId,
    actorRole,
    meta: meta || null,
  });
}

// Helper: Create notification
async function createNotification(
  userId: string,
  requestId: number | null,
  title: string,
  message: string,
  type: string,
  meta?: any,
) {
  await db.insert(schema.agentNotifications).values({
    userId,
    requestId,
    title,
    message,
    type,
    meta: meta || null,
  });
}

// ============================================================
// AGENT ENDPOINTS — Isolated by agentId
// ============================================================

// GET /api/agent-requests/stats — Dashboard stats
app.get("/stats", requireAgent, async (c) => {
  try {
    const user = c.get("user") as any;

    const [totalResult] = await db
      .select({ count: count() })
      .from(schema.agentRequests)
      .where(eq(schema.agentRequests.agentId, user.id));

    const [processingResult] = await db
      .select({ count: count() })
      .from(schema.agentRequests)
      .where(
        and(
          eq(schema.agentRequests.agentId, user.id),
          sql`${schema.agentRequests.status} IN ('submitted', 'in_review', 'need_more_info')`
        )
      );

    const [quotedResult] = await db
      .select({ count: count() })
      .from(schema.agentRequests)
      .where(
        and(
          eq(schema.agentRequests.agentId, user.id),
          sql`${schema.agentRequests.status} IN ('quoted', 'quote_revision_requested')`
        )
      );

    const [paymentResult] = await db
      .select({ count: count() })
      .from(schema.agentRequests)
      .where(
        and(
          eq(schema.agentRequests.agentId, user.id),
          sql`${schema.agentRequests.status} IN ('quote_accepted', 'invoiced', 'payment_uploaded')`
        )
      );

    const [completedResult] = await db
      .select({ count: count() })
      .from(schema.agentRequests)
      .where(
        and(
          eq(schema.agentRequests.agentId, user.id),
          sql`${schema.agentRequests.status} IN ('completed', 'voucher_issued')`
        )
      );

    return c.json({
      success: true,
      data: {
        total: totalResult?.count || 0,
        processing: processingResult?.count || 0,
        quoted: quotedResult?.count || 0,
        payment: paymentResult?.count || 0,
        completed: completedResult?.count || 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch agent request stats:", error);
    return c.json({ success: false, error: "Failed to fetch stats" }, 500);
  }
});

// GET /api/agent-requests — List agent's own requests
app.get("/", requireAgent, async (c) => {
  try {
    const user = c.get("user") as any;
    const status = c.req.query("status");
    const serviceType = c.req.query("serviceType");

    let conditions = [eq(schema.agentRequests.agentId, user.id)];
    if (status) {
      conditions.push(eq(schema.agentRequests.status, status as any));
    }
    if (serviceType) {
      conditions.push(eq(schema.agentRequests.serviceType, serviceType as any));
    }

    const requests = await db
      .select()
      .from(schema.agentRequests)
      .where(and(...conditions))
      .orderBy(desc(schema.agentRequests.createdAt));

    return c.json({ success: true, data: requests });
  } catch (error) {
    console.error("Failed to fetch agent requests:", error);
    return c.json({ success: false, error: "Failed to fetch requests" }, 500);
  }
});

// GET /api/agent-requests/:id — Get single request detail (agent only sees own)
app.get("/:id", requireAgent, async (c) => {
  try {
    const user = c.get("user") as any;
    const id = parseInt(c.req.param("id"));

    const request = await db
      .select()
      .from(schema.agentRequests)
      .where(
        and(
          eq(schema.agentRequests.id, id),
          eq(schema.agentRequests.agentId, user.id)
        )
      )
      .limit(1);

    if (!request[0]) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }

    // Fetch timeline
    const timeline = await db
      .select()
      .from(schema.agentRequestTimeline)
      .where(eq(schema.agentRequestTimeline.requestId, id))
      .orderBy(desc(schema.agentRequestTimeline.createdAt));

    return c.json({
      success: true,
      data: {
        ...request[0],
        timeline,
      },
    });
  } catch (error) {
    console.error("Failed to fetch agent request:", error);
    return c.json({ success: false, error: "Failed to fetch request" }, 500);
  }
});

// POST /api/agent-requests — Create new request
app.post("/", requireAgent, async (c) => {
  try {
    const user = c.get("user") as any;
    const body = await c.req.json();

    const requestNumber = generateRequestNumber();

    const [newRequest] = await db
      .insert(schema.agentRequests)
      .values({
        requestNumber,
        agentId: user.id,
        serviceType: body.serviceType,
        status: body.submitNow ? "submitted" : "draft",
        title: body.title,
        description: body.description || null,
        meta: body.meta || null,
        currency: body.currency || "SAR",
      })
      .returning();

    // Add timeline entry
    await addTimelineEntry(
      newRequest!.id,
      "created",
      "Request dibuat",
      `Request ${requestNumber} untuk layanan ${body.serviceType} telah dibuat`,
      user.id,
      "agent"
    );

    if (body.submitNow) {
      await addTimelineEntry(
        newRequest!.id,
        "status_change",
        "Request disubmit",
        "Request telah dikirim ke admin untuk diproses",
        user.id,
        "agent",
        { oldStatus: "draft", newStatus: "submitted" }
      );

      notifyAdminNewBooking({
        type: 'agent_request',
        bookingCode: requestNumber,
        customerName: user.name || user.email,
        customerEmail: user.email,
        title: `Permintaan Agen - ${body.title || body.serviceType}`,
        details: {
          'Layanan': body.serviceType,
          'Judul': body.title,
          'Agen': user.name || user.email,
          'Keterangan': body.description || '-',
        },
        currency: body.currency || 'SAR',
        source: 'Portal Agen B2B',
        dashboardPath: `/agent-requests`,
      }).catch((err) => console.error('Notification error in agentRequests POST /:', err));
    }

    return c.json({ success: true, data: newRequest });
  } catch (error) {
    console.error("Failed to create agent request:", error);
    return c.json({ success: false, error: "Failed to create request" }, 500);
  }
});

// PUT /api/agent-requests/:id — Update draft/need_more_info request
app.put("/:id", requireAgent, async (c) => {
  try {
    const user = c.get("user") as any;
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();

    // Verify ownership and editable status
    const existing = await db
      .select()
      .from(schema.agentRequests)
      .where(
        and(
          eq(schema.agentRequests.id, id),
          eq(schema.agentRequests.agentId, user.id)
        )
      )
      .limit(1);

    if (!existing[0]) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }

    if (!["draft", "need_more_info"].includes(existing[0].status)) {
      return c.json({ success: false, error: "Request cannot be edited in current status" }, 400);
    }

    const updateData: any = { updatedAt: new Date() };
    if (body.title) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.meta) updateData.meta = body.meta;
    if (body.serviceType) updateData.serviceType = body.serviceType;

    const [updated] = await db
      .update(schema.agentRequests)
      .set(updateData)
      .where(eq(schema.agentRequests.id, id))
      .returning();

    await addTimelineEntry(
      id,
      "updated",
      "Request diperbarui",
      "Agent memperbarui detail request",
      user.id,
      "agent"
    );

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update agent request:", error);
    return c.json({ success: false, error: "Failed to update request" }, 500);
  }
});

// POST /api/agent-requests/:id/submit — Submit draft to admin
app.post("/:id/submit", requireAgent, async (c) => {
  try {
    const user = c.get("user") as any;
    const id = parseInt(c.req.param("id"));

    const existing = await db
      .select()
      .from(schema.agentRequests)
      .where(
        and(
          eq(schema.agentRequests.id, id),
          eq(schema.agentRequests.agentId, user.id)
        )
      )
      .limit(1);

    if (!existing[0]) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }

    if (!["draft", "need_more_info"].includes(existing[0].status)) {
      return c.json({ success: false, error: "Only draft or need_more_info requests can be submitted" }, 400);
    }

    const [updated] = await db
      .update(schema.agentRequests)
      .set({ status: "submitted", updatedAt: new Date() })
      .where(eq(schema.agentRequests.id, id))
      .returning();

    await addTimelineEntry(
      id,
      "status_change",
      "Request disubmit",
      "Request telah dikirim ke admin untuk diproses",
      user.id,
      "agent",
      { oldStatus: existing[0].status, newStatus: "submitted" }
    );

    // Notify all admins about new request
    const admins = await db
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(sql`${schema.user.role} IN ('admin', 'owner')`);

    for (const admin of admins) {
      await createNotification(
        admin.id,
        id,
        "Request Baru dari Agent",
        `Request ${existing[0].requestNumber} (${existing[0].serviceType}) telah disubmit`,
        "status_change"
      );
    }

    // Notify admin via WhatsApp & Email
    notifyAdminNewBooking({
      type: 'agent_request',
      bookingCode: updated!.requestNumber,
      customerName: user.name || user.email,
      customerEmail: user.email,
      title: `Permintaan Agen Disubmit - ${updated!.title || updated!.serviceType}`,
      details: {
        'Layanan': updated!.serviceType,
        'Judul': updated!.title,
        'Agen': user.name || user.email,
      },
      currency: updated!.currency || 'SAR',
      source: 'Portal Agen B2B',
      dashboardPath: `/agent-requests`,
    }).catch((err) => console.error('Notification error in agentRequests POST /:id/submit:', err));

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to submit agent request:", error);
    return c.json({ success: false, error: "Failed to submit request" }, 500);
  }
});

// POST /api/agent-requests/:id/accept-quotation — Accept quotation
app.post("/:id/accept-quotation", requireAgent, async (c) => {
  try {
    const user = c.get("user") as any;
    const id = parseInt(c.req.param("id"));

    const existing = await db
      .select()
      .from(schema.agentRequests)
      .where(
        and(
          eq(schema.agentRequests.id, id),
          eq(schema.agentRequests.agentId, user.id)
        )
      )
      .limit(1);

    if (!existing[0]) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }

    if (existing[0].status !== "quoted") {
      return c.json({ success: false, error: "Only quoted requests can be accepted" }, 400);
    }

    const [updated] = await db
      .update(schema.agentRequests)
      .set({ status: "quote_accepted", updatedAt: new Date() })
      .where(eq(schema.agentRequests.id, id))
      .returning();

    await addTimelineEntry(
      id,
      "status_change",
      "Penawaran diterima",
      "Agent menyetujui penawaran",
      user.id,
      "agent",
      { oldStatus: "quoted", newStatus: "quote_accepted" }
    );

    // Notify assigned admin or all admins
    const notifyId = existing[0].assignedAdminId;
    if (notifyId) {
      await createNotification(notifyId, id, "Penawaran Diterima", `Agent menyetujui penawaran untuk request ${existing[0].requestNumber}`, "quotation");
    }

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to accept quotation:", error);
    return c.json({ success: false, error: "Failed to accept quotation" }, 500);
  }
});

// POST /api/agent-requests/:id/reject-quotation — Reject quotation
app.post("/:id/reject-quotation", requireAgent, async (c) => {
  try {
    const user = c.get("user") as any;
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();

    const existing = await db
      .select()
      .from(schema.agentRequests)
      .where(
        and(
          eq(schema.agentRequests.id, id),
          eq(schema.agentRequests.agentId, user.id)
        )
      )
      .limit(1);

    if (!existing[0]) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }

    if (existing[0].status !== "quoted") {
      return c.json({ success: false, error: "Only quoted requests can be rejected" }, 400);
    }

    const [updated] = await db
      .update(schema.agentRequests)
      .set({
        status: "cancelled",
        agentQuotationResponse: body.reason || "Ditolak oleh agent",
        updatedAt: new Date(),
      })
      .where(eq(schema.agentRequests.id, id))
      .returning();

    await addTimelineEntry(
      id,
      "status_change",
      "Penawaran ditolak",
      body.reason || "Agent menolak penawaran",
      user.id,
      "agent",
      { oldStatus: "quoted", newStatus: "cancelled" }
    );

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to reject quotation:", error);
    return c.json({ success: false, error: "Failed to reject quotation" }, 500);
  }
});

// POST /api/agent-requests/:id/request-revision — Request quotation revision
app.post("/:id/request-revision", requireAgent, async (c) => {
  try {
    const user = c.get("user") as any;
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();

    const existing = await db
      .select()
      .from(schema.agentRequests)
      .where(
        and(
          eq(schema.agentRequests.id, id),
          eq(schema.agentRequests.agentId, user.id)
        )
      )
      .limit(1);

    if (!existing[0]) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }

    if (existing[0].status !== "quoted") {
      return c.json({ success: false, error: "Only quoted requests can request revision" }, 400);
    }

    const [updated] = await db
      .update(schema.agentRequests)
      .set({
        status: "quote_revision_requested",
        agentQuotationResponse: body.notes || "Minta revisi penawaran",
        updatedAt: new Date(),
      })
      .where(eq(schema.agentRequests.id, id))
      .returning();

    await addTimelineEntry(
      id,
      "status_change",
      "Minta revisi penawaran",
      body.notes || "Agent meminta revisi penawaran",
      user.id,
      "agent",
      { oldStatus: "quoted", newStatus: "quote_revision_requested" }
    );

    // Notify admin
    if (existing[0].assignedAdminId) {
      await createNotification(existing[0].assignedAdminId, id, "Revisi Penawaran Diminta", `Agent meminta revisi penawaran untuk request ${existing[0].requestNumber}`, "quotation");
    }

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to request revision:", error);
    return c.json({ success: false, error: "Failed to request revision" }, 500);
  }
});

// POST /api/agent-requests/:id/upload-payment — Upload payment proof
app.post("/:id/upload-payment", requireAgent, async (c) => {
  try {
    const user = c.get("user") as any;
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();

    const existing = await db
      .select()
      .from(schema.agentRequests)
      .where(
        and(
          eq(schema.agentRequests.id, id),
          eq(schema.agentRequests.agentId, user.id)
        )
      )
      .limit(1);

    if (!existing[0]) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }

    if (existing[0].status !== "invoiced") {
      return c.json({ success: false, error: "Payment can only be uploaded for invoiced requests" }, 400);
    }

    const [updated] = await db
      .update(schema.agentRequests)
      .set({
        status: "payment_uploaded",
        paymentProofUrl: body.paymentProofUrl,
        paymentProofUploadedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.agentRequests.id, id))
      .returning();

    await addTimelineEntry(
      id,
      "payment_uploaded",
      "Bukti pembayaran diupload",
      "Agent mengupload bukti pembayaran",
      user.id,
      "agent",
      { paymentProofUrl: body.paymentProofUrl }
    );

    // Notify admin
    if (existing[0].assignedAdminId) {
      await createNotification(existing[0].assignedAdminId, id, "Bukti Pembayaran Diupload", `Agent mengupload bukti pembayaran untuk request ${existing[0].requestNumber}`, "payment");
    }

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to upload payment proof:", error);
    return c.json({ success: false, error: "Failed to upload payment" }, 500);
  }
});

// ============================================================
// ADMIN ENDPOINTS — Can see all agent requests
// ============================================================

// GET /api/agent-requests/admin/all — List all requests from all agents
app.get("/admin/all", requireAdmin, async (c) => {
  try {
    const status = c.req.query("status");
    const serviceType = c.req.query("serviceType");
    const agentId = c.req.query("agentId");

    let conditions: any[] = [];
    if (status) {
      conditions.push(eq(schema.agentRequests.status, status as any));
    }
    if (serviceType) {
      conditions.push(eq(schema.agentRequests.serviceType, serviceType as any));
    }
    if (agentId) {
      conditions.push(eq(schema.agentRequests.agentId, agentId));
    }

    const requests = await db
      .select({
        request: schema.agentRequests,
        agentName: schema.user.name,
        agentEmail: schema.user.email,
      })
      .from(schema.agentRequests)
      .leftJoin(schema.user, eq(schema.agentRequests.agentId, schema.user.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.agentRequests.createdAt));

    // Flatten result
    const data = requests.map((r) => ({
      ...r.request,
      agentName: r.agentName,
      agentEmail: r.agentEmail,
    }));

    return c.json({ success: true, data });
  } catch (error) {
    console.error("Failed to fetch all agent requests:", error);
    return c.json({ success: false, error: "Failed to fetch requests" }, 500);
  }
});

// GET /api/agent-requests/admin/stats — Admin dashboard stats
app.get("/admin/stats", requireAdmin, async (c) => {
  try {
    const [totalResult] = await db.select({ count: count() }).from(schema.agentRequests);

    const [pendingResult] = await db
      .select({ count: count() })
      .from(schema.agentRequests)
      .where(sql`${schema.agentRequests.status} IN ('submitted', 'need_more_info')`);

    const [inReviewResult] = await db
      .select({ count: count() })
      .from(schema.agentRequests)
      .where(eq(schema.agentRequests.status, "in_review"));

    const [paymentPendingResult] = await db
      .select({ count: count() })
      .from(schema.agentRequests)
      .where(sql`${schema.agentRequests.status} IN ('payment_uploaded')`);

    return c.json({
      success: true,
      data: {
        total: totalResult?.count || 0,
        pending: pendingResult?.count || 0,
        inReview: inReviewResult?.count || 0,
        paymentPending: paymentPendingResult?.count || 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch admin stats:", error);
    return c.json({ success: false, error: "Failed to fetch stats" }, 500);
  }
});

// GET /api/agent-requests/admin/:id — Admin get single request detail
app.get("/admin/:id", requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param("id"));

    const request = await db
      .select({
        request: schema.agentRequests,
        agentName: schema.user.name,
        agentEmail: schema.user.email,
      })
      .from(schema.agentRequests)
      .leftJoin(schema.user, eq(schema.agentRequests.agentId, schema.user.id))
      .where(eq(schema.agentRequests.id, id))
      .limit(1);

    if (!request[0]) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }

    // Fetch timeline
    const timeline = await db
      .select()
      .from(schema.agentRequestTimeline)
      .where(eq(schema.agentRequestTimeline.requestId, id))
      .orderBy(desc(schema.agentRequestTimeline.createdAt));

    // Fetch company profile
    const companyProfile = await db
      .select()
      .from(schema.agentCompanyProfiles)
      .where(eq(schema.agentCompanyProfiles.userId, request[0].request.agentId))
      .limit(1);

    return c.json({
      success: true,
      data: {
        ...request[0].request,
        agentName: request[0].agentName,
        agentEmail: request[0].agentEmail,
        companyProfile: companyProfile[0] || null,
        timeline,
      },
    });
  } catch (error) {
    console.error("Failed to fetch admin request detail:", error);
    return c.json({ success: false, error: "Failed to fetch request" }, 500);
  }
});

// PATCH /api/agent-requests/admin/:id/status — Admin update status
app.patch("/admin/:id/status", requireAdmin, async (c) => {
  try {
    const adminUser = c.get("user") as any;
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();

    const existing = await db
      .select()
      .from(schema.agentRequests)
      .where(eq(schema.agentRequests.id, id))
      .limit(1);

    if (!existing[0]) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }

    const updateData: any = {
      status: body.status,
      updatedAt: new Date(),
    };
    if (body.notes) updateData.quotationNotes = body.notes;

    const [updated] = await db
      .update(schema.agentRequests)
      .set(updateData)
      .where(eq(schema.agentRequests.id, id))
      .returning();

    await addTimelineEntry(
      id,
      "status_change",
      `Status diubah ke ${body.status}`,
      body.notes || null,
      adminUser.id,
      "admin",
      { oldStatus: existing[0].status, newStatus: body.status }
    );

    // Notify the agent
    await createNotification(
      existing[0].agentId,
      id,
      "Status Request Diperbarui",
      `Request ${existing[0].requestNumber} diperbarui ke status: ${body.status}`,
      "status_change"
    );

    // Invoice logic
    if (body.status === "invoiced") {
      const existingInvoice = await db
        .select()
        .from(schema.agentRequestInvoices)
        .where(eq(schema.agentRequestInvoices.agentRequestId, id))
        .limit(1);

      if (!existingInvoice[0]) {
        const invoiceNumber = `INV-AR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
        
        // Fetch agent company profile for invoice details
        const profile = await db
          .select()
          .from(schema.agentCompanyProfiles)
          .where(eq(schema.agentCompanyProfiles.userId, existing[0].agentId))
          .limit(1);

        const agentName = profile[0]?.companyName || existing[0].agentId;

        const invoiceData = {
          invoiceNo: invoiceNumber,
          date: new Date().toLocaleDateString("id-ID"),
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("id-ID"),
          agentName: agentName,
          totalAmount: existing[0].totalAmount || 0,
          description: existing[0].title,
        };

        try {
          const tempPdfPath = await generateAgentRequestInvoicePDF(invoiceData, existing[0]);
          const fileBuffer = fs.readFileSync(tempPdfPath);
          const minioPath = `agent-request-invoices/${invoiceNumber}.pdf`;
          
          await uploadToMinio(minioPath, fileBuffer, "application/pdf");
          const minioBaseUrl = process.env.MINIO_BASE_URL || "http://localhost:9000";
          const minioBucket = process.env.MINIO_BUCKET || "hotel-booking";
          const pdfUrl = `${minioBaseUrl}/${minioBucket}/${minioPath}`;

          await db.insert(schema.agentRequestInvoices).values({
            number: invoiceNumber,
            agentRequestId: id,
            amount: existing[0].totalAmount ? existing[0].totalAmount.toString() : "0",
            currency: existing[0].currency || "SAR",
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            status: "sent",
            pdfUrl: pdfUrl,
          });
          
          fs.unlinkSync(tempPdfPath); // cleanup
        } catch (err) {
          console.error("Failed to generate invoice:", err);
          // Don't fail the status update if PDF generation fails, just log it
        }
      }
    }

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to update status:", error);
    return c.json({ success: false, error: "Failed to update status" }, 500);
  }
});

// POST /api/agent-requests/admin/:id/assign — Assign request to admin
app.post("/admin/:id/assign", requireAdmin, async (c) => {
  try {
    const adminUser = c.get("user") as any;
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();

    const assignTo = body.adminId || adminUser.id;

    const [updated] = await db
      .update(schema.agentRequests)
      .set({
        assignedAdminId: assignTo,
        status: "in_review",
        updatedAt: new Date(),
      })
      .where(eq(schema.agentRequests.id, id))
      .returning();

    if (!updated) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }

    await addTimelineEntry(
      id,
      "assigned",
      "Request di-assign ke admin",
      `Request di-assign untuk diproses`,
      adminUser.id,
      "admin"
    );

    // Notify agent
    await createNotification(
      updated.agentId,
      id,
      "Request Sedang Diproses",
      `Request ${updated.requestNumber} sedang ditinjau oleh admin`,
      "status_change"
    );

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to assign request:", error);
    return c.json({ success: false, error: "Failed to assign request" }, 500);
  }
});

// POST /api/agent-requests/admin/:id/quotation — Send quotation
app.post("/admin/:id/quotation", requireAdmin, async (c) => {
  try {
    const adminUser = c.get("user") as any;
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();

    const existing = await db
      .select()
      .from(schema.agentRequests)
      .where(eq(schema.agentRequests.id, id))
      .limit(1);

    if (!existing[0]) {
      return c.json({ success: false, error: "Request not found" }, 404);
    }

    const [updated] = await db
      .update(schema.agentRequests)
      .set({
        status: "quoted",
        quotationData: body.quotationData,
        quotationNotes: body.notes || null,
        totalAmount: body.totalAmount?.toString() || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.agentRequests.id, id))
      .returning();

    await addTimelineEntry(
      id,
      "quotation_sent",
      "Penawaran dikirim",
      body.notes || "Admin mengirim penawaran ke agent",
      adminUser.id,
      "admin",
      { totalAmount: body.totalAmount }
    );

    // Notify agent
    await createNotification(
      existing[0].agentId,
      id,
      "Penawaran Tersedia",
      `Penawaran untuk request ${existing[0].requestNumber} telah tersedia. Silakan review.`,
      "quotation"
    );

    return c.json({ success: true, data: updated });
  } catch (error) {
    console.error("Failed to send quotation:", error);
    return c.json({ success: false, error: "Failed to send quotation" }, 500);
  }
});

// POST /api/agent-requests/admin/:id/note — Add admin note
app.post("/admin/:id/note", requireAdmin, async (c) => {
  try {
    const adminUser = c.get("user") as any;
    const id = parseInt(c.req.param("id"));
    const body = await c.req.json();

    await addTimelineEntry(
      id,
      "note",
      body.title || "Catatan Admin",
      body.description,
      adminUser.id,
      "admin",
      body.meta || null
    );

    // Optionally notify agent
    if (body.notifyAgent) {
      const existing = await db
        .select()
        .from(schema.agentRequests)
        .where(eq(schema.agentRequests.id, id))
        .limit(1);

      if (existing[0]) {
        await createNotification(
          existing[0].agentId,
          id,
          "Pesan dari Admin",
          body.description || "Ada catatan baru dari admin",
          "info"
        );
      }
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to add note:", error);
    return c.json({ success: false, error: "Failed to add note" }, 500);
  }
});

// ============================================================
// NOTIFICATION ENDPOINTS
// ============================================================

// GET /api/agent-requests/notifications — Get user notifications
app.get("/notifications/list", requireAuth, async (c) => {
  try {
    const user = c.get("user") as any;

    const notifications = await db
      .select()
      .from(schema.agentNotifications)
      .where(eq(schema.agentNotifications.userId, user.id))
      .orderBy(desc(schema.agentNotifications.createdAt))
      .limit(50);

    const [unreadCount] = await db
      .select({ count: count() })
      .from(schema.agentNotifications)
      .where(
        and(
          eq(schema.agentNotifications.userId, user.id),
          eq(schema.agentNotifications.isRead, false)
        )
      );

    return c.json({
      success: true,
      data: {
        notifications,
        unreadCount: unreadCount?.count || 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return c.json({ success: false, error: "Failed to fetch notifications" }, 500);
  }
});

// POST /api/agent-requests/notifications/read — Mark notifications as read
app.post("/notifications/read", requireAuth, async (c) => {
  try {
    const user = c.get("user") as any;
    const body = await c.req.json();

    if (body.all) {
      await db
        .update(schema.agentNotifications)
        .set({ isRead: true })
        .where(eq(schema.agentNotifications.userId, user.id));
    } else if (body.id) {
      await db
        .update(schema.agentNotifications)
        .set({ isRead: true })
        .where(
          and(
            eq(schema.agentNotifications.id, body.id),
            eq(schema.agentNotifications.userId, user.id)
          )
        );
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Failed to mark notifications as read:", error);
    return c.json({ success: false, error: "Failed to update notifications" }, 500);
  }
});

// ============================================================
// AGENT COMPANY PROFILE ENDPOINTS
// ============================================================

// GET /api/agent-requests/profile — Get agent's company profile
app.get("/profile/me", requireAgent, async (c) => {
  try {
    const user = c.get("user") as any;

    const profile = await db
      .select()
      .from(schema.agentCompanyProfiles)
      .where(eq(schema.agentCompanyProfiles.userId, user.id))
      .limit(1);

    return c.json({ success: true, data: profile[0] || null });
  } catch (error) {
    console.error("Failed to fetch company profile:", error);
    return c.json({ success: false, error: "Failed to fetch profile" }, 500);
  }
});

// POST /api/agent-requests/profile — Create/Update company profile
app.post("/profile/save", requireAgent, async (c) => {
  try {
    const user = c.get("user") as any;
    const body = await c.req.json();

    const existing = await db
      .select()
      .from(schema.agentCompanyProfiles)
      .where(eq(schema.agentCompanyProfiles.userId, user.id))
      .limit(1);

    let result;
    if (existing[0]) {
      [result] = await db
        .update(schema.agentCompanyProfiles)
        .set({
          companyName: body.companyName,
          companyPhone: body.companyPhone || null,
          companyEmail: body.companyEmail || null,
          companyAddress: body.companyAddress || null,
          city: body.city || null,
          province: body.province || null,
          country: body.country || 'Indonesia',
          logoUrl: body.logoUrl || null,
          licenseNumber: body.licenseNumber || null,
          notes: body.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.agentCompanyProfiles.userId, user.id))
        .returning();
    } else {
      [result] = await db
        .insert(schema.agentCompanyProfiles)
        .values({
          userId: user.id,
          companyName: body.companyName,
          companyPhone: body.companyPhone || null,
          companyEmail: body.companyEmail || null,
          companyAddress: body.companyAddress || null,
          city: body.city || null,
          province: body.province || null,
          country: body.country || 'Indonesia',
          logoUrl: body.logoUrl || null,
          licenseNumber: body.licenseNumber || null,
          notes: body.notes || null,
        })
        .returning();
    }

    return c.json({ success: true, data: result });
  } catch (error) {
    console.error("Failed to save company profile:", error);
    return c.json({ success: false, error: "Failed to save profile" }, 500);
  }
});

// GET /api/agent-requests/admin/:id/invoice - Get existing invoice for agent request
app.get("/admin/:id/invoice", requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param("id"));

    const invoice = await db
      .select()
      .from(schema.agentRequestInvoices)
      .where(eq(schema.agentRequestInvoices.agentRequestId, id))
      .limit(1);

    if (invoice.length === 0) {
      return c.json({ success: true, data: null });
    }

    return c.json({ success: true, data: invoice[0] });
  } catch (error) {
    console.error('Error retrieving agent request invoice:', error);
    return c.json({ error: 'Failed to retrieve agent request invoice' }, 500);
  }
});

// GET /api/agent-requests/:id/invoice - Get existing invoice for agent request (Agent)
app.get("/:id/invoice", requireAgent, async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const agentUser = c.get("user") as any;

    // Verify ownership
    const request = await db
      .select()
      .from(schema.agentRequests)
      .where(and(eq(schema.agentRequests.id, id), eq(schema.agentRequests.agentId, agentUser.id)))
      .limit(1);
    
    if (request.length === 0) {
      return c.json({ error: 'Not found or unauthorized' }, 404);
    }

    const invoice = await db
      .select()
      .from(schema.agentRequestInvoices)
      .where(eq(schema.agentRequestInvoices.agentRequestId, id))
      .limit(1);

    if (invoice.length === 0) {
      return c.json({ success: true, data: null });
    }

    return c.json({ success: true, data: invoice[0] });
  } catch (error) {
    console.error('Error retrieving agent request invoice:', error);
    return c.json({ error: 'Failed to retrieve agent request invoice' }, 500);
  }
});

// GET /api/agent-requests/invoice/:number - Serve invoice PDF
app.get("/invoice/:number", requireAuth, async (c) => {
  try {
    const invoiceNumber = c.req.param("number");

    const invoice = await db
      .select()
      .from(schema.agentRequestInvoices)
      .where(eq(schema.agentRequestInvoices.number, invoiceNumber))
      .limit(1);

    if (invoice.length === 0) {
      return c.json({ error: 'Invoice not found' }, 404);
    }

    const invoiceData = invoice[0]!;

    if (!invoiceData.pdfUrl) {
      return c.json({ error: 'PDF not available for this invoice' }, 404);
    }

    return c.redirect(invoiceData.pdfUrl);
  } catch (error) {
    console.error('Error serving agent request invoice PDF:', error);
    return c.json({ error: 'Failed to serve invoice PDF' }, 500);
  }
});
export default app;
