import { api, ApiError } from './instance';

export async function login(credentials: { email?: string; password?: string; pin?: string }) {
  try {
    const payload = credentials.email && credentials.password
      ? { email: credentials.email, password: credentials.password }
      : { pin: credentials.pin };

    const response = await api.post('/admin/login', payload);

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
    throw error;
  }
}


