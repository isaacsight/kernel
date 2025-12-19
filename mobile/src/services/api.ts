import axios from 'axios';

// Primary: Mac Controller (via Tailscale)
const PRIMARY_API_URL = `http://100.81.9.128:8000`;
// Secondary: Windows Node (Fallback)
const SECONDARY_API_URL = `http://100.98.193.42:5173`; // Adjusted to typical local node port if needed, or matched config

let activeBaseUrl = PRIMARY_API_URL;
let onUrlChange: ((url: string) => void) | null = null;

export const setUrlChangeListener = (listener: (url: string) => void) => {
    onUrlChange = listener;
};

export const getActiveBaseUrl = () => activeBaseUrl;

const api = axios.create({
    baseURL: activeBaseUrl,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to handle failover
api.interceptors.response.use(
    response => response,
    async error => {
        if (!error.response && activeBaseUrl === PRIMARY_API_URL) {
            console.warn("Primary API unreachable, switching to fallback...");
            activeBaseUrl = SECONDARY_API_URL;
            api.defaults.baseURL = activeBaseUrl;
            if (onUrlChange) onUrlChange(activeBaseUrl);
            // Retry the original request
            error.config.baseURL = activeBaseUrl;
            return api(error.config);
        }
        return Promise.reject(error);
    }
);

export const AgentService = {
    getAll: async () => {
        const response = await api.get('/agents');
        return response.data;
    },

    runAction: async (agentName: string, action: string, params: object = {}) => {
        const response = await api.post('/agents/run', {
            agent_name: agentName,
            action: action,
            parameters: params
        });
        return response.data;
    }
};

export const SystemService = {
    sendCommand: async (command: string) => {
        const response = await api.post('/command', { command });
        return response.data;
    },
    publish: async () => {
        const response = await api.post('/system/git/publish');
        return response.data;
    }
};

export default api;
