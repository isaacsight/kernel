import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { PlusCircle } from 'lucide-react';

const PostList = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        try {
            const apiBase = `http://${window.location.hostname}:8000`;
            const res = await axios.get(`${apiBase}/posts`);
            setPosts(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8">Loading content...</div>;

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <header className="mb-10 flex justify-between items-center">
                <div>
                    <h1 className="text-4xl font-bold mb-2 tracking-tighter">Content Studio</h1>
                    <p className="text-muted-foreground text-base">Manage your blog posts.</p>
                </div>
                <Link to="/content/new">
                    <button className="px-5 py-2.5 bg-accent text-accent-foreground rounded-lg hover:bg-accent/90 transition-all duration-200 flex items-center gap-2 font-semibold text-sm shadow-sm hover:scale-[1.02] active:scale-[0.98]">
                        <PlusCircle size={18} />
                        New Post
                    </button>
                </Link>
            </header>

            <div className="grid gap-4">
                {posts.map(post => (
                    <Link key={post.slug} to={`/content/${post.slug}`} className="block p-6 rounded-xl border border-border bg-card/50 hover:border-accent/50 transition-all duration-300 group hover:-translate-y-0.5 shadow-sm hover:shadow-lg">
                        <h2 className="text-xl font-semibold mb-2 group-hover:text-accent transition-colors tracking-tight">{post.title}</h2>
                        <div className="text-sm text-muted-foreground mb-3">
                            <span className="font-mono">{post.date}</span> • <span className="capitalize">{post.collection}</span>
                        </div>
                        <p className="text-muted-foreground line-clamp-2 text-sm">{post.excerpt || 'No excerpt available.'}</p>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default PostList;
