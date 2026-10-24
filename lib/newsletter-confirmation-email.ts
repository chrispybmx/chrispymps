/* Email di conferma della newsletter (double opt-in).
   Stili inline e bottone a tabella: Gmail e Outlook ignorano buona parte
   dei <style> e dei bottoni CSS. Colori allineati alle email admin in
   lib/email.ts. La scadenza del link (24 ore, cm_newsletter_request) resta
   in fondo: chi legge per prima cosa deve vedere il bottone, non un limite. */

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function newsletterConfirmationEmail(link: string, privacyUrl: string) {
  const href = escapeAttr(link);
  const privacy = escapeAttr(privacyUrl);

  const subject = 'Un clic e sei dentro: newsletter Chrispy Maps';

  const html = `<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#0a0a0a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#1a1a1a;border:1px solid #ff6a00;border-radius:4px;">
  <tr><td style="padding:32px 28px;font-family:'Courier New',monospace;color:#f3ead8;">
    <p style="margin:0 0 8px;font-size:12px;letter-spacing:2px;color:#ff6a00;">CHRISPY MAPS · NEWSLETTER BMX</p>
    <h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#f3ead8;">Manca solo un clic.</h1>
    <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">Ogni settimana cinque cose dal mondo BMX: spot nuovi, eventi, video da non perdere. Premi il bottone e sei iscritto.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
    <tr><td style="background:#ff6a00;border-radius:2px;">
      <a href="${href}" style="display:inline-block;padding:16px 32px;font-family:'Courier New',monospace;font-size:17px;font-weight:bold;color:#0a0a0a;text-decoration:none;">Conferma iscrizione →</a>
    </td></tr>
    </table>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#9a9a9a;">Il bottone non va? Copia questo link nel browser:<br><a href="${href}" style="color:#ff6a00;word-break:break-all;">${href}</a></p>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#9a9a9a;">Il link vale 24 ore. Se non hai chiesto tu l’iscrizione, ignora questa mail: non succede niente.</p>
    <p style="margin:16px 0 0;font-size:12px;color:#6a6a6a;"><a href="${privacy}" style="color:#6a6a6a;">Informativa privacy</a></p>
  </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;

  const text = `Manca solo un clic.

Ogni settimana cinque cose dal mondo BMX: spot nuovi, eventi, video da non perdere.
Apri questo link e premi Conferma iscrizione:
${link}

Il link vale 24 ore. Se non hai chiesto tu l’iscrizione, ignora questa mail: non succede niente.
Informativa: ${privacyUrl}`;

  return { subject, html, text };
}
