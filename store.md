# Musafirin Store PRD
## Saudi Souvenir & Cross-Border Commerce Platform

Version: 1.0  
Author: Product Owner Team  
Platform: Musafirin  
Document Type: Product Requirements Document (PRD)

---

# 1. Product Overview

## Product Name
Musafirin Store

## Product Summary
Musafirin Store adalah fitur e-commerce khusus oleh-oleh Saudi yang terintegrasi dengan ekosistem layanan Umrah dan Haji pada platform Musafirin.

Fitur ini memungkinkan:
- Jamaah membeli oleh-oleh Saudi
- Keluarga di Indonesia titip oleh-oleh
- Travel agent melakukan bulk order
- Pengiriman langsung Saudi → Indonesia
- Tracking logistik lintas negara
- Sistem pre-order produk Saudi

---

# 2. Vision

Menjadikan Musafirin sebagai:
- One-stop Umrah ecosystem
- Saudi cross-border commerce platform
- Trusted Saudi souvenir platform for Indonesian pilgrims

---

# 3. Problem Statement

## Existing Problems

### Jamaah
- Bingung mencari toko terpercaya
- Waktu belanja terbatas
- Capek keliling toko
- Overbagasi koper
- Harga tidak transparan

### Keluarga di Indonesia
- Sulit titip barang
- Tidak tahu harga asli Saudi
- Tidak ada sistem terpercaya

### Travel Agent
- Sulit mengelola souvenir jamaah
- Tidak punya supplier tetap
- Sulit melakukan bulk order

---

# 4. Product Goals

## Business Goals
- Additional revenue stream
- Increase retention
- Increase transaction frequency
- Cross-selling ecosystem
- B2B supplier untuk travel Umrah

## User Goals
- Belanja praktis
- Harga transparan
- Produk original Saudi
- Bisa dikirim ke Indonesia
- Tidak repot membawa koper

---

# 5. User Personas

## Persona 1 — Jamaah Umrah
### Needs
- Oleh-oleh praktis
- Tidak ribet belanja
- Bisa dikirim ke rumah

---

## Persona 2 — Keluarga di Indonesia
### Needs
- Titip barang dari Saudi
- Harga lebih murah
- Barang asli Saudi

---

## Persona 3 — Travel Agent
### Needs
- Bulk order souvenir
- Paket hampers jamaah
- Supplier terpercaya

---

# 6. Business Model

## Model 1 — Direct Selling
Musafirin membeli stok lalu menjual kembali.

### Example
- Kurma
- Sajadah
- Tasbih
- Parfum

---

## Model 2 — Pre Order (PO)
Barang dibeli setelah order masuk.

### Example
- Premium dates
- Oud luxury
- Abaya premium
- Gold accessories

---

## Model 3 — Jastip Premium
User request custom item.

### Example
- "Cari ajwa Madinah 10kg"
- "Cari abaya warna olive"

---

## Model 4 — B2B Wholesale
Travel agent membeli:
- souvenir jamaah
- hampers
- perlengkapan Umrah

---

# 7. MVP Scope

# Included Features

## Product Catalog
- Product list
- Product detail
- Category
- Search
- Product images
- Product stock
- Product variants

---

## Shopping Cart
- Add to cart
- Update quantity
- Remove item

---

## Checkout
- Shipping address
- Payment upload
- Order summary

---

## Order Management
- Order status
- Invoice
- Payment confirmation

---

## Logistics Tracking
- Shipment tracking number
- Tracking timeline
- Delivery status
- International shipment monitoring

---

## Pre Order System
- PO open/close date
- Estimated arrival date
- Deposit payment
- PO status tracking

---

## Admin Dashboard
- CRUD product
- Manage stock
- Manage shipment
- Manage PO
- Manage orders

---

# Excluded From MVP

- AI recommendation
- Loyalty point
- Marketplace vendor
- Auto shipping API integration
- Live courier GPS tracking

---

# 8. Product Categories

## Food
- Kurma
- Madu
- Coklat
- Kacang Arab
- Zamzam

---

## Religious
- Sajadah
- Tasbih
- Mushaf
- Siwak

---

## Fashion
- Abaya
- Gamis
- Hijab
- Peci

---

## Perfume
- Oud
- Bukhoor
- Arabic perfume

---

## Souvenir
- Magnet kulkas
- Gantungan kunci
- Gelang

---

# 9. User Flow

# Flow A — Regular Purchase

