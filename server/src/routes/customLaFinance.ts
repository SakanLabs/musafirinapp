import { Hono } from "hono";
import { db } from "../db";
import {
  customLaRequests,
  customLaExpenses,
  customLaInvoices,
  customLaInvoicePayments,
} from "../db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireFinance } from "../middleware/auth";
import type { NewCustomLaExpense } from "../db/schema";

const app = new Hono();

app.use("/*", requireFinance);

// ===== FINANCE SUMMARY =====

/**
 * GET /custom-la-finance/:id/summary
 * Get full financial summary for a Custom LA request:
 * - Total income (payments received from client)
 * - Total expenses (payments made to suppliers), broken down by category
 * - Net profit/loss
 */
app.get("/:id/summary", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    if (!id || isNaN(id)) {
      return c.json({ error: "Invalid Custom LA ID" }, 400);
    }

    // Get the Custom LA request
    const request = await db.query.customLaRequests.findFirst({
      where: eq(customLaRequests.id, id),
    });
    if (!request) {
      return c.json({ error: "Custom LA request not found" }, 404);
    }

    // Get all invoices for this LA
    const invoices = await db.query.customLaInvoices.findMany({
      where: eq(customLaInvoices.customLaRequestId, id),
    });

    // Get all payments across all invoices
    let totalIncome = 0;
    for (const inv of invoices) {
      const payments = await db.query.customLaInvoicePayments.findMany({
        where: eq(customLaInvoicePayments.invoiceId, inv.id),
      });
      totalIncome += payments.reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
      );
    }

    // Get all expenses for this LA
    const expenses = await db
      .select()
      .from(customLaExpenses)
      .where(
        and(
          eq(customLaExpenses.customLaRequestId, id),
          // Only count paid & pending (not cancelled)
        )
      )
      .orderBy(desc(customLaExpenses.createdAt));

    // Calculate total expenses (only paid ones for actual outflow)
    const totalExpensesPaid = expenses
      .filter((e) => e.status === "paid")
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const totalExpensesPending = expenses
      .filter((e) => e.status === "pending")
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const totalExpensesAll = expenses
      .filter((e) => e.status !== "cancelled")
      .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    // Breakdown by category
    const categoryBreakdown: Record<
      string,
      { total: number; paid: number; pending: number; count: number }
    > = {};
    for (const exp of expenses) {
      if (exp.status === "cancelled") continue;
      if (!categoryBreakdown[exp.category]) {
        categoryBreakdown[exp.category] = {
          total: 0,
          paid: 0,
          pending: 0,
          count: 0,
        };
      }
      const cat = categoryBreakdown[exp.category]!;
      const amount = parseFloat(exp.amount);
      cat.total += amount;
      cat.count += 1;
      if (exp.status === "paid") {
        cat.paid += amount;
      } else if (exp.status === "pending") {
        cat.pending += amount;
      }
    }

    const totalAmountSAR = parseFloat(String(request.totalAmountSAR));
    const netProfit = totalIncome - totalExpensesPaid;
    const projectedProfit = totalAmountSAR - totalExpensesAll;

    return c.json({
      success: true,
      data: {
        customLaId: id,
        customLaNumber: request.number,
        totalAmountSAR,
        totalIncome,
        totalExpensesPaid,
        totalExpensesPending,
        totalExpensesAll,
        netProfit,
        projectedProfit,
        profitMarginPercent:
          totalAmountSAR > 0
            ? ((projectedProfit / totalAmountSAR) * 100).toFixed(1)
            : "0",
        categoryBreakdown,
      },
    });
  } catch (error) {
    console.error("Error fetching finance summary:", error);
    return c.json(
      { success: false, error: "Failed to fetch finance summary" },
      500
    );
  }
});

// ===== EXPENSES CRUD =====

/**
 * GET /custom-la-finance/:id/expenses
 * Get all expenses for a Custom LA request
 */
app.get("/:id/expenses", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    if (!id || isNaN(id)) {
      return c.json({ error: "Invalid Custom LA ID" }, 400);
    }

    const expenses = await db
      .select()
      .from(customLaExpenses)
      .where(eq(customLaExpenses.customLaRequestId, id))
      .orderBy(desc(customLaExpenses.createdAt));

    return c.json({ success: true, data: expenses });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    return c.json(
      { success: false, error: "Failed to fetch expenses" },
      500
    );
  }
});

/**
 * POST /custom-la-finance/:id/expense
 * Create a new expense for a Custom LA request
 */
