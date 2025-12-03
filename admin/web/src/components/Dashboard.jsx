import React, { useState, useEffect } from 'react';
import AgentCard from './AgentCard';
import axios from 'axios';

const Dashboard = () => {
    const [agents, setAgents] = useState([]);

    const fetchAgents = async () => {
        try {
            const res = await axios.get('http://localhost:8000/agents');
            setAgents(res.data);
        } catch (err) {
            console.error("Failed to fetch agents:", err);
        }
    };

    useEffect(() => {
        fetchAgents();
        const interval = setInterval(fetchAgents, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    const handleAction = async (agentName, action) => {
        console.log(`Triggering ${action} for ${agentName}`);
        try {
            if (agentName === "The Alchemist") {
                const topic = prompt("Enter a topic for the new post:");
                if (!topic) return;

                await axios.post('http://localhost:8000/agents/run', {
                    agent_name: agentName,
                    action: action,
                    parameters: { topic }
                });
                alert("Alchemist commissioned! Check back soon.");
            } else {
                await axios.post('http://localhost:8000/agents/run', {
                    agent_name: agentName,
                    action: action
                });
                alert(`${agentName} action triggered.`);
            }
        } catch (error) {
            console.error(error);
            alert("Action failed: " + error.message);
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="mb-10">
                <h1 className="text-4xl font-bold mb-2 tracking-tighter">Mission Control</h1>
                <p className="text-muted-foreground text-base">Manage your autonomous creative team.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {agents.map(agent => (
                    <AgentCard key={agent.name} {...agent} onAction={handleAction} />
                ))}
            </div>
        </div>
    );
};

export default Dashboard;
