/**
 * Search functionality using Lunr.js
 */

const Search = {
    index: null,
    store: {},

    init: async () => {
        const searchOverlay = document.getElementById('search-overlay');
        const searchInput = document.getElementById('search-input');
        const searchResults = document.getElementById('search-results');
        const searchToggles = document.querySelectorAll('.search-trigger');
        const closeSearch = document.getElementById('close-search');

        if (!searchOverlay || !searchInput) return;

        // Fetch Index
        try {
            const response = await fetch('/search.json');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();

            // Initialize Lunr
            Search.index = lunr(function () {
                this.field('title', { boost: 10 });
                this.field('tags', { boost: 5 });
                this.field('excerpt');
                this.field('category');
                this.ref('slug');

                data.forEach(doc => {
                    this.add(doc);
                    Search.store[doc.slug] = doc;
                });
            });

        } catch (e) {
            console.error('Failed to load search index', e);
        }

        // Event Listeners
        if (searchToggles.length > 0) {
            searchToggles.forEach(toggle => {
                toggle.addEventListener('click', (e) => {
                    e.preventDefault();
                    searchOverlay.style.display = 'flex';
                    searchInput.focus();
                    document.body.style.overflow = 'hidden'; // Prevent scrolling
                });
            });
        }

        closeSearch.addEventListener('click', () => {
            searchOverlay.style.display = 'none';
            document.body.style.overflow = '';
            searchInput.value = '';
            searchResults.innerHTML = '';
        });

        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && searchOverlay.style.display === 'flex') {
                closeSearch.click();
            }
        });

        // Handle Input
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value;
            if (query.length < 2) {
                searchResults.innerHTML = '';
                return;
            }

            // Smart routing: Detect if query is conversational vs keyword search
            const isConversational = /^(what|how|why|when|where|who|can|should|tell me|explain|describe)/i.test(query) ||
                query.includes('?') ||
                query.split(' ').length > 5;

            if (isConversational && window.dtfrCopilot) {
                // Close search overlay and open Copilot
                searchOverlay.style.display = 'none';
                document.body.style.overflow = '';
                window.dtfrCopilot.openWithQuery(query);
                searchInput.value = '';
                searchResults.innerHTML = '';
                return;
            }

            if (!Search.index) {
                return;
            }

            const results = Search.index.search(query);
            Search.renderResults(results, searchResults);
        });
    },

    renderResults: (results, container) => {
        if (results.length === 0) {
            container.innerHTML = '<div class="no-results">No results found.</div>';
            return;
        }

        const html = results.map(result => {
            const doc = Search.store[result.ref];
            return `
                <a href="/posts/${doc.slug}.html" class="search-result-item">
                    <h3>${doc.title}</h3>
                    <p>${doc.excerpt}</p>
                    <span class="meta">${doc.date} • ${doc.category}</span>
                </a>
            `;
        }).join('');

        container.innerHTML = html;
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Check if lunr is loaded
    if (typeof lunr !== 'undefined') {
        Search.init();
    } else {
        // Wait for script to load if async
        window.addEventListener('load', Search.init);
    }
});
