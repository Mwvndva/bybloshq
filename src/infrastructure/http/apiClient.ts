import { defaultUniversalClient } from './UniversalHttpClient';
export { getFreshCsrfToken, getCachedCsrfToken, setCachedCsrfToken } from '../auth/WebAuthStrategy';

const apiClient = defaultUniversalClient.getAxiosInstance();

export { apiClient };
export default apiClient;
