const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

// Accounts
export const fetchAccounts = () => request<any[]>('/accounts');
export const createAccount = (data: { name: string; category: string; sort_order?: number; meta?: any }) =>
  request<any>('/accounts', { method: 'POST', body: JSON.stringify(data) });
export const updateAccount = (id: number, data: { name: string; category: string; sort_order?: number; meta?: any }) =>
  request<any>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const toggleAccount = (id: number) =>
  request<any>(`/accounts/${id}/toggle`, { method: 'POST' });
export const deleteAccount = (id: number) =>
  request<any>(`/accounts/${id}`, { method: 'DELETE' });
export const reorderAccounts = (items: { id: number; sort_order: number }[]) =>
  request<any>('/accounts/reorder', { method: 'POST', body: JSON.stringify(items) });

// Snapshots
export const fetchSnapshots = () => request<any[]>('/snapshots');
export const fetchSnapshot = (id: number) => request<any>(`/snapshots/${id}`);
export const fetchLatestSnapshots = () => request<any[]>('/snapshots/latest');
export const createSnapshot = (data: { date: string; notes: string; items: any[] }) =>
  request<any>('/snapshots', { method: 'POST', body: JSON.stringify(data) });
export const deleteSnapshot = (id: number) =>
  request<any>(`/snapshots/${id}`, { method: 'DELETE' });

// Dashboard
export const fetchTrend = () => request<any[]>('/dashboard/trend');

// Quotes
export const fetchBatchQuotes = (data: { stocks: string[]; funds: string[] }) =>
  request<any>('/quote/batch', { method: 'POST', body: JSON.stringify(data) });

// Export / Import
export const exportData = () => request<any>('/export');
export const importData = (data: any) =>
  request<any>('/import', { method: 'POST', body: JSON.stringify(data) });
