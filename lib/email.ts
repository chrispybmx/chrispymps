import { Resend } from 'resend';
import { generateApproveToken, generateRejectToken } from './auth';
import { APP_CONFIG } from './constants';
import type { Spot, Contributor } from './types';

/** Escapa i caratteri HTML speciali per prevenire XSS nelle email HTML */
function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let _resend: Resend | null = null;
function resend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error('RESEND_API_KEY mancante');
    _resend = new Resend(key);
  }
  return _resend;
}

const FROM_EMAIL = 'ChrispyMPS <noreply@chrispybmx.com>';

// ===== EMAIL ALL'ADMIN: nuovo spot da moderare =====
export async function sendAdminNotification(spot: Spot, contributor: Contributor): Promise<void> {
  const approveToken  = generateApproveToken(spot.id);
  const rejectToken   = generateRejectToken(spot.id);   // BUG-FIX: token dedicato con separatore '|'
  const baseUrl       = APP_CONFIG.url;

  const approveUrl = `${baseUrl}/api/admin/approve?token=${approveToken}`;
  const rejectUrl  = `${baseUrl}/api/admin/reject?token=${rejectToken}`;
  const adminUrl   = `${baseUrl}/admin`;

  // SEC-FIX: escape tutti i campi user-controlled per prevenire XSS in webmail
  const eName = escapeHtml(spot.name);
  const eType = escapeHtml(spot.type);
  const eCity = escapeHtml(spot.city ?? '—');
  const eCondition = escapeHtml(spot.condition);
  const eSurface = escapeHtml(spot.surface ?? '—');
  const eDescription = escapeHtml(spot.description);
  const eGuardians = escapeHtml(spot.guardians);
  const eContribName = escapeHtml(contributor.name);
  const eContribEmail = escapeHtml(contributor.email);
  const eInstagram = escapeHtml(contributor.instagram_handle);

  await resend().emails.send({
    from:    FROM_EMAIL,
    to:      APP_CONFIG.adminEmail,
    subject: `🏴 Nuovo spot: ${eName} (${eCity})`,
    html: `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><style>
  body { background:#0a0a0a; color:#f3ead8; font-family:'Courier New',monospace; margin:0; padding:20px; }
  .card { background:#1a1a1a; border:1px solid #ff6a00; border-radius:4px; padding:24px; max-width:560px; margin:0 auto; }
  h1 { color:#ff6a00; font-size:22px; margin:0 0 16px; }
  .row { display:flex; gap:8px; margin:6px 0; }
  .label { color:#888; min-width:120px; }
  .val { color:#f3ead8; }
  .btn { display:inline-block; padding:12px 24px; border-radius:2px; text-decoration:none; font-weight:bold; font-size:15px; margin:6px 6px 0 0; }
  .btn-approve { background:#00c851; color:#000; }
  .btn-reject  { background:#ff6a00; color:#000; }
  .btn-admin   { background:#2a2a2a; color:#f3ead8; border:1px solid #3a3a3a; }
  .sep { border:none; border-top:1px solid #2a2a2a; margin:20px 0; }
</style></head>
<body><div class="card">
  <h1>🏴 NUOVO SPOT DA MODERARE</h1>
  <div class="row"><span class="label">Nome:</span>      <span class="val">${eName}</span></div>
  <div class="row"><span class="label">Tipo:</span>      <span class="val">${eType}</span></div>
  <div class="row"><span class="label">Città:</span>     <span class="val">${eCity}</span></div>
  <div class="row"><span class="label">Condizione:</span><span class="val">${eCondition}</span></div>
  <div class="row"><span class="label">Superficie:</span><span class="val">${eSurface}</span></div>
  <div class="row"><span class="label">Cera:</span>      <span class="val">${spot.wax_needed ? 'Sì' : 'No'}</span></div>
  ${eDescription ? `<div class="row"><span class="label">Descrizione:</span><span class="val">${eDescription}</span></div>` : ''}
  ${eGuardians ? `<div class="row"><span class="label">Note accesso:</span><span class="val">${eGuardians}</span></div>` : ''}
  <div class="row"><span class="label">GPS:</span>       <span class="val">${spot.lat.toFixed(6)}, ${spot.lon.toFixed(6)}</span></div>
  <hr class="sep">
  <div class="row"><span class="label">Da:</span>        <span class="val">${eContribName} (${eContribEmail})</span></div>
  ${eInstagram ? `<div class="row"><span class="label">Instagram:</span><span class="val">@${eInstagram}</span></div>` : ''}
  <hr class="sep">
  <a href="${approveUrl}" class="btn btn-approve">✅ APPROVA</a>
  <a href="${rejectUrl}"  class="btn btn-reject">❌ RIFIUTA</a>
  <a href="${adminUrl}"   class="btn btn-admin">📱 Admin dashboard</a>
  <hr class="sep">
  <p style="color:#888;font-size:11px;">Spot ID: ${spot.id}<br>
  I link di approvazione scadono dopo 72 ore.</p>
</div></body></html>
    `.trim(),
  });
}

