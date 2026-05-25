import { db } from '/Users/mac146/Musafirin/apps/main-app/musafirinapp/server/src/db';
import { customLaRequests, customLaInvoices, clients } from '/Users/mac146/Musafirin/apps/main-app/musafirinapp/server/src/db/schema';
import { eq } from 'drizzle-orm';

async function main() {
  try {
    const allCustomLaInvoices = await db
      .select({
        id: customLaInvoices.id,
        number: customLaInvoices.number,
        bookingId: customLaInvoices.customLaRequestId,
        amount: customLaInvoices.amount,
        currency: customLaInvoices.currency,
        issueDate: customLaInvoices.issueDate,
        dueDate: customLaInvoices.dueDate,
        status: customLaInvoices.status,
        pdfUrl: customLaInvoices.pdfUrl,
        bookingCode: customLaRequests.number,
        clientName: clients.name,
        clientEmail: clients.email,
        hotelName: customLaRequests.travelName,
        city: customLaRequests.status,
      })
      .from(customLaInvoices)
      .leftJoin(customLaRequests, eq(customLaInvoices.customLaRequestId, customLaRequests.id))
      .leftJoin(clients, eq(customLaRequests.clientId, clients.id));

    console.log('Query result:', allCustomLaInvoices);
  } catch (err) {
    console.error('Error querying:', err);
  } finally {
    process.exit(0);
  }
}

main();
