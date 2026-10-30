export type PasswordResetTemplateInput = {
  firstName: string;
  code: string;
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ??
      character,
  );
}

export function passwordResetTemplate({ firstName, code }: PasswordResetTemplateInput) {
  const safeFirstName = escapeHtml(firstName);
  const safeCode = escapeHtml(code);
  return {
    subject: 'Your Sellonit password reset code',
    html: `<main style="font-family: Arial, sans-serif; line-height: 1.5; color: #202124;"><h1>Reset your password</h1><p>Hi ${safeFirstName},</p><p>Use this code to reset your Sellonit password:</p><p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${safeCode}</p><p>This code expires in 10 minutes. If you did not request a password reset, you can safely ignore this email.</p><p>The Sellonit team</p></main>`,
    text: [
      `Hi ${firstName},`,
      '',
      `Your Sellonit password reset code is: ${code}`,
      '',
      'This code expires in 10 minutes. If you did not request a password reset, you can safely ignore this email.',
      '',
      'The Sellonit team',
    ].join('\n'),
  };
}
