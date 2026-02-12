import nodemailer from 'nodemailer';
import { passwordResetTemplate, verificationTemplate } from './templates';

const FROM_ADDRESS = process.env.SMTP_FROM || 'noreply@freeluma.com';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST);
}

function getTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const transporter = getTransporter();

  if (!transporter) {
    // Dev fallback: log email to console
    console.log('\n========== EMAIL (SMTP not configured) ==========');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`HTML length: ${html.length} chars`);
    // Extract any URLs from the HTML for easy dev testing
    const urlMatch = html.match(/href="(https?:\/\/[^"]+)"/g);
    if (urlMatch) {
      console.log('Links found:');
      urlMatch.forEach((match) => {
        const url = match.replace(/href="/, '').replace(/"$/, '');
        if (url.includes('reset-password') || url.includes('verify-email')) {
          console.log(`  => ${url}`);
        }
      });
    }
    console.log('=================================================\n');
    return;
  }

  await transporter.sendMail({
    from: `"Free Luma" <${FROM_ADDRESS}>`,
    to,
    subject,
    html,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  token: string
): Promise<void> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const html = passwordResetTemplate(resetUrl);
  await sendEmail(to, 'Reset Your Password - Free Luma', html);
}

export async function sendVerificationEmail(
  to: string,
  token: string
): Promise<void> {
  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}`;
  const html = verificationTemplate(verifyUrl);
  await sendEmail(to, 'Verify Your Email - Free Luma', html);
}
