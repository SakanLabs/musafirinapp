import { Hono } from "hono";
import { db } from "../db";
import { 
  customLaRequests, 
  customLaInvoices, 
  customLaInvoicePayments, 
  customLaReceipts 
} from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { generateCustomLaInvoicePDF, generateCustomLaReceiptPDF } from "../utils/pdf";

const app = new Hono();

app.use("/*", requireAdmin);

// Utility to generate Invoice Code
const generateInvoiceCode = () => `LA-INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
const generateReceiptCode = () => `LA-KWT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

// Get Billing for a Custom LA
app.get("/:id", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const invoices = await db.query.customLaInvoices.findMany({
      where: eq(customLaInvoices.customLaRequestId, id),
      orderBy: [desc(customLaInvoices.createdAt)]
    });
    
    // Fetch payments and receipts for these invoices
    const billingData = await Promise.all(invoices.map(async (inv) => {
      const payments = await db.query.customLaInvoicePayments.findMany({
        where: eq(customLaInvoicePayments.invoiceId, inv.id)
      });
      const receipts = await db.query.customLaReceipts.findMany({
        where: eq(customLaReceipts.invoiceId, inv.id)
      });
      return { ...inv, payments, receipts };
    }));

    return c.json({ success: true, data: billingData });
  } catch (error) {
    console.error("Failed to fetch LA billing:", error);
    return c.json({ success: false, error: "Failed to fetch LA billing" }, 500);
  }
});

