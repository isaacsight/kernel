import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

/**
 * useNeuralStream - Custom hook for robust data streaming from the Neural Link API.
 * Handles polling, error states, and data normalization.
 */
export const useNeuralStream = (pollInterval = 3000) => {
    const [feed, setFeed] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [lastSync, setLastSync] = useState(null);
    const [signalStrength, setSignalStrength] = useState(100);

    const pollRef = useRef(null);

    const fetchData = async () => {
        try {
            const response = await axios.get('/api/studio/neural_link');

            if (response.data && Array.isArray(response.data.feed)) {
                // Defensive normalization: ensure every item has required fields
                const normalizedFeed = response.data.feed.map(item => ({
                    ...item,
                    metadata: item.metadata || {},
                    content: item.content || '',
                    source_type: item.source_type || 'unknown',
                    timestamp: item.timestamp || new Date().toISOString()
                }));

                setFeed(normalizedFeed);
                setLastSync(new Date());
                setError(null);
                setSignalStrength(s => Math.min(100, s + 5)); // Gradually recover signal
            }
        } catch (err) {
            console.error("Neural Stream Error:", err);
            setError(err.message || 'Connection Interrupted');
            setSignalStrength(s => Math.max(0, s - 20)); // Quick signal drop on error
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        pollRef.current = setInterval(fetchData, pollInterval);

        return () => {
            if (pollRef.current) clearInterval(pollRef.current);
        };
    }, [pollInterval]);

    return {
        feed,
        loading,
        error,
        lastSync,
        signalStrength,
        refresh: fetchData
    };
};
