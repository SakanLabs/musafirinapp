# PRD — Fitur Hotel Request untuk Agen Umrah

## 1. Ringkasan Produk

Fitur **Hotel Request** adalah fitur untuk membantu agen/travel mengajukan permintaan hotel kepada platform Musafirin, baik untuk kebutuhan **individual/FIT** maupun **group/rombongan**. Agen cukup mengisi kebutuhan hotel, lalu admin Musafirin memproses permintaan tersebut sampai menghasilkan **quotation/penawaran, invoice, kwitansi, dan voucher hotel**.

Fitur ini dibuat untuk B2B/agen, tetapi tetap berada dalam ekosistem Musafirin yang juga melayani B2C/direct jamaah.

Tujuan utama fitur ini adalah membuat proses request hotel menjadi:

- Simple
- Clear
- Mudah dilacak
- Terdokumentasi
- Profesional untuk agen
- Efisien untuk admin

---

## 2. Background / Problem

Agen Umrah sering membutuhkan hotel untuk jamaah individual maupun group. Proses saat ini biasanya dilakukan secara manual melalui WhatsApp, telepon, atau komunikasi langsung dengan vendor/hotel.

Masalah yang sering muncul:

1. Informasi request tidak lengkap.
2. Admin harus bolak-balik bertanya detail kebutuhan.
3. Agen sulit melacak status request.
4. Penawaran, invoice, kwitansi, dan voucher tersebar di chat.
5. Tidak ada riwayat permintaan yang rapi.
6. Sulit membedakan request individual dan group.
7. Proses admin tidak terstruktur.
8. Agen tidak tahu apakah permintaan sedang dicari, menunggu konfirmasi, sudah invoiced, atau sudah issued voucher.

Dengan fitur Hotel Request, semua proses dimasukkan ke satu sistem yang rapi dan mudah digunakan.

---

## 3. Product Architecture Decision

Fitur Hotel Request untuk agen **tidak digabung mentah-mentah dengan platform B2C/direct jamaah**, tetapi juga **tidak dibuat sebagai brand/domain yang benar-benar terpisah**.

Keputusan produk yang direkomendasikan:

> **Satu brand, satu ekosistem, satu backend, tetapi experience B2C dan B2B/agen dipisahkan.**

### 3.1 Struktur Platform

Musafirin menjadi umbrella platform untuk semua layanan Umrah di Saudi.

Struktur jangka panjang yang direkomendasikan:

```text
musafirin.com          → public website dan B2C/direct jamaah
agent.musafirin.com    → dedicated portal untuk agen/travel partner
admin.musafirin.com    → internal admin Musafirin
```

Alternatif untuk MVP jika belum ingin memakai subdomain:

```text
musafirin.com/umrah-mandiri       → B2C/direct jamaah
musafirin.com/agent               → B2B/agent portal
musafirin.com/admin               → admin internal
```

Namun untuk positioning jangka panjang, `agent.musafirin.com` lebih profesional untuk agent portal.

### 3.2 Alasan Keputusan

B2C dan B2B memiliki kebutuhan yang berbeda.

B2C/direct jamaah membutuhkan pengalaman yang lebih edukatif, sederhana, dan menenangkan. Fokusnya adalah membantu jamaah atau keluarga memahami cara mengatur Umrah mandiri, memilih layanan, dan melakukan request bantuan.

B2B/agen membutuhkan pengalaman yang lebih operasional dan administratif. Agen membutuhkan request group, tracking progress, quotation, invoice, kwitansi, voucher, riwayat transaksi, dokumen, dan komunikasi status yang jelas.

Jika keduanya dicampur dalam satu dashboard yang sama, B2C akan merasa terlalu rumit, sementara agen akan merasa fiturnya kurang profesional. Karena itu, experience perlu dipisahkan.

Namun, pemisahan ini tidak perlu sampai membuat brand atau domain baru yang berbeda. Brand tetap Musafirin agar trust, SEO, dan positioning tidak pecah.

### 3.3 Prinsip Implementasi

