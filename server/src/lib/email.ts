import nodemailer from "nodemailer";

export interface SendEmailParams {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendEmail({ to, subject, text, html }: SendEmailParams): Promise<void> {
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

      await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });

      console.log(`[Email] Successfully sent email to ${to}`);
      return;
    } catch (error) {
      console.error(`[Email] Failed to send email via SMTP to ${to}:`, error);
    }
  }

  // Fallback for development if SMTP is not configured
  console.log("\n==================================================");
  console.log("             DEVELOPMENT EMAIL FALLBACK            ");
  console.log("==================================================");
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log("--------------------------------------------------");
  console.log("Body (Text):");
  console.log(text);
  console.log("--------------------------------------------------");
  console.log("==================================================\n");
}
