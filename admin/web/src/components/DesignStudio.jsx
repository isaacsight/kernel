import React, { useState } from 'react';

function DesignStudio() {
    const [activeTab, setActiveTab] = useState('critique');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState('');

    // Critique Inputs
    const [cssInput, setCssInput] = useState('');
    const [htmlInput, setHtmlInput] = useState('');

    // Generate Inputs
    const [requirements, setRequirements] = useState('');
    const [contextCss, setContextCss] = useState('');

    const handleCritique = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:8000/agents/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_name: 'The Visionary',
                    action: 'critique',
                    parameters: {
                        css: cssInput,
                        html: htmlInput
                    }
                })
            });
            const data = await response.json();
            setResult(data.result);
        } catch (error) {
            setResult('Error: ' + error.message);
        }
        setLoading(false);
    };

    const handleGenerate = async () => {
        setLoading(true);
        try {
            const response = await fetch('http://localhost:8000/agents/run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    agent_name: 'The Visionary',
                    action: 'generate_css',
                    parameters: {
                        requirements: requirements,
                        current_css: contextCss
                    }
                })
            });
            const data = await response.json();
            setResult(data.result);
        } catch (error) {
            setResult('Error: ' + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="p-6 max-w-4xl mx-auto">
            <header className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Design Studio</h1>
                <p className="text-gray-400">Collaborate with The Visionary to refine your UI.</p>
            </header>

            <div className="flex gap-4 mb-6 border-b border-gray-700">
                <button
                    className={`pb-2 px-4 ${activeTab === 'critique' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
                    onClick={() => setActiveTab('critique')}
                >
                    Critique
                </button>
                <button
                    className={`pb-2 px-4 ${activeTab === 'generate' ? 'border-b-2 border-blue-500 text-blue-400' : 'text-gray-400'}`}
                    onClick={() => setActiveTab('generate')}
                >
                    Generate CSS
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Input Section */}
                <div className="space-y-4">
                    {activeTab === 'critique' ? (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">CSS Snippet</label>
                                <textarea
                                    className="w-full h-40 bg-gray-800 border border-gray-700 rounded p-2 font-mono text-sm"
                                    value={cssInput}
                                    onChange={(e) => setCssInput(e.target.value)}
                                    placeholder=".button { background: red; }"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">HTML Context (Optional)</label>
                                <textarea
                                    className="w-full h-32 bg-gray-800 border border-gray-700 rounded p-2 font-mono text-sm"
                                    value={htmlInput}
                                    onChange={(e) => setHtmlInput(e.target.value)}
                                    placeholder="<button>Click Me</button>"
                                />
                            </div>
                            <button
                                onClick={handleCritique}
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded disabled:opacity-50"
                            >
                                {loading ? 'Analyzing...' : 'Critique Design'}
                            </button>
                        </>
                    ) : (
                        <>
                            <div>
                                <label className="block text-sm font-medium mb-1">Requirements</label>
                                <textarea
                                    className="w-full h-32 bg-gray-800 border border-gray-700 rounded p-2"
                                    value={requirements}
                                    onChange={(e) => setRequirements(e.target.value)}
                                    placeholder="Make a glassmorphism card with a glowing border..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Existing CSS (Context)</label>
                                <textarea
                                    className="w-full h-40 bg-gray-800 border border-gray-700 rounded p-2 font-mono text-sm"
                                    value={contextCss}
                                    onChange={(e) => setContextCss(e.target.value)}
                                    placeholder="To match existing variables..."
                                />
                            </div>
                            <button
                                onClick={handleGenerate}
                                disabled={loading}
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded disabled:opacity-50"
                            >
                                {loading ? 'Dreaming...' : 'Generate CSS'}
                            </button>
                        </>
                    )}
                </div>

                {/* Output Section */}
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-700 h-full min-h-[500px]">
                    <h3 className="text-sm font-medium text-gray-400 mb-2">
                        {activeTab === 'critique' ? 'Visionary Feedback' : 'Generated Code'}
                    </h3>
                    {result ? (
                        <pre className="whitespace-pre-wrap font-mono text-sm text-gray-300 overflow-auto h-full max-h-[600px]">
                            {result}
                        </pre>
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-600 italic">
                            Output will appear here...
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default DesignStudio;