// Generate/Create Invoice
app.post("/:id/invoice", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const { dueDate } = await c.req.json();
    
    const requestRows = await db.query.customLaRequests.findMany({
      where: eq(customLaRequests.id, id)
    });
    
    const request = requestRows[0];
    if (!request) return c.json({ success: false, error: "Request not found" }, 404);
    
    // Check if invoice already exists
    const existingInvoices = await db.query.customLaInvoices.findMany({
      where: eq(customLaInvoices.customLaRequestId, id)
    });
    
    let invoice = existingInvoices[0];
    if (!invoice) {
      const inserted = await db.insert(customLaInvoices).values({
        number: generateInvoiceCode(),
        customLaRequestId: id,
        amount: String(request.totalAmountSAR),
        currency: "SAR",
        issueDate: new Date(),
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // default 7 days
        status: "draft"
      }).returning();
      invoice = inserted[0]!;
    } else {
      const updateData: any = { amount: String(request.totalAmountSAR) };
      if (dueDate) updateData.dueDate = new Date(dueDate);
      const updated = await db.update(customLaInvoices)
        .set(updateData)
        .where(eq(customLaInvoices.id, invoice.id))
        .returning();
      invoice = updated[0]!;
    }

    // Prepare PDF Data
    const meta: any = request.meta || {};
    const totals: any = meta.totals || {};
    const rooms: any = meta.rooms || {};
    const handling: any = meta.handlingDetails || {};

    const formatRooms = (r: any) => {
      if (!r) return "";
      let parts = [];
      if (r.nights) parts.push(`${r.nights} Malam`);
      let roomTypes = [];
      if (r.doubleQty) roomTypes.push(`${r.doubleQty} Double`);
      if (r.tripleQty) roomTypes.push(`${r.tripleQty} Triple`);
      if (r.quadQty) roomTypes.push(`${r.quadQty} Quad`);
      if (r.quintQty) roomTypes.push(`${r.quintQty} Quint`);
      if (roomTypes.length > 0) parts.push(`(${roomTypes.join(', ')})`);
      return parts.join(' ');
    };

    const makkahHotelName = rooms.makkah?.name || "Makkah Hotel";
    const makkahDetails = formatRooms(rooms.makkah);
    const makkahStr = makkahDetails ? `${makkahHotelName} - ${makkahDetails}` : makkahHotelName;

    const madinahHotelName = rooms.madinah?.name || "Madinah Hotel";
    const madinahDetails = formatRooms(rooms.madinah);
    const madinahStr = madinahDetails ? `${madinahHotelName} - ${madinahDetails}` : madinahHotelName;

    const handlingItems = [];
    if (handling.muthowif) handlingItems.push('Muthowif');
    if (handling.muthowifahRaudhah) handlingItems.push('Muthowifah Raudhah');
    if (handling.tipDriver) handlingItems.push('Tip Driver');
    if (handling.keretaCepat) handlingItems.push('Kereta Cepat');
    if (handling.tiketMuseum) handlingItems.push('Tiket Museum/Ziarah');
    if (handling.handlingHotel) handlingItems.push('Handling Hotel');
    if (handling.handlingAirport) handlingItems.push('Handling Airport');
    const handlingStr = handlingItems.length > 0 ? handlingItems.join(', ') : '';

    const datesStr = (meta.tanggalKedatangan && meta.tanggalKeberangkatan) ? 
      `${new Date(meta.tanggalKedatangan).toLocaleDateString('id-ID')} s/d ${new Date(meta.tanggalKeberangkatan).toLocaleDateString('id-ID')}` : '';

    const allPayments = await db.query.customLaInvoicePayments.findMany({
      where: eq(customLaInvoicePayments.invoiceId, invoice.id)
    });
    const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const balanceDue = Math.max(0, parseFloat(invoice.amount) - totalPaid);

    const invoiceData = {
      invoiceNo: invoice.number,
      invoiceDate: invoice.issueDate.toLocaleDateString('id-ID'),
      dueDate: invoice.dueDate.toLocaleDateString('id-ID'),
      client: {
        name: request.customerName,
        email: request.customerEmail,
        phone: request.customerPhone,
        address: "-"
      },
      groupLeaderName: request.customerName,
      pax: request.totalPax,
      currency: invoice.currency,
      dates: datesStr,
      hasMakkah: (totals.makkahHotelTotal > 0 || rooms.makkah?.nights > 0),
      makkahHotel: makkahStr,
      hasMadinah: (totals.madinahHotelTotal > 0 || rooms.madinah?.nights > 0),
      madinahHotel: madinahStr,
      hasTransport: totals.totalTransport > 0,
      transportType: "Bus / Kendaraan",
      hasVisa: totals.includeVisa || totals.visaTotal > 0,
      hasHandling: handlingStr.length > 0 || totals.subTotalHandling > 0,
      handlingDetails: handlingStr || "Layanan Handling & Ziarah",
      pricePerPax: (Number(request.totalAmountSAR) / Number(request.totalPax)).toFixed(2),
      subtotal: parseFloat(invoice.amount).toFixed(2),
      grandTotal: parseFloat(invoice.amount).toFixed(2),
      paidAmount: totalPaid.toFixed(2),
      balanceDue: balanceDue.toFixed(2)
    };

    const pdfUrl = await generateCustomLaInvoicePDF(invoiceData);
    
    const updated = await db.update(customLaInvoices)
      .set({ pdfUrl, status: invoice.status === 'draft' ? 'sent' : invoice.status as any })
      .where(eq(customLaInvoices.id, invoice.id))
      .returning();

    return c.json({ success: true, data: updated[0] });
  } catch (error) {
    console.error("Failed to generate invoice:", error);
    return c.json({ success: false, error: "Failed to generate invoice" }, 500);
  }
});