- Brand utama tetap Musafirin.
- Backend tetap satu ekosistem.
- Database bisa tetap satu dengan role dan permission yang jelas.
- Modul reusable, misalnya invoice, payment, notification, file upload, document generation, dan status tracking.
- Frontend bisa dimulai dari satu codebase dengan route/layout berbeda.
- Agent portal memiliki dashboard, menu, dan flow khusus agen.
- B2C/direct jamaah memiliki flow yang lebih sederhana dan edukatif.
- Admin panel tetap satu untuk mengelola request dari B2C maupun B2B.

### 3.4 Positioning Platform

#### Musafirin Direct

Untuk jamaah individu atau keluarga.

Positioning:

> Atur perjalanan Umrah mandiri dengan layanan terpercaya di Saudi.

Contoh fitur:

- Visa
- Hotel
- Transport
- Mutawwif
- City tour
- Edukasi Umrah mandiri
- Itinerary assistance

#### Musafirin Agent Partner

Untuk travel agent dan penyelenggara Umrah.

Positioning:

> Portal B2B untuk travel agent yang membutuhkan support layanan hotel, visa, transport, mutawwif, dan handling di Saudi.

Contoh fitur:

- Hotel request individual/group
- Visa request
- Transport request
- Mutawwif request
- Group handling
- Invoice
- Kwitansi
- Voucher
- Request tracking
- Agent company profile
- Payment history

### 3.5 MVP Recommendation

Untuk MVP, tidak perlu langsung membuat aplikasi frontend yang benar-benar terpisah secara teknis. Implementasi awal bisa menggunakan:

- Satu frontend codebase
- Layout berbeda untuk public/B2C dan agent portal
- Role-based routing
- Role-based menu
- Backend service yang sama
- Admin panel yang sama

Jika traffic, kompleksitas, dan kebutuhan operasional sudah meningkat, agent portal dapat dipisah menjadi aplikasi frontend khusus di subdomain `agent.musafirin.com`.

---

## 4. Goals

### 4.1 Business Goals

- Membantu Musafirin menjadi platform layanan Umrah yang lengkap untuk agen.
- Mengurangi ketergantungan pada komunikasi manual WhatsApp.
- Meningkatkan kepercayaan agen dengan tracking status yang jelas.
- Memudahkan admin mengelola banyak permintaan hotel.
- Membuka peluang revenue dari markup hotel, handling fee, atau service fee.
- Membuat data transaksi hotel terdokumentasi untuk analisis bisnis.

### 4.2 User Goals — Agen

- Agen bisa request hotel dengan cepat.
- Agen bisa request untuk jamaah individual atau group.
- Agen bisa melihat status progress request.
- Agen bisa menerima quotation/penawaran dengan jelas.
- Agen bisa mendapatkan invoice, kwitansi, dan voucher dalam satu tempat.
- Agen bisa melihat riwayat request sebelumnya.

### 4.3 Admin Goals

- Admin bisa melihat semua request hotel dari agen.
- Admin bisa memfilter request berdasarkan status, kota, tanggal, agen, dan tipe request.
- Admin bisa memproses request secara bertahap.
- Admin bisa mengirim penawaran ke agen.
- Admin bisa menerbitkan invoice, kwitansi, dan voucher.
- Admin bisa mencatat harga modal, harga jual, margin, dan supplier/hotel.

---

## 5. Scope MVP

### Included in MVP

1. Agen membuat hotel request.
2. Request bisa berupa individual/FIT atau group/rombongan.
3. Agen mengisi detail kebutuhan hotel.
4. Admin melihat daftar request.
5. Admin memproses request dan update status.
6. Admin membuat quotation/penawaran.
7. Agen bisa accept, reject, atau request revision quotation.
8. Admin menerbitkan invoice.
9. Agen upload bukti pembayaran.
10. Admin memverifikasi pembayaran.
11. Admin menerbitkan kwitansi.
12. Admin menerbitkan voucher hotel.
13. Agen bisa download semua dokumen.
14. Agen bisa tracking progress.

### Not Included in MVP

1. Integrasi API hotel real-time.
2. Auto booking langsung ke hotel.
3. Auto room allotment management.
4. Multi-currency settlement lanjutan.
5. Marketplace supplier hotel.
6. Dynamic hotel inventory seperti OTA.
7. Auto cancellation penalty calculation.
8. Integrasi payment gateway otomatis.

