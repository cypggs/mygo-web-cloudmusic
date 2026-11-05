export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'same-origin', ...options })
  const data = await response.json()
  if (!response.ok || (data.code && data.code !== 200)) {
    throw new Error(data.message || data.msg || '请求失败，请稍后重试')
  }
  return data as T
}

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) : fallback
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}
