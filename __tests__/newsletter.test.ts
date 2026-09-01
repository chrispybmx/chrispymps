import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { subscribeToNewsletter as viaFacade } from '@/lib/newsletter';
import { subscribeToNewsletter as viaBrevo } from '@/lib/brevo';

/** Ultima chiamata fetch registrata dal mock. */
type Call = { url: string; init: RequestInit };
let calls: Call[] = [];

/** Mock di fetch che risponde `status` con `body` e registra ogni chiamata. */
function mockFetch(status = 201, body: unknown = { id: 42 }) {
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response;
  }));
}

const ENV_SNAPSHOT = { ...process.env };

beforeEach(() => {
  calls = [];
  // Parte da zero: nessun provider configurato.
  for (const k of Object.keys(process.env)) {
    if (k.startsWith('BREVO_') || k.startsWith('MAILERLITE_') || k === 'NEWSLETTER_PROVIDER') {
      delete process.env[k];
    }
  }
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.env = { ...ENV_SNAPSHOT };
});

const body = (i: number) => JSON.parse(String(calls[i].init.body));

describe('lib/brevo', () => {
  it('senza API key non chiama la rete e non blocca il flusso', async () => {
    mockFetch();
    const res = await viaBrevo('rider@example.com', 'Rider');
    expect(res.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it('single opt-in: manda updateEnabled true, cosi la re-iscrizione non da 4xx', async () => {
    process.env.BREVO_API_KEY = 'k';
    process.env.BREVO_LIST_NEWSLETTER = '7';
    mockFetch(201, { id: 42 });

    const res = await viaBrevo('rider@example.com', 'Rider', { source: 'newsletter' });

    expect(res).toEqual({ ok: true, subscriberId: '42' });
    expect(calls[0].url).toBe('https://api.brevo.com/v3/contacts');
    expect((calls[0].init.headers as Record<string, string>)['api-key']).toBe('k');
    expect(body(0)).toMatchObject({
      email: 'rider@example.com',
      updateEnabled: true,
      listIds: [7],            // numerico, non stringa
      attributes: { NOME: 'Rider' },
    });
  });

  it('re-iscrizione: 204 senza body resta un successo', async () => {
    process.env.BREVO_API_KEY = 'k';
    process.env.BREVO_LIST_NEWSLETTER = '7';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 204,
      json: async () => { throw new Error('no body'); },
    } as unknown as Response)));

    const res = await viaBrevo('rider@example.com', 'Rider', { source: 'newsletter' });
    expect(res.ok).toBe(true);
    expect(res.subscriberId).toBeUndefined();
  });

  it('con template DOI usa il double opt-in e segnala la conferma pendente', async () => {
    process.env.BREVO_API_KEY = 'k';
    process.env.BREVO_LIST_NEWSLETTER = '7';
    process.env.BREVO_DOI_TEMPLATE_ID = '3';
    mockFetch(201, {});

    const res = await viaBrevo('rider@example.com', 'Rider', { source: 'newsletter' });

    expect(calls[0].url).toBe('https://api.brevo.com/v3/contacts/doubleOptinConfirmation');
    expect(body(0)).toMatchObject({ templateId: 3, includeListIds: [7] });
    expect(res.ok).toBe(true);
    expect(res.pendingConfirmation).toBe(true);
  });

  it('su errore non logga il body della risposta: contiene la mail (SEC-12.1)', async () => {
    process.env.BREVO_API_KEY = 'k';
    process.env.BREVO_LIST_NEWSLETTER = '7';
    mockFetch(400, { message: 'Invalid', email: 'rider@example.com' });

    const res = await viaBrevo('rider@example.com', 'Rider', { source: 'newsletter' });

    expect(res.ok).toBe(false);
    const logged = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.flat();
    expect(JSON.stringify(logged)).not.toContain('rider@example.com');
  });

  it('rifiuta un list id non numerico invece di mandare NaN a Brevo', async () => {
    process.env.BREVO_API_KEY = 'k';
    mockFetch();
    const res = await viaBrevo('rider@example.com', 'Rider', { listId: 'abc' });
    expect(res.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
});

describe('lib/newsletter — scelta del provider', () => {
  it('default con sola MailerLite configurata: resta su MailerLite', async () => {
    process.env.MAILERLITE_API_KEY = 'ml';
    mockFetch(201, { data: { id: '9' } });

    await viaFacade('rider@example.com', 'Rider', { source: 'newsletter' });

    expect(calls[0].url).toContain('connect.mailerlite.com');
  });

  it('default con sola Brevo configurata: passa a Brevo', async () => {
    process.env.BREVO_API_KEY = 'k';
    process.env.BREVO_LIST_NEWSLETTER = '7';
    mockFetch();

    await viaFacade('rider@example.com', 'Rider', { source: 'newsletter' });

    expect(calls[0].url).toContain('api.brevo.com');
  });

  it('NEWSLETTER_PROVIDER=brevo vince anche se MailerLite e ancora configurata', async () => {
    process.env.MAILERLITE_API_KEY = 'ml';
    process.env.BREVO_API_KEY = 'k';
    process.env.BREVO_LIST_NEWSLETTER = '7';
    process.env.NEWSLETTER_PROVIDER = 'brevo';
    mockFetch();

    await viaFacade('rider@example.com', 'Rider', { source: 'newsletter' });

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain('api.brevo.com');
  });

  it('both: MailerLite decide l esito, Brevo riceve la copia', async () => {
    process.env.MAILERLITE_API_KEY = 'ml';
    process.env.BREVO_API_KEY = 'k';
    process.env.BREVO_LIST_NEWSLETTER = '7';
    process.env.NEWSLETTER_PROVIDER = 'both';
    mockFetch(201, { data: { id: '9' } });

    const res = await viaFacade('rider@example.com', 'Rider', { source: 'newsletter' });
    await new Promise((r) => setTimeout(r, 0)); // lascia partire la copia fire-and-forget

    expect(res.ok).toBe(true);
    const hosts = calls.map((c) => c.url);
    expect(hosts.some((u) => u.includes('connect.mailerlite.com'))).toBe(true);
    expect(hosts.some((u) => u.includes('api.brevo.com'))).toBe(true);
  });
});
