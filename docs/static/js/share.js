/**
 * Share functionality and Related Posts
 */

// Share buttons
document.addEventListener('DOMContentLoaded', () => {
    const shareButtons = document.querySelectorAll('.share-btn');

    shareButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const slug = btn.dataset.slug;
            const title = btn.dataset.title;
            const url = `${window.location.origin}/posts/${slug}.html`;

            if (btn.classList.contains('twitter')) {
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`;
                window.open(twitterUrl, '_blank');
            } else if (btn.classList.contains('linkedin')) {
                const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
                window.open(linkedinUrl, '_blank');
            } else if (btn.classList.contains('copy')) {
                try {
                    await navigator.clipboard.writeText(url);
                    const originalText = btn.innerHTML;
                    btn.innerHTML = '<svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg> Copied!';
                    btn.style.backgroundColor = '#2e7d32';
                    btn.style.color = 'white';
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                        btn.style.backgroundColor = '';
                        btn.style.color = '';
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy:', err);
                }
            }
        });
    });
});

// Related Posts
const RelatedPosts = {
    init: async () => {
        const container = document.getElementById('related-posts');
        if (!container) return;

        // Get current post info from page
        const currentSlug = document.querySelector('.save-btn')?.dataset.slug;
        const currentCategory = document.querySelector('.save-btn')?.dataset.category;

        if (!currentSlug || !currentCategory) return;

        // Fetch all posts from homepage (hacky but works for static site)
        const response = await fetch('/index.html');
        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Extract post data from homepage
        const postCards = Array.from(doc.querySelectorAll('.post-card'));
        const posts = postCards.map(card => {
            const href = card.getAttribute('href');
            const slug = href?.replace('posts/', '').replace('.html', '');
            const category = card.querySelector('.post-meta')?.textContent;
            const title = card.querySelector('h2')?.textContent;
            return { slug, category, title, href };
        }).filter(p => p.slug && p.slug !== currentSlug);

        // Find related posts (same category)
        const relatedPosts = posts.filter(p => p.category === currentCategory).slice(0, 3);

        if (relatedPosts.length === 0) return;

        // Render
        let htmlContent = '<h3>Related Essays</h3><div class="related-grid">';
        relatedPosts.forEach(post => {
            htmlContent += `
                <a href="/${post.href}" class="related-card">
                    <span class="post-meta">${post.category}</span>
                    <h4>${post.title}</h4>
                </a>
            `;
        });
        htmlContent += '</div>';
        container.innerHTML = htmlContent;
    }
};

// Initialize on post pages
if (document.getElementById('related-posts')) {
    RelatedPosts.init();
}
