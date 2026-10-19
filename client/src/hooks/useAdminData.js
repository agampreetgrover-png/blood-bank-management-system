import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

// The 8 blood groups for dropdowns. Stays empty if they can't be loaded.
export function useBloodGroups() {
  const [bloodGroups, setBloodGroups] = useState([]);

  useEffect(() => {
    api.get('/dashboard/blood-groups')
      .then((res) => setBloodGroups(res.data))
      .catch(() => {});
  }, []);

  return bloodGroups;
}

// A searchable admin list. Loads 250 ms after the filters stop changing; only filters with a value are sent.
// Replies to older requests are ignored, so a slow search can't overwrite newer results.
// reload() fetches again right away, e.g. after a change.
export function useFilteredList(path, filters, errorMessage) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const lastRequest = useRef(0);
  const { showToast } = useToast();

  const query = JSON.stringify(Object.fromEntries(Object.entries(filters).filter(([, value]) => value)));

  const reload = useCallback(async () => {
    const request = ++lastRequest.current;
    const isLatest = () => request === lastRequest.current;
    try {
      const res = await api.get(path, { params: JSON.parse(query) });
      if (isLatest()) setItems(res.data);
    } catch {
      if (isLatest()) showToast(errorMessage, 'error');
    } finally {
      if (isLatest()) setLoading(false);
    }
  }, [path, query, errorMessage, showToast]);

  useEffect(() => {
    const timer = setTimeout(reload, 250);
    return () => clearTimeout(timer);
  }, [reload]);

  return { items, loading, reload };
}
