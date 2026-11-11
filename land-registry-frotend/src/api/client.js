const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

const ACCESS_KEY = 'lrc.accessToken';
const REFRESH_KEY = 'lrc.refreshToken';
const SESSION_EXPIRED_EVENT = 'lrc:session-expired';

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'UNKNOWN', details = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh() {
    return localStorage.getItem(REFRESH_KEY);
  },
  set({ accessToken, refreshToken }) {
    if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
    if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  },
  clear() {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export function onSessionExpired(handler) {
  window.addEventListener(SESSION_EXPIRED_EVENT, handler);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
}

function notifySessionExpired() {
  tokenStore.clear();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

function withQuery(path, query) {
  if (!query) return path;
  if (typeof query === 'string') {
    if (!query) return path;
    return query.startsWith('?') ? `${path}${query}` : `${path}?${query}`;
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function rawRequest(path, { method = 'GET', body, token, responseType = 'json' } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the API server. Is the backend running?', {
      code: 'NETWORK_ERROR',
    });
  }

  if (responseType === 'blob' && res.ok) {
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    return {
      blob: await res.blob(),
      filename: match ? decodeURIComponent(match[1]) : null,
      contentType: res.headers.get('Content-Type'),
    };
  }

  const payload = await res.json().catch(() => null);

  if (!res.ok || !payload?.success) {
    throw new ApiError(payload?.message || `Request failed (${res.status})`, {
      status: res.status,
      code: payload?.error?.code || 'REQUEST_FAILED',
      details: payload?.error?.details || null,
    });
  }

  return { data: payload.data, meta: payload.meta, message: payload.message };
}

let refreshing = null;

async function tryRefresh() {
  if (!tokenStore.refresh) return false;
  if (!refreshing) {
    refreshing = rawRequest('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: tokenStore.refresh },
    })
      .then((result) => {
        tokenStore.set(result.data);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

const inFlight = new Map();

export async function request(path, options = {}) {
  const { auth = false, method = 'GET', body, query, responseType = 'json', dedupe = true } = options;
  const fullPath = withQuery(path, query);
  const token = auth ? tokenStore.access : undefined;
  const key = `${method}:${fullPath}:${token || ''}`;

  if (method === 'GET' && dedupe && inFlight.has(key)) return inFlight.get(key);

  const run = (async () => {
    try {
      return await rawRequest(fullPath, { method, body, token, responseType });
    } catch (err) {
      if (auth && err.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) {
          return rawRequest(fullPath, { method, body, token: tokenStore.access, responseType });
        }
        notifySessionExpired();
      }
      throw err;
    }
  })();

  if (method === 'GET' && dedupe) {
    inFlight.set(key, run);
    run.then(
      () => inFlight.delete(key),
      () => inFlight.delete(key)
    );
  }

  return run;
}

export const api = {
  health: () => request('/health'),

  // Auth / profile
  register: (input) => request('/auth/register', { method: 'POST', body: input }),
  login: (input) => request('/auth/login', { method: 'POST', body: input }),
  logout: (refreshToken) => request('/auth/logout', { method: 'POST', body: { refreshToken } }),
  me: () => request('/auth/me', { auth: true }),
  updateProfile: (input) => request('/users/me', { method: 'PATCH', body: input, auth: true }),
  changePassword: (input) => request('/users/me/password', { method: 'PATCH', body: input, auth: true }),
  lookupUser: (email) => request('/users/lookup', { query: { email }, auth: true }),

  // Users (administrator)
  listUsers: (query) => request('/users', { query, auth: true }),
  updateUserStatus: (id, status) => request(`/users/${id}/status`, { method: 'PATCH', body: { status }, auth: true }),

  // Land registry
  searchParcel: (parcelNumber) => request('/parcels/search', { query: { q: parcelNumber }, auth: true }),
  listParcels: (query) => request('/parcels', { query, auth: true }),
  getParcel: (id) => request(`/parcels/${id}`, { auth: true }),
  createParcel: (input) => request('/parcels', { method: 'POST', body: input, auth: true }),
  updateParcel: (id, input) => request(`/parcels/${id}`, { method: 'PATCH', body: input, auth: true }),
  parcelOwnerships: (id) => request(`/parcels/${id}/ownerships`, { auth: true }),
  parcelDocuments: (id) => request(`/parcels/${id}/documents`, { auth: true }),
  freezeParcel: (id, frozen, reason) =>
    request(`/parcels/${id}/freeze`, { method: 'POST', body: { frozen, reason }, auth: true }),

  // Registrations
  createRegistration: (input) => request('/registrations', { method: 'POST', body: input, auth: true }),
  listRegistrations: (query) => request('/registrations', { query, auth: true }),
  getRegistration: (id) => request(`/registrations/${id}`, { auth: true }),
  reviewRegistration: (id, input) =>
    request(`/registrations/${id}/review`, { method: 'POST', body: input, auth: true }),

  // Transfers
  createTransfer: (input) => request('/transfers', { method: 'POST', body: input, auth: true }),
  listTransfers: (query) => request('/transfers', { query, auth: true }),
  getTransfer: (id) => request(`/transfers/${id}`, { auth: true }),
  reviewTransfer: (id, input) => request(`/transfers/${id}/review`, { method: 'POST', body: input, auth: true }),

  // Documents
  uploadDocument: (parcelId, input) =>
    request(`/parcels/${parcelId}/documents`, { method: 'POST', body: input, auth: true }),
  uploadDocumentToRegistration: (registrationId, input) =>
    request(`/registrations/${registrationId}/documents`, { method: 'POST', body: input, auth: true }),
  listDocuments: (parcelId) => request(`/parcels/${parcelId}/documents`, { auth: true }),
  listRegistrationDocuments: (registrationId) =>
    request(`/registrations/${registrationId}/documents`, { auth: true }),
  getDocument: (id) => request(`/documents/${id}`, { auth: true }),
  verifyDocument: (id) => request(`/documents/${id}/verify`, { method: 'POST', auth: true }),
  downloadDocument: (id) => request(`/documents/${id}/download`, { auth: true, responseType: 'blob' }),

  // Evidence
  listEvidence: () => request('/evidence', { auth: true }),
  getEvidence: (id) => request(`/evidence/${id}`, { auth: true }),
  createEvidence: (input) => request('/evidence', { method: 'POST', body: input, auth: true }),
  addEvidenceCustody: (id, input) =>
    request(`/evidence/${id}/custody`, { method: 'POST', body: input, auth: true }),

  // Forensic findings
  listForensicFindings: (query) => request('/evidence/findings', { query, auth: true }),
  getForensicFinding: (id) => request(`/evidence/findings/${id}`, { auth: true }),
  createForensicFinding: (evidenceId, input) =>
    request(`/evidence/${evidenceId}/findings`, { method: 'POST', body: input, auth: true }),

  // Audit
  listAuditLogs: (query) => request('/audit-logs', { query, auth: true }),

  // Notifications
  notifications: (query) => request('/notifications', { query, auth: true }),
  markNotificationsRead: () => request('/notifications/read-all', { method: 'POST', auth: true }),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'POST', auth: true }),

  // Blockchain
  blockchainStatus: () => request('/blockchain/status', { auth: true }),
  listBlockchainTransactions: (query) => request('/blockchain/transactions', { query, auth: true }),
  getBlockchainTransaction: (id) => request(`/blockchain/transactions/${id}`, { auth: true }),
  retryBlockchainTransaction: (id) =>
    request(`/blockchain/transactions/${id}/retry`, { method: 'POST', auth: true }),
  verifyParcelOnChain: (parcelNumber) =>
    request(`/blockchain/parcels/${encodeURIComponent(parcelNumber)}`, { auth: true }),
};

export { API_BASE };
