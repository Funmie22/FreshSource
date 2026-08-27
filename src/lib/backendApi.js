const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://freshsource.onrender.com').replace(/\/$/, '')

export async function backendRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })

  if (!response.ok) {
    throw new Error(`FreshSource API request failed: ${response.status}`)
  }

  return response.json()
}

export async function getBackendHealth() {
  return backendRequest('/health')
}

export { API_BASE_URL }
