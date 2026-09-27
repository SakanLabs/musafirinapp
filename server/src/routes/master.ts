import { Hono } from 'hono';
import { db } from '../db/index.js';
import { hotels, hotelPricingPeriods, transportationRoutesMaster, transportationRoutePricingPeriods } from '../db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { requireAdmin } from '../middleware/auth.js';
import * as XLSX from 'xlsx';

const app = new Hono();

// ==========================================
// HOTELS
// ==========================================

// GET /hotels - List all hotels
app.get('/hotels', async (c) => {
  try {
    const allHotels = await db.select().from(hotels).orderBy(hotels.name);
    return c.json(allHotels);
  } catch (error) {
    console.error('Error fetching hotels:', error);
    return c.json({ error: 'Failed to fetch hotels' }, 500);
  }
});

// POST /hotels - Create new hotel
app.post('/hotels', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    if (!body.name || !body.city) {
      return c.json({ error: 'Name and city are required' }, 400);
    }

    const newHotel = await db.insert(hotels).values({
      name: body.name,
      city: body.city,
      address: body.address,
      starRating: body.starRating,
      contactPerson: body.contactPerson,
      contactPhone: body.contactPhone,
      supplierName: body.supplierName,
      picName: body.picName,
      picContact: body.picContact,
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return c.json({ message: 'Hotel created', hotel: newHotel[0] }, 201);
  } catch (error) {
    console.error('Error creating hotel:', error);
    return c.json({ error: 'Failed to create hotel' }, 500);
  }
});

// PUT /hotels/:id - Update hotel
app.put('/hotels/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid hotel ID' }, 400);
    
    const body = await c.req.json();
    
    const updatedHotel = await db.update(hotels).set({
      ...body,
      updatedAt: new Date(),
    }).where(eq(hotels.id, id)).returning();

    if (updatedHotel.length === 0) return c.json({ error: 'Hotel not found' }, 404);

    return c.json({ message: 'Hotel updated', hotel: updatedHotel[0] });
  } catch (error) {
    console.error('Error updating hotel:', error);
    return c.json({ error: 'Failed to update hotel' }, 500);
  }
});

// DELETE /hotels/:id - Soft delete hotel
app.delete('/hotels/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid hotel ID' }, 400);
    
    const updatedHotel = await db.update(hotels).set({
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(hotels.id, id)).returning();

    if (updatedHotel.length === 0) return c.json({ error: 'Hotel not found' }, 404);

    return c.json({ message: 'Hotel deactivated' });
  } catch (error) {
    console.error('Error deleting hotel:', error);
    return c.json({ error: 'Failed to delete hotel' }, 500);
  }
});

