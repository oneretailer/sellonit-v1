export type EmailVerificationTemplateInput = {
  firstName: string;
  verificationUrl: string;
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] ?? character,
  );
}

export function emailVerificationTemplate({
  firstName,
  verificationUrl,
}: EmailVerificationTemplateInput): {
  subject: string;
  html: string;
  text: string;
} {
  const safeFirstName = escapeHtml(firstName);
  const safeVerificationUrl = escapeHtml(verificationUrl);
  return {
    subject: 'Verify your Sellonit email address',
    html: `
      <main style="font-family: Arial, sans-serif; line-height: 1.5; color: #202124;">
        <h1>Verify your email address</h1>
        <p>Hi ${safeFirstName},</p>
        <p>Thanks for creating your Sellonit account. Confirm your email address to finish setting up your account.</p>
        <p>
          <a href="${safeVerificationUrl}" style="background: #111827; color: #ffffff; padding: 12px 18px; text-decoration: none; border-radius: 6px;">
            Verify email address
          </a>
        </p>
        <p>This link expires in 24 hours. If you did not create this account, you can safely ignore this email.</p>
        <p>The Sellonit team</p>
      </main>
    `.trim(),
    text: [
      `Hi ${firstName},`,
      '',
      'Thanks for creating your Sellonit account. Confirm your email address to finish setting up your account:',
      verificationUrl,
      '',
      'This link expires in 24 hours. If you did not create this account, you can safely ignore this email.',
      '',
      'The Sellonit team',
    ].join('\n'),
  };
}