---

## 6. Product Principles

1. **Simple first**  
   Jangan terlalu banyak field di awal. Field tambahan dibuat opsional.

2. **Clear status**  
   Agen harus selalu tahu posisi request-nya.

3. **One request, one timeline**  
   Semua aktivitas request tersimpan dalam satu timeline.

4. **Document-ready**  
   Invoice, kwitansi, dan voucher harus mudah diakses.

5. **Admin-friendly**  
   Admin harus bisa memproses request tanpa terlalu banyak klik.

6. **B2B professional**  
   Tampilan harus bersih, rapi, dan kredibel untuk agen.

---

## 7. Main User Flow

### 7.1 Flow Agen — Membuat Request Hotel

1. Agen login ke dashboard agent portal.
2. Agen buka menu **Hotel Request**.
3. Agen klik **Create Hotel Request**.
4. Agen memilih tipe request:
   - Individual/FIT
   - Group/Rombongan
5. Agen mengisi form kebutuhan hotel.
6. Agen submit request.
7. Sistem membuat nomor request otomatis.
8. Status awal menjadi **Submitted**.
9. Agen melihat request di halaman tracking.

### 7.2 Flow Admin — Memproses Request

1. Admin membuka daftar request hotel.
2. Admin melihat request baru.
3. Admin membuka detail request.
4. Admin memeriksa kelengkapan data.
5. Admin bisa meminta revisi/kelengkapan data jika perlu.
6. Admin mencari opsi hotel secara manual/offline.
7. Admin input quotation/penawaran ke sistem.
8. Status berubah menjadi **Quotation Sent**.
9. Agen menerima dan melihat quotation.

### 7.3 Flow Agen — Menyetujui Penawaran

1. Agen membuka detail request.
2. Agen melihat quotation.
3. Agen bisa:
   - Accept quotation
   - Reject quotation
   - Request revision
4. Jika accept, status menjadi **Quotation Accepted**.
5. Admin menerbitkan invoice.

### 7.4 Flow Pembayaran dan Dokumen

1. Admin generate invoice.
2. Agen download invoice.
3. Agen melakukan pembayaran.
4. Agen upload payment proof.
5. Admin verifikasi pembayaran.
6. Jika valid, status menjadi **Paid**.
7. Sistem/admin generate kwitansi.
8. Admin upload atau generate voucher hotel.
9. Status menjadi **Voucher Issued**.
10. Agen download voucher hotel.
11. Request selesai.

---

## 8. Request Types

### 8.1 Individual / FIT Request

Digunakan untuk permintaan hotel skala kecil, misalnya 1 keluarga, 1 jamaah, atau beberapa orang.

Required fields:

- City: Makkah / Madinah / Jeddah / Thaif / Other
- Check-in date
- Check-out date
- Number of nights
- Number of guests
- Room type preference
- Meal plan
- Hotel star preference
- Budget range
- Special request / notes

Optional fields:

- Preferred hotel name
- Distance preference from Haram/Nabawi
- Guest names
- Nationality
- Bed preference
- Smoking/non-smoking preference
- Early check-in request
- Late check-out request

### 8.2 Group / Rombongan Request

Digunakan untuk permintaan hotel rombongan, biasanya jamaah Umrah dari travel agent.

Required fields:

- Group name
- City
- Check-in date
- Check-out date
- Number of nights
- Total pax
- Room arrangement
- Meal plan
- Hotel star preference
- Budget range
- Special request / notes

Room arrangement fields:

- Single room quantity
- Double room quantity
- Triple room quantity
- Quad room quantity
- Extra bed quantity

Optional fields:

- Preferred hotel name
- Distance preference from Haram/Nabawi
- Arrival date and time
- Departure date and time
- Transport schedule
- Group leader name
- Group leader phone number
- Guest manifest upload
- Special meal request
- Wheelchair request
- Elderly jamaah notes

---

## 9. Hotel Request Status

### 9.1 Internal Status