// POST /hotels/import-pricing - Bulk import hotel pricing from Excel
app.post('/hotels/import-pricing', requireAdmin, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const resetBeforeImport = formData.get('resetBeforeImport') === 'true' || formData.get('reset_before_import') === 'true';

    if (!file) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });

    const results = {
      totalRowsProcessed: 0,
      hotelsCreated: 0,
      pricingCreated: 0,
      pricingOverwritten: 0,
      pricingResetCount: 0,
      errors: [] as string[],
      sheets: [] as { name: string; city: string; rows: number }[],
    };

    // If reset before import is requested, wipe existing hotel pricing periods first
    if (resetBeforeImport) {
      const deleted = await db.delete(hotelPricingPeriods).returning();
      results.pricingResetCount = deleted.length;
    }

    // Fetch all existing hotels upfront for matching
    const existingHotels = await db.select().from(hotels);
    const hotelMap = new Map<string, typeof existingHotels[0]>();
    existingHotels.forEach(h => hotelMap.set(h.name.toLowerCase().trim(), h));

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      // Only process sheets whose name contains "Makkah" or "Madinah", silently skip others
      const sheetNameLower = sheetName.toLowerCase().trim();
      let city: 'Makkah' | 'Madinah';
      if (sheetNameLower.includes('makkah') || sheetNameLower.includes('mekah') || sheetNameLower.includes('mekkah')) {
        city = 'Makkah';
      } else if (sheetNameLower.includes('madinah') || sheetNameLower.includes('medina') || sheetNameLower.includes('medinah')) {
        city = 'Madinah';
      } else {
        // Skip sheets that are not Makkah/Madinah (e.g. Dashboard, Syarat dan Ketentuan)
        continue;
      }

      // Convert sheet to JSON - read all rows as arrays
      const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '', raw: false, dateNF: 'dd mmm yyyy' });
      
      if (rows.length < 5) {
        results.errors.push(`Sheet "${sheetName}": Not enough rows (need at least 5, got ${rows.length})`);
        continue;
      }

      // Find header row (row 4, index 3) to detect column positions
      // Look for the sub-header row that contains "From", "To", "Double", "Triple", "Quad" etc.
      let headerRowIndex = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i];
        if (!row) continue;
        const rowStr = row.map((c: any) => String(c || '').toLowerCase()).join('|');
        if (rowStr.includes('from') && rowStr.includes('to') && (rowStr.includes('double') || rowStr.includes('triple') || rowStr.includes('quad'))) {
          headerRowIndex = i;
          break;
        }
      }

      if (headerRowIndex === -1) {
        results.errors.push(`Sheet "${sheetName}": Cannot find header row with columns "From", "To", "Double/Triple/Quad".`);
        continue;
      }

      const headerRow = rows[headerRowIndex]!;
      const headerMap: Record<string, number> = {};
      for (let colIdx = 0; colIdx < headerRow.length; colIdx++) {
        const val = String(headerRow[colIdx] || '').toLowerCase().trim();
        if (val) headerMap[val] = colIdx;
      }

      // Map column indices
      const colNamaHotel = headerMap['nama hotel'] ?? headerMap['hotel name'] ?? headerMap['hotel'] ?? 1; // Default column B
      const colBintang = headerMap['bintang'] ?? headerMap['star'] ?? headerMap['stars'] ?? 2; // Default column C
      const colFrom = headerMap['from'] ?? 3; // Default column D
      const colTo = headerMap['to'] ?? 4; // Default column E
      // Days column is skipped (computed)
      const colDouble = headerMap['double'] ?? 6; // Default column G
      const colTriple = headerMap['triple'] ?? 7; // Default column H
      const colQuad = headerMap['quad'] ?? 8; // Default column I
      const colMeals = headerMap['meals'] ?? headerMap['meal'] ?? headerMap['meal plan'] ?? headerMap['mealplan'] ?? (headerRow.length > 9 ? 9 : -1);
      // Future columns
      const colCostPrice = headerMap['cost price'] ?? headerMap['costprice'] ?? headerMap['cost'] ?? -1;
      const colAgentPrice = headerMap['agent price'] ?? headerMap['agentprice'] ?? headerMap['agent'] ?? -1;

      let sheetRowCount = 0;

      // Process data rows (start after header row)
      for (let rowIdx = headerRowIndex + 1; rowIdx < rows.length; rowIdx++) {
        const row = rows[rowIdx];
        if (!row) continue;

        const hotelName = String(row[colNamaHotel] || '').trim();
        if (!hotelName) continue; // Skip empty rows

        const fromRaw = row[colFrom];
        const toRaw = row[colTo];

        if (!fromRaw || !toRaw) {
          results.errors.push(`Sheet "${sheetName}", Row ${rowIdx + 1}: Missing dates for hotel "${hotelName}"`);
          continue;
        }

        // Parse dates
        let startDate: Date;
        let endDate: Date;
        try {
          startDate = parseExcelDate(fromRaw);
          endDate = parseExcelDate(toRaw);
        } catch (e: any) {
          results.errors.push(`Sheet "${sheetName}", Row ${rowIdx + 1}: Invalid date format - ${e.message}`);
          continue;
        }

        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          results.errors.push(`Sheet "${sheetName}", Row ${rowIdx + 1}: Invalid date for hotel "${hotelName}"`);
          continue;
        }

        // Parse star rating
        const starRaw = row[colBintang];
        const starRating = starRaw ? parseInt(String(starRaw)) : null;

        // Parse meal plan (Room Only, Breakfast, Full Board, etc.)
        const mealPlan = colMeals >= 0 ? parseMealPlan(row[colMeals]) : 'Room Only';

        // Parse prices for each room type
        const priceDouble = parsePrice(row[colDouble]);
        const priceTriple = parsePrice(row[colTriple]);
        const priceQuad = parsePrice(row[colQuad]);

        // Parse optional cost/agent prices
        const costPrice = colCostPrice >= 0 ? parsePrice(row[colCostPrice]) : null;
        const agentPrice = colAgentPrice >= 0 ? parsePrice(row[colAgentPrice]) : null;

        if (priceDouble === null && priceTriple === null && priceQuad === null) {
          results.errors.push(`Sheet "${sheetName}", Row ${rowIdx + 1}: No valid prices for hotel "${hotelName}"`);
          continue;
        }

        // Find or create hotel
        let hotel = hotelMap.get(hotelName.toLowerCase().trim());
        if (!hotel) {
          // Create new hotel
          const insertResult = await db.insert(hotels).values({
            name: hotelName,
            city: city,
            starRating: starRating || undefined,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }).returning();
          const newHotel = insertResult[0]!;
          hotel = newHotel;
          hotelMap.set(hotelName.toLowerCase().trim(), newHotel);
          results.hotelsCreated++;
        } else if (starRating && !hotel.starRating) {
          // Update star rating if it was empty and Excel provides it
          await db.update(hotels).set({ starRating, updatedAt: new Date() }).where(eq(hotels.id, hotel.id));
          hotel.starRating = starRating;
        }

        // Insert pricing for each room type
        const roomTypes: { type: string; price: number | null }[] = [
          { type: 'Double', price: priceDouble },
          { type: 'Triple', price: priceTriple },
          { type: 'Quad', price: priceQuad },
        ];

        for (const rt of roomTypes) {
          if (rt.price === null || rt.price <= 0) continue;

          // Check for existing pricing to overwrite (matched by hotel + roomType + mealPlan + startDate + endDate)
          const existing = await db.select().from(hotelPricingPeriods).where(
            and(
              eq(hotelPricingPeriods.hotelId, hotel!.id),
              eq(hotelPricingPeriods.roomType, rt.type),
              eq(hotelPricingPeriods.mealPlan, mealPlan),
              eq(hotelPricingPeriods.startDate, startDate),
              eq(hotelPricingPeriods.endDate, endDate),
            )
          );

          if (existing.length > 0) {
            // Overwrite existing
            const existingRecord = existing[0]!;
            await db.update(hotelPricingPeriods).set({
              sellingPrice: rt.price.toString(),
              costPrice: costPrice !== null ? costPrice.toString() : existingRecord.costPrice,
              agentPrice: agentPrice !== null ? agentPrice.toString() : existingRecord.agentPrice,
              isActive: true,
              updatedAt: new Date(),
            }).where(eq(hotelPricingPeriods.id, existingRecord.id));
            results.pricingOverwritten++;
          } else {
            // Create new
            await db.insert(hotelPricingPeriods).values({
              hotelId: hotel!.id,
              roomType: rt.type,
              mealPlan: mealPlan,
              startDate: startDate,
              endDate: endDate,
              sellingPrice: rt.price.toString(),
              costPrice: costPrice !== null ? costPrice.toString() : '0',
              agentPrice: agentPrice !== null ? agentPrice.toString() : '0',
              currency: 'SAR',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            results.pricingCreated++;
          }
        }

        sheetRowCount++;
        results.totalRowsProcessed++;
      }

      results.sheets.push({ name: sheetName, city, rows: sheetRowCount });
    }

    return c.json({
      message: 'Import completed',
      ...results,
    });
  } catch (error: any) {
    console.error('Error importing hotel pricing:', error);
    return c.json({ error: `Failed to import: ${error.message}` }, 500);
  }
});