```text
Browse Product
→ Add To Cart
→ Checkout
→ Upload Payment
→ Admin Confirm
→ Packing
→ Shipment
→ Tracking
→ Delivered
Flow B — Pre Order
Browse PO Product
→ Checkout
→ Deposit Payment
→ Waiting PO Close
→ Saudi Purchasing
→ International Shipment
→ Tracking
→ Delivered
Flow C — Travel Agent Bulk Order
Request Quotation
→ Admin Negotiation
→ Payment
→ Bulk Processing
→ Shipment
→ Delivery
10. Product Module
Product Entity
Product
- id
- name
- slug
- description
- categoryId
- sku
- stock
- price
- promoPrice
- weight
- dimensions
- active
- isPreOrder
- preOrderOpenDate
- preOrderCloseDate
- estimatedArrivalDate
- createdAt
Product Images
ProductImage
- id
- productId
- imageUrl
- thumbnail
- sortOrder
11. Order Module
Order Entity
Order
- id
- orderNumber
- userId
- totalAmount
- shippingCost
- discountAmount
- finalAmount
- paymentStatus
- orderStatus
- shippingAddressId
- trackingNumber
- courierName
- estimatedDelivery
- createdAt
Order Item
OrderItem
- id
- orderId
- productId
- quantity
- price
- subtotal
12. Pre Order System
Purpose

Mengurangi risiko dead stock dan menjaga cashflow.

PO Flow
PO Open
→ Customer Order
→ Deposit Payment
→ PO Closed
→ Saudi Purchasing
→ International Shipping
→ Local Distribution
→ Delivered
PO Features
Admin
Open PO
Close PO
Minimum quantity target
ETA management
User
View ETA
Track PO progress
Deposit payment
Remaining payment
PO Status
PO_OPEN
PO_CLOSED
PURCHASING
SHIPPING_FROM_SAUDI
ARRIVED_INDONESIA
LOCAL_DELIVERY
COMPLETED
13. Logistics Tracking System
Goal

Memberikan transparansi pengiriman Saudi → Indonesia.

Tracking Features
User Features
Real-time shipment status
Shipment timeline
Tracking number
Courier information
Estimated arrival
Admin Features
Input AWB
Update shipment status
Manage batch shipment
Bulk update tracking
Shipment Status
PENDING
PACKING
READY_TO_SHIP
SHIPPED_FROM_SAUDI
ARRIVED_INDONESIA
CUSTOMS_CLEARANCE
LOCAL_COURIER
OUT_FOR_DELIVERY
DELIVERED
FAILED_DELIVERY
RETURNED
Shipment Timeline Example
20 Jun 2026 — Barang dipacking
21 Jun 2026 — Barang dikirim dari Jeddah
23 Jun 2026 — Barang tiba di Jakarta
24 Jun 2026 — Customs clearance
25 Jun 2026 — Diserahkan ke kurir lokal
26 Jun 2026 — Delivered
14. Logistics Architecture Recommendation
MVP Recommendation

Gunakan:

Manual AWB input
Manual status update
Batch shipment processing

Karena:

lebih cepat development
lebih murah
lebih realistis untuk early-stage startup
Future Integration

Integrasi:

JNE
SiCepat
SAPX
Ninja Express
DHL
FedEx
15. Payment System
MVP Payment
Bank transfer
Upload payment proof
Future Payment
Midtrans
Xendit
Stripe
16. Admin Dashboard
Product Management
CRUD product
Upload images
Stock management
Category management
Order Management
View order
Confirm payment
Update shipment
Input AWB
PO Management
Open PO
Close PO
Set ETA
Set minimum quantity
Shipment Management
Update tracking
Batch shipment
Shipment monitoring
17. Suggested Backend Architecture
store/
├── product/
├── category/
├── cart/
├── order/
├── payment/
├── shipment/
├── preorder/
├── voucher/
├── inventory/
18. Suggested Database Tables
products
product_images
categories
carts
cart_items
orders
order_items
payments
shipments
shipment_logs
pre_orders
pre_order_items
vouchers
inventory_logs
19. Recommended Technology
Frontend
Next.js
TypeScript
Tailwind
Shadcn UI
Backend
Spring Boot
PostgreSQL
Redis
File Storage
Cloudflare R2
Deployment
Docker
VPS / Cloudflare Tunnel
20. Future Features
Phase 2
AI Recommendation

"Jamaah lain juga membeli ini"

Phase 3
Smart Bundle
Paket Oleh-Oleh 500rb
Paket Haji VIP
Paket Keluarga
Phase 4
Multi Vendor Marketplace

Supplier Saudi dapat membuka toko sendiri.

21. KPI
Business KPI
Monthly GMV
Average Order Value
Repeat Purchase
Conversion Rate
Operational KPI
Shipment success rate
Refund rate
Delivery time
PO completion rate
22. Strategic Recommendation
Recommended MVP Strategy

Jangan mulai dengan:

ribuan produk
marketplace besar
sistem terlalu kompleks
Start With

20–30 produk:

high demand
ringan
margin bagus
mudah dikirim
Recommended First Products
Kurma
Parfum
Tasbih
Sajadah
Coklat
Bukhoor
23. Biggest Opportunity

Musafirin Store sebenarnya bukan sekadar toko oleh-oleh.

Tetapi:

Saudi Cross-Border Commerce Infrastructure

Karena:

jamaah Indonesia sangat besar
budaya titip sangat kuat
trust terhadap Saudi sangat tinggi
market Umrah repeat terus setiap tahun
24. Final Product Vision

Future Vision:

Musafirin
=
Umrah Ecosystem
+
Saudi Commerce
+
Travel Infrastructure
+
Cross-border Logistics