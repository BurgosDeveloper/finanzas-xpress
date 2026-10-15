// Comunicación con el servidor.
export class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.status = status
    this.data = data
  }
}

let onUnauthorized = () => {}
export const setUnauthorizedHandler = (fn) => {
  onUnauthorized = fn
}

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`/api/${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError('Sin conexión. Revisa tu internet.', 0, null)
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    /* sin cuerpo */
  }
  if (!res.ok) {
    if (res.status === 401 && path !== 'login') onUnauthorized()
    throw new ApiError(data?.error || 'No se pudo completar. Intenta de nuevo.', res.status, data)
  }
  return data
}

export const api = {
  state: (version) => request(`state${version != null ? `?v=${version}` : ''}`),
  login: (body) => request('login', { method: 'POST', body }),
  logout: () => request('logout', { method: 'POST' }),
  addMovement: (body) => request('movements', { method: 'POST', body }),
  updateMovement: (id, body) => request(`movements/${id}`, { method: 'PUT', body }),
  deleteMovement: (id) => request(`movements/${id}`, { method: 'DELETE' }),
  saveRates: (body) => request('rates', { method: 'PUT', body }),
}