// Indonesian month abbreviation mapping
const INDONESIAN_MONTHS: Record<string, string> = {
  'jan': 'Jan', 'feb': 'Feb', 'mar': 'Mar', 'apr': 'Apr',
  'mei': 'May', 'jun': 'Jun', 'jul': 'Jul',
  'ags': 'Aug', 'agu': 'Aug', 'agust': 'Aug', 'agustus': 'Aug',
  'sep': 'Sep', 'sept': 'Sep',
  'okt': 'Oct',
  'nov': 'Nov', 'nop': 'Nov',
  'des': 'Dec',
  // Also map full Indonesian month names
  'januari': 'Jan', 'februari': 'Feb', 'maret': 'Mar', 'april': 'Apr',
  'juni': 'Jun', 'juli': 'Jul',
  'september': 'Sep', 'oktober': 'Oct', 'november': 'Nov', 'desember': 'Dec',
};

// Helper: parse Excel date value (could be Date object, serial number, or string)
function parseExcelDate(value: any): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    // Excel serial date number
    return XLSX.SSF.parse_date_code(value) as unknown as Date;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Try direct Date parse
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
    // Try "13 Aug 2026" or "15 Ags 2026" format (with Indonesian month support)
    const match = trimmed.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/);
    if (match) {
      const monthStr = match[2]!;
      // Convert Indonesian month to English if needed
      const englishMonth = INDONESIAN_MONTHS[monthStr.toLowerCase()] || monthStr;
      const d = new Date(`${englishMonth} ${match[1]}, ${match[3]}`);
      if (!isNaN(d.getTime())) return d;
    }
    throw new Error(`Cannot parse date: "${trimmed}"`);
  }
  throw new Error(`Unsupported date type: ${typeof value}`);
}

