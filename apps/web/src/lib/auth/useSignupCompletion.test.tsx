/** @vitest-environment jsdom */
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useSignupCompletion } from './useSignupCompletion';
import { AUTH_SIGNAL_STORAGE_KEY, broadcastSignupCompleted } from './crossTab';
import { ApiError } from '@/lib/api-client';
const mocks = vi.hoisted(() => ({ replace: vi.fn(), identity: vi.fn(), context: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/lib/workspace/api', () => ({ confirmIdentity: (): Promise<boolean> => mocks.identity() as Promise<boolean>, getSessionContext: (): Promise<{ businesses: { id: string }[] }> => mocks.context() as Promise<{ businesses: { id: string }[] }> }));
function signalFromAnotherTab() { broadcastSignupCompleted('supplier'); window.dispatchEvent(new StorageEvent('storage', { key: AUTH_SIGNAL_STORAGE_KEY, newValue: localStorage.getItem(AUTH_SIGNAL_STORAGE_KEY) })); }

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); mocks.identity.mockResolvedValue(true); mocks.context.mockResolvedValue({ businesses: [] }); });
afterEach(() => cleanup());
describe('server-confirmed signup completion', () => {
  it('locks immediately on signal, then replaces only after /me and membership confirm', async () => {
    let resolveIdentity: ((value: boolean) => void) | undefined;
    mocks.identity.mockReturnValue(new Promise<boolean>((resolve) => { resolveIdentity = resolve; }));
    const { result } = renderHook(() => useSignupCompletion());
    act(() => signalFromAnotherTab());
    expect(result.current.locked).toBe(true); expect(mocks.replace).not.toHaveBeenCalled();
    mocks.context.mockResolvedValue({ businesses: [{ id: 'biz-1' }] });
    act(() => { resolveIdentity?.(true); });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/dashboard'));
    expect(mocks.identity).toHaveBeenCalledTimes(1); expect(mocks.context).toHaveBeenCalledTimes(1);
  });
  it('does not redirect on a forged/stale signal without server membership', async () => {
    const { result } = renderHook(() => useSignupCompletion()); act(() => signalFromAnotherTab());
    await waitFor(() => expect(result.current.locked).toBe(false)); expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('offers retry after confirmation failure', async () => {
    mocks.identity.mockRejectedValueOnce(new Error('offline')); const { result } = renderHook(() => useSignupCompletion());
    act(() => signalFromAnotherTab()); await waitFor(() => expect(result.current.error).toContain('retry'));
    mocks.context.mockResolvedValue({ businesses: [{ id: 'biz-1' }] }); act(() => result.current.retry());
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/dashboard'));
  });
  it('handles expired identity without navigating', async () => {
    mocks.identity.mockRejectedValue(new ApiError(401, 'UNAUTHENTICATED', 'Expired')); const { result } = renderHook(() => useSignupCompletion());
    act(() => signalFromAnotherTab()); await waitFor(() => expect(result.current.error).toContain('expired')); expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('preflights existing membership and skips signup', async () => {
    mocks.context.mockResolvedValue({ businesses: [{ id: 'existing' }] }); const { result } = renderHook(() => useSignupCompletion());
    let completed = false; await act(async () => { completed = await result.current.confirmOnServer(); }); expect(completed).toBe(true); expect(mocks.replace).toHaveBeenCalledWith('/dashboard');
  });
  it('rechecks on focus and visible visibility changes', async () => {
    renderHook(() => useSignupCompletion());
    mocks.context.mockResolvedValue({ businesses: [{ id: 'existing' }] });
    await act(async () => { window.dispatchEvent(new Event('focus')); await Promise.resolve(); });
    expect(mocks.replace).toHaveBeenCalledWith('/dashboard');
    mocks.replace.mockClear(); mocks.context.mockResolvedValue({ businesses: [] });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await Promise.resolve(); });
    expect(mocks.identity).toHaveBeenCalledTimes(2);
  });
  it('cleans up under StrictMode and ignores signals after unmount', async () => {
    const { result, unmount } = renderHook(() => useSignupCompletion(), { wrapper: StrictMode }); unmount();
    act(() => signalFromAnotherTab()); await Promise.resolve(); expect(mocks.identity).not.toHaveBeenCalled(); expect(result.current.locked).toBe(false);
  });
});
