(async function () {
    const input = document.getElementById("searchInputPage");
    const resultsEl = document.getElementById("searchResultsPage");
    const metaEl = document.getElementById("searchMetaPage");

    if (!input || !resultsEl) return;

    let index = [];
    try {
        const res = await fetch("index.json", { cache: "no-store" });
        index = await res.json();
    } catch (e) {
        metaEl.textContent = "Search index failed to load.";
        console.error(e);
        return;
    }

    function tokenize(q) {
        return (q || "")
            .toLowerCase()
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 12);
    }

    function scoreItem(item, tokens) {
        // Very simple weighted scoring
        const title = (item.title || "").toLowerCase();
        const tldr = (item.tldr || "").toLowerCase();
        const body = (item.body || "").toLowerCase();

        let score = 0;

        for (const t of tokens) {
            if (!t) continue;

            if (title.includes(t)) score += 6;
            if (tldr.includes(t)) score += 3;
            if (body.includes(t)) score += 1;
        }

        if (item.canonical) score += 2; // boost canon
        return score;
    }

    function render(items, tokens) {
        resultsEl.innerHTML = "";
        metaEl.textContent = tokens.length ? `${items.length} result(s)` : "";

        for (const item of items) {
            const a = document.createElement("a");
            a.className = "post-card search-result-item";
            a.href = item.url.replace('/posts/', '../posts/'); // Fix relative link from search/ subdir if needed, or use absolute
            a.style.display = "block";
            a.style.textDecoration = "none";

            // Use existing card structure but simplified
            a.innerHTML = `
            <div class="post-card-content">
                <div class="post-meta-top">
                    <span class="mode-badge mode-${(item.mode || 'essay').toLowerCase()}">${item.mode || 'Essay'}</span>
                    <span class="post-category-label">${(item.pillar || 'General').replace('-', ' ').toUpperCase()}</span>
                    <span class="post-date">${item.date}</span>
                </div>
                <h3 class="post-title">${item.title}</h3>
                <p class="post-excerpt">${item.tldr || ''}</p>
            </div>
        `;

            resultsEl.appendChild(a);
        }
    }

    function run(q) {
        const tokens = tokenize(q);
        if (!tokens.length) {
            resultsEl.innerHTML = "";
            metaEl.textContent = "";
            return;
        }

        const scored = index
            .map((item) => ({ item, score: scoreItem(item, tokens) }))
            .filter((x) => x.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 30)
            .map((x) => x.item);

        render(scored, tokens);
    }

    // Optional: support ?q=
    const params = new URLSearchParams(location.search);
    const initial = params.get("q");
    if (initial) {
        input.value = initial;
        run(initial);
    }

    input.addEventListener("input", (e) => run(e.target.value));
    input.focus();
})();
