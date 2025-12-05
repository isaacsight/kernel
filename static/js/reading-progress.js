/**
 * Reading Progress Tracker
 */

const ReadingProgress = {
    progressBar: null,

    // Create and inject the progress bar element
    createProgressBar: () => {
        const bar = document.createElement('div');
        bar.className = 'reading-progress';
        bar.setAttribute('role', 'progressbar');
        bar.setAttribute('aria-valuemin', '0');
        bar.setAttribute('aria-valuemax', '100');
        bar.setAttribute('aria-valuenow', '0');
        document.body.prepend(bar);
        ReadingProgress.progressBar = bar;
    },

    // Update progress bar width based on scroll position
    updateProgress: () => {
        if (!ReadingProgress.progressBar) return;

        const article = document.querySelector('article') || document.querySelector('main');
        if (!article) return;

        const articleRect = article.getBoundingClientRect();
        const articleTop = articleRect.top + window.scrollY;
        const articleHeight = article.offsetHeight;
        const windowHeight = window.innerHeight;
        const scrollY = window.scrollY;

        // Calculate progress: start when article comes into view, end when bottom reaches viewport
        const scrollableDistance = articleHeight - windowHeight + articleTop;
        const progress = Math.min(100, Math.max(0, ((scrollY - articleTop + windowHeight) / scrollableDistance) * 100));

        ReadingProgress.progressBar.style.width = `${progress}%`;
        ReadingProgress.progressBar.setAttribute('aria-valuenow', Math.round(progress));
    },

    // Mark a post as read
    markAsRead: async (slug) => {
        if (typeof Auth === 'undefined') return;
        const user = await Auth.getUser();
        if (!user) return;

        if (typeof supabaseClient === 'undefined') return;
        const { error } = await supabaseClient
            .from('reading_history')
            .upsert({
                user_id: user.id,
                post_slug: slug,
                last_read_at: new Date().toISOString()
            }, {
                onConflict: 'user_id,post_slug'
            });

        if (error) console.error('Error marking as read:', error);
    },

    // Check if a post was read
    isRead: async (slug) => {
        if (typeof Auth === 'undefined') return false;
        const user = await Auth.getUser();
        if (!user) return false;

        if (typeof supabaseClient === 'undefined') return false;
        const { data } = await supabaseClient
            .from('reading_history')
            .select('id')
            .eq('user_id', user.id)
            .eq('post_slug', slug)
            .single();

        return !!data;
    },

    // Get all read posts
    getReadPosts: async () => {
        if (typeof Auth === 'undefined') return [];
        const user = await Auth.getUser();
        if (!user) return [];

        if (typeof supabaseClient === 'undefined') return [];
        const { data } = await supabaseClient
            .from('reading_history')
            .select('post_slug, last_read_at')
            .eq('user_id', user.id);

        return data || [];
    },

    // Initialize tracking on post pages
    initPostTracking: () => {
        // Only track on post pages (not index, about, login, library)
        const path = window.location.pathname;
        if (!path.includes('/posts/')) return;

        // Extract slug from URL
        const slug = path.split('/posts/')[1]?.replace('.html', '');
        if (!slug) return;

        // Mark as read after 5 seconds of being on the page
        setTimeout(async () => {
            await ReadingProgress.markAsRead(slug);
        }, 5000);
    },

    // Initialize the visual progress bar
    initProgressBar: () => {
        // Only show progress bar on article/post pages
        const path = window.location.pathname;
        const isArticlePage = path.includes('/posts/') || document.querySelector('article');

        if (!isArticlePage) return;

        ReadingProgress.createProgressBar();

        // Throttled scroll handler for performance
        let ticking = false;
        window.addEventListener('scroll', () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    ReadingProgress.updateProgress();
                    ticking = false;
                });
                ticking = true;
            }
        }, { passive: true });

        // Initial update
        ReadingProgress.updateProgress();
    }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    ReadingProgress.initPostTracking();
    ReadingProgress.initProgressBar();
});
