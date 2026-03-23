import { getResend } from "./resend";

const ADMIN_EMAIL = "menesskr5@gmail.com";
const FROM_ADDRESS = "メンエスSKR <info@menes-skr.com>";
const SITE_URL = "https://menes-skr.com";

function layout(body: string): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;max-width:100%">
  <tr><td style="background:#1a1a2e;padding:20px 24px;text-align:center">
    <a href="${SITE_URL}" style="color:#fff;font-size:20px;font-weight:bold;text-decoration:none;letter-spacing:1px">メンエスSKR</a>
  </td></tr>
  <tr><td style="padding:32px 24px">${body}</td></tr>
  <tr><td style="padding:16px 24px;background:#fafafa;text-align:center;font-size:12px;color:#999">
    <p style="margin:0">このメールは<a href="${SITE_URL}" style="color:#666">menes-skr.com</a>から送信されています。</p>
    <p style="margin:4px 0 0">心当たりがない場合はこのメールを無視してください。</p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

/** 口コミ承認通知 */
export function approvalEmailHtml(nickname: string, therapistName: string, credits: number): string {
  return layout(`
    <p style="margin:0 0 16px;font-size:15px;color:#333">${nickname}様</p>
    <p style="margin:0 0 12px;font-size:15px;color:#333">
      <strong>${therapistName}</strong>への口コミが承認されました。
    </p>
    <div style="background:#f0fdf4;border-left:4px solid #22c55e;padding:12px 16px;margin:16px 0;border-radius:0 4px 4px 0">
      <p style="margin:0;font-size:14px;color:#166534">🎉 <strong>${credits}クレジット</strong>が付与されました！</p>
    </div>
    <p style="margin:16px 0;font-size:14px;color:#555">
      クレジットを使って他のユーザーの口コミを閲覧できます。
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="background:#1a1a2e;border-radius:6px;padding:12px 24px">
      <a href="${SITE_URL}/mypage" style="color:#fff;text-decoration:none;font-size:14px;font-weight:bold">マイページを見る →</a>
    </td></tr></table>
  `);
}

/** 口コミ却下通知 */
export function rejectionEmailHtml(nickname: string, therapistName: string, reason: string): string {
  return layout(`
    <p style="margin:0 0 16px;font-size:15px;color:#333">${nickname}様</p>
    <p style="margin:0 0 12px;font-size:15px;color:#333">
      <strong>${therapistName}</strong>への口コミについて、承認できませんでした。
    </p>
    <div style="background:#fef2f2;border-left:4px solid #ef4444;padding:12px 16px;margin:16px 0;border-radius:0 4px 4px 0">
      <p style="margin:0;font-size:14px;color:#991b1b"><strong>理由:</strong> ${reason}</p>
    </div>
    <p style="margin:16px 0;font-size:14px;color:#555">
      内容を修正の上、再投稿をお願いいたします。
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="background:#1a1a2e;border-radius:6px;padding:12px 24px">
      <a href="${SITE_URL}" style="color:#fff;text-decoration:none;font-size:14px;font-weight:bold">サイトに戻る →</a>
    </td></tr></table>
  `);
}

/** お問い合わせ管理者通知 */
export function contactNotificationHtml(type: string, name: string | null, email: string | null, metadata: Record<string, unknown>): string {
  const rows = Object.entries(metadata)
    .map(([k, v]) => `<tr><td style="padding:6px 8px;font-size:13px;color:#666;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 8px;font-size:13px;color:#333">${String(v ?? "")}</td></tr>`)
    .join("");

  return layout(`
    <p style="margin:0 0 16px;font-size:15px;color:#333">新しいお問い合わせがありました。</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:4px;margin:16px 0">
      <tr style="background:#f9fafb">
        <td style="padding:6px 8px;font-size:13px;color:#666">種別</td>
        <td style="padding:6px 8px;font-size:13px;color:#333;font-weight:bold">${type}</td>
      </tr>
      <tr>
        <td style="padding:6px 8px;font-size:13px;color:#666">名前</td>
        <td style="padding:6px 8px;font-size:13px;color:#333">${name || "未入力"}</td>
      </tr>
      <tr style="background:#f9fafb">
        <td style="padding:6px 8px;font-size:13px;color:#666">メール</td>
        <td style="padding:6px 8px;font-size:13px;color:#333">${email || "未入力"}</td>
      </tr>
      ${rows}
    </table>
    <table cellpadding="0" cellspacing="0" style="margin:24px 0"><tr><td style="background:#1a1a2e;border-radius:6px;padding:12px 24px">
      <a href="${SITE_URL}/admin" style="color:#fff;text-decoration:none;font-size:14px;font-weight:bold">管理画面で確認 →</a>
    </td></tr></table>
  `);
}

/** メール送信ヘルパー（失敗してもthrowしない） */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const resend = getResend();
    if (!resend) return false;
    await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

/** 管理者にメール送信 */
export async function sendAdminEmail(subject: string, html: string): Promise<boolean> {
  return sendEmail(ADMIN_EMAIL, subject, html);
}