// Helper: parse price value, returns null if invalid
function parsePrice(value: any): number | null {
  if (value === undefined || value === null || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? null : num;
}

// Helper: parse meal plan string (Room Only, Breakfast, Full Board, Half Board)
function parseMealPlan(value: any): string {
  if (!value) return 'Room Only';
  const str = String(value).trim().toLowerCase();
  if (str === 'full board' || str === 'fullboard' || str === 'fb' || str.includes('full')) {
    return 'Full Board';
  }
  if (str === 'breakfast' || str === 'bf' || str === 'bb' || str.includes('sarapan') || str.includes('breakfast')) {
    return 'Breakfast';
  }
  if (str === 'half board' || str === 'halfboard' || str === 'hb' || str.includes('half')) {
    return 'Half Board';
  }
  if (str === 'room only' || str === 'roomonly' || str === 'ro' || str.includes('only') || str === 'room') {
    return 'Room Only';
  }
  return String(value).trim() || 'Room Only';
}

// ==========================================
// HOTEL PRICING PERIODS
// ==========================================

// GET /hotels/:id/pricing - Get pricing periods for a hotel
app.get('/hotels/:id/pricing', async (c) => {
  try {
    const hotelId = parseInt(c.req.param('id'));
    if (isNaN(hotelId)) return c.json({ error: 'Invalid hotel ID' }, 400);

    const pricing = await db.select().from(hotelPricingPeriods)
      .where(eq(hotelPricingPeriods.hotelId, hotelId))
      .orderBy(hotelPricingPeriods.startDate);
      
    return c.json(pricing);
  } catch (error) {
    console.error('Error fetching hotel pricing periods:', error);
    return c.json({ error: 'Failed to fetch pricing periods' }, 500);
  }
});

// POST /hotels/:id/pricing - Add new pricing period
app.post('/hotels/:id/pricing', requireAdmin, async (c) => {
  try {
    const hotelId = parseInt(c.req.param('id'));
    if (isNaN(hotelId)) return c.json({ error: 'Invalid hotel ID' }, 400);
    
    const body = await c.req.json();
    if (!body.roomType || !body.startDate || !body.endDate || !body.costPrice || !body.sellingPrice) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const newPricing = await db.insert(hotelPricingPeriods).values({
      hotelId: hotelId,
      roomType: body.roomType,
      mealPlan: body.mealPlan || 'Room Only',
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      costPrice: body.costPrice.toString(),
      sellingPrice: body.sellingPrice.toString(),
      agentPrice: body.agentPrice?.toString() || '0',
      currency: body.currency || 'SAR',
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return c.json({ message: 'Pricing period added', pricing: newPricing[0] }, 201);
  } catch (error) {
    console.error('Error adding hotel pricing:', error);
    return c.json({ error: 'Failed to add pricing period' }, 500);
  }
});

// PUT /hotels/:hotelId/pricing/:id - Update pricing period
app.put('/hotels/:hotelId/pricing/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const hotelId = parseInt(c.req.param('hotelId'));
    if (isNaN(id) || isNaN(hotelId)) return c.json({ error: 'Invalid IDs' }, 400);
    
    const body = await c.req.json();
    
    const updateData: any = { ...body, updatedAt: new Date() };
    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.endDate) updateData.endDate = new Date(body.endDate);
    if (body.costPrice !== undefined) updateData.costPrice = body.costPrice.toString();
    if (body.sellingPrice !== undefined) updateData.sellingPrice = body.sellingPrice.toString();
    if (body.agentPrice !== undefined) updateData.agentPrice = body.agentPrice.toString();

    const updatedPricing = await db.update(hotelPricingPeriods).set(updateData)
      .where(and(eq(hotelPricingPeriods.id, id), eq(hotelPricingPeriods.hotelId, hotelId)))
      .returning();

    if (updatedPricing.length === 0) return c.json({ error: 'Pricing period not found' }, 404);

    return c.json({ message: 'Pricing period updated', pricing: updatedPricing[0] });
  } catch (error) {
    console.error('Error updating pricing:', error);
    return c.json({ error: 'Failed to update pricing period' }, 500);
  }
});

