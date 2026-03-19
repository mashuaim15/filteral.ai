/**
 * Email service using Zoho SMTP.
 */

import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.zoho.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_SECURE === "true", // false for 587 with STARTTLS
  auth: {
    user: process.env.SMTP_USER || "hello@filteral.app",
    pass: process.env.SMTP_PASS,
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || "noreply@filteral.app",
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
    });
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

interface RecommendationEmailData {
  userName: string;
  recommendations: Array<{
    site: string;
    title: string;
    author: string;
    url: string;
    reason: string;
    thumbnail?: string;
    importanceScore?: number;
  }>;
  date: string;
}

function getPlatformBadge(site: string): string {
  const colors: Record<string, string> = {
    BILIBILI: "#00a1d6",
    YOUTUBE: "#ff0000",
    REDDIT: "#ff4500",
    X: "#000000",
  };
  const color = colors[site] || "#666";
  return `<span style="display: inline-block; padding: 2px 8px; background-color: ${color}; color: #fff; font-size: 11px; font-weight: 600; border-radius: 4px; letter-spacing: 0.5px;">${site}</span>`;
}

export function buildRecommendationEmail(data: RecommendationEmailData): string {
  const { userName, recommendations, date } = data;

  // Split into featured (top picks, score >= 7) and rest
  const sorted = [...recommendations].sort((a, b) => (b.importanceScore || 0) - (a.importanceScore || 0));
  const featured = sorted.filter((r) => (r.importanceScore || 0) >= 7).slice(0, 3);
  const rest = sorted.filter((r) => !featured.includes(r));

  // Featured cards: large with thumbnail
  const featuredItems = featured
    .map(
      (rec) => `
      <tr>
        <td style="padding: 0 0 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e5e5e5; border-radius: 12px; overflow: hidden;">
            ${
              rec.thumbnail
                ? `<tr>
                    <td>
                      <a href="${rec.url}" style="text-decoration: none;">
                        <img src="${rec.thumbnail}" alt="" width="536" style="width: 100%; display: block;" />
                      </a>
                    </td>
                  </tr>`
                : ""
            }
            <tr>
              <td style="padding: 16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <span style="display: inline-block; padding: 3px 10px; background-color: #111; color: #fff; font-size: 11px; font-weight: 700; border-radius: 4px; letter-spacing: 0.5px; text-transform: uppercase;">Top Pick</span>
                      &nbsp;${getPlatformBadge(rec.site)}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top: 10px;">
                      <a href="${rec.url}" style="color: #111; text-decoration: none; font-weight: 700; font-size: 18px; line-height: 1.3;">
                        ${rec.title}
                      </a>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top: 6px;">
                      <span style="color: #666; font-size: 14px;">${rec.author}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top: 10px;">
                      <p style="margin: 0; color: #444; font-size: 14px; line-height: 1.5; font-style: italic;">
                        ${rec.reason}
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join("");

  // Compact list for remaining items
  const restItems = rest
    .map(
      (rec) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align: top;">
                ${getPlatformBadge(rec.site)}
                <a href="${rec.url}" style="color: #111; text-decoration: none; font-weight: 600; font-size: 15px; line-height: 1.4; margin-left: 6px;">
                  ${rec.title}
                </a>
                <p style="margin: 4px 0 0; color: #888; font-size: 13px;">
                  ${rec.author}
                  ${rec.reason ? ` &mdash; <span style="font-style: italic;">${rec.reason}</span>` : ""}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Filteral Daily</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px; border-bottom: 2px solid #111;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #111; letter-spacing: -0.5px;">
                      Filteral Daily
                    </h1>
                  </td>
                  <td style="text-align: right; vertical-align: middle;">
                    <span style="color: #888; font-size: 13px;">${date}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 24px 32px 8px;">
              <p style="margin: 0; color: #333; font-size: 15px; line-height: 1.5;">
                Hi ${userName}, here's what's worth your time today.
              </p>
            </td>
          </tr>

          ${featured.length > 0 ? `
          <!-- Featured Section -->
          <tr>
            <td style="padding: 20px 32px 8px;">
              <h2 style="margin: 0; font-size: 13px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px;">
                Today's Top Picks
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 12px 32px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${featuredItems}
              </table>
            </td>
          </tr>
          ` : ""}

          ${rest.length > 0 ? `
          <!-- More For You Section -->
          <tr>
            <td style="padding: 16px 32px 8px;">
              <h2 style="margin: 0; font-size: 13px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: 1px;">
                More For You
              </h2>
            </td>
          </tr>
          <tr>
            <td style="padding: 4px 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${restItems}
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #fafafa; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; color: #888; font-size: 13px;">
                Curated by <a href="https://filteral.app" style="color: #111; text-decoration: none; font-weight: 600;">Filteral</a>
              </p>
              <p style="margin: 8px 0 0; color: #aaa; font-size: 12px;">
                <a href="https://filteral.app/settings" style="color: #888; text-decoration: underline;">Manage preferences</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export async function sendDailyRecommendations(
  email: string,
  data: RecommendationEmailData
): Promise<boolean> {
  const html = buildRecommendationEmail(data);

  return sendEmail({
    to: email,
    subject: `Your Daily Recommendations - ${data.date}`,
    html,
  });
}

/**
 * Send welcome email to new PRO users
 */
export async function sendProWelcomeEmail(
  email: string,
  userName: string
): Promise<boolean> {
  const html = buildProWelcomeEmail(userName);

  return sendEmail({
    to: email,
    subject: `Welcome to Filteral Pro! 🎉`,
    html,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  userName: string,
  resetUrl: string
): Promise<boolean> {
  const html = buildPasswordResetEmail(userName, resetUrl);

  return sendEmail({
    to: email,
    subject: `Reset your Filteral password`,
    html,
  });
}

function buildPasswordResetEmail(userName: string, resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px; text-align: center; border-bottom: 1px solid #e5e5e5;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #111;">
                Filteral.app
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0; color: #333; font-size: 16px; line-height: 1.6;">
                Hi ${userName},
              </p>
              <p style="margin: 16px 0 0; color: #555; font-size: 15px; line-height: 1.6;">
                We received a request to reset your password. Click the button below to create a new password:
              </p>

              <!-- CTA -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="display: inline-block; padding: 14px 32px; background-color: #111; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  Reset Password
                </a>
              </div>

              <p style="margin: 24px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>

              <p style="margin: 24px 0 0; color: #888; font-size: 13px; line-height: 1.5;">
                If the button doesn't work, copy and paste this link into your browser:<br/>
                <a href="${resetUrl}" style="color: #666; word-break: break-all;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #fafafa; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; color: #888; font-size: 13px;">
                Powered by <a href="https://filteral.app" style="color: #111; text-decoration: none;">Filteral.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

function buildProWelcomeEmail(userName: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Filteral Pro</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <h1 style="margin: 0; font-size: 28px; font-weight: 600; color: #ffffff;">
                Welcome to Pro! 🎉
              </h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0; color: #333; font-size: 16px; line-height: 1.6;">
                Hi ${userName},
              </p>
              <p style="margin: 16px 0 0; color: #555; font-size: 15px; line-height: 1.6;">
                Thank you for upgrading to <strong>Filteral Pro</strong>! You now have access to powerful features that will help you discover even better content.
              </p>

              <!-- Pro Features -->
              <h2 style="margin: 32px 0 16px; font-size: 18px; color: #333;">What's included in Pro:</h2>

              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <strong style="color: #667eea;">✨ 20 daily generations</strong>
                    <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Generate fresh recommendations up to 20 times per day</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <strong style="color: #667eea;">🔗 Unlimited platform connections</strong>
                    <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Connect as many accounts as you want</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <strong style="color: #667eea;">🎯 Up to 20 recommendations</strong>
                    <p style="margin: 4px 0 0; color: #666; font-size: 14px;">Get more personalized content per generation</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0; border-bottom: 1px solid #eee;">
                    <strong style="color: #667eea;">🧠 Smarter AI recommendations</strong>
                    <p style="margin: 4px 0 0; color: #666; font-size: 14px;">AI learns from your watch history for better matches</p>
                  </td>
                </tr>
              </table>

              <!-- Bilibili Note -->
              <div style="background-color: #fffbeb; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <h3 style="margin: 0 0 8px; font-size: 15px; color: #92400e;">📺 About Bilibili Connection</h3>
                <p style="margin: 0; color: #78350f; font-size: 14px; line-height: 1.5;">
                  Bilibili login sessions may expire after some time. If you want to continue sharing your watch history and followed channels for better recommendations, remember to <a href="https://filteral.app/connect" style="color: #92400e; font-weight: 600;">reconnect your Bilibili account</a> when prompted.
                </p>
                <p style="margin: 12px 0 0; color: #78350f; font-size: 14px; line-height: 1.5;">
                  However, it's perfectly fine to leave it unconnected - our AI has already learned your preferences and will continue recommending great content based on what it knows about you!
                </p>
              </div>

              <!-- CTA -->
              <div style="text-align: center; margin: 32px 0;">
                <a href="https://filteral.app/dashboard" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; font-weight: 600; font-size: 16px; border-radius: 8px;">
                  Start Exploring →
                </a>
              </div>

              <p style="margin: 24px 0 0; color: #666; font-size: 14px; line-height: 1.6;">
                If you have any questions, just reply to this email - we're here to help!
              </p>

              <p style="margin: 24px 0 0; color: #333; font-size: 15px;">
                Happy discovering,<br/>
                <strong>The Filteral Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #fafafa; text-align: center; border-top: 1px solid #e5e5e5;">
              <p style="margin: 0; color: #888; font-size: 13px;">
                Powered by <a href="https://filteral.app" style="color: #111; text-decoration: none;">Filteral.app</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}