// Record Payment
app.post("/:id/payment", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const { invoiceId, amount, paymentMethod, paymentDate, notes, currency } = await c.req.json();
    
    if (!invoiceId) {
      return c.json({ success: false, error: "invoiceId is required" }, 400);
    }

    const invoices = await db.query.customLaInvoices.findMany({
      where: eq(customLaInvoices.id, invoiceId)
    });
    const invoice = invoices[0];
    if (!invoice) return c.json({ success: false, error: "Invoice not found" }, 404);
    
    if (invoice.customLaRequestId !== id) {
      return c.json({ success: false, error: "Invoice does not belong to this request" }, 400);
    }
    
    const payment = await db.insert(customLaInvoicePayments).values({
      invoiceId: invoice.id,
      amount: String(amount),
      currency: currency || "SAR",
      paymentMethod,
      paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
      notes
    }).returning();
    
    // Update invoice status if fully paid
    const allPayments = await db.query.customLaInvoicePayments.findMany({
      where: eq(customLaInvoicePayments.invoiceId, invoice.id)
    });
    
    const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const invoiceTotal = parseFloat(invoice.amount);
    
    if (totalPaid >= invoiceTotal) {
      await db.update(customLaInvoices).set({ status: 'paid' }).where(eq(customLaInvoices.id, invoice.id));
    } else if (totalPaid > 0) {
      await db.update(customLaInvoices).set({ status: 'partially_paid' }).where(eq(customLaInvoices.id, invoice.id));
    } else {
      await db.update(customLaInvoices).set({ status: 'sent' }).where(eq(customLaInvoices.id, invoice.id));
    }

    return c.json({ success: true, data: payment[0]! });
  } catch (error) {
    console.error("Failed to record payment:", error);
    return c.json({ success: false, error: "Failed to record payment" }, 500);
  }
});

// Generate Receipt for a Payment
app.post("/:id/receipt/:paymentId", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const paymentId = parseInt(c.req.param("paymentId"));
    
    const requestRows = await db.query.customLaRequests.findMany({
      where: eq(customLaRequests.id, id)
    });
    const request = requestRows[0];
    if (!request) return c.json({ success: false, error: "Request not found" }, 404);
    
    const payments = await db.query.customLaInvoicePayments.findMany({
      where: eq(customLaInvoicePayments.id, paymentId)
    });
    const payment = payments[0];
    if (!payment) return c.json({ success: false, error: "Payment not found" }, 404);
    
    const invoice = await db.query.customLaInvoices.findFirst({
      where: eq(customLaInvoices.id, payment.invoiceId)
    });
    if (!invoice) return c.json({ success: false, error: "Invoice not found" }, 404);
    
    // Check total paid so far
    const allPayments = await db.query.customLaInvoicePayments.findMany({
      where: eq(customLaInvoicePayments.invoiceId, invoice.id)
    });
    const totalPaidAmount = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const balanceDue = Math.max(0, parseFloat(invoice.amount) - totalPaidAmount);
    
    const receiptCode = generateReceiptCode();
    
    const receiptData = {
      receiptNo: receiptCode,
      receiptDate: new Date().toLocaleDateString('id-ID'),
      isFullyPaid: balanceDue <= 0,
      payer: {
        name: request.customerName,
        email: request.customerEmail,
        phone: request.customerPhone,
      },
      invoiceNo: invoice.number,
      groupLeaderName: request.customerName,
      pax: request.totalPax,
      paymentMethod: payment.paymentMethod,
      currency: payment.currency,
      paidAmount: payment.amount,
      totals: {
        invoiceAmount: invoice.amount,
        totalPaidAmount: totalPaidAmount.toFixed(2),
        balanceDue: balanceDue.toFixed(2)
      },
      notes: payment.notes
    };
    
    const pdfUrl = await generateCustomLaReceiptPDF(receiptData);
    
    const receipt = await db.insert(customLaReceipts).values({
      number: receiptCode,
      customLaRequestId: id,
      invoiceId: invoice.id,
      paymentId: payment.id,
      totalAmount: invoice.amount,
      paidAmount: payment.amount,
      balanceDue: String(balanceDue),
      currency: "SAR",
      payerName: request.customerName,
      paymentMethod: payment.paymentMethod,
      pdfUrl
    }).returning();
    
    return c.json({ success: true, data: receipt[0]! });
  } catch (error) {
    console.error("Failed to generate receipt:", error);
    return c.json({ success: false, error: "Failed to generate receipt" }, 500);
  }
});

export default app;
