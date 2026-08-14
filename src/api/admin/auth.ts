import { getFreshCsrfToken } from '@/lib/apiClient';
import { api, ApiError, setCsrfTokenCache } from './instance';

export async function login(credentials: { email?: string; password?: string; pin?: string }) {
  try {
    console.log('Starting admin login...');
    const payload = credentials.email && credentials.password
      ? { email: credentials.email, password: credentials.password }
      : { pin: credentials.pin };

    const response = await api.post('/admin/login', payload);
    console.log('Login response:', response.data);

    if (response.data?.status === 'success') {
      localStorage.setItem('admin_authenticated', 'true');
      if (response.data.data?.user) {
        localStorage.setItem('admin_user', JSON.stringify(response.data.data.user));
      }
      const token = await getFreshCsrfToken();
      setCsrfTokenCache(token);
    }

    return response.data;
  } catch (error) {
    const err = error as ApiError;
    console.error('Login error:', err.response?.data?.message || err.message);
    throw error;
  }
}

export async function getMe() {
  try {
    const { data } = await api.get('/admin/me');
    return data.data?.user;
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    throw error;
  }
}

export function isAuthenticated() {
  return localStorage.getItem('admin_authenticated') === 'true';
}

export function logout() {
  localStorage.removeItem('admin_authenticated');
  localStorage.removeItem('admin_user');
}