// DELETE /hotels/:hotelId/pricing/:id - Soft delete pricing period
app.delete('/hotels/:hotelId/pricing/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const hotelId = parseInt(c.req.param('hotelId'));
    if (isNaN(id) || isNaN(hotelId)) return c.json({ error: 'Invalid IDs' }, 400);
    
    const updatedPricing = await db.update(hotelPricingPeriods).set({
      isActive: false,
      updatedAt: new Date(),
    }).where(and(eq(hotelPricingPeriods.id, id), eq(hotelPricingPeriods.hotelId, hotelId)))
      .returning();

    if (updatedPricing.length === 0) return c.json({ error: 'Pricing period not found' }, 404);

    return c.json({ message: 'Pricing period deactivated' });
  } catch (error) {
    console.error('Error deleting pricing:', error);
    return c.json({ error: 'Failed to delete pricing period' }, 500);
  }
});

// POST /hotels/pricing/reset - Reset hotel pricing periods (all, by city, or by hotel)
app.post('/hotels/pricing/reset', requireAdmin, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({ scope: 'all' }));
    const scope = body?.scope || 'all'; // 'all' | 'city' | 'hotel'
    const city = body?.city; // 'Makkah' | 'Madinah'
    const hotelId = body?.hotelId ? parseInt(String(body.hotelId)) : undefined;

    let deletedRows: any[] = [];

    if (scope === 'city' && city) {
      const cityHotels = await db.select({ id: hotels.id }).from(hotels).where(eq(hotels.city, city));
      const hotelIds = cityHotels.map(h => h.id);
      if (hotelIds.length > 0) {
        deletedRows = await db.delete(hotelPricingPeriods)
          .where(inArray(hotelPricingPeriods.hotelId, hotelIds))
          .returning();
      }
      return c.json({
        message: `Berhasil mereset semua harga hotel di ${city} (${deletedRows.length} periode harga dihapus)`,
        deletedCount: deletedRows.length,
        scope,
        city,
      });
    } else if (scope === 'hotel' && hotelId && !isNaN(hotelId)) {
      deletedRows = await db.delete(hotelPricingPeriods)
        .where(eq(hotelPricingPeriods.hotelId, hotelId))
        .returning();
      return c.json({
        message: `Berhasil mereset harga untuk hotel ini (${deletedRows.length} periode harga dihapus)`,
        deletedCount: deletedRows.length,
        scope,
        hotelId,
      });
    } else {
      // Default: Reset all
      deletedRows = await db.delete(hotelPricingPeriods).returning();
      return c.json({
        message: `Berhasil mereset seluruh harga hotel (${deletedRows.length} periode harga dihapus)`,
        deletedCount: deletedRows.length,
        scope: 'all',
      });
    }
  } catch (error: any) {
    console.error('Error resetting hotel pricing:', error);
    return c.json({ error: `Failed to reset hotel pricing: ${error.message}` }, 500);
  }
});