1. **Draft** — Request belum dikirim oleh agen.
2. **Submitted** — Request sudah dikirim dan menunggu diproses admin.
3. **Need More Info** — Admin membutuhkan informasi tambahan dari agen.
4. **In Review** — Admin sedang memeriksa dan mencari opsi hotel.
5. **Quotation Sent** — Admin sudah mengirim penawaran.
6. **Quotation Revision Requested** — Agen meminta revisi penawaran.
7. **Quotation Accepted** — Agen menyetujui penawaran.
8. **Invoice Issued** — Invoice sudah diterbitkan.
9. **Payment Uploaded** — Agen sudah upload bukti pembayaran.
10. **Paid** — Pembayaran sudah diverifikasi.
11. **Voucher Issued** — Voucher hotel sudah diterbitkan.
12. **Completed** — Request selesai.
13. **Cancelled** — Request dibatalkan.
14. **Rejected** — Request tidak dapat diproses.

### 9.2 Simplified Agent Status

Agar tidak membingungkan agen, status bisa ditampilkan dalam 5 tahap utama:

1. Request Submitted
2. Processing
3. Quotation
4. Payment
5. Voucher Issued

### 9.3 Status Mapping

| Internal Status | Agent Display Status |
|---|---|
| Draft | Draft |
| Submitted | Request Submitted |
| Need More Info | Action Required |
| In Review | Processing |
| Quotation Sent | Quotation |
| Quotation Revision Requested | Quotation |
| Quotation Accepted | Payment |
| Invoice Issued | Payment |
| Payment Uploaded | Payment Verification |
| Paid | Voucher Processing |
| Voucher Issued | Voucher Issued |
| Completed | Completed |
| Cancelled | Cancelled |
| Rejected | Rejected |

---

## 10. Key Features

### 10.1 Agent Hotel Request Dashboard

Agen dapat melihat semua request hotel yang pernah dibuat.

Displayed data:

- Request number
- Request type
- City
- Check-in date
- Check-out date
- Pax
- Status
- Last update
- Action button

Filters:

- Status
- City
- Request type
- Date range
- Search by request number/group name

Actions:

- View detail
- Continue draft
- Download invoice
- Download receipt
- Download voucher
- Upload payment proof

### 10.2 Create Hotel Request Form

Suggested form steps:

1. Request Type
2. Stay Details
3. Room & Meal Details
4. Preference & Notes
5. Review & Submit

### 10.3 Request Detail Page for Agent

Sections:

1. Request summary
2. Progress tracker
3. Timeline/activity log
4. Quotation section
5. Invoice section
6. Payment proof section
7. Receipt section
8. Voucher section
9. Notes/messages from admin

### 10.4 Admin Hotel Request List

Displayed data:

- Request number
- Agent name
- Request type
- City
- Dates
- Pax
- Status
- Assigned admin
- Created date
- Last update

Filters:

- Status
- Agent
- City
- Type
- Check-in date range
- Created date range
- Assigned admin

Actions:

- View detail
- Assign to me
- Update status
- Create quotation
- Generate invoice
- Verify payment
- Upload/generate voucher

### 10.5 Admin Request Detail

Sections:

1. Request information
2. Agent information
3. Guest/group information
4. Room arrangement
5. Notes and special requests
6. Internal admin notes
7. Quotation management
8. Invoice management
9. Payment verification
10. Receipt management
11. Voucher management
12. Timeline log

### 10.6 Quotation Management

Admin bisa membuat satu atau beberapa opsi hotel sebagai penawaran.

Quotation fields:

- Hotel name
- City
- Star rating
- Distance from Haram/Nabawi
- Room type
- Meal plan
- Check-in date
- Check-out date
- Number of nights
- Quantity of rooms
- Cost price
- Selling price
- Currency
- Cancellation policy
- Payment deadline
- Notes

Agent view:

- Hotel name
- Star rating
- Distance
- Room arrangement
- Meal plan
- Total price
- Payment deadline
- Cancellation policy
- Accept / Reject / Request Revision button

Important rule:

> Cost price dan margin hanya boleh terlihat oleh admin, tidak boleh terlihat oleh agen.

### 10.7 Invoice Management

Setelah agen accept quotation, admin dapat generate invoice.

Invoice fields:

