export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('vouchit_token') : null;
  
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
    throw new Error(errorData.message || 'API request failed');
  }

  return response.json();
}

export const authApi = {
  register: (email: string, password: string) => fetchApi('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
  verifyEmail: (email: string, otp: string) => fetchApi('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, otp }),
  }),
  login: (email: string, password: string) => fetchApi('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  }),
};

export const wagersApi = {
  create: (description: string, amount: number) => fetchApi('/wagers', {
    method: 'POST',
    body: JSON.stringify({ description, amount }),
  }),
  getAll: () => fetchApi('/wagers'),
  getById: (id: string) => fetchApi(`/wagers/${id}`),
  join: (id: string, amount: number) => fetchApi(`/wagers/${id}/join`, {
    method: 'POST',
    body: JSON.stringify({ amount }),
  }),
};

export const userApi = {
  getProfile: () => fetchApi('/users/me'),
};

export const walletApi = {
  getBalances: () => fetchApi('/wallet'),
  deposit: (amount: number) => fetchApi('/wallet/deposit', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  }),
  withdraw: (amount: number) => fetchApi('/wallet/withdraw', {
    method: 'POST',
    body: JSON.stringify({ amount }),
  }),
};
