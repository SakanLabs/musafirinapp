import nodemailer from "nodemailer";
import fs from "fs";

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
  provider?: "resend" | "smtp" | "dev-fallback";
  error?: string;
}

async function sendViaResend({
  from,
  to,
  subject,
  text,
  html,
  attachments,
  apiKey,
}: SendEmailParams & { from: string; apiKey: string }): Promise<SendEmailResult> {
  try {
    const payload: Record<string, unknown> = {
      from,
      to: [to],
      subject,
      html,
      text,
    };

    if (attachments && attachments.length > 0) {
      payload.attachments = attachments
        .map((att) => {
          let base64Content: string | undefined;
          if (Buffer.isBuffer(att.content)) {
            base64Content = att.content.toString("base64");
          } else if (typeof att.content === "string") {
            base64Content = Buffer.from(att.content).toString("base64");
          } else if (att.path && fs.existsSync(att.path)) {
            base64Content = fs.readFileSync(att.path).toString("base64");
          }
          if (!base64Content) return null;
          return {
            filename: att.filename,
            content: base64Content,
          };
        })
        .filter(Boolean);
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };

    if (!response.ok) {
      const errorMsg = data?.message || `Resend API error (${response.status})`;
      console.error(`[Email:Resend] Failed to send email to ${to}:`, errorMsg);
      return {
        success: false,
        provider: "resend",
        error: errorMsg,
      };
    }

    console.log(`[Email:Resend] Sent email to ${to} (ID: ${data.id})`);
    return {
      success: true,
      provider: "resend",
      messageId: data.id,
    };
  } catch (error: any) {
    console.error(`[Email:Resend] Unexpected error sending email to ${to}:`, error);
    return {
      success: false,
      provider: "resend",
      error: error?.message || "Gagal mengirim email melalui Resend",
    };
  }
}

export async function sendEmail({ to, subject, text, html, attachments }: SendEmailParams): Promise<SendEmailResult> {
  const provider = (process.env.EMAIL_PROVIDER || "").toLowerCase().trim();
  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || "Musafirin <notifications@musafirin.co>";

  if ((provider === "resend" || (!provider && resendApiKey)) && resendApiKey) {
    return sendViaResend({ from, to, subject, text, html, attachments, apiKey: resendApiKey });
  }

  const host = process.env.SMTP_HOST;
  const portStr = process.env.SMTP_PORT;
  const port = portStr ? parseInt(portStr, 10) : 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
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

      console.log(`[Email:SMTP] Sent email to ${to} (MessageId: ${info.messageId})`);
      return {
        success: true,
        provider: "smtp",
        messageId: info.messageId,
      };
    } catch (error: any) {
      console.error(`[Email:SMTP] Failed to send email to ${to}:`, error);
      return {
        success: false,
        provider: "smtp",
        error: error?.message || "Failed to send email via SMTP",
      };
    }
  }

  console.log(`[Email:DevFallback] To: ${to} | Subject: ${subject}`);
  return {
    success: true,
    provider: "dev-fallback",
    messageId: `dev-fallback-${Date.now()}`,
  };
}
