import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendWaitlistConfirmationEmail(
  to: string,
  confirmUrl: string
) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to,
    subject: "Confirm your RUTA waitlist signup",
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>Confirm your email</h2>
        <p>Thanks for joining the RUTA waitlist.</p>
        <p>Please confirm your email by clicking the button below:</p>
        <p>
          <a href="${confirmUrl}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:999px;">
            Confirm my email
          </a>
        </p>
        <p>If the button does not work, copy and paste this link into your browser:</p>
        <p>${confirmUrl}</p>
        <p><strong>Adrian Alquizar — Founder, RUTA</strong></p>
      </div>
    `,
  });
}