// POST /hotels/:id/pricing/reset - Reset pricing for a specific hotel
app.post('/hotels/:id/pricing/reset', requireAdmin, async (c) => {
  try {
    const hotelId = parseInt(c.req.param('id'));
    if (isNaN(hotelId)) return c.json({ error: 'Invalid hotel ID' }, 400);

    const deleted = await db.delete(hotelPricingPeriods)
      .where(eq(hotelPricingPeriods.hotelId, hotelId))
      .returning();

    return c.json({
      message: `Berhasil mereset harga untuk hotel ini (${deleted.length} periode harga dihapus)`,
      deletedCount: deleted.length,
      hotelId,
    });
  } catch (error: any) {
    console.error('Error resetting hotel pricing for hotel:', error);
    return c.json({ error: `Failed to reset hotel pricing: ${error.message}` }, 500);
  }
});

// ==========================================
// TRANSPORTATION ROUTES
// ==========================================

// GET /transport-routes - List all transport routes
app.get('/transport-routes', async (c) => {
  try {
    const routes = await db.select().from(transportationRoutesMaster).orderBy(transportationRoutesMaster.originLocation);
    return c.json(routes);
  } catch (error) {
    console.error('Error fetching transport routes:', error);
    return c.json({ error: 'Failed to fetch transport routes' }, 500);
  }
});

// POST /transport-routes - Create new transport route
app.post('/transport-routes', requireAdmin, async (c) => {
  try {
    const body = await c.req.json();
    if (!body.originLocation || !body.destinationLocation) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const newRoute = await db.insert(transportationRoutesMaster).values({
      originLocation: body.originLocation,
      destinationLocation: body.destinationLocation,
      supplierName: body.supplierName,
      picName: body.picName,
      picContact: body.picContact,
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return c.json({ message: 'Transport route created', route: newRoute[0] }, 201);
  } catch (error) {
    console.error('Error creating transport route:', error);
    return c.json({ error: 'Failed to create transport route' }, 500);
  }
});

// PUT /transport-routes/:id - Update transport route
app.put('/transport-routes/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid route ID' }, 400);
    
    const body = await c.req.json();
    const updateData: any = { ...body, updatedAt: new Date() };
    
    const updatedRoute = await db.update(transportationRoutesMaster).set(updateData)
      .where(eq(transportationRoutesMaster.id, id)).returning();

    if (updatedRoute.length === 0) return c.json({ error: 'Route not found' }, 404);

    return c.json({ message: 'Transport route updated', route: updatedRoute[0] });
  } catch (error) {
    console.error('Error updating transport route:', error);
    return c.json({ error: 'Failed to update transport route' }, 500);
  }
});

// DELETE /transport-routes/:id - Soft delete transport route
app.delete('/transport-routes/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    if (isNaN(id)) return c.json({ error: 'Invalid route ID' }, 400);
    
    const updatedRoute = await db.update(transportationRoutesMaster).set({
      isActive: false,
      updatedAt: new Date(),
    }).where(eq(transportationRoutesMaster.id, id)).returning();

    if (updatedRoute.length === 0) return c.json({ error: 'Route not found' }, 404);

    return c.json({ message: 'Transport route deactivated' });
  } catch (error) {
    console.error('Error deleting transport route:', error);
    return c.json({ error: 'Failed to delete transport route' }, 500);
  }
});

// ==========================================
// TRANSPORTATION ROUTE PRICING PERIODS
// ==========================================