- Invoice number
- Request number
- Agent name
- Hotel details
- Stay dates
- Room arrangement
- Total amount
- Currency
- Payment deadline
- Bank/payment instruction
- Terms and conditions

Invoice status:

- Draft
- Issued
- Paid
- Cancelled

### 10.8 Payment Proof Upload

Agen dapat upload bukti pembayaran setelah invoice diterbitkan.

Fields:

- Invoice number
- Payment amount
- Payment date
- Bank sender name
- Payment proof file
- Notes

Accepted file types:

- PDF
- JPG
- JPEG
- PNG

Admin actions:

- Approve payment
- Reject payment
- Request re-upload

### 10.9 Receipt / Kwitansi Management

Setelah pembayaran valid, sistem/admin menerbitkan kwitansi.

Receipt fields:

- Receipt number
- Invoice number
- Agent name
- Payment amount
- Payment date
- Payment method
- Description
- Admin issuer

### 10.10 Hotel Voucher Management

Voucher adalah dokumen akhir yang diberikan kepada agen sebagai bukti booking hotel.

Voucher fields:

- Voucher number
- Request number
- Hotel name
- Hotel address
- City
- Check-in date
- Check-out date
- Number of nights
- Guest/group name
- Room arrangement
- Meal plan
- Booking reference
- Important notes
- Emergency contact / admin contact

MVP recommendation:

- Admin bisa upload voucher PDF manual.
- Sistem juga bisa generate voucher PDF sederhana dari data yang sudah diinput.

### 10.11 Timeline / Activity Log

Logged events:

- Request created
- Request submitted
- Admin assigned
- Status changed
- Admin requested more info
- Agent updated info
- Quotation sent
- Quotation accepted
- Quotation rejected
- Invoice issued
- Payment proof uploaded
- Payment approved
- Payment rejected
- Receipt issued
- Voucher issued
- Request completed
- Request cancelled

---

## 11. Notifications

### Agent Notifications

Agen menerima notifikasi saat:

- Request diterima
- Admin meminta informasi tambahan
- Quotation dikirim
- Invoice diterbitkan
- Payment proof diterima
- Payment approved/rejected
- Receipt diterbitkan
- Voucher diterbitkan
- Request dibatalkan/rejected

### Admin Notifications

Admin menerima notifikasi saat:

- Ada request baru
- Agen update informasi
- Agen accept/reject quotation
- Agen upload payment proof

MVP channels:

- In-app notification
- Email notification

WhatsApp notification masuk fase berikutnya.

---

## 12. Roles & Permissions

### 12.1 Agent

Can:

- Create hotel request
- View own requests
- Edit draft request
- Update request only when status is Need More Info
- View quotation
- Accept/reject/request revision quotation
- Download invoice
- Upload payment proof
- Download receipt
- Download voucher

Cannot:

- View other agents' requests
- See cost price/margin
- Change status manually
- Edit request after quotation accepted unless admin allows

### 12.2 Admin

Can:

- View all hotel requests
- Update status
- Assign request
- Add internal notes
- Create quotation
- Generate invoice
- Verify payment
- Generate/upload receipt
- Generate/upload voucher
- Cancel/reject request

### 12.3 Finance

Can:

- View invoice and payment data
- Verify payment
- Issue receipt

Cannot:

- Edit core hotel request details unless permitted

---

## 13. Data Model Draft

### 13.1 HotelRequest

Fields:

- id
- requestNumber
- agentId
- requestType: INDIVIDUAL / GROUP
- status
- city
- checkInDate
- checkOutDate
- numberOfNights
- totalPax
- hotelStarPreference
- budgetMin
- budgetMax
- currency
- mealPlan
- preferredHotelName
- distancePreference
- specialRequest
- groupName
- groupLeaderName
- groupLeaderPhone
- manifestFileUrl
- assignedAdminId
- createdAt
- createdBy
- modifiedAt
- modifiedBy
- isDeleted

### 13.2 HotelRequestRoom

Fields:

- id
- hotelRequestId
- roomType: SINGLE / DOUBLE / TRIPLE / QUAD / EXTRA_BED
- quantity
- paxPerRoom
- notes

