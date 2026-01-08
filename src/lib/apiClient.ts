import axios from 'axios';

// Determine Base URL
// Priority: VITE_API_URL -> localhost logic
const isDevelopment = import.meta.env.DEV;
const envApiUrl = import.meta.env.VITE_API_URL;

let baseURL = '';
if (isDevelopment && !envApiUrl) {
    baseURL = '/api'; // Use Vite proxy
} else {
    baseURL = (envApiUrl || 'http://localhost:3002').replace(/\/$/, '');
    if (!baseURL.endsWith('/api')) {
        baseURL += '/api';
    }
}

const apiClient = axios.create({
    baseURL,
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Send cookies
});

// Response Interceptor: Error Handling
apiClient.interceptors.response.use(
    (response) => {
        return response; // Return full response to satisfy Axios types
    },
    (error) => {
        const message = error.response?.data?.message || error.message || 'An error occurred';

        // Optional: Handle 401 Global Logout/Clear Token?
        // if (error.response?.status === 401) { ... }

        return Promise.reject(new Error(message));
    }
);

export default apiClient;
