export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

export interface InvoiceEmailData {
  recipientName: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  formattedAmount: string;
  bookingCode?: string;
  serviceSummary?: string;
  downloadUrl: string;
}

export interface ReceiptEmailData {
  recipientName: string;
  receiptNumber: string;
  issueDate: string;
  currency: string;
  formattedPaidAmount: string;
  formattedTotalAmount: string;
  formattedBalanceDue: string;
  paymentMethod?: string;
  paymentStatusLabel: string;
  isPaidFull: boolean;
  bookingCode?: string;
  invoiceNumber?: string;
  serviceSummary?: string;
  downloadUrl?: string;
}

export interface VoucherEmailData {
  recipientName: string;
  voucherNumber: string;
  bookingCode: string;
  hotelName: string;
  city: string;
  hcn?: string | null;
  checkIn: string;
  checkOut: string;
  roomSummary: string;
  downloadUrl: string;
}

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderLedgerRow(label: string, value: string, options?: { mono?: boolean; bold?: boolean; accentColor?: string; last?: boolean }): string {
  const borderStyle = options?.last ? "" : "border-bottom:1px solid #f1f5f9;";
  const fontFamily = options?.mono ? "font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;" : "";
  const fontWeight = options?.bold ? "font-weight:700;" : "font-weight:600;";
  const color = options?.accentColor || "#111827";
  return `
    <tr>
      <td style="padding:10px 0;${borderStyle}color:#4b5563;font-size:13px;line-height:1.5;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;${borderStyle}color:${color};font-size:13px;line-height:1.5;text-align:right;vertical-align:top;${fontWeight}${fontFamily}">${escapeHtml(value)}</td>
    </tr>
  `;
}

