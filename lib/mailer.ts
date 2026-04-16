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
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111; max-width: 500px; margin: auto;">

        <!-- 🔥 HEADER IMAGE -->
        <img 
          src="https://ruta-ai.vercel.app/ruta-banner.png" 
          alt="RUTA" 
          style="width:100%; border-radius:12px; margin-bottom:20px;"
        />

        <h2>Confirm your email</h2>

        <p>Thanks for joining the <strong>RUTA</strong> waitlist 🚍</p>

        <p>
          RUTA is an AI-powered commuting guide in Cebu that helps you find the right jeepney routes,
          fares, ETA, and traffic-aware directions.
        </p>

        <p>Please confirm your email by clicking the button below:</p>

        <p style="text-align:center; margin: 24px 0;">
          <a 
            href="${confirmUrl}" 
            style="display:inline-block;padding:14px 24px;background:#111;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;"
          >
            Confirm my email
          </a>
        </p>

        <p style="font-size:12px; color:#666;">
          If the button does not work, copy and paste this link into your browser:
        </p>

        <p style="font-size:12px; word-break:break-all;">
          ${confirmUrl}
        </p>

        <hr style="margin:24px 0; border:none; border-top:1px solid #eee;" />

        <p style="font-size:13px; color:#888;">
          Adrian Alquizar — Founder, RUTA
        </p>
      </div>
    `,
  });
}