import { pgTable, text, timestamp, boolean, varchar, serial, integer, decimal, jsonb, pgEnum, date } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// User table for better-auth
export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').default(false).notNull(),
  image: text('image'),
  role: text('role').default('user').notNull(), // Added for admin plugin
  userType: text('userType').default('direct').notNull(), // 'direct' or 'agent'
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
export const customLaRequestStatusEnum = pgEnum('custom_la_request_status', ['pending', 'quoted', 'approved', 'invoiced', 'completed', 'cancelled']);
// roomTypeEnum removed - now using varchar for flexibility
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled']);
export const mealPlanEnum = pgEnum('meal_plan', ['Breakfast', 'Half Board', 'Full Board', 'Room Only']);
// Service Orders enums (new products: Visa Umrah, Siskopatuh)
export const serviceOrderProductEnum = pgEnum('service_order_product', ['visa_umrah', 'siskopatuh']);
export const serviceOrderStatusEnum = pgEnum('service_order_status', ['draft', 'submitted', 'paid', 'cancelled']);

// Master Services Enum
export const serviceCategoryEnum = pgEnum('service_category', ['Visa', 'Siskopatuh', 'Transportasi', 'Handling Airport', 'Handling Hotel', 'Muthowif', 'Tiket Museum', 'Lainnya']);

// CRM / Lead Management Enums
export const leadStatusEnum = pgEnum('lead_status', ['NEW', 'DISCUSSION', 'QUOTED', 'FOLLOW_UP', 'WON', 'LOST']);

// Transportation enums
export const vehicleTypeEnum = pgEnum('vehicle_type', ['sedan', 'suv', 'van', 'bus', 'minibus', 'staria', 'hiace', 'gmc', 'coaster']);
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
  customLaRequestId: integer('custom_la_request_id').references(() => customLaRequests.id, { onDelete: 'set null' }), // Added for LA integration
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
  paidAmount: decimal('paid_amount', { precision: 10, scale: 2 }).default('0').notNull(),
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

