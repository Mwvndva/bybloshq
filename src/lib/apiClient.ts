import { defaultUniversalClient } from './http/UniversalHttpClient';
export { getFreshCsrfToken, getCachedCsrfToken, setCachedCsrfToken } from './auth/WebAuthStrategy';

const apiClient = defaultUniversalClient.getAxiosInstance();

export default apiClient;