### 13.3 HotelQuotation

Fields:

- id
- hotelRequestId
- quotationNumber
- status: DRAFT / SENT / ACCEPTED / REJECTED / EXPIRED / REVISION_REQUESTED
- hotelName
- hotelAddress
- city
- starRating
- distanceDescription
- mealPlan
- checkInDate
- checkOutDate
- numberOfNights
- costPrice
- sellingPrice
- currency
- cancellationPolicy
- paymentDeadline
- notesForAgent
- internalNotes
- createdAt
- createdBy

### 13.4 HotelQuotationRoom

Fields:

- id
- hotelQuotationId
- roomType
- quantity
- pricePerRoom
- totalPrice

### 13.5 HotelInvoice

Fields:

- id
- invoiceNumber
- hotelRequestId
- quotationId
- agentId
- status: DRAFT / ISSUED / PAID / CANCELLED
- subtotal
- discount
- tax
- serviceFee
- totalAmount
- currency
- paymentDeadline
- paymentInstruction
- invoicePdfUrl
- issuedAt
- paidAt

### 13.6 HotelPaymentProof

Fields:

- id
- invoiceId
- hotelRequestId
- agentId
- amount
- paymentDate
- senderBankName
- senderAccountName
- proofFileUrl
- status: PENDING / APPROVED / REJECTED
- adminNote
- verifiedBy
- verifiedAt

### 13.7 HotelReceipt

Fields:

- id
- receiptNumber
- invoiceId
- hotelRequestId
- amount
- paymentDate
- paymentMethod
- description
- receiptPdfUrl
- issuedBy
- issuedAt

### 13.8 HotelVoucher

Fields:

- id
- voucherNumber
- hotelRequestId
- quotationId
- hotelName
- hotelAddress
- guestOrGroupName
- checkInDate
- checkOutDate
- roomArrangementSummary
- mealPlan
- bookingReference
- voucherPdfUrl
- notes
- issuedBy
- issuedAt

### 13.9 HotelRequestTimeline

Fields:

- id
- hotelRequestId
- eventType
- title
- description
- actorId
- actorRole
- createdAt

---

## 14. API Draft

### 14.1 Agent APIs

```http
POST   /api/agent/hotel-requests
GET    /api/agent/hotel-requests
GET    /api/agent/hotel-requests/{id}
PUT    /api/agent/hotel-requests/{id}
POST   /api/agent/hotel-requests/{id}/submit
POST   /api/agent/hotel-requests/{id}/quotations/{quotationId}/accept
POST   /api/agent/hotel-requests/{id}/quotations/{quotationId}/reject
POST   /api/agent/hotel-requests/{id}/quotations/{quotationId}/request-revision
POST   /api/agent/hotel-requests/{id}/payment-proof
GET    /api/agent/hotel-requests/{id}/invoice/download
GET    /api/agent/hotel-requests/{id}/receipt/download
GET    /api/agent/hotel-requests/{id}/voucher/download
```

### 14.2 Admin APIs

```http
GET    /api/admin/hotel-requests
GET    /api/admin/hotel-requests/{id}
POST   /api/admin/hotel-requests/{id}/assign
PATCH  /api/admin/hotel-requests/{id}/status
POST   /api/admin/hotel-requests/{id}/request-more-info
POST   /api/admin/hotel-requests/{id}/quotations
POST   /api/admin/hotel-requests/{id}/quotations/{quotationId}/send
POST   /api/admin/hotel-requests/{id}/invoice/generate
POST   /api/admin/hotel-requests/{id}/payment-proof/{paymentProofId}/verify
POST   /api/admin/hotel-requests/{id}/payment-proof/{paymentProofId}/reject
POST   /api/admin/hotel-requests/{id}/receipt/generate
POST   /api/admin/hotel-requests/{id}/voucher/generate
POST   /api/admin/hotel-requests/{id}/voucher/upload
```

---

## 15. UI/UX Recommendation

### 15.1 Agent Side

Menu structure:

- Dashboard
- Hotel Request
  - All Requests
  - Create Request
- Invoices
- Vouchers

Design direction:

