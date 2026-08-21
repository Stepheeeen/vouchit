import Cookies from 'js-cookie';

const isLocal = typeof window !== 'undefined' 
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  : process.env.NODE_ENV !== 'production';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (isLocal ? 'http://localhost:3001' : 'https://vouchit.onrender.com');

export async function fetchApi(endpoint: string, options: RequestInit = {}) {
  const token = Cookies.get('vouchit_token');

  const headers: Record<string, string> = {
    // Only set Content-Type when there's a body — sending it on every GET
    // (including the notification poll every 10s) forces an unnecessary
    // CORS preflight (OPTIONS) round-trip before each real request.
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
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

// Shared token storage so every call site (login, verify, logout) applies the
// same cookie attributes instead of re-declaring `expires`/`sameSite`/`secure`.
export function setAuthToken(token: string) {
  Cookies.set('vouchit_token', token, {
    expires: 7,
    path: '/',
    sameSite: 'Lax',
    secure: !isLocal,
  });
  localStorage.setItem('vouchit_token', token); // kept for backward compatibility during transition
}

export function clearAuthToken() {
  Cookies.remove('vouchit_token', { path: '/' });
  localStorage.removeItem('vouchit_token');
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
  // `stake` is a human-readable token amount (e.g. "25" USDC); `contractWagerId`
  // is the id of an already-mined escrow entry, which the API verifies on-chain.
  create: (
    description: string,
    stake: string,
    tokenAddress: string,
    isSymmetric: boolean,
    expiryDays: number,
    contractWagerId: string,
  ) =>
    fetchApi('/wagers', {
      method: 'POST',
      body: JSON.stringify({ description, stake, tokenAddress, isSymmetric, expiryDays, contractWagerId }),
    }),
  getAll: () => fetchApi('/wagers'),
  getById: (id: string) => fetchApi(`/wagers/${id}`),
  getMy: () => fetchApi('/wagers/my'),
  // The stake is fixed by the escrow entry, so there is no amount to send.
  join: (id: string) => fetchApi(`/wagers/${id}/join`, { method: 'POST' }),
  /** Sync our records with the escrow after voting on-chain. The winner is
   *  decided by the contract, so nothing is sent. */
  settle: (id: string) => fetchApi(`/wagers/${id}/settle`, { method: 'POST' }),
};

export const userApi = {
  getProfile: () => fetchApi('/users/me'),
  updateProfile: (data: { displayName?: string; bio?: string; phone?: string }) =>
    fetchApi('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    fetchApi('/users/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),
  verifyKYC: (type: 'BVN' | 'NIN', number: string) =>
    fetchApi('/users/kyc', { method: 'POST', body: JSON.stringify({ type, number }) }),
};

export const web3Api = {
  linkWallet: (address: string, signature: string) =>
    fetchApi('/web3/link-wallet', { method: 'POST', body: JSON.stringify({ address, signature }) }),
  unlinkWallet: () => fetchApi('/web3/unlink-wallet', { method: 'DELETE' }),
};

export const walletApi = {
  getBalances: () => fetchApi('/wallet'),
  initializeDeposit: (amount: number) =>
    fetchApi('/wallet/deposit/initialize', { method: 'POST', body: JSON.stringify({ amount }) }),
  verifyDeposit: (reference: string) =>
    fetchApi(`/wallet/deposit/verify?reference=${reference}`),
  withdraw: (amount: number) =>
    fetchApi('/wallet/withdraw', { method: 'POST', body: JSON.stringify({ amount }) }),
  resolveBank: (accountNumber: string, bankCode: string) =>
    fetchApi(`/wallet/bank/resolve?accountNumber=${accountNumber}&bankCode=${bankCode}`),
  linkBank: (data: { bankCode: string, bankName: string, accountNumber: string, accountName: string }) =>
    fetchApi('/wallet/bank', { method: 'POST', body: JSON.stringify(data) }),
  getLinkedBank: () => fetchApi('/wallet/bank'),
  unlinkBank: () => fetchApi('/wallet/bank', { method: 'DELETE' }),
};

export const disputesApi = {
  create: (data: { wagerId: string; reason: string; proofType?: string; mediaUrl?: string }) =>
    fetchApi('/disputes', { method: 'POST', body: JSON.stringify(data) }),
  getByWagerId: (wagerId: string) => fetchApi(`/disputes/${wagerId}`),
  getAll: () => fetchApi('/disputes'),
  resolve: (id: string, resolution: 'WINNER_A' | 'WINNER_B' | 'REFUND') =>
    fetchApi(`/disputes/${id}/resolve`, { method: 'POST', body: JSON.stringify({ resolution }) }),
  uploadFile: async (file: File) => {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dnv9z6wnf';
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || 'vouchit';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Cloudinary upload failed: ${response.status}`);
    }

    const resData = await response.json();
    return { url: resData.secure_url };
  },
};

export const leaderboardApi = {
  get: () => fetchApi('/users/leaderboard'),
};

export const notificationsApi = {
  getAll: () => fetchApi('/notifications'),
  markRead: (id: string) => fetchApi(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllRead: () => fetchApi('/notifications/read-all', { method: 'POST' }),
};

