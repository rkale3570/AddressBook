const BASE_URL = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  contacts: {
    list: (page = 1, limit = 20, search?: string) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      return request<any>(`/contacts?${params}`);
    },
    get: (id: string) => request<any>(`/contacts/${id}`),
    create: (data: any) => request<any>('/contacts', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/contacts/${id}`, { method: 'DELETE' }),
    merge: (sourceId: string, targetId: string) =>
      request<any>('/contacts/merge', { method: 'POST', body: JSON.stringify({ sourceId, targetId }) }),
  },

  scan: {
    image: (file: File) => {
      const form = new FormData();
      form.append('image', file);
      return fetch(`${BASE_URL}/scan/image`, { method: 'POST', body: form }).then(r => r.json());
    },
    text: (text: string) => request<any>('/scan/text', { method: 'POST', body: JSON.stringify({ text }) }),
  },

  voice: {
    transcribe: (transcript: string) =>
      request<any>('/voice/transcribe', { method: 'POST', body: JSON.stringify({ transcript }) }),
    transcribeAudio: (file: File) => {
      const form = new FormData();
      form.append('audio', file);
      return fetch(`${BASE_URL}/voice/transcribe-audio`, { method: 'POST', body: form }).then(r => r.json());
    },
  },

  duplicates: {
    check: (data: any) => request<any>('/duplicates/check', { method: 'POST', body: JSON.stringify(data) }),
    resolve: (data: any) => request<any>('/duplicates/resolve', { method: 'POST', body: JSON.stringify(data) }),
  },

  relationships: {
    create: (data: any) => request<any>('/relationships', { method: 'POST', body: JSON.stringify(data) }),
    getForContact: (contactId: string) => request<any>(`/relationships/contact/${contactId}`),
    delete: (id: string) => request<any>(`/relationships/${id}`, { method: 'DELETE' }),
    groups: {
      list: () => request<any>('/relationships/groups'),
      create: (data: any) => request<any>('/relationships/groups', { method: 'POST', body: JSON.stringify(data) }),
      addContacts: (groupId: string, contactIds: string[]) =>
        request<any>(`/relationships/groups/${groupId}/contacts`, { method: 'POST', body: JSON.stringify({ contactIds }) }),
      delete: (id: string) => request<any>(`/relationships/groups/${id}`, { method: 'DELETE' }),
    },
  },
};
