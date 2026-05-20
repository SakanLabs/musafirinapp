import { Hono } from "hono";
import { db } from "../db";
import { leads } from "../db/schema";
import { eq, asc } from "drizzle-orm";
import type { ApiResponse } from "shared/dist";

const leadsRoutes = new Hono()
  // Get all leads
  .get("/", async (c) => {
    try {
      const allLeads = await db.select().from(leads).orderBy(asc(leads.orderIndex), asc(leads.createdAt));
      
      const response: ApiResponse = {
        success: true,
        message: "Leads fetched successfully",
        data: allLeads,
      };
      return c.json(response);
    } catch (error: any) {
      console.error("Error fetching leads:", error);
      const response: ApiResponse = {
        success: false,
        message: error.message || "Failed to fetch leads",
      };
      return c.json(response, 500);
    }
  })
  
  // Create a new lead
  .post("/", async (c) => {
    try {
      const body = await c.req.json();
      const newLead = await db.insert(leads).values({
        name: body.name,
        phone: body.phone,
        companyName: body.companyName || null,
        requirement: body.requirement,
        status: body.status || 'NEW',
        value: body.value ? body.value.toString() : null,
        notes: body.notes || null,
        assignedTo: body.assignedTo || null,
      }).returning();
      
      const response: ApiResponse = {
        success: true,
        message: "Lead created successfully",
        data: newLead[0],
      };
      return c.json(response, 201);
    } catch (error: any) {
      console.error("Error creating lead:", error);
      const response: ApiResponse = {
        success: false,
        message: error.message || "Failed to create lead",
      };
      return c.json(response, 500);
    }
  })
  
  // Update a lead (status, orderIndex, or other details)
  .patch("/:id", async (c) => {
    try {
      const id = parseInt(c.req.param("id"));
      const body = await c.req.json();
      
      const updatedLead = await db.update(leads)
        .set({
          ...body,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, id))
        .returning();
        
      if (!updatedLead.length) {
        return c.json({ success: false, message: "Lead not found" }, 404);
      }
      
      const response: ApiResponse = {
        success: true,
        message: "Lead updated successfully",
        data: updatedLead[0],
      };
      return c.json(response);
    } catch (error: any) {
      console.error("Error updating lead:", error);
      const response: ApiResponse = {
        success: false,
        message: error.message || "Failed to update lead",
      };
      return c.json(response, 500);
    }
  })
  
  // Update multiple leads ordering (for kanban drag and drop within same column)
  .put("/reorder", async (c) => {
    try {
      const { items } = await c.req.json(); // Array of { id, orderIndex }
      
      await db.transaction(async (tx) => {
        for (const item of items) {
          await tx.update(leads)
            .set({ orderIndex: item.orderIndex })
            .where(eq(leads.id, item.id));
        }
      });
      
      return c.json({ success: true, message: "Leads reordered successfully" });
    } catch (error: any) {
      console.error("Error reordering leads:", error);
      return c.json({ success: false, message: "Failed to reorder leads" }, 500);
    }
  })
  
  // Delete a lead
  .delete("/:id", async (c) => {
    try {
      const id = parseInt(c.req.param("id"));
      await db.delete(leads).where(eq(leads.id, id));
      
      const response: ApiResponse = {
        success: true,
        message: "Lead deleted successfully",
      };
      return c.json(response);
    } catch (error: any) {
      console.error("Error deleting lead:", error);
      const response: ApiResponse = {
        success: false,
        message: error.message || "Failed to delete lead",
      };
      return c.json(response, 500);
    }
  });

export default leadsRoutes;
