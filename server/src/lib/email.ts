import nodemailer from "nodemailer";

export interface EmailAttachment {
  filename: string;
  path?: string;
  content?: string | Buffer;
  contentType?: string;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: EmailAttachment[];
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail({ to, subject, text, html, attachments }: SendEmailParams): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST;
  const portStr = process.env.SMTP_PORT;
  const port = portStr ? parseInt(portStr, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "noreply@musafirin.co";

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        auth: {
          user,
          pass,
        },
      });

      const info = await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
        attachments,
      });

      console.log(`[Email] Successfully sent email to ${to} (MessageId: ${info.messageId})`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      console.error(`[Email] Failed to send email via SMTP to ${to}:`, error);
      return {
        success: false,
        error: error?.message || 'Failed to send email via SMTP',
      };
    }
  }

  // Fallback for development if SMTP is not configured
  console.log("\n==================================================");
  console.log("             DEVELOPMENT EMAIL FALLBACK            ");
  console.log("==================================================");
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  if (attachments && attachments.length > 0) {
    console.log(`Attachments: ${attachments.map(a => a.filename).join(', ')}`);
  }
  console.log("--------------------------------------------------");
  console.log("Body (Text):");
  console.log(text);
  console.log("--------------------------------------------------");
  console.log("==================================================\n");

  return {
    success: true,
    messageId: `dev-fallback-${Date.now()}`,
  };
}