- Clean white background
- Soft card layout
- Simple progress stepper
- Clear CTA buttons
- Minimal table columns
- Use badges for status
- Avoid overwhelming the agent with admin-level details

Agent dashboard cards:

- Total Requests
- Processing
- Waiting Payment
- Voucher Issued

### 15.2 Admin Side

Menu structure:

- Hotel Requests
- Quotations
- Invoices
- Payments
- Vouchers

Design direction:

- Dense enough for operations, but not cluttered
- Filters at top
- Table with clear status badges
- Detail page split into sections
- Admin actions placed on right side or top sticky action bar

---

## 16. Empty States

### Agent Has No Request

Message:

> Belum ada request hotel. Buat request pertama Anda untuk kebutuhan hotel jamaah individual atau group.

CTA:

> Create Hotel Request

### No Quotation Yet

Message:

> Request Anda sedang diproses oleh admin. Penawaran hotel akan muncul di sini setelah tersedia.

### No Voucher Yet

Message:

> Voucher akan tersedia setelah pembayaran terverifikasi dan booking hotel selesai diproses.

---

## 17. Edge Cases

1. Agen submit request dengan data tidak lengkap.
2. Tanggal check-out lebih awal dari check-in.
3. Total pax tidak sesuai dengan room arrangement.
4. Admin mengirim quotation, tetapi agen tidak merespons sampai deadline.
5. Agen upload bukti pembayaran yang salah.
6. Pembayaran kurang dari nominal invoice.
7. Hotel tidak tersedia setelah quotation dikirim.
8. Agen meminta perubahan setelah invoice issued.
9. Voucher perlu direvisi karena nama group salah.
10. Request dibatalkan setelah pembayaran.
11. Refund dibutuhkan.
12. File upload gagal.
13. Agen mencoba melihat request milik agen lain.
14. Admin salah input harga.

---

## 18. Business Rules

1. Request number harus unik.
2. Request hanya bisa diproses setelah status Submitted.
3. Agen hanya bisa edit request saat Draft atau Need More Info.
4. Quotation hanya bisa di-accept jika status Quotation Sent.
5. Invoice hanya bisa diterbitkan setelah quotation accepted.
6. Payment proof hanya bisa diupload setelah invoice issued.
7. Receipt hanya bisa diterbitkan setelah payment approved.
8. Voucher hanya bisa diterbitkan setelah payment approved.
9. Completed hanya bisa dilakukan setelah voucher issued.
10. Cost price tidak boleh tampil ke agen.
11. Semua perubahan status harus masuk timeline.
12. Semua dokumen harus bisa diunduh ulang.
13. Jika payment rejected, status kembali ke Invoice Issued atau Payment Rejected.
14. Jika quotation expired, agen tidak bisa accept tanpa admin memperbarui quotation.

---

## 19. Success Metrics

### Product Metrics

- Number of hotel requests submitted
- Percentage of completed requests
- Average processing time from submitted to quotation sent
- Average processing time from payment uploaded to voucher issued
- Quotation acceptance rate
- Payment completion rate
- Number of requests requiring additional information

### Business Metrics

- Total hotel booking revenue
- Average margin per request
- Number of active agents using hotel request feature
- Repeat request rate per agent

### Operational Metrics

- Admin response time
- Number of pending requests by status
- Number of overdue quotations
- Number of payment verification delays

---

## 20. MVP Release Plan

### Phase 1 — Core Request & Admin Processing

Deliverables:

- Agent create request
- Agent request list
- Agent request detail
- Admin request list
- Admin request detail
- Status update
- Timeline log

### Phase 2 — Quotation & Invoice

Deliverables:

- Admin create quotation
- Agent accept/reject quotation
- Admin generate invoice
- Agent download invoice

### Phase 3 — Payment, Receipt & Voucher

Deliverables:

- Agent upload payment proof
- Admin verify payment
- Generate receipt
- Generate/upload voucher
- Agent download receipt and voucher

### Phase 4 — Notifications & Refinement

Deliverables:

- In-app notification
- Email notification
- Dashboard summary
- Better filters
- Export data

---

## 21. Recommended MVP Priority

### Must Have

