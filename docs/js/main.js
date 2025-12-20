document.addEventListener('DOMContentLoaded', () => {
    // === SCROLL REVEAL ANIMATIONS ===
    // Elements will fade in as they enter the viewport
    const initScrollReveal = () => {
        const revealElements = document.querySelectorAll(
            '.post-card, article h2, article h3, .card-grid > *, .hero h1, .hero-subtitle, .investigation-block, .read-next-card'
        );

        if ('IntersectionObserver' in window) {
            const revealObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('reveal', 'visible');
                        // Optionally stop observing after reveal
                        revealObserver.unobserve(entry.target);
                    }
                });
            }, {
                threshold: 0.1,
                rootMargin: '0px 0px -50px 0px' // Trigger slightly before fully in view
            });

            revealElements.forEach(el => {
                el.classList.add('reveal');
                revealObserver.observe(el);
            });
        } else {
            // Fallback: just show everything
            revealElements.forEach(el => el.classList.add('visible'));
        }
    };

    // Run after a small delay to let page paint first
    requestAnimationFrame(() => {
        requestAnimationFrame(initScrollReveal);
    });

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

    // === PAGINATION SYSTEM ===
    const POSTS_PER_PAGE = 20;
    let currentPage = 1;
    let filteredPosts = Array.from(posts);

    function setupPagination() {
        if (!postsContainer || posts.length <= POSTS_PER_PAGE) return;

        // Create pagination controls if they don't exist
        let paginationEl = document.querySelector('.pagination');
        if (!paginationEl) {
            paginationEl = document.createElement('div');
            paginationEl.className = 'pagination';
            postsContainer.after(paginationEl);
        }

        updatePagination();
    }

    function updatePagination() {
        const paginationEl = document.querySelector('.pagination');
        if (!paginationEl) return;

        const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);

        if (totalPages <= 1) {
            paginationEl.style.display = 'none';
            return;
        }

        paginationEl.style.display = 'flex';

        let html = '';

        // Previous button
        html += `<button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>← Prev</button>`;

        // Page numbers (show first, current area, and last)
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }
        } else {
            // Always show first page
            html += `<button class="page-btn ${currentPage === 1 ? 'active' : ''}" data-page="1">1</button>`;

            if (currentPage > 3) {
                html += '<span class="page-dots">...</span>';
            }

            // Show pages around current
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
            }

            if (currentPage < totalPages - 2) {
                html += '<span class="page-dots">...</span>';
            }

            // Always show last page
            html += `<button class="page-btn ${currentPage === totalPages ? 'active' : ''}" data-page="${totalPages}">${totalPages}</button>`;
        }

        // Next button
        html += `<button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" data-page="${currentPage + 1}" ${currentPage === totalPages ? 'disabled' : ''}>Next →</button>`;

        // Post count info
        const start = (currentPage - 1) * POSTS_PER_PAGE + 1;
        const end = Math.min(currentPage * POSTS_PER_PAGE, filteredPosts.length);
        html += `<span class="page-info">Showing ${start}-${end} of ${filteredPosts.length} essays</span>`;

        paginationEl.innerHTML = html;

        // Add click handlers
        paginationEl.querySelectorAll('.page-btn:not(.disabled)').forEach(btn => {
            btn.addEventListener('click', () => {
                currentPage = parseInt(btn.dataset.page);
                showCurrentPage();
                updatePagination();
                // Scroll to top of posts
                postsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });
    }

    function showCurrentPage() {
        const start = (currentPage - 1) * POSTS_PER_PAGE;
        const end = start + POSTS_PER_PAGE;

        // Hide all posts first
        posts.forEach(post => post.style.display = 'none');

        // Show only current page's posts from filtered list
        filteredPosts.slice(start, end).forEach(post => {
            post.style.display = 'block';
        });
    }

    // Initialize pagination
    if (postsContainer && posts.length > POSTS_PER_PAGE) {
        setupPagination();
        showCurrentPage();
    }

    // === UPDATE FILTER TO WORK WITH PAGINATION ===
    if (filterBtns.length > 0) {
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const filterValue = btn.getAttribute('data-filter');

                // Update filtered posts list
                if (filterValue === 'all') {
                    filteredPosts = Array.from(posts);
                } else {
                    filteredPosts = Array.from(posts).filter(post =>
                        post.getAttribute('data-category') === filterValue
                    );
                }

                // Reset to page 1 and update display
                currentPage = 1;
                showCurrentPage();
                updatePagination();
            });
        });
    }

    if (sortBtns.length > 0 && postsContainer) {
        sortBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();

                // Update active state
                sortBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const sortType = btn.getAttribute('data-sort');

                filteredPosts.sort((a, b) => {
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

                // Reset to page 1 and update display
                currentPage = 1;
                showCurrentPage();
                updatePagination();
            });
        });
    }

    // === DRAWER / MENU TOGGLE LOGIC ===
    const menuBtns = document.querySelectorAll('.mobile-menu-trigger');
    const drawerOverlay = document.getElementById('drawer-backdrop');
    const drawer = document.getElementById('mobile-drawer');
    const drawerClose = document.getElementById('close-drawer');
    const drawerLinks = document.querySelectorAll('.drawer-nav a');

    function openDrawer() {
        if (drawer && drawerOverlay) {
            drawerOverlay.classList.add('active');
            drawer.classList.add('active');
            document.body.style.overflow = 'hidden'; // Lock scroll
            menuBtns.forEach(btn => btn.setAttribute('aria-expanded', 'true'));
        }
    }

    function closeDrawer() {
        if (drawer && drawerOverlay) {
            drawerOverlay.classList.remove('active');
            drawer.classList.remove('active');
            document.body.style.overflow = ''; // Unlock scroll
            menuBtns.forEach(btn => btn.setAttribute('aria-expanded', 'false'));
        }
    }

    if (menuBtns.length > 0) {
        menuBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const isOpen = drawer.classList.contains('active');
                if (isOpen) {
                    closeDrawer();
                } else {
                    openDrawer();
                }
            });
        });
    }

    if (drawerClose) {
        drawerClose.addEventListener('click', closeDrawer);
    }

    if (drawerOverlay) {
        drawerOverlay.addEventListener('click', closeDrawer);
    }

    // Close drawer when clicking a link
    drawerLinks.forEach(link => {
        link.addEventListener('click', closeDrawer);
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && drawer && drawer.classList.contains('active')) {
            closeDrawer();
        }
    });

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
    // === GENERIC FEED SEARCH (Experiments, Collections) ===
    const feedSearchInput = document.getElementById('feed-search-input');
    if (feedSearchInput) {
        feedSearchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();

            // Define targets to filter
            const targets = document.querySelectorAll('.experiment-card, .collection-card, .post-card');
            const targetSmall = document.querySelectorAll('.experiment-card-small'); // Sidebar items if needed? No, usually main feed.

            targets.forEach(card => {
                // Find text content
                const title = card.querySelector('h3, h2, .post-title')?.textContent.toLowerCase() || '';
                const desc = card.querySelector('p, .post-excerpt')?.textContent.toLowerCase() || '';

                if (title.includes(query) || desc.includes(query)) {
                    // Reset to default CSS value (usually block, flex, or grid item)
                    card.style.display = '';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }

    // === BACK TO TOP BUTTON ===
    const backToTopBtn = document.getElementById('back-to-top');

    if (backToTopBtn) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('visible');
            } else {
                backToTopBtn.classList.remove('visible');
            }
        }, { passive: true });

        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    }

});
