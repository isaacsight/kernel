import React, { useState } from 'react';
import axios from 'axios';
import { Upload, Link as LinkIcon, Send, CheckCircle, Loader } from 'lucide-react';

const Consulting = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: '',
        links: '',
    });
    const [files, setFiles] = useState([]);
    const [status, setStatus] = useState('idle'); // idle, submitting, success, error

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        const newFiles = Array.from(e.target.files);
        setFiles((prev) => [...prev, ...newFiles]);
    };

    const removeFile = (index) => {
        setFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setStatus('submitting');

        const data = new FormData();
        data.append('name', formData.name);
        data.append('email', formData.email);
        data.append('message', formData.message);
        data.append('links', formData.links);

        files.forEach((file) => {
            data.append('images', file);
        });

        try {
            const apiBase = `http://${window.location.hostname}:8000`;
            await axios.post(`${apiBase}/api/consulting/submit`, data, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            setStatus('success');
            setFormData({ name: '', email: '', message: '', links: '' });
            setFiles([]);
        } catch (error) {
            console.error('Error submitting inquiry:', error);
            setStatus('error');
        }
    };

    return (
        <div className="min-h-screen bg-stone-950 text-stone-200 p-8 flex flex-col items-center">
            <div className="w-full max-w-2xl animate-fade-in-up">
                <header className="mb-12 text-center">
                    <h1 className="text-4xl font-bold tracking-tighter text-white mb-2">Work with <span className="text-orange-600">Me</span>.</h1>
                    <p className="text-stone-400">Tell me about your project. Let's build something exceptional.</p>
                </header>

                {status === 'success' ? (
                    <div className="bg-stone-900 border border-green-900/50 rounded-xl p-12 text-center flex flex-col items-center animate-fade-in">
                        <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-2">Inquiry Received</h2>
                        <p className="text-stone-400 mb-6">I've got your details. I'll review them and get back to you shortly.</p>
                        <button
                            onClick={() => setStatus('idle')}
                            className="text-orange-500 hover:text-orange-400 font-medium transition-colors"
                        >
                            Send another message
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-stone-500">Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full bg-stone-900 border border-stone-800 rounded-lg p-3 text-white focus:outline-none focus:border-orange-600 transition-colors"
                                    placeholder="Jane Doe"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-stone-500">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full bg-stone-900 border border-stone-800 rounded-lg p-3 text-white focus:outline-none focus:border-orange-600 transition-colors"
                                    placeholder="jane@example.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-stone-500">Project Details</label>
                            <textarea
                                name="message"
                                required
                                value={formData.message}
                                onChange={handleChange}
                                rows={6}
                                className="w-full bg-stone-900 border border-stone-800 rounded-lg p-3 text-white focus:outline-none focus:border-orange-600 transition-colors resize-none"
                                placeholder="Describe your vision, requirements, and timeline..."
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-stone-500 flex items-center gap-2">
                                <LinkIcon className="w-4 h-4" /> Relevant Links
                            </label>
                            <input
                                type="text"
                                name="links"
                                value={formData.links}
                                onChange={handleChange}
                                className="w-full bg-stone-900 border border-stone-800 rounded-lg p-3 text-white focus:outline-none focus:border-orange-600 transition-colors"
                                placeholder="https://example.com, https://github.com/..."
                            />
                            <p className="text-xs text-stone-600">Comma separated URLs</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-stone-500 flex items-center gap-2">
                                <Upload className="w-4 h-4" /> Attachments
                            </label>
                            <div className="relative">
                                <input
                                    type="file"
                                    multiple
                                    onChange={handleFileChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="w-full bg-stone-900 border border-dashed border-stone-800 rounded-lg p-8 flex flex-col items-center justify-center hover:border-stone-600 transition-colors">
                                    <span className="text-stone-400 text-sm">Drop files here or click to upload</span>
                                </div>
                            </div>

                            {files.length > 0 && (
                                <div className="space-y-2 mt-4">
                                    {files.map((file, index) => (
                                        <div key={index} className="flex items-center justify-between bg-stone-900/50 p-2 rounded px-3">
                                            <span className="text-xs text-stone-300 truncate">{file.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => removeFile(index)}
                                                className="text-stone-500 hover:text-red-500 transition-colors"
                                            >
                                                &times;
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {status === 'error' && (
                            <div className="text-red-500 text-sm text-center">
                                Something went wrong. Please try again.
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'submitting'}
                            className="w-full bg-white text-black font-bold py-4 rounded-lg hover:bg-stone-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {status === 'submitting' ? (
                                <>
                                    <Loader className="w-5 h-5 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    Submit Inquiry
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Consulting;