// GET /transport-routes/:id/pricing - Get pricing periods for a route
app.get('/transport-routes/:id/pricing', async (c) => {
  try {
    const routeId = parseInt(c.req.param('id'));
    if (isNaN(routeId)) return c.json({ error: 'Invalid route ID' }, 400);

    const pricing = await db.select().from(transportationRoutePricingPeriods)
      .where(eq(transportationRoutePricingPeriods.transportationRouteMasterId, routeId))
      .orderBy(transportationRoutePricingPeriods.startDate);
      
    return c.json(pricing);
  } catch (error) {
    console.error('Error fetching transport pricing periods:', error);
    return c.json({ error: 'Failed to fetch pricing periods' }, 500);
  }
});

// POST /transport-routes/:id/pricing - Add new pricing period
app.post('/transport-routes/:id/pricing', requireAdmin, async (c) => {
  try {
    const routeId = parseInt(c.req.param('id'));
    if (isNaN(routeId)) return c.json({ error: 'Invalid route ID' }, 400);
    
    const body = await c.req.json();
    if (!body.vehicleType || !body.startDate || !body.endDate || !body.costPrice || !body.sellingPrice) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    const newPricing = await db.insert(transportationRoutePricingPeriods).values({
      transportationRouteMasterId: routeId,
      vehicleType: body.vehicleType,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      costPrice: body.costPrice.toString(),
      sellingPrice: body.sellingPrice.toString(),
      agentPrice: body.agentPrice?.toString() || '0',
      currency: body.currency || 'SAR',
      isActive: body.isActive !== undefined ? body.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    return c.json({ message: 'Pricing period added', pricing: newPricing[0] }, 201);
  } catch (error) {
    console.error('Error adding transport pricing:', error);
    return c.json({ error: 'Failed to add pricing period' }, 500);
  }
});

// PUT /transport-routes/:routeId/pricing/:id - Update pricing period
app.put('/transport-routes/:routeId/pricing/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const routeId = parseInt(c.req.param('routeId'));
    if (isNaN(id) || isNaN(routeId)) return c.json({ error: 'Invalid IDs' }, 400);
    
    const body = await c.req.json();
    
    const updateData: any = { ...body, updatedAt: new Date() };
    if (body.startDate) updateData.startDate = new Date(body.startDate);
    if (body.endDate) updateData.endDate = new Date(body.endDate);
    if (body.costPrice !== undefined) updateData.costPrice = body.costPrice.toString();
    if (body.sellingPrice !== undefined) updateData.sellingPrice = body.sellingPrice.toString();
    if (body.agentPrice !== undefined) updateData.agentPrice = body.agentPrice.toString();

    const updatedPricing = await db.update(transportationRoutePricingPeriods).set(updateData)
      .where(and(eq(transportationRoutePricingPeriods.id, id), eq(transportationRoutePricingPeriods.transportationRouteMasterId, routeId)))
      .returning();

    if (updatedPricing.length === 0) return c.json({ error: 'Pricing period not found' }, 404);

    return c.json({ message: 'Pricing period updated', pricing: updatedPricing[0] });
  } catch (error) {
    console.error('Error updating pricing:', error);
    return c.json({ error: 'Failed to update pricing period' }, 500);
  }
});

// DELETE /transport-routes/:routeId/pricing/:id - Soft delete pricing period
app.delete('/transport-routes/:routeId/pricing/:id', requireAdmin, async (c) => {
  try {
    const id = parseInt(c.req.param('id'));
    const routeId = parseInt(c.req.param('routeId'));
    if (isNaN(id) || isNaN(routeId)) return c.json({ error: 'Invalid IDs' }, 400);
    
    const updatedPricing = await db.update(transportationRoutePricingPeriods).set({
      isActive: false,
      updatedAt: new Date(),
    }).where(and(eq(transportationRoutePricingPeriods.id, id), eq(transportationRoutePricingPeriods.transportationRouteMasterId, routeId)))
      .returning();

    if (updatedPricing.length === 0) return c.json({ error: 'Pricing period not found' }, 404);

    return c.json({ message: 'Pricing period deactivated' });
  } catch (error) {
    console.error('Error deleting pricing:', error);
    return c.json({ error: 'Failed to delete pricing period' }, 500);
  }
});

export default app;
