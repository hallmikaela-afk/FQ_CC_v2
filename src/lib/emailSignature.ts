/**
 * emailSignature.ts
 * Mikaela Hall's default email signature — plain text source and HTML renderer.
 */

export const EMAIL_SIGNATURE_PLAIN = `---
Mikaela Hall | Owner & Creative Director
(916)715-4122
Mikaela@foxandquinn.co
www.foxandquinn.co`;

/**
 * Returns the signature as an HTML string for embedding inside email bodies.
 * The rule line, bold name, plain phone, and linked email/website are all styled
 * to match the FQ design language.
 */
export function renderSignatureHtml(): string {
  return [
    '<hr style="border:none;border-top:1px solid #E8E0D8;margin:24px 0 16px" />',
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;',
    'font-size:13px;line-height:1.75;color:#9B8E82">',
    '<strong style="color:#2C2420;font-weight:600">Mikaela Hall | Owner &amp; Creative Director</strong><br/>',
    '(916)715-4122<br/>',
    '<a href="mailto:Mikaela@foxandquinn.co" style="color:#8B6F4E;text-decoration:none">Mikaela@foxandquinn.co</a><br/>',
    '<a href="https://www.foxandquinn.co" style="color:#8B6F4E;text-decoration:none">www.foxandquinn.co</a>',
    '</div>',
  ].join('');
}
