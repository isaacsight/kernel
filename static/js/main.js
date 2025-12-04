document.addEventListener('DOMContentLoaded', () => {
    // Newsletter Form Handling (Removed)

    // Post Filtering Logic
    const filterBtns = document.querySelectorAll('.filter-btn');
    const posts = document.querySelectorAll('.post-card');

    if (filterBtns.length > 0) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // 1. Update Active State
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // 2. Filter Posts
                const filterValue = btn.getAttribute('data-filter');

                posts.forEach(post => {
                    if (filterValue === 'all' || post.getAttribute('data-category') === filterValue) {
                        post.style.display = 'block';
                    } else {
                        post.style.display = 'none';
                    }
                });
            });
        });
    }

    // Post Sorting Logic
    const sortBtns = document.querySelectorAll('.sort-btn');
    const postsContainer = document.querySelector('.posts-container');

    if (sortBtns.length > 0 && postsContainer) {
        sortBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();

                // Update active state
                sortBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const sortType = btn.getAttribute('data-sort');
                const postsArray = Array.from(posts);

                postsArray.sort((a, b) => {
                    if (sortType === 'date-desc') {
                        const dateA = a.getAttribute('data-date') || '';
                        const dateB = b.getAttribute('data-date') || '';
                        return dateB.localeCompare(dateA); // Newest first
                    } else if (sortType === 'date-asc') {
                        const dateA = a.getAttribute('data-date') || '';
                        const dateB = b.getAttribute('data-date') || '';
                        return dateA.localeCompare(dateB); // Oldest first
                    } else if (sortType === 'title') {
                        const titleA = a.querySelector('h2').textContent;
                        const titleB = b.querySelector('h2').textContent;
                        return titleA.localeCompare(titleB);
                    }
                    return 0;
                });

                // Re-append in sorted order
                postsArray.forEach(post => postsContainer.appendChild(post));
            });
        });
    }

    // Mobile Menu Toggle
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const mobileNavOverlay = document.querySelector('.mobile-nav-overlay');

    if (mobileBtn && mobileNavOverlay) {
        mobileBtn.addEventListener('click', () => {
            mobileNavOverlay.classList.toggle('active');

            // Toggle icon between hamburger and X
            const isOpen = mobileNavOverlay.classList.contains('active');
            if (isOpen) {
                mobileBtn.innerHTML = '<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            } else {
                mobileBtn.innerHTML = '<svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>';
            }
        });
    }

    // Support Button Logic (Scroll to bottom or open modal)
    const supportBtn = document.querySelector('.support-trigger');
    if (supportBtn) {
        supportBtn.addEventListener('click', () => {
            // For now, just scroll to footer or support section if it exists
            const supportSection = document.querySelector('.support-section');
            if (supportSection) {
                supportSection.scrollIntoView({ behavior: 'smooth' });
            } else {
                window.open('https://www.buymeacoffee.com/doesthisfeelright', '_blank');
            }
        });
    }

    // Welcome Gate Logic (Removed)

    // Reaction Button Logic
    const reactionBtn = document.getElementById('reaction-btn');
    const reactionCount = document.getElementById('reaction-count');

    if (reactionBtn && reactionCount) {
        // Get slug from URL (e.g., /posts/slug.html -> slug)
        const path = window.location.pathname;
        const slug = path.split('/').pop().replace('.html', '');

        // Check local storage
        const hasReacted = localStorage.getItem(`reacted_${slug}`);
        if (hasReacted) {
            reactionBtn.classList.add('reacted');
        }

        // Fetch current count
        async function fetchCount() {
            if (!window.supabaseClient) {
                console.warn('Supabase client not initialized. Reactions disabled.');
                return;
            }
            try {
                const { data, error } = await window.supabaseClient
                    .from('reactions')
                    .select('count')
                    .eq('slug', slug)
                    .single();

                if (data) {
                    reactionCount.textContent = data.count;
                }
            } catch (err) {
                console.error('Error fetching reactions:', err);
            }
        }

        fetchCount();

        // Handle click
        reactionBtn.addEventListener('click', async () => {
            if (reactionBtn.classList.contains('reacted')) return; // Prevent double click

            // Optimistic update
            const currentCount = parseInt(reactionCount.textContent) || 0;
            reactionCount.textContent = currentCount + 1;
            reactionBtn.classList.add('reacted');
            localStorage.setItem(`reacted_${slug}`, 'true');

            try {
                // Call RPC function to increment
                const { error } = await window.supabaseClient.rpc('increment_reaction', { post_slug: slug });

                if (error) throw error;
            } catch (err) {
                console.error('Error incrementing reaction:', err);
                // Revert on error? Nah, let them have the UI win.
            }
        });
    }

    // Privacy-First Analytics (Page Views)
    // We only track the slug, no user data.
    const path = window.location.pathname;
    // Only track actual pages, not assets or empty paths
    if (path && (!path.includes('.') || path.endsWith('.html'))) {
        const pageSlug = path === '/' || path === '/index.html' ? 'home' : path.split('/').pop().replace('.html', '');

        // Simple session check to avoid double-counting reload (optional, but good for accuracy)
        const sessionKey = `viewed_${pageSlug}`;
        if (!sessionStorage.getItem(sessionKey)) {
            sessionStorage.setItem(sessionKey, 'true');

            // Fire and forget
            window.supabaseClient.rpc('increment_page_view', { page_slug: pageSlug })
                .then(({ error }) => {
                    if (error) console.error('Error tracking view:', error);
                });
        }
    }
});
