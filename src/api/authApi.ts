export interface RemoteAuthResponse {
  ok: boolean;
  user?: any;
  token?: string;
  error?: string;
}

function buildUrl(base: string, path: string) {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}

export async function registerRemote(baseUrl: string, payload: { username: string; passwordHash: string; name?: string }): Promise<RemoteAuthResponse> {
  try {
    const res = await fetch(buildUrl(baseUrl, '/api/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function loginRemote(baseUrl: string, payload: { username: string; passwordHash: string }): Promise<RemoteAuthResponse> {
  try {
    const res = await fetch(buildUrl(baseUrl, '/api/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function deleteRemoteAccount(baseUrl: string, token: string): Promise<RemoteAuthResponse> {
  try {
    const res = await fetch(buildUrl(baseUrl, '/api/me'), {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

export async function getRemoteUser(baseUrl: string, token: string): Promise<RemoteAuthResponse> {
  try {
    const res = await fetch(buildUrl(baseUrl, '/api/me'), {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return await res.json();
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}
