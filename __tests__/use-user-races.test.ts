import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type TestUser = { id: string; username: string; email: string; accessToken: string };
type Session = { user: { id: string; email?: string; user_metadata?: Record<string, string> }; access_token: string } | null;
const mock = vi.hoisted(() => ({ getSession: vi.fn(), getProfile: vi.fn(), unsubscribe: vi.fn(), state: undefined as TestUser | null | undefined, updates: [] as unknown[], event: null as null | ((event: string, session: Session) => void), cleanup: null as null | (() => void) }));

// Exercise the actual hook effect without introducing a DOM/testing dependency.
vi.mock('react', () => ({
  useState: () => [mock.state, (update: unknown) => {
    mock.state = typeof update === 'function' ? update(mock.state) : update as TestUser | null | undefined;
    mock.updates.push(mock.state);
  }],
  useEffect: (effect: () => (() => void) | undefined) => { mock.cleanup = effect() ?? null; },
}));
vi.mock('@/lib/supabase-browser', () => ({ supabaseBrowser: () => ({ auth: {
  getSession: mock.getSession,
  onAuthStateChange: (callback: (event: string, session: Session) => void) => { mock.event = callback; return { data: { subscription: { unsubscribe: mock.unsubscribe } } }; },
} }) }));
vi.mock('@/lib/auth-client', () => ({ getProfile: mock.getProfile }));

import { useUser } from '@/hooks/useUser';

const A = 'first-account'; const B = 'second-account';
const session = (id: string, token = `token-${id}`, username?: string): NonNullable<Session> => ({ user: { id, email: `${id}@example.test`, user_metadata: username ? { username } : {} }, access_token: token });
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { for (let index = 0; index < 6; index++) await Promise.resolve(); };
beforeEach(() => {
  vi.clearAllMocks(); vi.useFakeTimers();
  mock.state = undefined; mock.updates = []; mock.event = null; mock.cleanup = null;
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
});
afterEach(() => { mock.cleanup?.(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('useUser asynchronous identity boundaries', () => {
  it('does not apply an old profile after a newer account signs in', async () => {
    const oldProfile = deferred<{ username: string }>();
    mock.getSession.mockResolvedValue({ data: { session: session(A) } });
    mock.getProfile.mockReturnValue(oldProfile.promise);
    useUser(); await flush();
    mock.event?.('SIGNED_IN', session(B, 'new-account-token', 'rider-b'));
    oldProfile.resolve({ username: 'rider-a' }); await flush();
    expect(mock.state).toMatchObject({ id: B, username: 'rider-b', accessToken: 'new-account-token' });
    expect(localStorage.getItem(`cmaps_un_${A}`)).toBeNull();
  });

  it('keeps logout final when the previous account profile lookup resolves later', async () => {
    const oldProfile = deferred<{ username: string }>();
    mock.getSession.mockResolvedValue({ data: { session: session(A) } }); mock.getProfile.mockReturnValue(oldProfile.promise);
    useUser(); await flush(); mock.event?.('SIGNED_OUT', null);
    oldProfile.resolve({ username: 'rider-a' }); await flush();
    expect(mock.state).toBeNull();
    expect(mock.updates).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: A })]));
  });

  it('ignores a stale profile rejection instead of signing out the new account', async () => {
    const oldProfile = deferred<null>();
    mock.getSession.mockResolvedValue({ data: { session: session(A) } }); mock.getProfile.mockReturnValue(oldProfile.promise);
    useUser(); await flush(); mock.event?.('SIGNED_IN', session(B, 'token-b', 'rider-b'));
    oldProfile.reject(new Error('old request failed')); await flush();
    expect(mock.state?.id).toBe(B);
  });

  it('ignores an initial session snapshot that arrives after an auth event', async () => {
    const initial = deferred<{ data: { session: Session } }>(); mock.getSession.mockReturnValue(initial.promise);
    useUser(); mock.event?.('SIGNED_IN', session(B, 'token-b', 'rider-b'));
    initial.resolve({ data: { session: session(A, 'old-token', 'rider-a') } }); await flush();
    expect(mock.state?.id).toBe(B);
    expect(mock.getProfile).not.toHaveBeenCalled();
  });

  it('preserves the newest refreshed token when an older lookup finishes', async () => {
    const oldProfile = deferred<{ username: string }>();
    mock.getSession.mockResolvedValue({ data: { session: session(A, 'old-token') } }); mock.getProfile.mockReturnValue(oldProfile.promise);
    useUser(); await flush(); mock.event?.('TOKEN_REFRESHED', session(A, 'fresh-token', 'rider-a'));
    oldProfile.resolve({ username: 'rider-a' }); await flush();
    expect(mock.state?.accessToken).toBe('fresh-token');
  });

  it('does not update state or cached identity after unmount', async () => {
    const oldProfile = deferred<{ username: string }>();
    mock.getSession.mockResolvedValue({ data: { session: session(A) } }); mock.getProfile.mockReturnValue(oldProfile.promise);
    useUser(); await flush(); mock.cleanup?.(); mock.cleanup = null;
    oldProfile.resolve({ username: 'rider-a' }); await flush();
    expect(mock.updates).toHaveLength(0);
    expect(localStorage.getItem(`cmaps_un_${A}`)).toBeNull();
    expect(mock.unsubscribe).toHaveBeenCalledOnce();
  });

  it('does not let failure of an outdated initial read override the current user', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const initial = deferred<unknown>(); mock.getSession.mockReturnValue(initial.promise);
    useUser(); mock.event?.('SIGNED_IN', session(B, 'token-b', 'rider-b'));
    initial.reject(new Error('initial read failed')); await flush();
    expect(mock.state?.id).toBe(B);
  });
});
