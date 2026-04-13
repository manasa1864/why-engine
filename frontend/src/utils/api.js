import axios from 'axios';
const api = axios.create({ baseURL: process.env.REACT_APP_API_URL || '/api', timeout: 90000 });
api.interceptors.request.use(c => { const t = localStorage.getItem('why_token'); if (t) c.headers.Authorization = `Bearer ${t}`; return c; });
api.interceptors.response.use(r => r, e => { if (e.response?.status === 401 && !['/login','/register'].includes(window.location.pathname)) { localStorage.removeItem('why_token'); window.location.href = '/login'; } return Promise.reject(e); });
export default api;
