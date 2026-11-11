import Cookies from 'js-cookie';

const isLocal = typeof window !== 'undefined' 
  ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  : process.env.NODE_ENV !== 'production';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 
  (isLocal ? 'http://localhost:3001' : 'https://vouchit.onrender.com');

/**
 * How long to wait before giving up on the API.
 *
 * Generous because the backend runs on Render's free plan, which sleeps when
 * idle and takes most of a minute to wake. Finite because the alternative is
 * what shipped: a request with no deadline, so a cold start or a dead backend
 * left the page spinning forever with no error and nothing to retry.
 */
const REQUEST_TIMEOUT_MS = 70_000;

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
      signal: options.signal ?? controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(
        'The server took too long to respond. It may be waking up — try again in a moment.',
      );
    }
    throw new Error('Could not reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 429) {
      throw new Error(
        errorData.message || 'Too many attempts. Wait a few minutes and try again.',
      );
    }
    throw new Error(errorData.message || `Request failed: ${response.status}`);
  }

  // 204 and other empty bodies are valid answers, not parse failures.
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
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
  // Deliberately NOT mirrored into localStorage. The copy that used to live
  // there ("kept for backward compatibility during transition") handed any
  // XSS a seven-day bearer token in one line of script. The cookie is no
  // fortress either — js-cookie cannot set HttpOnly — but it is not readable
  // by a stray `localStorage.getItem` and it expires with the session rules.
}

export function clearAuthToken() {
  Cookies.remove('vouchit_token', { path: '/' });
  // Clear the legacy copy for anyone still carrying one from an older build.
  try {
    localStorage.removeItem('vouchit_token');
  } catch {
    /* private mode / blocked storage */
  }
}

export const authApi = {
  register: (email: string, password: string) =>
    fetchApi('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  verifyEmail: (email: string, otp: string) =>
    fetchApi('/auth/verify-email', { method: 'POST', body: JSON.stringify({ email, otp }) }),
  login: (email: string, password: string) =>
    fetchApi('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  /** Second step when the account has two-factor enabled. */
  loginTwoFactor: (email: string, otp: string) =>
    fetchApi('/auth/login/2fa', { method: 'POST', body: JSON.stringify({ email, otp }) }),
  /** A real endpoint, rather than re-calling register with a placeholder. */
  resendOtp: (email: string) =>
    fetchApi('/auth/resend-otp', { method: 'POST', body: JSON.stringify({ email }) }),
  forgotPassword: (email: string) =>
    fetchApi('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (email: string, otp: string, password: string) =>
    fetchApi('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, otp, password }) }),
  signOutAllDevices: () => fetchApi('/auth/sign-out-all', { method: 'POST' }),
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
    category: string,
  ) =>
    fetchApi('/wagers', {
      method: 'POST',
      body: JSON.stringify({
        description,
        stake,
        tokenAddress,
        isSymmetric,
        expiryDays,
        contractWagerId,
        category,
      }),
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
  updateProfile: (data: {
    displayName?: string;
    bio?: string;
    avatarUrl?: string;
    username?: string;
  }) => fetchApi('/users/me', { method: 'PATCH', body: JSON.stringify(data) }),
  getPublicProfile: (id: string) => fetchApi(`/users/${id}`),
  exportMyData: () => fetchApi('/users/me/export'),
  changePassword: (currentPassword: string, newPassword: string) =>
    fetchApi('/users/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),
  /** Preferences live on the server now, not in this browser's localStorage. */
  getPreferences: () => fetchApi('/users/me/preferences'),
  updatePreferences: (patch: Record<string, boolean>) =>
    fetchApi('/users/me/preferences', { method: 'PATCH', body: JSON.stringify(patch) }),
  deleteAccount: (password: string) =>
    fetchApi('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }),
};

export const web3Api = {
  linkWallet: (address: string, signature: string) =>
    fetchApi('/web3/link-wallet', { method: 'POST', body: JSON.stringify({ address, signature }) }),
  unlinkWallet: () => fetchApi('/web3/unlink-wallet', { method: 'DELETE' }),
  /** Current verification tier, its signals, and the limits it unlocks. */
  getVerification: () => fetchApi('/web3/verification'),
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

