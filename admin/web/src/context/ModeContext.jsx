import React, { createContext, useContext, useState, useEffect } from 'react';

const ModeContext = createContext();

export const ModeProvider = ({ children }) => {
    // Initialize from DOM if available (prevent FOUC mismatch) or localStorage
    const [mode, setMode] = useState(() => {
        if (typeof document !== 'undefined' && document.body.className) {
            // If blocking script already set class, use that truth
            return document.body.className;
        }
        return localStorage.getItem('studio_mode') || 'standard';
    });

    useEffect(() => {
        const current = localStorage.getItem('studio_mode');
        if (current !== mode) {
            localStorage.setItem('studio_mode', mode);
        }
        if (document.body.className !== mode) {
            document.body.className = mode;
        }
    }, [mode]);

    const toggleMode = (newMode) => {
        setMode(newMode);
    };

    return (
        <ModeContext.Provider value={{ mode, toggleMode }}>
            {children}
        </ModeContext.Provider>
    );
};

export const useMode = () => {
    const context = useContext(ModeContext);
    if (!context) {
        throw new Error('useMode must be used within a ModeProvider');
    }
    return context;
};
