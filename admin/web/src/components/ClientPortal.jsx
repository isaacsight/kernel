import React from 'react';
import ClientChatWidget from './ClientChatWidget';

const ClientPortal = () => {
    return (
        <div className="min-h-screen bg-stone-950 text-stone-200 p-8 flex flex-col items-center">
            <header className="w-full max-w-4xl flex justify-between items-center mb-12">
                <h1 className="text-3xl font-bold tracking-tighter text-orange-600">CLIENT<span className="text-white">PORTAL</span></h1>
                <nav className="flex gap-6 text-sm font-medium text-stone-400">
                    <a href="#" className="hover:text-white transition-colors">Services</a>
                    <a href="#" className="hover:text-white transition-colors">Pricing</a>
                    <a href="#" className="hover:text-white transition-colors">Contact</a>
                </nav>
            </header>

            <main className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-8">
                    <div>
                        <h2 className="text-4xl font-bold mb-4">Let's create something <span className="text-orange-500">amazing</span>.</h2>
                        <p className="text-stone-400 text-lg leading-relaxed">
                            Welcome to the client portal. Here you can chat with our AI assistant to get instant quotes, learn about our services, and inquire about availability.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-stone-900 p-6 rounded-xl border border-stone-800">
                            <h3 className="font-semibold mb-2">Video Editing</h3>
                            <p className="text-sm text-stone-500">Professional cuts, color grading, and sound design.</p>
                        </div>
                        <div className="bg-stone-900 p-6 rounded-xl border border-stone-800">
                            <h3 className="font-semibold mb-2">Motion Graphics</h3>
                            <p className="text-sm text-stone-500">2D/3D animation, titles, and visual effects.</p>
                        </div>
                    </div>
                </div>

                <div className="flex justify-center md:justify-end">
                    <ClientChatWidget />
                </div>
            </main>
        </div>
    );
};

export default ClientPortal;
