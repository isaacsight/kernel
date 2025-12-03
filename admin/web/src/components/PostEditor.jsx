import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Save, ArrowLeft } from 'lucide-react';

const PostEditor = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const isNew = !slug || slug === 'new';

    const [post, setPost] = useState({
        title: '',
        date: new Date().toISOString().split('T')[0],
        category: '',
        tags: '',
        content: '',
        filename: ''
    });

    const fetchPost = async () => {
        try {
            const res = await axios.get(`http://localhost:8000/posts/${slug}`);
            const data = res.data;
            // Convert tags array to string for editing
            if (Array.isArray(data.tags)) {
                data.tags = data.tags.join(', ');
            }
            setPost(data);
        } catch (err) {
            console.error(err);
            alert("Failed to load post");
        }
    };

    useEffect(() => {
        if (!isNew) {
            fetchPost();
        }
    }, [slug]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setPost(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async () => {
        try {
            // Prepare payload
            const payload = {
                ...post,
                tags: post.tags.split(',').map(t => t.trim()).filter(Boolean)
            };

            const res = await axios.post('http://localhost:8000/posts', payload);
            alert("Post saved!");
            if (isNew && res.data.filename) {
                // Navigate to edit mode of new post (assuming slug is filename without ext)
                // Actually, backend returns filename. We might need to reload or just stay here.
                // For now, go back to list.
                navigate('/content');
            }
        } catch (err) {
            console.error(err);
            alert("Failed to save post");
        }
    };

    const [aiPanelOpen, setAiPanelOpen] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiFeedback, setAiFeedback] = useState(null);

    const handleAiAction = async (action) => {
        setAiLoading(true);
        setAiFeedback(null);
        try {
            if (action === 'critique') {
                const res = await axios.post('http://localhost:8000/agents/audit', {
                    agent_name: 'The Editor',
                    action: 'audit',
                    parameters: { content: post.content }
                });
                setAiFeedback(res.data.issues);
            } else if (action === 'generate') {
                const topic = prompt("Enter a topic for the draft:");
                if (!topic) {
                    setAiLoading(false);
                    return;
                }
                const res = await axios.post('http://localhost:8000/agents/run', {
                    agent_name: 'The Alchemist',
                    action: 'generate',
                    parameters: { topic }
                });
                alert(`Draft generation started! Filename: ${res.data.filename}`);
                // Optionally reload or redirect
            }
        } catch (err) {
            console.error(err);
            alert("AI Action failed: " + (err.response?.data?.detail || err.message));
        } finally {
            setAiLoading(false);
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)]">
            <div className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    <div className="flex justify-between items-center mb-6">
                        <button
                            onClick={() => navigate('/content')}
                            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <ArrowLeft size={20} />
                            Back
                        </button>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setAiPanelOpen(!aiPanelOpen)}
                                className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-lg hover:bg-secondary/80 transition-colors font-medium"
                            >
                                {aiPanelOpen ? 'Close AI Assistant' : 'AI Assistant'}
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:opacity-90 transition-opacity font-medium"
                            >
                                <Save size={18} />
                                Save
                            </button>
                        </div>
                    </div>

                    <div className="space-y-6 bg-card border border-border p-8 rounded-xl shadow-sm">
                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Title</label>
                            <input
                                type="text"
                                name="title"
                                value={post.title}
                                onChange={handleChange}
                                className="w-full bg-background border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-lg font-semibold"
                                placeholder="Enter post title..."
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Date</label>
                                <input
                                    type="date"
                                    name="date"
                                    value={post.date}
                                    onChange={handleChange}
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Category</label>
                                <input
                                    type="text"
                                    name="category"
                                    value={post.category}
                                    onChange={handleChange}
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="Engineering"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-muted-foreground mb-1">Tags</label>
                                <input
                                    type="text"
                                    name="tags"
                                    value={post.tags}
                                    onChange={handleChange}
                                    className="w-full bg-background border border-border rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary outline-none"
                                    placeholder="ai, design, web"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-muted-foreground mb-1">Content (Markdown)</label>
                            <textarea
                                name="content"
                                value={post.content}
                                onChange={handleChange}
                                className="w-full h-[500px] bg-background border border-border rounded-lg px-4 py-4 font-mono text-sm focus:ring-2 focus:ring-primary outline-none resize-none"
                                placeholder="# Write your masterpiece..."
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Assistant Panel */}
            {aiPanelOpen && (
                <div className="w-80 border-l border-border bg-card p-6 overflow-y-auto">
                    <h2 className="text-xl font-bold mb-4">AI Assistant</h2>

                    <div className="space-y-4">
                        <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                            <h3 className="font-semibold mb-2">The Editor</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                Get feedback on style, clarity, and grammar.
                            </p>
                            <button
                                onClick={() => handleAiAction('critique')}
                                disabled={aiLoading}
                                className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50"
                            >
                                {aiLoading ? 'Analyzing...' : 'Critique Content'}
                            </button>
                        </div>

                        <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                            <h3 className="font-semibold mb-2">The Alchemist</h3>
                            <p className="text-sm text-muted-foreground mb-3">
                                Generate a new draft based on a topic.
                            </p>
                            <button
                                onClick={() => handleAiAction('generate')}
                                disabled={aiLoading}
                                className="w-full py-2 px-4 bg-secondary text-secondary-foreground border border-border rounded-lg text-sm font-medium hover:bg-secondary/80 disabled:opacity-50"
                            >
                                Generate Draft
                            </button>
                        </div>

                        {aiFeedback && (
                            <div className="mt-6">
                                <h3 className="font-semibold mb-2">Feedback</h3>
                                <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-background p-3 rounded border border-border">
                                    {typeof aiFeedback === 'string' ? aiFeedback : JSON.stringify(aiFeedback, null, 2)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default PostEditor;
