/**
 * emailSignature.ts
 * Mikaela Hall's email signature and outgoing HTML email builders.
 */

/* ── Signature HTML block (used standalone or embedded in outgoing emails) ── */
export const emailSignatureHtml = `<div style="font-family: Optima, 'Palatino Linotype', Georgia, serif; border-top: 1px solid #E8E4DF; padding-top: 12px; margin-top: 12px; font-size: 13px; color: #2C2C2C; line-height: 1.8;"><strong>Mikaela Hall</strong> | <em>Owner &amp; Creative Director</em><br>(916)715-4122<br><a href="mailto:Mikaela@foxandquinn.co" style="color: #2C2C2C; text-decoration: none;">Mikaela@foxandquinn.co</a><br><a href="https://www.foxandquinn.co" style="color: #2C2C2C; text-decoration: none;">www.foxandquinn.co</a></div>`;

/* ── Plain-text fallback signature ── */
export const emailSignaturePlain = `--
Mikaela Hall | Owner & Creative Director
(916)715-4122
Mikaela@foxandquinn.co
www.foxandquinn.co`;

/* ── Wrap HTML content in the full outgoing email shell ── */
export function wrapHtmlEmail(contentHtml: string): string {
  return `<html><body style="font-family: Optima, 'Palatino Linotype', Georgia, serif; font-size: 14px; line-height: 1.6; color: #2C2C2C; max-width: 600px;">${contentHtml}</body></html>`;
}

/**
 * Build a complete outgoing email: body + signature, wrapped in the HTML shell.
 * Pass plain-text lines already converted to <br> if needed.
 */
export function buildOutgoingHtml(bodyHtml: string): string {
  return wrapHtmlEmail(`${bodyHtml}<br><br>${emailSignatureHtml}`);
}

/**
 * Build a reply email: body + signature + quoted original, wrapped in HTML shell.
 */
export function buildReplyHtml(
  bodyHtml: string,
  originalDate: string,
  originalSender: string,
  originalBody: string,
  /** Pass a custom signature HTML (e.g. from the editable sig field). Defaults to the standard signature. */
  signatureHtml?: string,
): string {
  const sig = signatureHtml ?? emailSignatureHtml;
  const quote = `<div style="border-left: 2px solid #E8E4DF; padding-left: 12px; color: #6B6B6B; font-size: 13px; margin-top: 16px;"><strong>On ${originalDate}, ${originalSender} wrote:</strong><br>${originalBody}</div>`;
  return wrapHtmlEmail(`${bodyHtml}<br><br>${sig}<br><br>${quote}`);
}

/* ── Backward-compatibility aliases ── */
export const EMAIL_SIGNATURE_PLAIN = emailSignaturePlain;
export function renderSignatureHtml(): string { return emailSignatureHtml; }
