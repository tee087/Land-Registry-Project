const API_BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');

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

const VALIDATION_LABELS = {
  fullName: 'Full name', email: 'Email address', phone: 'Phone number',
  accountType: 'Account type', password: 'Password', captchaToken: 'Human verification',
  code: 'Verification code', mfaCode: 'Authenticator code',
};

function getRequestErrorMessage(payload, status) {
  if (payload?.error?.code === 'APPROVAL_EMAIL_FAILED') {
    return 'We could not email the site owner for approval. Please try again shortly.';
  }
  if (status >= 500) return 'Something went wrong on our side. Please try again shortly.';
  const details = payload?.error?.details;
  if (payload?.error?.code === 'VALIDATION_ERROR' && Array.isArray(details) && details.length) {
    const messages = details.map(({ field, message }) => {
      const label = VALIDATION_LABELS[field] || 'Form';
      const reason = String(message || '').replace(/^Invalid input$/, 'is invalid').replace(/^Required$/, 'is required');
      return `${label}: ${reason}`;
    });
    return [...new Set(messages)].join(' ');
  }
  if (payload?.error?.code === 'HUMAN_VERIFICATION_FAILED' || payload?.error?.code === 'HUMAN_VERIFICATION_REQUIRED') {
    return 'Please complete the security check and try again.';
  }
  return payload?.message || 'We could not complete that request. Please check your information and try again.';
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
    throw new ApiError('We’re having trouble connecting. Please try again shortly.', {
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
    const message = getRequestErrorMessage(payload, res.status);
    throw new ApiError(message, {
      status: res.status,
      code: payload?.error?.code || 'REQUEST_FAILED',
      details: payload?.error?.details || null,
    });
  }

  return { data: payload.data, meta: payload.meta, message: payload.message };
}

let refreshing = null;

async function sha256Base64(file) {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

function fileMimeType(file) {
  if (file.type) return file.type;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return ({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', tif: 'image/tiff', tiff: 'image/tiff' })[extension] || 'application/octet-stream';
}

async function uploadDocumentFile(resource, id, file) {
  const metadata = {
    originalName: file.name,
    mimeType: fileMimeType(file),
    sizeBytes: file.size,
    sha256: await sha256Base64(file),
  };
  const root = resource === 'parcel' ? `/parcels/${id}/documents` : `/registrations/${id}/documents`;

  let ticket;
  try {
    ({ data: ticket } = await request(`${root}/upload-url`, { method: 'POST', body: metadata, auth: true }));
  } catch (error) {
    // Local development without S3 keeps support for small JSON uploads.
    if (error.code !== 'DIRECT_UPLOAD_UNAVAILABLE' || file.size > 650 * 1024) throw error;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      reader.readAsDataURL(file);
    });
    return request(root, { method: 'POST', body: { ...metadata, contentBase64: dataUrl }, auth: true });
  }

  const uploaded = await fetch(ticket.uploadUrl, { method: 'PUT', headers: ticket.headers, body: file });
  if (!uploaded.ok) throw new ApiError('The document could not be stored. Check object storage CORS and retry.', { status: uploaded.status, code: 'DOCUMENT_STORAGE_FAILED' });
  return request(`${root}/complete`, { method: 'POST', body: { ...metadata, storageKey: ticket.storageKey }, auth: true });
}

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
  googleAuth: (input) => request('/auth/google', { method: 'POST', body: input }),
  verifyEmail: (token) => request('/auth/verify-email', { method: 'POST', body: { token } }),
  verifyEmailCode: (email, code) => request('/auth/verify-email', { method: 'POST', body: { email, code } }),
  requestEmailVerification: (email) => request('/auth/email-verification/request', { method: 'POST', body: { email } }),
  requestPasswordReset: (email) => request('/auth/password-reset/request', { method: 'POST', body: { email } }),
  resetPassword: (token, password) => request('/auth/password-reset/confirm', { method: 'POST', body: { token, password } }),
  setupMfa: (password) => request('/auth/mfa/setup', { method: 'POST', body: { password }, auth: true }),
  enableMfa: (code) => request('/auth/mfa/enable', { method: 'POST', body: { code }, auth: true }),
  logout: (refreshToken) => request('/auth/logout', { method: 'POST', body: { refreshToken } }),
  me: () => request('/auth/me', { auth: true }),
  updateProfile: (input) => request('/users/me', { method: 'PATCH', body: input, auth: true }),
  uploadProfileAvatar: async (file) => {
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read the selected image.'));
      reader.readAsDataURL(file);
    });
    const contentBase64 = dataUrl.split(',')[1] || '';
    return request('/users/me/avatar', { method: 'PUT', body: { mimeType: file.type, contentBase64 }, auth: true });
  },
  getProfileAvatar: () => request('/users/me/avatar', { auth: true, responseType: 'blob' }),
  removeProfileAvatar: () => request('/users/me/avatar', { method: 'DELETE', auth: true }),
  requestReviewerAccess: (input) => request('/users/me/reviewer-access-request', { method: 'POST', body: input, auth: true }),
  requestAccountModeChange: (requestedAccountType) => request('/account-mode/request', { method: 'POST', body: { requestedAccountType }, auth: true }),
  accountModeRequestStatus: () => request('/account-mode/mine', { auth: true }),
  getAccountModeApproval: (token) => request('/account-mode/approval/inspect', { method: 'POST', body: { token } }),
  approveAccountMode: (token) => request('/account-mode/approval', { method: 'POST', body: { token } }),
  changePassword: (input) => request('/users/me/password', { method: 'PATCH', body: input, auth: true }),
  lookupUser: (email) => request('/users/lookup', { query: { email }, auth: true }),

  // Users (administrator)
  listUsers: (query) => request('/users', { query, auth: true }),
  updateUserStatus: (id, status) => request(`/users/${id}/status`, { method: 'PATCH', body: { status }, auth: true }),
  updateUserRole: (id, role) => request(`/users/${id}/role`, { method: 'PATCH', body: { role }, auth: true }),

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
  uploadDocument: (parcelId, file) => uploadDocumentFile('parcel', parcelId, file),
  uploadDocumentToRegistration: (registrationId, file) => uploadDocumentFile('registration', registrationId, file),
  listDocuments: (parcelId) => request(`/parcels/${parcelId}/documents`, { auth: true }),
  listRegistrationDocuments: (registrationId) =>
    request(`/registrations/${registrationId}/documents`, { auth: true }),
  getDocument: (id) => request(`/documents/${id}`, { auth: true }),
  verifyDocument: (id) => request(`/documents/${id}/verify`, { method: 'POST', auth: true }),
  downloadDocument: async (id, filename) => {
    try {
      const { data } = await request(`/documents/${id}/download-url`, { auth: true });
      const response = await fetch(data.downloadUrl);
      if (!response.ok) throw new ApiError('Unable to download document from storage.', { status: response.status, code: 'DOCUMENT_DOWNLOAD_FAILED' });
      return { blob: await response.blob(), filename, contentType: response.headers.get('Content-Type') };
    } catch (error) {
      if (error.code !== 'DIRECT_DOWNLOAD_UNAVAILABLE') throw error;
      return request(`/documents/${id}/download`, { auth: true, responseType: 'blob' });
    }
  },

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