- Create hotel request
- Individual and group request type
- Admin request list
- Request status tracking
- Quotation creation
- Invoice generation
- Payment proof upload
- Payment verification
- Receipt generation
- Voucher upload/download
- Timeline log

### Should Have

- Notification email
- Dashboard summary
- Manifest upload
- Multiple quotation options
- Internal admin notes
- Search and filter

### Could Have

- WhatsApp notification
- Auto PDF template customization
- Hotel master data
- Supplier management
- Refund flow
- Multi-currency advanced handling

### Won’t Have for MVP

- Real-time hotel API integration
- Online payment gateway
- Auto room allocation engine
- Supplier marketplace

---

## 22. Suggested Page List

### Agent Pages

1. Hotel Request List
2. Create Hotel Request
3. Hotel Request Detail
4. Quotation Detail
5. Invoice Detail
6. Payment Proof Upload
7. Voucher Detail

### Admin Pages

1. Admin Hotel Request List
2. Admin Hotel Request Detail
3. Create/Edit Quotation
4. Invoice Management
5. Payment Verification
6. Receipt Management
7. Voucher Management

---

## 23. Suggested Component List

### Shared Components

- StatusBadge
- ProgressStepper
- TimelineLog
- FileUploadBox
- DocumentDownloadCard
- PriceSummaryCard
- RequestSummaryCard
- RoomArrangementTable
- EmptyState
- ConfirmationModal

### Agent Components

- HotelRequestForm
- AgentRequestTable
- AgentQuotationCard
- PaymentProofForm
- VoucherDownloadCard

### Admin Components

- AdminRequestTable
- RequestFilterBar
- AdminActionPanel
- QuotationForm
- InvoiceGeneratorPanel
- PaymentVerificationPanel
- VoucherUploadPanel
- InternalNoteBox

---

## 24. Open Questions

1. Apakah invoice harus bisa multi-currency, misalnya SAR dan IDR?
2. Apakah pembayaran dilakukan ke rekening Indonesia, rekening Saudi, atau keduanya?
3. Apakah admin perlu mencatat supplier hotel secara terpisah?
4. Apakah agen boleh request lebih dari satu kota dalam satu request, misalnya Makkah dan Madinah sekaligus?
5. Apakah voucher akan selalu dibuat oleh Musafirin atau kadang dari pihak hotel/supplier?
6. Apakah perlu approval finance sebelum voucher diterbitkan?
7. Apakah cancellation dan refund akan dimasukkan ke MVP atau fase berikutnya?
8. Apakah quotation bisa memiliki lebih dari satu opsi hotel?
9. Apakah agen bisa membuat request ulang dari request lama?
10. Apakah hotel request ini akan terhubung dengan modul transport, visa, dan mutawwif di masa depan?

---

## 25. Recommendation from Product Owner Perspective

Untuk MVP, jangan langsung membuat sistem seperti OTA. Jangan terlalu berat dengan inventory hotel, supplier marketplace, dan API real-time.

Lebih baik mulai dari **request-based workflow** yang rapi:

1. Agen submit kebutuhan hotel.
2. Admin proses manual.
3. Admin kirim quotation.
4. Agen accept.
5. Admin issue invoice.
6. Agen bayar dan upload bukti.
7. Admin verify.
8. Admin issue receipt dan voucher.

Ini paling realistis, cepat dibangun, dan sudah menyelesaikan problem utama agen.

Fitur ini akan menjadi fondasi penting sebelum Musafirin berkembang ke sistem hotel inventory atau integrasi supplier yang lebih otomatis.

---

## 26. Final MVP Definition

MVP dianggap selesai jika agen bisa melakukan proses berikut dari awal sampai akhir:

> Membuat request hotel individual/group → melihat progress → menerima quotation → menyetujui penawaran → menerima invoice → upload bukti pembayaran → menerima kwitansi → menerima voucher hotel.

Dan admin bisa melakukan proses berikut:

> Menerima request → memproses request → mengirim quotation → menerbitkan invoice → memverifikasi pembayaran → menerbitkan kwitansi → menerbitkan voucher.

Jika dua flow ini berjalan lancar, fitur Hotel Request sudah layak digunakan oleh agen secara nyata.
