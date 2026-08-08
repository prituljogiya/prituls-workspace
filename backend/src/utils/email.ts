import nodemailer from 'nodemailer';

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getFrontendUrl() {
  return (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
}

export function buildPasswordResetUrl(resetToken: string) {
  return `${getFrontendUrl()}/reset-password?token=${resetToken}`;
}

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string
): Promise<{ sent: boolean; resetUrl: string }> => {
  const resetUrl = buildPasswordResetUrl(resetToken);

  if (!isSmtpConfigured()) {
    console.warn('SMTP not configured — returning reset link without sending email');
    return { sent: false, resetUrl };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_USER,
    to: email,
    subject: 'Password Reset Request',
    html: `
      <h2>Password Reset Request</h2>
      <p>You requested to reset your password. Click the link below to reset it:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link will expire in 1 hour.</p>
      <p>If you didn't request this, please ignore this email.</p>
    `,
  });

  return { sent: true, resetUrl };
};
