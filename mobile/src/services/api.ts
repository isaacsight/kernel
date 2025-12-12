import axios from 'axios';

// localhost works for iOS simulator (and Android emulator via adb reverse)
// for physical devices, you'd need the LAN IP
const API_URL = 'http://localhost:8000';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

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
