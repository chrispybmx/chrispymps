import { beforeEach, describe, expect, it, vi } from 'vitest';
import { escapeHtml } from '@/lib/escape-html';

const mock = vi.hoisted(() => ({
  getUser: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
  notify: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/email', () => ({ sendAdminNotification: mock.notify }));
vi.mock('@/lib/supabase', () => {
  const chain = () => {
    const q: Record<string, unknown> = {};
    q.select = () => q; q.eq = () => q; q.single = mock.single;
    return q;
  };
  return {
    supabasePublic: vi.fn(),
    supabaseAdmin: () => ({
      auth: { getUser: mock.getUser },
      from: () => ({
        ...chain(),
        update: (patch: unknown) => { mock.update(patch); return chain(); },
      }),
    }),
  };
});

import { PATCH } from '@/app/api/spots/[slug]/route';

const SPOT_ID = '11111111-1111-4111-8111-111111111111';
const OWNER = { id: 'owner', email: 'rider@example.com' };
const approvedSpot = {
  id: SPOT_ID, submitted_by_user_id: 'owner', status: 'approved', slug: 'park', city: 'Merano',
  approved_at: '2026-10-01T00:00:00Z', name: 'Park pulito', description: 'Bel park', guardians: null, type: 'park',
};

function patch(body: Record<string, unknown>) {
  return PATCH(
    new Request(`https://maps.example/api/spots/${SPOT_ID}`, {
      method: 'PATCH', body: JSON.stringify({ access_token: 'tok', ...body }),
    }) as never,
    { params: Promise.resolve({ slug: SPOT_ID }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.getUser.mockResolvedValue({ data: { user: OWNER }, error: null });
  mock.single
    .mockResolvedValueOnce({ data: approvedSpot, error: null })   // authorizeOwner
    .mockResolvedValueOnce({ data: { slug: 'park' }, error: null }); // update
});

describe('modifica di uno spot approvato', () => {
  it('rimanda in moderazione quando cambia il nome e avvisa l admin', async () => {
    const res = await patch({ name: 'Spam totale' });
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, inModerazione: true });
    expect(mock.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending', approved_at: approvedSpot.approved_at }));
    expect(mock.notify).toHaveBeenCalledOnce();
  });

  it('rimanda in moderazione quando cambia la descrizione', async () => {
    const body = await (await patch({ description: 'Altro testo' })).json();
    expect(body.inModerazione).toBe(true);
    expect(mock.update.mock.calls[0][0].status).toBe('pending');
  });

  it('resta online se cambia solo la categoria', async () => {
    const body = await (await patch({ type: 'street' })).json();
    expect(body).toMatchObject({ ok: true, inModerazione: false });
    expect(mock.update.mock.calls[0][0]).not.toHaveProperty('status');
    expect(mock.notify).not.toHaveBeenCalled();
  });

  it('resta online se il testo inviato e identico a quello salvato', async () => {
    const body = await (await patch({ name: 'Park pulito', description: 'Bel park' })).json();
    expect(body.inModerazione).toBe(false);
    expect(mock.update.mock.calls[0][0]).not.toHaveProperty('status');
  });

  it('rifiuta chi non e il proprietario', async () => {
    mock.getUser.mockResolvedValue({ data: { user: { id: 'altro' } }, error: null });
    const res = await patch({ name: 'Spam' });
    expect(res.status).toBe(403);
    expect(mock.update).not.toHaveBeenCalled();
  });
});

describe('escapeHtml', () => {
  it('neutralizza i tag nel testo degli utenti', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>"\'&')).toBe('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;');
    expect(escapeHtml(null)).toBe('');
  });
});