function renderEmailShell(params: {
  documentLabel: string;
  preheader: string;
  bodyHtml: string;
}): string {
  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(params.documentLabel)} | Musafirin</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f2937;-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(params.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f5f4;padding:28px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <tr>
            <td style="padding:20px 28px;border-bottom:1px solid #e5e7eb;background-color:#ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size:15px;font-weight:700;letter-spacing:0.04em;color:#111111;">MUSAFIRIN</td>
                  <td style="text-align:right;font-size:12px;font-weight:600;color:#4b5563;">${escapeHtml(params.documentLabel)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              ${params.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;border-top:1px solid #e5e7eb;background-color:#fafaf9;font-size:12px;line-height:1.6;color:#4b5563;">
              <div style="font-weight:600;color:#111827;">PT Thalhah Insan Rabbani (Musafirin)</div>
              <div>Email: hotel@musafirin.co | WhatsApp: +62 812-3562-3973</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function buildInvoiceEmail(data: InvoiceEmailData): EmailContent {
  const subject = `Invoice ${data.invoiceNumber} | MUSAFIRIN`;
  const amountText = `${data.currency} ${data.formattedAmount}`;

  const rows = [
    renderLedgerRow("Nomor Invoice", data.invoiceNumber, { mono: true, bold: true }),
    data.bookingCode ? renderLedgerRow("Kode Pesanan", data.bookingCode, { mono: true }) : "",
    data.serviceSummary ? renderLedgerRow("Layanan", data.serviceSummary) : "",
    renderLedgerRow("Tanggal Terbit", data.issueDate),
    renderLedgerRow("Jatuh Tempo", data.dueDate, { bold: true, accentColor: "#991b1b" }),
    renderLedgerRow("Total Tagihan", amountText, { mono: true, bold: true, last: true }),
  ].join("");

  const bodyHtml = `
    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:#1f2937;">
      Assalamu'alaikum ${escapeHtml(data.recipientName)},
    </p>
    <p style="margin:0 0 22px 0;font-size:14px;line-height:1.6;color:#374151;">
      Tim Musafirin telah menerbitkan invoice <strong>${escapeHtml(data.invoiceNumber)}</strong> untuk pesanan Anda. Mohon selesaikan pembayaran sebelum tanggal jatuh tempo agar proses reservasi berjalan sesuai jadwal.
    </p>

    <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;padding:18px 20px;margin-bottom:22px;">
      <div style="font-size:11px;font-weight:600;color:#4b5563;text-transform:uppercase;letter-spacing:0.04em;">Total Tagihan</div>
      <div style="font-size:24px;font-weight:700;color:#111111;margin-top:4px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;">${escapeHtml(amountText)}</div>
      <div style="font-size:12px;font-weight:600;color:#991b1b;margin-top:4px;">Jatuh tempo: ${escapeHtml(data.dueDate)}</div>
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      ${rows}
    </table>

    <div style="margin:26px 0 22px 0;">
      <a href="${escapeHtml(data.downloadUrl)}" style="display:inline-block;background-color:#111111;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:12px 22px;border-radius:6px;">
        Unduh Invoice (PDF)
      </a>
    </div>

    <p style="margin:0;font-size:12px;line-height:1.6;color:#4b5563;">
      Setelah transfer, kirim bukti pembayaran ke hotel@musafirin.co atau WhatsApp +62 812-3562-3973 dengan mencantumkan nomor invoice ${escapeHtml(data.invoiceNumber)}.
    </p>
  `;

  const text = [
    `Assalamu'alaikum ${data.recipientName},`,
    "",
    `Tim Musafirin telah menerbitkan invoice ${data.invoiceNumber} untuk pesanan Anda.`,
    "",
    "Rincian Tagihan:",
    `- Nomor Invoice: ${data.invoiceNumber}`,
    data.bookingCode ? `- Kode Pesanan: ${data.bookingCode}` : null,
    data.serviceSummary ? `- Layanan: ${data.serviceSummary}` : null,
    `- Tanggal Terbit: ${data.issueDate}`,
    `- Jatuh Tempo: ${data.dueDate}`,
    `- Total Tagihan: ${amountText}`,
    "",
    `Unduh Invoice (PDF): ${data.downloadUrl}`,
    "",
    `Setelah transfer, kirim bukti pembayaran ke hotel@musafirin.co atau WhatsApp +62 812-3562-3973 dengan mencantumkan nomor invoice ${data.invoiceNumber}.`,
    "",
    "PT Thalhah Insan Rabbani (Musafirin)",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    subject,
    text,
    html: renderEmailShell({
      documentLabel: "Invoice Tagihan",
      preheader: `Invoice ${data.invoiceNumber} sebesar ${amountText}, jatuh tempo ${data.dueDate}.`,
      bodyHtml,
    }),
  };
}

export function buildReceiptEmail(data: ReceiptEmailData): EmailContent {
  const subject = `Kwitansi ${data.receiptNumber} | MUSAFIRIN`;
  const paidText = `${data.currency} ${data.formattedPaidAmount}`;
  const totalText = `${data.currency} ${data.formattedTotalAmount}`;
  const balanceText = `${data.currency} ${data.formattedBalanceDue}`;

  const summaryBg = data.isPaidFull ? "#ecfdf5" : "#fffbeb";
  const summaryBorder = data.isPaidFull ? "#a7f3d0" : "#fde68a";
  const summaryText = data.isPaidFull ? "#065f46" : "#92400e";

  const rows = [
    renderLedgerRow("Nomor Kwitansi", data.receiptNumber, { mono: true, bold: true }),
    data.invoiceNumber ? renderLedgerRow("Nomor Invoice", data.invoiceNumber, { mono: true }) : "",
    data.bookingCode ? renderLedgerRow("Kode Pesanan", data.bookingCode, { mono: true }) : "",
    data.serviceSummary ? renderLedgerRow("Layanan", data.serviceSummary) : "",
    renderLedgerRow("Tanggal Terbit", data.issueDate),
    data.paymentMethod ? renderLedgerRow("Metode Pembayaran", data.paymentMethod) : "",
    renderLedgerRow("Total Tagihan", totalText, { mono: true }),
    renderLedgerRow("Jumlah Diterima", paidText, { mono: true, bold: true, accentColor: "#065f46" }),
    renderLedgerRow("Sisa Tagihan", balanceText, { mono: true, bold: true, last: true }),
  ].join("");

  const ctaHtml = data.downloadUrl
    ? `
      <div style="margin:26px 0 22px 0;">
        <a href="${escapeHtml(data.downloadUrl)}" style="display:inline-block;background-color:#111111;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:12px 22px;border-radius:6px;">
          Unduh Kwitansi (PDF)
        </a>
      </div>
    `
    : "";

  const bodyHtml = `
    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:#1f2937;">
      Assalamu'alaikum ${escapeHtml(data.recipientName)},
    </p>
    <p style="margin:0 0 22px 0;font-size:14px;line-height:1.6;color:#374151;">
      Kami telah menerima dan mencatat pembayaran Anda. Kwitansi resmi <strong>${escapeHtml(data.receiptNumber)}</strong> telah diterbitkan sebagai bukti transaksi.
    </p>

    <div style="background-color:${summaryBg};border:1px solid ${summaryBorder};border-radius:6px;padding:18px 20px;margin-bottom:22px;">
      <div style="font-size:11px;font-weight:700;color:${summaryText};text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(data.paymentStatusLabel)}</div>
      <div style="font-size:24px;font-weight:700;color:${summaryText};margin-top:4px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;">${escapeHtml(paidText)}</div>
      <div style="font-size:12px;color:${summaryText};margin-top:4px;">Sisa tagihan: ${escapeHtml(balanceText)}</div>
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      ${rows}
    </table>

    ${ctaHtml}

    <p style="margin:0;font-size:12px;line-height:1.6;color:#4b5563;">
      Simpan kwitansi ini untuk arsip keuangan Anda. Hubungi tim finance Musafirin jika terdapat perbedaan data pada rincian di atas.
    </p>
  `;

  const text = [
    `Assalamu'alaikum ${data.recipientName},`,
    "",
    `Kami telah menerima dan mencatat pembayaran Anda. Kwitansi resmi ${data.receiptNumber} telah diterbitkan.`,
    "",
    "Rincian Kwitansi:",
    `- Nomor Kwitansi: ${data.receiptNumber}`,
    data.invoiceNumber ? `- Nomor Invoice: ${data.invoiceNumber}` : null,
    data.bookingCode ? `- Kode Pesanan: ${data.bookingCode}` : null,
    data.serviceSummary ? `- Layanan: ${data.serviceSummary}` : null,
    `- Tanggal Terbit: ${data.issueDate}`,
    data.paymentMethod ? `- Metode Pembayaran: ${data.paymentMethod}` : null,
    `- Status: ${data.paymentStatusLabel}`,
    `- Total Tagihan: ${totalText}`,
    `- Jumlah Diterima: ${paidText}`,
    `- Sisa Tagihan: ${balanceText}`,
    data.downloadUrl ? "" : null,
    data.downloadUrl ? `Unduh Kwitansi (PDF): ${data.downloadUrl}` : null,
    "",
    "PT Thalhah Insan Rabbani (Musafirin)",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return {
    subject,
    text,
    html: renderEmailShell({
      documentLabel: "Kwitansi Pembayaran",
      preheader: `Pembayaran sebesar ${paidText} telah dicatat pada kwitansi ${data.receiptNumber}.`,
      bodyHtml,
    }),
  };
}

export function buildVoucherEmail(data: VoucherEmailData): EmailContent {
  const subject = `Voucher Hotel ${data.voucherNumber} (${data.bookingCode}) | MUSAFIRIN`;
  const hcnDisplay = data.hcn || "Terkonfirmasi";

  const rows = [
    renderLedgerRow("Nomor Voucher", data.voucherNumber, { mono: true, bold: true }),
    renderLedgerRow("Kode Booking", data.bookingCode, { mono: true }),
    renderLedgerRow("Hotel", `${data.hotelName} (${data.city})`),
    renderLedgerRow("Hotel Confirmation No. (HCN)", hcnDisplay, { mono: true, bold: true }),
    renderLedgerRow("Check-in", data.checkIn),
    renderLedgerRow("Check-out", data.checkOut),
    renderLedgerRow("Kamar", data.roomSummary, { last: true }),
  ].join("");

  const bodyHtml = `
    <p style="margin:0 0 14px 0;font-size:14px;line-height:1.6;color:#1f2937;">
      Assalamu'alaikum ${escapeHtml(data.recipientName)},
    </p>
    <p style="margin:0 0 22px 0;font-size:14px;line-height:1.6;color:#374151;">
      Tim Musafirin telah menerbitkan voucher hotel untuk booking <strong>${escapeHtml(data.bookingCode)}</strong>. Mohon periksa kembali nama hotel, tanggal menginap, dan detail kamar sebelum keberangkatan.
    </p>

    <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:18px 20px;margin-bottom:22px;">
      <div style="font-size:11px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:0.04em;">Voucher Reservasi Hotel</div>
      <div style="font-size:20px;font-weight:700;color:#1e3a8a;margin-top:4px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;">${escapeHtml(data.voucherNumber)}</div>
      <div style="font-size:12px;color:#1e40af;margin-top:4px;">${escapeHtml(data.hotelName)} (${escapeHtml(data.city)}) | HCN: <strong>${escapeHtml(hcnDisplay)}</strong></div>
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      ${rows}
    </table>

    <div style="margin:26px 0 22px 0;">
      <a href="${escapeHtml(data.downloadUrl)}" style="display:inline-block;background-color:#111111;color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;padding:12px 22px;border-radius:6px;">
        Unduh Voucher Hotel (PDF)
      </a>
    </div>

    <p style="margin:0;font-size:12px;line-height:1.6;color:#4b5563;">
      Tunjukkan voucher ini beserta identitas tamu saat proses check-in di resepsionis hotel.
    </p>
  `;

  const text = [
    `Assalamu'alaikum ${data.recipientName},`,
    "",
    `Tim Musafirin telah menerbitkan voucher hotel untuk booking ${data.bookingCode}.`,
    "",
    "Rincian Reservasi:",
    `- Nomor Voucher: ${data.voucherNumber}`,
    `- Kode Booking: ${data.bookingCode}`,
    `- Hotel: ${data.hotelName} (${data.city})`,
    `- HCN: ${hcnDisplay}`,
    `- Check-in: ${data.checkIn}`,
    `- Check-out: ${data.checkOut}`,
    `- Kamar: ${data.roomSummary}`,
    "",
    `Unduh Voucher Hotel (PDF): ${data.downloadUrl}`,
    "",
    "Tunjukkan voucher ini beserta identitas tamu saat proses check-in di resepsionis hotel.",
    "",
    "PT Thalhah Insan Rabbani (Musafirin)",
  ].join("\n");

  return {
    subject,
    text,
    html: renderEmailShell({
      documentLabel: "Voucher Hotel",
      preheader: `Voucher ${data.voucherNumber} untuk ${data.hotelName} (${data.checkIn} - ${data.checkOut}) telah terbit.`,
      bodyHtml,
    }),
  };
}
