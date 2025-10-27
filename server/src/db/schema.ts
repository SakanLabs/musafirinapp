import { pgTable, text, timestamp, boolean, varchar, serial, integer, decimal, jsonb, pgEnum } from 'drizzle-orm/pg-core';

// User table for better-auth
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').default(false).notNull(),
  image: text('image'),
  role: text('role').default('user').notNull(), // Added for admin plugin
  banned: boolean('banned').default(false).notNull(), // Added for admin plugin
  banReason: text('banReason'),
  banExpires: timestamp('banExpires'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Session table for better-auth
export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
});

// Account table for better-auth (for OAuth providers)
export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// Verification table for better-auth (for email verification, password reset, etc.)
export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow(),
});

// Enums for Hotel Booking Management
export const cityEnum = pgEnum('city', ['Makkah', 'Madinah']);
export const paymentStatusEnum = pgEnum('payment_status', ['unpaid', 'partial', 'paid', 'overdue']);
export const bookingStatusEnum = pgEnum('booking_status', ['pending', 'confirmed', 'cancelled']);
// roomTypeEnum removed - now using varchar for flexibility
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'overdue', 'cancelled']);
export const mealPlanEnum = pgEnum('meal_plan', ['Breakfast', 'Half Board', 'Full Board', 'Room Only']);
// Service Orders enums (new products: Visa Umrah, Siskopatuh)
export const serviceOrderProductEnum = pgEnum('service_order_product', ['visa_umrah', 'siskopatuh']);
export const serviceOrderStatusEnum = pgEnum('service_order_status', ['draft', 'submitted', 'paid', 'cancelled']);

// Transportation enums
export const vehicleTypeEnum = pgEnum('vehicle_type', ['sedan', 'suv', 'van', 'bus', 'minibus']);
export const transportationStatusEnum = pgEnum('transportation_status', ['pending', 'confirmed', 'completed', 'cancelled']);

// Clients table
export const clients = pgTable('clients', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 50 }),
  address: text('address'),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Client Deposits table for tracking deposit balance
