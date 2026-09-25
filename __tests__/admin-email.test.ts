import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Contributor, Spot } from '@/lib/types';

const send = vi.hoisted(() => vi.fn());
vi.mock('resend', () => ({ Resend: vi.fn(function () { return { emails: { send } }; }) }));
vi.mock('@/lib/auth', () => ({
  generateApproveToken: () => 'approve-test', generateRejectToken: () => 'reject-test',
  generateEventActionToken: () => 'event-test',
}));
import { sendAdminNotification } from '@/lib/email';

afterEach(() => { vi.unstubAllEnvs(); send.mockReset(); });
const spot = { id: 'spot-test', name: '<script>test</script>', city: 'Verona', type: 'street', condition: 'alive', lat: 45, lon: 11 } as Spot;
const contributor = { name: 'Rider', email: 'rider@example.com' } as Contributor;

describe('admin notification through Resend', () => {
  it('uses the transactional sender and keeps moderation links and HTML escaping', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-only');
    send.mockResolvedValue({ data: { id: 'email-test' }, error: null });
    await sendAdminNotification(spot, contributor);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ from: 'ChrispyMPS <noreply@chrispybmx.com>' }));
    const payload = send.mock.calls[0][0];
    expect(payload.html).toContain('/api/admin/approve?token=approve-test');
    expect(payload.html).toContain('/api/admin/reject?token=reject-test');
    expect(payload.html).toContain('&lt;script&gt;test&lt;/script&gt;');
    expect(payload.html).not.toContain('<script>test</script>');
  });

  it('surfaces provider errors even when the SDK resolves its promise', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-only');
    send.mockResolvedValue({ data: null, error: { message: 'rate limited' } });
    await expect(sendAdminNotification(spot, contributor)).rejects.toThrow('Resend admin notification: rate limited');
  });
});
