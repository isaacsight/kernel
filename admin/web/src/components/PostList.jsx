import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Plus, Calendar, Tag } from 'lucide-react';

const PostList = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        try {
            const res = await axios.get('http://localhost:8000/posts');
            setPosts(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="p-8">Loading content...</div>;

    return (
        <div className="p-8">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold">Content Studio</h1>
                <Link
                    to="/content/new"
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
                >
                    <Plus size={18} />
                    New Post
                </Link>
            </div>

            <div className="space-y-4">
                {posts.map((post) => (
                    <Link
                        key={post.slug}
                        to={`/content/${post.slug}`}
                        className="block p-6 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-accent transition-all group"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-semibold mb-2 group-hover:text-primary transition-colors">
                                    {post.title}
                                </h3>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={14} />
                                        {post.date}
                                    </span>
                                    {post.category && (
                                        <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground text-xs">
                                            {post.category}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {post.tags && post.tags.map(tag => (
                                    <span key={tag} className="text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
                                        #{tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default PostList;