app.post("/:id/expense", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    if (!id || isNaN(id)) {
      return c.json({ error: "Invalid Custom LA ID" }, 400);
    }

    // Verify LA request exists
    const request = await db.query.customLaRequests.findFirst({
      where: eq(customLaRequests.id, id),
    });
    if (!request) {
      return c.json({ error: "Custom LA request not found" }, 404);
    }

    const body = await c.req.json();
    const {
      category,
      supplierName,
      description,
      amount,
      currency,
      paymentDate,
      paymentMethod,
      referenceNumber,
      notes,
      status,
    } = body;

    // Validate required fields
    if (!category || !supplierName || amount === undefined) {
      return c.json(
        {
          error:
            "Missing required fields: category, supplierName, amount",
        },
        400
      );
    }

    if (typeof amount !== "number" || amount < 0) {
      return c.json(
        { error: "Amount must be a positive number" },
        400
      );
    }

    const newExpense: NewCustomLaExpense = {
      customLaRequestId: id,
      category,
      supplierName,
      description: description || null,
      amount: amount.toString(),
      currency: currency || "SAR",
      paymentDate: paymentDate ? new Date(paymentDate) : null,
      paymentMethod: paymentMethod || null,
      referenceNumber: referenceNumber || null,
      notes: notes || null,
      status: status || "pending",
    };

    const [inserted] = await db
      .insert(customLaExpenses)
      .values(newExpense)
      .returning();

    return c.json(
      {
        success: true,
        data: inserted,
        message: "Expense created successfully",
      },
      201
    );
  } catch (error) {
    console.error("Error creating expense:", error);
    return c.json(
      { success: false, error: "Failed to create expense" },
      500
    );
  }
});

/**
 * PUT /custom-la-finance/:id/expense/:expenseId
 * Update an existing expense
 */
app.put("/:id/expense/:expenseId", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const expenseId = parseInt(c.req.param("expenseId"));

    if (!id || isNaN(id) || !expenseId || isNaN(expenseId)) {
      return c.json({ error: "Invalid IDs" }, 400);
    }

    // Check expense exists and belongs to this LA
    const existing = await db
      .select()
      .from(customLaExpenses)
      .where(
        and(
          eq(customLaExpenses.id, expenseId),
          eq(customLaExpenses.customLaRequestId, id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Expense not found" }, 404);
    }

    const body = await c.req.json();
    const {
      category,
      supplierName,
      description,
      amount,
      currency,
      paymentDate,
      paymentMethod,
      referenceNumber,
      notes,
      status,
    } = body;

    if (!category || !supplierName || amount === undefined) {
      return c.json(
        {
          error:
            "Missing required fields: category, supplierName, amount",
        },
        400
      );
    }

    if (typeof amount !== "number" || amount < 0) {
      return c.json(
        { error: "Amount must be a positive number" },
        400
      );
    }

    const [updated] = await db
      .update(customLaExpenses)
      .set({
        category,
        supplierName,
        description: description || null,
        amount: amount.toString(),
        currency: currency || "SAR",
        paymentDate: paymentDate ? new Date(paymentDate) : null,
        paymentMethod: paymentMethod || null,
        referenceNumber: referenceNumber || null,
        notes: notes || null,
        status: status || "pending",
        updatedAt: new Date(),
      })
      .where(eq(customLaExpenses.id, expenseId))
      .returning();

    return c.json({
      success: true,
      data: updated,
      message: "Expense updated successfully",
    });
  } catch (error) {
    console.error("Error updating expense:", error);
    return c.json(
      { success: false, error: "Failed to update expense" },
      500
    );
  }
});

/**
 * DELETE /custom-la-finance/:id/expense/:expenseId
 * Delete an expense
 */
app.delete("/:id/expense/:expenseId", async (c) => {
  try {
    const id = parseInt(c.req.param("id"));
    const expenseId = parseInt(c.req.param("expenseId"));

    if (!id || isNaN(id) || !expenseId || isNaN(expenseId)) {
      return c.json({ error: "Invalid IDs" }, 400);
    }

    // Check expense exists and belongs to this LA
    const existing = await db
      .select()
      .from(customLaExpenses)
      .where(
        and(
          eq(customLaExpenses.id, expenseId),
          eq(customLaExpenses.customLaRequestId, id)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: "Expense not found" }, 404);
    }

    await db
      .delete(customLaExpenses)
      .where(eq(customLaExpenses.id, expenseId));

    return c.json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting expense:", error);
    return c.json(
      { success: false, error: "Failed to delete expense" },
      500
    );
  }
});

export default app;