// ===== EMAIL AL CONTRIBUTOR: conferma ricezione =====
export async function sendContributorConfirmation(
  contributor: Contributor,
  spot: Spot
): Promise<void> {
  const eName = escapeHtml(spot.name);
  const eCity = escapeHtml(spot.city);
  const eContribName = escapeHtml(contributor.name);

  await resend().emails.send({
    from:    FROM_EMAIL,
    to:      contributor.email,
    subject: `Spot ricevuto: ${eName} 🏴`,
    html: `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><style>
  body { background:#0a0a0a; color:#f3ead8; font-family:'Courier New',monospace; margin:0; padding:20px; }
  .card { background:#1a1a1a; border:1px solid #ff6a00; border-radius:4px; padding:24px; max-width:560px; margin:0 auto; }
  h1 { color:#ff6a00; font-size:22px; margin:0 0 12px; }
  p { margin:8px 0; line-height:1.6; }
  .highlight { color:#ffce4d; }
  .sig { margin-top:24px; color:#888; }
</style></head>
<body><div class="card">
  <h1>SPOT RICEVUTO 🏴</h1>
  <p>Ciao <span class="highlight">${eContribName}</span>,</p>
  <p>ho ricevuto il tuo spot <strong>${eName}</strong>${eCity ? ` a ${eCity}` : ''}.</p>
  <p>Lo do un'occhiata il prima possibile. Se è tutto ok lo troverai sulla mappa entro 24-48 ore.</p>
  <p>Grazie per contribuire alla mappa — senza gente come te questo progetto non esisterebbe.</p>
  <div class="sig">
    <p>— Chrispy<br>
    <a href="https://www.instagram.com/chrispy_bmx" style="color:#ff6a00;">@chrispy_bmx</a> |
    <a href="${APP_CONFIG.mapUrl}" style="color:#ff6a00;">maps.chrispybmx.com</a></p>
  </div>
</div></body></html>
    `.trim(),
  });
}

// ===== EMAIL AL CONTRIBUTOR: spot approvato =====
export async function sendApprovalEmail(
  contributor: Contributor,
  spot: Spot
): Promise<void> {
  const spotUrl = `${APP_CONFIG.url}/map/spot/${spot.slug}`;
  const eName = escapeHtml(spot.name);
  const eCity = escapeHtml(spot.city);
  const eContribName = escapeHtml(contributor.name);

  await resend().emails.send({
    from:    FROM_EMAIL,
    to:      contributor.email,
    subject: `Il tuo spot è online! ${eName} ✅`,
    html: `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><style>
  body { background:#0a0a0a; color:#f3ead8; font-family:'Courier New',monospace; margin:0; padding:20px; }
  .card { background:#1a1a1a; border:1px solid #00c851; border-radius:4px; padding:24px; max-width:560px; margin:0 auto; }
  h1 { color:#00c851; font-size:22px; margin:0 0 12px; }
  p { margin:8px 0; line-height:1.6; }
  .highlight { color:#ffce4d; }
  .btn { display:inline-block; background:#ff6a00; color:#000; padding:12px 24px; text-decoration:none; border-radius:2px; font-weight:bold; margin-top:16px; }
  .sig { margin-top:24px; color:#888; }
</style></head>
<body><div class="card">
  <h1>SPOT APPROVATO ✅</h1>
  <p>Ciao <span class="highlight">${eContribName}</span>,</p>
  <p>il tuo spot <strong>${eName}</strong>${eCity ? ` a ${eCity}` : ''} è ora visibile sulla mappa!</p>
  <p>Condividilo con la crew — ogni link condiviso aiuta la mappa a crescere.</p>
  <a href="${spotUrl}" class="btn">Vedi il tuo spot →</a>
  <div class="sig">
    <p>— Chrispy<br>
    <a href="https://www.instagram.com/chrispy_bmx" style="color:#ff6a00;">@chrispy_bmx</a></p>
  </div>
</div></body></html>
    `.trim(),
  });
}

// ===== EMAIL AL CONTRIBUTOR: spot rifiutato =====
export async function sendRejectionEmail(
  contributor: Contributor,
  spot: Spot,
  reason?: string
): Promise<void> {
  const eName = escapeHtml(spot.name);
  const eContribName = escapeHtml(contributor.name);
  const eReason = escapeHtml(reason);

  await resend().emails.send({
    from:    FROM_EMAIL,
    to:      contributor.email,
    subject: `Spot non approvato: ${eName}`,
    html: `
<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><style>
  body { background:#0a0a0a; color:#f3ead8; font-family:'Courier New',monospace; margin:0; padding:20px; }
  .card { background:#1a1a1a; border:1px solid #3a3a3a; border-radius:4px; padding:24px; max-width:560px; margin:0 auto; }
  h1 { color:#888; font-size:22px; margin:0 0 12px; }
  p { margin:8px 0; line-height:1.6; }
  .reason { background:#0a0a0a; border-left:3px solid #ff6a00; padding:8px 12px; margin:12px 0; font-style:italic; }
  .sig { margin-top:24px; color:#888; }
</style></head>
<body><div class="card">
  <h1>SPOT NON APPROVATO</h1>
  <p>Ciao ${eContribName},</p>
  <p>ho dovuto scartare lo spot <strong>${eName}</strong>.</p>
  ${eReason ? `<div class="reason">${eReason}</div>` : ''}
  <p>Puoi riprovare con un altro spot — ogni contributo è benvenuto.</p>
  <div class="sig">
    <p>— Chrispy<br>
    <a href="https://www.instagram.com/chrispy_bmx" style="color:#ff6a00;">@chrispy_bmx</a></p>
  </div>
</div></body></html>
    `.trim(),
  });
}