// Master Data: Hotels
export const hotels = pgTable('hotels', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  city: cityEnum('city').notNull(),
  address: text('address'),
  starRating: integer('star_rating'),
  contactPerson: varchar('contact_person', { length: 150 }),
  contactPhone: varchar('contact_phone', { length: 50 }),
  supplierName: varchar('supplier_name', { length: 255 }),
  picName: varchar('pic_name', { length: 255 }),
  picContact: varchar('pic_contact', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Master Data: Hotel Pricing Periods
export const hotelPricingPeriods = pgTable('hotel_pricing_periods', {
  id: serial('id').primaryKey(),
  hotelId: integer('hotel_id').notNull().references(() => hotels.id, { onDelete: 'cascade' }),
  roomType: varchar('room_type', { length: 255 }).notNull(),
  mealPlan: varchar('meal_plan', { length: 50 }).notNull().default('Room Only'),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  costPrice: decimal('cost_price', { precision: 10, scale: 2 }).notNull(),
  sellingPrice: decimal('selling_price', { precision: 10, scale: 2 }).notNull(), // Price for direct customers
  agentPrice: decimal('agent_price', { precision: 10, scale: 2 }).default('0').notNull(), // Price for agents
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Master Services Table
export const serviceMaster = pgTable('service_master', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: serviceCategoryEnum('category').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  unitType: varchar('unit_type', { length: 50 }).notNull().default('Per Pax'), // e.g. "Per Pax", "Per Group"
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Service Orders table (generic for Visa Umrah & Siskopatuh)
export const serviceOrders = pgTable('service_orders', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: SO-YYYY-XXXX
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'set null' }), // User who created (for pricing)
  servicePackage: text('service_package'), // Example: Standard, Premium, dll.
  customLaRequestId: integer('custom_la_request_id').references(() => customLaRequests.id, { onDelete: 'set null' }), // Added for LA integration
  productType: serviceOrderProductEnum('product_type').notNull(),
  status: serviceOrderStatusEnum('status').default('draft').notNull(),
  groupLeaderName: varchar('group_leader_name', { length: 255 }).notNull(), // Penanggung Jawab Grup
  groupLeaderPhone: varchar('group_leader_phone', { length: 50 }), // Nomor Ketua Rombongan
  totalPeople: integer('total_people').notNull(),
  unitPriceUSD: decimal('unit_price_usd', { precision: 10, scale: 2 }).notNull(),
  totalPriceUSD: decimal('total_price_usd', { precision: 10, scale: 2 }).notNull(),
  agentUnitPriceUSD: decimal('agent_unit_price_usd', { precision: 10, scale: 2 }).default('0').notNull(),
  agentTotalPriceUSD: decimal('agent_total_price_usd', { precision: 10, scale: 2 }).default('0').notNull(),
  currency: varchar('currency', { length: 3 }).default('USD').notNull(),
  exchangeRateToSAR: decimal('exchange_rate_to_sar', { precision: 10, scale: 4 }).default('3.75').notNull(),
  totalPriceSAR: decimal('total_price_sar', { precision: 10, scale: 2 }).notNull(),
  agentTotalPriceSAR: decimal('agent_total_price_sar', { precision: 10, scale: 2 }).default('0').notNull(),
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
  paidAmount: decimal('paid_amount', { precision: 10, scale: 2 }).default('0').notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  issueDate: timestamp('issue_date').notNull(),
  dueDate: timestamp('due_date').notNull(),
  status: invoiceStatusEnum('status').default('draft').notNull(),
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Service Order Receipts table
export const serviceOrderReceipts = pgTable('service_order_receipts', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: SOR-YYYY-XXXX
  serviceOrderId: integer('service_order_id').notNull().references(() => serviceOrders.id, { onDelete: 'cascade' }),
  serviceOrderInvoiceId: integer('service_order_invoice_id').references(() => serviceOrderInvoices.id, { onDelete: 'set null' }),
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

// Transportation Bookings table
export const transportationBookings = pgTable('transportation_bookings', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: TB-YYYY-XXXX
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 50 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  customLaRequestId: integer('custom_la_request_id').references(() => customLaRequests.id, { onDelete: 'set null' }), // Added for LA integration
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

// Master Data: Transportation Routes Master
export const transportationRoutesMaster = pgTable('transportation_routes_master', {
  id: serial('id').primaryKey(),
  originLocation: varchar('origin_location', { length: 500 }).notNull(),
  destinationLocation: varchar('destination_location', { length: 500 }).notNull(),
  supplierName: varchar('supplier_name', { length: 255 }),
  picName: varchar('pic_name', { length: 255 }),
  picContact: varchar('pic_contact', { length: 255 }),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Master Data: Transportation Route Pricing Periods
export const transportationRoutePricingPeriods = pgTable('transportation_route_pricing_periods', {
  id: serial('id').primaryKey(),
  transportationRouteMasterId: integer('transportation_route_master_id').notNull().references(() => transportationRoutesMaster.id, { onDelete: 'cascade' }),
  vehicleType: vehicleTypeEnum('vehicle_type').notNull(),
  startDate: date('start_date', { mode: 'date' }).notNull(),
  endDate: date('end_date', { mode: 'date' }).notNull(),
  costPrice: decimal('cost_price', { precision: 10, scale: 2 }).notNull(),
  sellingPrice: decimal('selling_price', { precision: 10, scale: 2 }).notNull(), // Price for direct customers
  agentPrice: decimal('agent_price', { precision: 10, scale: 2 }).default('0').notNull(), // Price for agents
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Transportation Invoices table
export const transportationInvoices = pgTable('transportation_invoices', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: TI-YYYY-XXXX
  transportationBookingId: integer('transportation_booking_id').notNull().references(() => transportationBookings.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 10, scale: 2 }).default('0').notNull(),
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

// Transportation Vouchers table
export const transportationVouchers = pgTable('transportation_vouchers', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: TV-YYYY-XXXX
  transportationBookingId: integer('transportation_booking_id').notNull().references(() => transportationBookings.id, { onDelete: 'cascade' }),
  issueDate: timestamp('issue_date').defaultNow().notNull(),
  pdfUrl: text('pdf_url'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});


// Additional enums and tables for multi-service booking and partial payments
export const serviceItemTypeEnum = pgEnum('service_item_type', ['visa_umrah', 'transportasi', 'other']);

// Generic service items attached to a hotel booking (e.g. Visa Umrah, Transportation/Bus Full Trip)
export const bookingServiceItems = pgTable('booking_service_items', {
  id: serial('id').primaryKey(),
  bookingId: integer('booking_id').notNull().references(() => bookings.id, { onDelete: 'cascade' }),
  serviceType: serviceItemTypeEnum('service_type').notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  quantity: integer('quantity').default(1).notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(), // quantity * unitPrice
  notes: text('notes'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Payments against invoices to support partial payments
export const invoicePayments = pgTable('invoice_payments', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  method: varchar('method', { length: 50 }), // e.g. bank_transfer, cash, card
  referenceNumber: varchar('reference_number', { length: 100 }),
  paidAt: timestamp('paid_at').notNull(),
  status: depositTransactionStatusEnum('status').default('completed').notNull(), // reuse existing enum (pending/completed/cancelled/failed)
  meta: jsonb('meta'), // optional payment metadata (bank account used, IBAN, etc.)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const serviceOrderInvoicePayments = pgTable('service_order_invoice_payments', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => serviceOrderInvoices.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  method: varchar('method', { length: 50 }),
  referenceNumber: varchar('reference_number', { length: 100 }),
  paidAt: timestamp('paid_at').notNull(),
  status: depositTransactionStatusEnum('status').default('completed').notNull(),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const transportationInvoicePayments = pgTable('transportation_invoice_payments', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => transportationInvoices.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  method: varchar('method', { length: 50 }),
  referenceNumber: varchar('reference_number', { length: 100 }),
  paidAt: timestamp('paid_at').notNull(),
  status: depositTransactionStatusEnum('status').default('completed').notNull(),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Custom LA Requests table
export const customLaRequests = pgTable('custom_la_requests', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: CLA-YYYY-XXXX
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  customerName: varchar('customer_name', { length: 255 }).notNull(),
  customerPhone: varchar('customer_phone', { length: 50 }),
  customerEmail: varchar('customer_email', { length: 255 }),
  travelName: varchar('travel_name', { length: 255 }),
  status: customLaRequestStatusEnum('status').default('pending').notNull(),
  totalAmountSAR: decimal('total_amount_sar', { precision: 10, scale: 2 }).notNull(),
  totalPax: integer('total_pax').notNull(),
  meta: jsonb('meta').notNull(), // To store all form details (hotel selected, transport, layout)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Muthowif Enums
export const visaStatusEnum = pgEnum('visa_status', ['umrah', 'ziarah', 'student', 'worker', 'resident']);
export const residentTypeEnum = pgEnum('resident_type', ['mahasiswa', 'mukimin']);
export const muthowifStatusEnum = pgEnum('muthowif_status', ['idle', 'assigned', 'unavailable']);
export const assignmentReferenceTypeEnum = pgEnum('assignment_reference_type', ['service_order', 'custom_la', 'booking']);
export const assignmentStatusEnum = pgEnum('assignment_status', ['active', 'completed', 'cancelled']);

// Muthowif Master Table
export const muthowifs = pgTable('muthowifs', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  iqamaOrPassportNo: varchar('iqama_or_passport_no', { length: 100 }),
  visaStatus: visaStatusEnum('visa_status').notNull(),
  residentType: residentTypeEnum('resident_type').notNull(),
  residenceLocation: text('residence_location'),
  lastEducation: varchar('last_education', { length: 255 }), // Pendidikan terakhir
  status: muthowifStatusEnum('status').default('idle').notNull(),
  notes: text('notes'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Muthowif Assignments Table
export const muthowifAssignments = pgTable('muthowif_assignments', {
  id: serial('id').primaryKey(),
  muthowifId: integer('muthowif_id').notNull().references(() => muthowifs.id, { onDelete: 'cascade' }),
  referenceType: assignmentReferenceTypeEnum('reference_type').notNull(),
  referenceId: integer('reference_id').notNull(),
  startDate: timestamp('start_date').notNull(),
  endDate: timestamp('end_date').notNull(),
  taskDescription: text('task_description'),
  status: assignmentStatusEnum('status').default('active').notNull(),
  assignedBy: text('assigned_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// CRM / Leads Table
export const leads = pgTable('leads', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 50 }).notNull(),
  companyName: varchar('company_name', { length: 255 }),
  requirement: text('requirement').notNull(),
  status: leadStatusEnum('status').default('NEW').notNull(),
  value: decimal('value', { precision: 12, scale: 2 }), // Estimated deal value
  notes: text('notes'),
  assignedTo: text('assigned_to').references(() => user.id, { onDelete: 'set null' }),
  orderIndex: integer('order_index').default(0).notNull(), // For kanban ordering
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
export type TransportationVoucher = typeof transportationVouchers.$inferSelect;
export type NewTransportationVoucher = typeof transportationVouchers.$inferInsert;
export type BookingServiceItem = typeof bookingServiceItems.$inferSelect;
export type NewBookingServiceItem = typeof bookingServiceItems.$inferInsert;

// Custom LA Billing
export const customLaInvoices = pgTable("custom_la_invoices", {
  id: serial("id").primaryKey(),
  number: varchar("number", { length: 50 }).notNull().unique(),
  customLaRequestId: integer("custom_la_request_id").notNull().references(() => customLaRequests.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  issueDate: timestamp("issue_date").notNull(),
  dueDate: timestamp("due_date").notNull(),
  status: invoiceStatusEnum("status").default("draft").notNull(),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customLaInvoicePayments = pgTable("custom_la_invoice_payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoice_id").notNull().references(() => customLaInvoices.id, { onDelete: "cascade" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
  paymentDate: timestamp("payment_date").defaultNow().notNull(),
  referenceNumber: varchar("reference_number", { length: 100 }),
  notes: text("notes"),
  status: depositTransactionStatusEnum("status").default("completed").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customLaReceipts = pgTable("custom_la_receipts", {
  id: serial("id").primaryKey(),
  number: varchar("number", { length: 50 }).notNull().unique(),
  customLaRequestId: integer("custom_la_request_id").notNull().references(() => customLaRequests.id, { onDelete: "cascade" }),
  invoiceId: integer("invoice_id").references(() => customLaInvoices.id, { onDelete: "set null" }),
  paymentId: integer("payment_id").references(() => customLaInvoicePayments.id, { onDelete: "set null" }),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }).notNull(),
  balanceDue: decimal("balance_due", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  issueDate: timestamp("issue_date").defaultNow().notNull(),
  payerName: varchar("payer_name", { length: 255 }).notNull(),
  payerEmail: varchar("payer_email", { length: 255 }),
  payerPhone: varchar("payer_phone", { length: 50 }),
  payerAddress: text("payer_address"),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull(),
  amountInWords: text("amount_in_words"),
  notes: text("notes"),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Store-specific Enums
export const storePaymentStatusEnum = pgEnum('store_payment_status', ['unpaid', 'partial', 'paid', 'verified', 'failed']);
export const storeOrderStatusEnum = pgEnum('store_order_status', ['pending', 'processing', 'completed', 'cancelled']);
export const preOrderStatusEnum = pgEnum('pre_order_status', ['PO_OPEN', 'PO_CLOSED', 'PURCHASING', 'SHIPPING_FROM_SAUDI', 'ARRIVED_INDONESIA', 'LOCAL_DELIVERY', 'COMPLETED']);
export const shipmentStatusEnum = pgEnum('shipment_status', ['PENDING', 'PACKING', 'READY_TO_SHIP', 'SHIPPED_FROM_SAUDI', 'ARRIVED_INDONESIA', 'CUSTOMS_CLEARANCE', 'LOCAL_COURIER', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED_DELIVERY', 'RETURNED']);

// Store Categories
export const storeCategories = pgTable('store_categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Store Products
export const storeProducts = pgTable('store_products', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  categoryId: integer('category_id').notNull().references(() => storeCategories.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 100 }).notNull(),
  stock: integer('stock').default(0).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  promoPrice: decimal('promo_price', { precision: 10, scale: 2 }),
  weight: decimal('weight', { precision: 10, scale: 2 }).default('0.00').notNull(), // in kg
  dimensions: varchar('dimensions', { length: 100 }), // e.g. "20x15x10"
  isActive: boolean('is_active').default(true).notNull(),
  isPreOrder: boolean('is_pre_order').default(false).notNull(),
  preOrderOpenDate: timestamp('pre_order_open_date'),
  preOrderCloseDate: timestamp('pre_order_close_date'),
  estimatedArrivalDate: timestamp('estimated_arrival_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Store Product Images
export const storeProductImages = pgTable('store_product_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  imageUrl: text('image_url').notNull(),
  thumbnail: boolean('thumbnail').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Store Carts
export const storeCarts = pgTable('store_carts', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Store Cart Items
export const storeCartItems = pgTable('store_cart_items', {
  id: serial('id').primaryKey(),
  cartId: integer('cart_id').notNull().references(() => storeCarts.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').default(1).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Store Orders
export const storeOrders = pgTable('store_orders', {
  id: serial('id').primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(), // e.g. ORD-2026-XXXXXX
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  shippingCost: decimal('shipping_cost', { precision: 10, scale: 2 }).default('0.00').notNull(),
  discountAmount: decimal('discount_amount', { precision: 10, scale: 2 }).default('0.00').notNull(),
  finalAmount: decimal('final_amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  paymentStatus: storePaymentStatusEnum('payment_status').default('unpaid').notNull(),
  orderStatus: storeOrderStatusEnum('order_status').default('pending').notNull(),
  preOrderStatus: preOrderStatusEnum('pre_order_status'), // For PO orders tracking
  shippingName: varchar('shipping_name', { length: 255 }).notNull(),
  shippingPhone: varchar('shipping_phone', { length: 50 }).notNull(),
  shippingAddress: text('shipping_address').notNull(),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  courierName: varchar('courier_name', { length: 100 }),
  estimatedDelivery: timestamp('estimated_delivery'),
  isPreOrder: boolean('is_pre_order').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Store Order Items
export const storeOrderItems = pgTable('store_order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => storeOrders.id, { onDelete: 'cascade' }),
  productId: integer('product_id').notNull().references(() => storeProducts.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Store Payments (Manual Uploads)
export const storePayments = pgTable('store_payments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => storeOrders.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  bankName: varchar('bank_name', { length: 100 }).notNull(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  paymentProofUrl: text('payment_proof_url').notNull(),
  notes: text('notes'),
  status: varchar('status', { length: 50 }).default('pending').notNull(), // 'pending', 'approved', 'rejected'
  verifiedBy: text('verified_by').references(() => user.id, { onDelete: 'set null' }),
  verifiedAt: timestamp('verified_by_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Store Shipments
export const storeShipments = pgTable('store_shipments', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').notNull().references(() => storeOrders.id, { onDelete: 'cascade' }),
  trackingNumber: varchar('tracking_number', { length: 100 }).notNull(),
  courierName: varchar('courier_name', { length: 100 }).notNull(),
  status: shipmentStatusEnum('status').default('PENDING').notNull(),
  estimatedArrival: timestamp('estimated_arrival'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Store Shipment Logs (Timeline)
export const storeShipmentLogs = pgTable('store_shipment_logs', {
  id: serial('id').primaryKey(),
  shipmentId: integer('shipment_id').notNull().references(() => storeShipments.id, { onDelete: 'cascade' }),
  status: shipmentStatusEnum('status').notNull(),
  description: text('description').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});


export type InvoicePayment = typeof invoicePayments.$inferSelect;
export type NewInvoicePayment = typeof invoicePayments.$inferInsert;
export type ServiceOrderReceipt = typeof serviceOrderReceipts.$inferSelect;
export type NewServiceOrderReceipt = typeof serviceOrderReceipts.$inferInsert;
export type Hotel = typeof hotels.$inferSelect;
export type NewHotel = typeof hotels.$inferInsert;
export type HotelPricingPeriod = typeof hotelPricingPeriods.$inferSelect;
export type NewHotelPricingPeriod = typeof hotelPricingPeriods.$inferInsert;
export type TransportationRouteMaster = typeof transportationRoutesMaster.$inferSelect;
export type NewTransportationRouteMaster = typeof transportationRoutesMaster.$inferInsert;
export type TransportationRoutePricingPeriod = typeof transportationRoutePricingPeriods.$inferSelect;
export type NewTransportationRoutePricingPeriod = typeof transportationRoutePricingPeriods.$inferInsert;
export type CustomLaRequest = typeof customLaRequests.$inferSelect;
export type NewCustomLaRequest = typeof customLaRequests.$inferInsert;
export type Muthowif = typeof muthowifs.$inferSelect;
export type NewMuthowif = typeof muthowifs.$inferInsert;
export type MuthowifAssignment = typeof muthowifAssignments.$inferSelect;
export type NewMuthowifAssignment = typeof muthowifAssignments.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type CustomLaInvoice = typeof customLaInvoices.$inferSelect;
export type NewCustomLaInvoice = typeof customLaInvoices.$inferInsert;
export type CustomLaInvoicePayment = typeof customLaInvoicePayments.$inferSelect;
export type NewCustomLaInvoicePayment = typeof customLaInvoicePayments.$inferInsert;
export type ServiceOrderInvoicePayment = typeof serviceOrderInvoicePayments.$inferSelect;
export type NewServiceOrderInvoicePayment = typeof serviceOrderInvoicePayments.$inferInsert;
export type TransportationInvoicePayment = typeof transportationInvoicePayments.$inferSelect;
export type NewTransportationInvoicePayment = typeof transportationInvoicePayments.$inferInsert;
export type CustomLaReceipt = typeof customLaReceipts.$inferSelect;
export type NewCustomLaReceipt = typeof customLaReceipts.$inferInsert;

export type StoreCategory = typeof storeCategories.$inferSelect;
export type NewStoreCategory = typeof storeCategories.$inferInsert;
export type StoreProduct = typeof storeProducts.$inferSelect;
export type NewStoreProduct = typeof storeProducts.$inferInsert;
export type StoreProductImage = typeof storeProductImages.$inferSelect;
export type NewStoreProductImage = typeof storeProductImages.$inferInsert;
export type StoreCart = typeof storeCarts.$inferSelect;
export type NewStoreCart = typeof storeCarts.$inferInsert;
export type StoreCartItem = typeof storeCartItems.$inferSelect;
export type NewStoreCartItem = typeof storeCartItems.$inferInsert;
export type StoreOrder = typeof storeOrders.$inferSelect;
export type NewStoreOrder = typeof storeOrders.$inferInsert;
export type StoreOrderItem = typeof storeOrderItems.$inferSelect;
export type NewStoreOrderItem = typeof storeOrderItems.$inferInsert;
export type StorePayment = typeof storePayments.$inferSelect;
export type NewStorePayment = typeof storePayments.$inferInsert;
export type StoreShipment = typeof storeShipments.$inferSelect;
export type NewStoreShipment = typeof storeShipments.$inferInsert;
export type StoreShipmentLog = typeof storeShipmentLogs.$inferSelect;
export type NewStoreShipmentLog = typeof storeShipmentLogs.$inferInsert;

export const storeProductsRelations = relations(storeProducts, ({ one, many }) => ({
  category: one(storeCategories, {
    fields: [storeProducts.categoryId],
    references: [storeCategories.id]
  }),
  images: many(storeProductImages)
}));

export const storeProductImagesRelations = relations(storeProductImages, ({ one }) => ({
  product: one(storeProducts, {
    fields: [storeProductImages.productId],
    references: [storeProducts.id]
  })
}));

export const storeCartsRelations = relations(storeCarts, ({ many }) => ({
  items: many(storeCartItems)
}));

export const storeCartItemsRelations = relations(storeCartItems, ({ one }) => ({
  cart: one(storeCarts, {
    fields: [storeCartItems.cartId],
    references: [storeCarts.id]
  }),
  product: one(storeProducts, {
    fields: [storeCartItems.productId],
    references: [storeProducts.id]
  })
}));

export const storeOrdersRelations = relations(storeOrders, ({ many }) => ({
  items: many(storeOrderItems),
  payments: many(storePayments),
  shipments: many(storeShipments)
}));

export const storeOrderItemsRelations = relations(storeOrderItems, ({ one }) => ({
  order: one(storeOrders, {
    fields: [storeOrderItems.orderId],
    references: [storeOrders.id]
  }),
  product: one(storeProducts, {
    fields: [storeOrderItems.productId],
    references: [storeProducts.id]
  })
}));

export const storePaymentsRelations = relations(storePayments, ({ one }) => ({
  order: one(storeOrders, {
    fields: [storePayments.orderId],
    references: [storeOrders.id]
  })
}));

export const storeShipmentsRelations = relations(storeShipments, ({ one, many }) => ({
  order: one(storeOrders, {
    fields: [storeShipments.orderId],
    references: [storeOrders.id]
  }),
  logs: many(storeShipmentLogs)
}));

export const storeShipmentLogsRelations = relations(storeShipmentLogs, ({ one }) => ({
  shipment: one(storeShipments, {
    fields: [storeShipmentLogs.shipmentId],
    references: [storeShipments.id]
  })
}));

// Store User Addresses table
export const storeUserAddresses = pgTable('store_user_addresses', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 100 }).notNull(), // e.g. 'Rumah', 'Kantor'
  recipientName: varchar('recipient_name', { length: 255 }).notNull(),
  recipientPhone: varchar('recipient_phone', { length: 50 }).notNull(),
  shippingAddress: text('shipping_address').notNull(),
  province: varchar('province', { length: 100 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  postalCode: varchar('postal_code', { length: 20 }).notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const storeUserAddressesRelations = relations(storeUserAddresses, ({ one }) => ({
  user: one(user, {
    fields: [storeUserAddresses.userId],
    references: [user.id]
  })
}));



// Muthowif Bookings
export const muthowifBookingEventEnum = pgEnum('muthowif_booking_event', ['Umrah', 'Makkah City Tour', 'Madinah City Tour']);
export const muthowifBookingStatusEnum = pgEnum('muthowif_booking_status', ['pending', 'confirmed', 'completed', 'cancelled']);

export const muthowifBookings = pgTable('muthowif_bookings', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: MB-YYYY-XXXX
  clientId: integer('client_id').notNull().references(() => clients.id, { onDelete: 'cascade' }),
  guestName: varchar('guest_name', { length: 255 }).notNull(),
  dateTime: timestamp('date_time').notNull(),
  event: muthowifBookingEventEnum('event').notNull(),
  totalPax: integer('total_pax').notNull(),
  meetingPoint: varchar('meeting_point', { length: 255 }).notNull(),
  status: muthowifBookingStatusEnum('status').default('pending').notNull(),
  totalAmount: decimal('total_amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  assignedMuthowifId: integer('assigned_muthowif_id').references(() => muthowifs.id, { onDelete: 'set null' }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const muthowifInvoices = pgTable('muthowif_invoices', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: MBI-YYYY-XXXX
  muthowifBookingId: integer('muthowif_booking_id').notNull().references(() => muthowifBookings.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  paidAmount: decimal('paid_amount', { precision: 10, scale: 2 }).default('0').notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  issueDate: timestamp('issue_date').notNull(),
  dueDate: timestamp('due_date').notNull(),
  status: invoiceStatusEnum('status').default('draft').notNull(),
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const muthowifInvoicePayments = pgTable('muthowif_invoice_payments', {
  id: serial('id').primaryKey(),
  invoiceId: integer('invoice_id').notNull().references(() => muthowifInvoices.id, { onDelete: 'cascade' }),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).default('SAR').notNull(),
  method: varchar('method', { length: 50 }),
  referenceNumber: varchar('reference_number', { length: 100 }),
  paidAt: timestamp('paid_at').notNull(),
  status: depositTransactionStatusEnum('status').default('completed').notNull(),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const muthowifReceipts = pgTable('muthowif_receipts', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: MBR-YYYY-XXXX
  muthowifBookingId: integer('muthowif_booking_id').notNull().references(() => muthowifBookings.id, { onDelete: 'cascade' }),
  muthowifInvoiceId: integer('muthowif_invoice_id').references(() => muthowifInvoices.id, { onDelete: 'set null' }),
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
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const muthowifVouchers = pgTable('muthowif_vouchers', {
  id: serial('id').primaryKey(),
  number: varchar('number', { length: 50 }).notNull().unique(), // Format: MBV-YYYY-XXXX
  muthowifBookingId: integer('muthowif_booking_id').notNull().references(() => muthowifBookings.id, { onDelete: 'cascade' }),
  issueDate: timestamp('issue_date').defaultNow().notNull(),
  pdfUrl: text('pdf_url'),
  meta: jsonb('meta'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type MuthowifBooking = typeof muthowifBookings.$inferSelect;
export type NewMuthowifBooking = typeof muthowifBookings.$inferInsert;
export type MuthowifInvoice = typeof muthowifInvoices.$inferSelect;
export type NewMuthowifInvoice = typeof muthowifInvoices.$inferInsert;
export type MuthowifInvoicePayment = typeof muthowifInvoicePayments.$inferSelect;
export type NewMuthowifInvoicePayment = typeof muthowifInvoicePayments.$inferInsert;
export type MuthowifReceipt = typeof muthowifReceipts.$inferSelect;
export type NewMuthowifReceipt = typeof muthowifReceipts.$inferInsert;
export type MuthowifVoucher = typeof muthowifVouchers.$inferSelect;
export type NewMuthowifVoucher = typeof muthowifVouchers.$inferInsert;
