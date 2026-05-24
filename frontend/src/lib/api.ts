import Cookies from 'js-cookie';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = Cookies.get('vouchit_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `Request failed: ${response.status}`);
  }

  return response.json();
}

export const authApi = {
  register: (email: string, password: string) =>
    fetchApi('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  verifyEmail: (email: string, otp: string) =>
    fetchApi('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, otp }) }),
  login: (email: string, password: string) =>
    fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
};

export const wagersApi = {
  create: (description: string, amount: number) =>
    fetchApi('/wagers', { method: 'POST', body: JSON.stringify({ description, amount }) }),
  getAll: () => fetchApi('/wagers'),
  getById: (id: string) => fetchApi(`/wagers/${id}`),
  getMy: () => fetchApi('/wagers/my'),
  join: (id: string, amount: number) =>
    fetchApi(`/wagers/${id}/join`, { method: 'POST', body: JSON.stringify({ amount }) }),
  settle: (id: string, winnerId: string) =>
    fetchApi(`/wagers/${id}/settle`, { method: 'POST', body: JSON.stringify({ winnerId }) }),
};

export const userApi = {
  getProfile: () => fetchApi('/users/me'),
  updateProfile: (data: { displayName?: string; bio?: string; phone?: string }) =>
    fetchApi('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    fetchApi('/users/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),
};

export const walletApi = {
  getBalances: () => fetchApi('/wallet'),
  initializeDeposit: (amount: number) =>
    fetchApi('/wallet/deposit/initialize', { method: 'POST', body: JSON.stringify({ amount }) }),
  verifyDeposit: (reference: string) =>
    fetchApi(`/wallet/deposit/verify?reference=${reference}`),
  withdraw: (amount: number) =>
    fetchApi('/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount }) }),
};

export const disputesApi = {
  create: (data: { wagerId: string; reason: string; proofType?: string; mediaUrl?: string }) =>
    fetchApi('/disputes', { method: 'POST', body: JSON.stringify(data) }),
  getByWagerId: (wagerId: string) => fetchApi(`/disputes/${wagerId}`),
};

export const leaderboardApi = {
  get: () => fetchApi('/users/leaderboard'),
};