export const clientDeposits = pgTable('client_deposits', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  currentBalance: decimal('current_balance', { precision: 10, scale: 2 }).default('0').notNull(),
  totalDeposited: decimal('total_deposited', { precision: 10, scale: 2 }).default('0').notNull(),
  totalUsed: decimal('total_used', { precision: 10, scale: 2 }).default('0').notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  lastTransactionAt: timestamp('last_transaction_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Deposit Transactions table for tracking all deposit activities
export const depositTransactionTypeEnum = pgEnum('deposit_transaction_type', ['deposit', 'usage', 'refund', 'adjustment']);
export const depositTransactionStatusEnum = pgEnum('deposit_transaction_status', ['pending', 'completed', 'cancelled', 'failed']);

export const depositTransactions = pgTable('deposit_transactions', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  type: depositTransactionTypeEnum('type').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  balanceBefore: decimal('balance_before', { precision: 10, scale: 2 }).notNull(),
  balanceAfter: decimal('balance_after', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  status: depositTransactionStatusEnum('status').default('pending').notNull(),
  description: text('description'),
  bookingId: integer('booking_id').references(() => bookings.id, { onDelete: 'set null' }), // For usage transactions
  referenceNumber: varchar('reference_number', { length: 100 }),
  processedBy: text('processed_by'), // Admin who processed the transaction
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Bookings table
export const bookings = pgTable('bookings', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 50 }).notNull().unique(),
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  hotelName: varchar('hotel_name', { length: 255 }).notNull(),
  city: cityEnum('city').notNull(),
  mealPlan: mealPlanEnum('meal_plan').default('Room Only').notNull(),
  checkIn: timestamp('check_in').notNull(),
  checkOut: timestamp('check_out').notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  paymentStatus: paymentStatusEnum('payment_status').default('unpaid').notNull(),
  bookingStatus: bookingStatusEnum('booking_status').default('pending').notNull(),
  hotelConfirmationNo: varchar('hotel_confirmation_no', { length: 100 }),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Booking Items table
export const bookingItems = pgTable('booking_items', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  roomType: varchar('room_type', { length: 255 }).notNull(), // Changed from enum to varchar for flexibility
  roomCount: integer('room_count').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(), // Harga jual ke customer (average or base price)
  hotelCostPrice: decimal('hotel_cost_price', { precision: 10, scale: 2 }).default('0').notNull(), // Harga beli ke hotel (average or base price)
  hasPricingPeriods: boolean('has_pricing_periods').default(false).notNull(), // Flag to indicate if this item uses pricing periods
});

// Booking Item Pricing Periods table - for hotels with period-based pricing (Makkah/Madinah)
export const bookingItemPricingPeriods = pgTable('booking_item_pricing_periods', {
  id: serial('id').primaryKey(),
  bookingItemId: integer('booking_item_id').notNull().references(() => bookingItems.id, { onDelete: 'cascade' }),
  startDate: timestamp('start_date').notNull(), // Start date of this pricing period
  endDate: timestamp('end_date').notNull(), // End date of this pricing period
  nights: integer('nights').notNull(), // Number of nights in this period
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(), // Price per room per night for this period
  hotelCostPrice: decimal('hotel_cost_price', { precision: 10, scale: 2 }).default('0').notNull(), // Hotel cost for this period
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(), // nights * roomCount * unitPrice
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Invoices table
export const invoices = pgTable('invoices', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: INV-YYYY-XXXX
  bookingId: integer('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  issueDate: timestamp('issue_date').notNull(),
  dueDate: timestamp('due_date').notNull(),
  status: invoiceStatusEnum('status').default('draft').notNull(),
  pdfUrl: text('pdf_url'),
});

// Vouchers table
export const vouchers = pgTable('vouchers', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: VCH-YYYY-XXXX
  bookingId: integer('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  guestName: varchar('guest_name', { length: 255 }).notNull(),
  qrUrl: text('qr_url'),
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Receipts (Kwitansi) table
export const receipts = pgTable('receipts', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: KWT-YYYY-XXXX
  bookingId: integer('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  invoiceId: integer('invoice_id').references(() => invoices.id, { onDelete: 'set null' }),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 10, scale: 2 }).notNull(),
  balanceDue: decimal('balance_due', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  issueDate: timestamp('issue_date').defaultNow().notNull(),
  payerName: varchar('payer_name', { length: 255 }).notNull(),
  payerEmail: varchar('payer_email', { length: 255 }),
  payerPhone: varchar('payer_phone', { length: 50 }),
  payerAddress: text('payer_address'),
  hotelName: varchar('hotel_name', { length: 255 }).notNull(),
  hotelAddress: text('hotel_address'),
  bankName: varchar('bank_name', { length: 255 }),
  bankCountry: varchar('bank_country', { length: 100 }),
  accountName: varchar('account_name', { length: 255 }),
  accountNumberOrIBAN: varchar('account_number_or_iban', { length: 100 }),
  notes: text('notes'),
  amountInWords: text('amount_in_words'),
  pdfUrl: text('pdf_url'),
  meta: jsonb('meta'), // For storing payment details array
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Operational costs for tracking additional expenses per booking
export const operationalCosts = pgTable('operational_costs', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  costType: varchar('cost_type', { length: 100 }).notNull(), // e.g., 'transportation', 'visa', 'admin'
  description: text('description'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  incurredDate: timestamp('incurred_date').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Hotel cost templates for default pricing
export const hotelCostTemplates = pgTable('hotel_cost_templates', {
  id: serial('id').primaryKey(),
  hotelName: varchar('hotel_name', { length: 255 }).notNull(),
  city: cityEnum('city').notNull(),
  roomType: varchar('room_type', { length: 255 }).notNull(), // Changed from enum to varchar for flexibility
  costPrice: decimal('cost_price', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  effectiveDate: timestamp('effective_date').defaultNow().notNull(),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Service Orders table (generic for Visa Umrah & Siskopatuh)
export const serviceOrders = pgTable('service_orders', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: SO-YYYY-XXXX
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  productType: serviceOrderProductEnum('product_type').notNull(),
  status: serviceOrderStatusEnum('status').default('draft').notNull(),
  groupLeaderName: varchar('group_leader_name', { length: 255 }).notNull(), // Penanggung Jawab Grup
  groupLeaderPhone: varchar('group_leader_phone', { length: 50 }), // Nomor Ketua Rombongan
  totalPeople: integer('total_people').notNull(),
  unitPriceUSD: decimal('unit_price_usd', { precision: 10, scale: 2 }).notNull(),
  totalPriceUSD: decimal('total_price_usd', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  exchangeRateToSAR: decimal('exchange_rate_to_sar', { precision: 10, scale: 4 }).default('3.75').notNull(),
  totalPriceSAR: decimal('total_price_sar', { precision: 10, scale: 2 }).notNull(),
  departureDate: timestamp('departure_date').notNull(), // Wajib, tidak ditampilkan di invoice/receipt
  returnDate: timestamp('return_date').notNull(), // Wajib, tidak ditampilkan di invoice/receipt
  notes: text('notes'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Checklist Kelengkapan Dokumen untuk Service Order
export const serviceOrderChecklists = pgTable('service_order_checklists', {
  id: serial('id').primaryKey(),
  serviceOrderId: integer('service_order_id').notNull().references(() => serviceOrders.id, { onDelete: 'cascade' }),
  items: jsonb('items').notNull(), // JSON berbentuk { passport: true/false, ktp: ..., kk: ..., hotelMakkah: ..., hotelMadinah: ..., transportAirportHotel: ..., transportMakkahToMadinah: ..., transportHotelToAirport: ..., roundTripTicket: ... }
  remarks: text('remarks'), // Catatan tambahan admin
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Service Order Invoices table
export const serviceOrderInvoices = pgTable('service_order_invoices', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: SOI-YYYY-XXXX
  serviceOrderId: integer('service_order_id').notNull().references(() => serviceOrders.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  issueDate: timestamp('issue_date').notNull(),
  dueDate: timestamp('due_date').notNull(),
  status: invoiceStatusEnum('status').default('draft').notNull(),
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Transportation Bookings table
export const transportationBookings = pgTable('transportation_bookings', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: TB-YYYY-XXXX
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 50 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  status: transportationStatusEnum('status').default('pending').notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Transportation Routes table (one booking can have multiple routes)
export const transportationRoutes = pgTable('transportation_routes', {
  id: serial('id').primaryKey(),
  transportationBookingId: integer('transportation_booking_id').notNull().references(() => transportationBookings.id, { onDelete: 'cascade' }),
  pickupDateTime: timestamp('pickup_date_time').notNull(),
  originLocation: varchar('origin_location', { length: 500 }).notNull(),
  destinationLocation: varchar('destination_location', { length: 500 }).notNull(),
  vehicleType: vehicleTypeEnum('vehicle_type').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  driverName: varchar('driver_name', { length: 255 }),
  driverPhone: varchar('driver_phone', { length: 50 }),
  vehiclePlateNumber: varchar('vehicle_plate_number', { length: 50 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Transportation Invoices table
export const transportationInvoices = pgTable('transportation_invoices', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: TI-YYYY-XXXX
  transportationBookingId: integer('transportation_booking_id').notNull().references(() => transportationBookings.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  issueDate: timestamp('issue_date').notNull(),
  dueDate: timestamp('due_date').notNull(),
  status: invoiceStatusEnum('status').default('draft').notNull(),
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Transportation Receipts table
export const transportationReceipts = pgTable('transportation_receipts', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: TR-YYYY-XXXX
  transportationBookingId: integer('transportation_booking_id').notNull().references(() => transportationBookings.id, { onDelete: 'cascade' }),
  transportationInvoiceId: integer('transportation_invoice_id').references(() => transportationInvoices.id, { onDelete: 'set null' }),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 10, scale: 2 }).notNull(),
  balanceDue: decimal('balance_due', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  issueDate: timestamp('issue_date').defaultNow().notNull(),
  payerName: varchar('payer_name', { length: 255 }).notNull(),
  payerEmail: varchar('payer_email', { length: 255 }),
  payerPhone: varchar('payer_phone', { length: 50 }),
  payerAddress: text('payer_address'),
  bankName: varchar('bank_name', { length: 255 }),
  bankCountry: varchar('bank_country', { length: 100 }),
  accountName: varchar('account_name', { length: 255 }),
  accountNumberOrIBAN: varchar('account_number_or_iban', { length: 100 }),
  notes: text('notes'),
  amountInWords: text('amount_in_words'),
  pdfUrl: text('pdf_url'),
  meta: jsonb('meta'), // For storing payment details array
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});



// Type exports for better-auth tables
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

// Type exports for Hotel Booking Management tables
export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
export type ClientDeposit = typeof clientDeposits.$inferSelect;
export type NewClientDeposit = typeof clientDeposits.$inferInsert;
export type DepositTransaction = typeof depositTransactions.$inferSelect;
export type NewDepositTransaction = typeof depositTransactions.$inferInsert;
export type Booking = typeof bookings.$inferSelect;
export type NewBooking = typeof bookings.$inferInsert;
export type BookingItem = typeof bookingItems.$inferSelect;
export type NewBookingItem = typeof bookingItems.$inferInsert;
export type BookingItemPricingPeriod = typeof bookingItemPricingPeriods.$inferSelect;
export type NewBookingItemPricingPeriod = typeof bookingItemPricingPeriods.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type Voucher = typeof vouchers.$inferSelect;
export type NewVoucher = typeof vouchers.$inferInsert;
export type Receipt = typeof receipts.$inferSelect;
export type NewReceipt = typeof receipts.$inferInsert;
export type OperationalCost = typeof operationalCosts.$inferSelect;
export type NewOperationalCost = typeof operationalCosts.$inferInsert;
export type HotelCostTemplate = typeof hotelCostTemplates.$inferSelect;
export type NewHotelCostTemplate = typeof hotelCostTemplates.$inferInsert;
export type ServiceOrder = typeof serviceOrders.$inferSelect;
export type NewServiceOrder = typeof serviceOrders.$inferInsert;
export type ServiceOrderChecklist = typeof serviceOrderChecklists.$inferSelect;
export type NewServiceOrderChecklist = typeof serviceOrderChecklists.$inferInsert;
export type ServiceOrderInvoice = typeof serviceOrderInvoices.$inferSelect;
export type NewServiceOrderInvoice = typeof serviceOrderInvoices.$inferInsert;
export type TransportationBooking = typeof transportationBookings.$inferSelect;
export type NewTransportationBooking = typeof transportationBookings.$inferInsert;
export type TransportationRoute = typeof transportationRoutes.$inferSelect;
export type NewTransportationRoute = typeof transportationRoutes.$inferInsert;
export type TransportationInvoice = typeof transportationInvoices.$inferSelect;
export type NewTransportationInvoice = typeof transportationInvoices.$inferInsert;
export type TransportationReceipt = typeof transportationReceipts.$inferSelect;
export type NewTransportationReceipt = typeof transportationReceipts.$inferInsert;
