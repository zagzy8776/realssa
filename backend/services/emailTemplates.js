/**
 * RealSSA Executive Email Template Engine (emailTemplates.js)
 * Generates fully responsive, dark-slate / gold branded email layouts for Resend API.
 */

function getEmailHeader() {
  return `
    <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 24px;">
      <h1 style="margin: 0; font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
        <span style="color: #ffffff;">Real</span><span style="color: #f59e0b;">SSA</span>
      </h1>
    </div>
  `;
}

function getEmailFooter() {
  return `
    <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.1); text-align: center; font-size: 12px; color: #64748b; line-height: 1.6;">
      <p style="margin: 0 0 6px 0; font-weight: 600; color: #94a3b8;">RealSSA News &bull; Real-Time Intelligence</p>
      <p style="margin: 0;">
        <a href="https://www.realssanews.com.ng" style="color: #f59e0b; text-decoration: none;">www.realssanews.com.ng</a> &bull; 
        <a href="https://www.realssanews.com.ng/privacy-policy" style="color: #64748b; text-decoration: none;">Privacy Policy</a>
      </p>
    </div>
  `;
}

function wrapLayout(contentHtml) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #080e1a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <div style="max-width: 560px; margin: 30px auto; background-color: #0f172a; border: 1px solid rgba(51, 65, 85, 0.7); border-radius: 20px; padding: 32px 28px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); color: #e2e8f0;">
        ${getEmailHeader()}
        ${contentHtml}
        ${getEmailFooter()}
      </div>
    </body>
    </html>
  `;
}

/**
 * 1. Account Verification Email Template
 */
function getVerificationEmailHtml({ verifyLink, email }) {
  const content = `
    <div>
      <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0;">Verify your RealSSA Account</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin: 0 0 20px 0;">
        Welcome to RealSSA News. Please verify your email address (<strong>${email}</strong>) to sync your reading streak, RealSSA Points (RP), and saved bookmarks across your devices.
      </p>
      
      <div style="text-align: center; margin: 28px 0;">
        <a href="${verifyLink}" target="_blank" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #000000; font-weight: 800; font-size: 14px; padding: 14px 32px; border-radius: 12px; text-decoration: none; display: inline-block; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);">
          Verify Email Address &rarr;
        </a>
      </div>

      <div style="background-color: rgba(30, 41, 59, 0.6); border-left: 3px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-top: 24px; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        <strong style="color: #cbd5e1;">Security Notice:</strong> If you did not create a RealSSA account, you can safely ignore this email. This link expires in 24 hours.
      </div>
    </div>
  `;
  return wrapLayout(content);
}

/**
 * 2. Password Reset / Security Code Email Template
 */
function getPasswordResetEmailHtml({ resetLink, securityPin }) {
  const content = `
    <div>
      <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 12px 0;">Reset Your Password</h2>
      <p style="font-size: 14px; line-height: 1.6; color: #cbd5e1; margin: 0 0 20px 0;">
        We received a request to reset your RealSSA account password. Use the security PIN below or click the button to proceed:
      </p>

      ${securityPin ? `
        <div style="text-align: center; margin: 20px 0;">
          <div style="display: inline-block; background-color: #1e293b; border: 1px border-slate-700; padding: 12px 24px; border-radius: 12px; font-size: 24px; font-weight: 900; letter-spacing: 6px; color: #f59e0b;">
            ${securityPin}
          </div>
        </div>
      ` : ''}

      <div style="text-align: center; margin: 24px 0;">
        <a href="${resetLink}" target="_blank" style="background: #3b82f6; color: #ffffff; font-weight: 800; font-size: 14px; padding: 14px 32px; border-radius: 12px; text-decoration: none; display: inline-block;">
          Reset Password
        </a>
      </div>

      <p style="font-size: 12px; color: #64748b; text-align: center;">This code and link expire in 15 minutes.</p>
    </div>
  `;
  return wrapLayout(content);
}

/**
 * 3. Milestone Achievement Email Template
 */
function getMilestoneEmailHtml({ milestoneName, pointsAwarded, totalPoints }) {
  const content = `
    <div style="text-align: center;">
      <div style="font-size: 40px; margin-bottom: 8px;">🏆</div>
      <h2 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 8px 0;">Milestone Unlocked!</h2>
      <p style="font-size: 15px; color: #f59e0b; font-weight: 700; margin: 0 0 16px 0;">${milestoneName}</p>
      
      <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 16px; padding: 20px; margin: 20px 0;">
        <div style="font-size: 28px; font-weight: 900; color: #f59e0b;">+${pointsAwarded} RP</div>
        <p style="font-size: 13px; color: #cbd5e1; margin: 4px 0 0 0;">Total Balance: <strong>${totalPoints.toLocaleString()} RP</strong></p>
      </div>

      <a href="https://www.realssanews.com.ng/profile" target="_blank" style="background: #f59e0b; color: #000000; font-weight: 800; font-size: 13px; padding: 12px 24px; border-radius: 10px; text-decoration: none; display: inline-block;">
        View Profile & Referral Link &rarr;
      </a>
    </div>
  `;
  return wrapLayout(content);
}

module.exports = {
  getVerificationEmailHtml,
  getPasswordResetEmailHtml,
  getMilestoneEmailHtml
};
