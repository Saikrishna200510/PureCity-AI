import { auth } from '../firebase/config';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export async function getAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (auth?.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers.Authorization = `Bearer ${token}`;
    } catch {
      // Proceed without token if unavailable
    }
  }
  return headers;
}

export async function apiRequest(path, options = {}) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();

  if (!res.ok) {
    const errMsg = typeof data === 'object' && data?.error ? data.error : `Request failed (${res.status})`;
    const error = new Error(errMsg);
    error.status = res.status;
    error.code = data?.code;
    error.details = data;
    throw error;
  }

  return data;
}
