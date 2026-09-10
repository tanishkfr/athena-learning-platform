import { createContext, useContext, useEffect, useState, useCallback } from 'react';

export async function api(path, body, method = 'POST') {
  const response = await fetch('/api' + path, { method: body === undefined ? 'GET' : method, headers: body instanceof FormData ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The request could not be completed.');
  return data;
}
const Context = createContext(null);
export function Store({ children }) {
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [ai, setAi] = useState(null);
  const refresh = useCallback(async () => { try { setData(await api('/state')); setError(''); } catch (e) { setError(e.message); } }, []);
  useEffect(() => { refresh(); api('/ai/status').then(setAi).catch(() => {}); const interval = setInterval(refresh, 2000); return () => clearInterval(interval); }, [refresh]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(t); }, [notice]);
  const mutate = useCallback(async (path, body, method = 'POST') => { const result = await api(path, body, method); await refresh(); return result; }, [refresh]);
  const prefs = data?.preferences.find(p => p.id === 'local');
  useEffect(() => { document.documentElement.dataset.textSize = prefs?.textSize || 'standard'; document.documentElement.dataset.motion = prefs?.reducedMotion ? 'reduced' : 'normal'; }, [prefs]);
  return <Context.Provider value={{ data, error, refresh, mutate, notice: setNotice, ai, refreshAi: async () => setAi(await api('/ai/status')), prefs }}>{children}{notice && <div className="toast" role="status">{notice}</div>}</Context.Provider>;
}
export const useStore = () => useContext(Context);
export function useDraft(key, initial = '') {
  const [value, setValue] = useState(() => { try { return localStorage.getItem('athena:draft:' + key) ?? initial; } catch { return initial; } });
  const update = v => { setValue(v); try { localStorage.setItem('athena:draft:' + key, v); } catch { /* The current input stays in memory if browser storage is full. */ } };
  const clear = () => { try { localStorage.removeItem('athena:draft:' + key); } catch {} };
  return [value, update, clear];
}
