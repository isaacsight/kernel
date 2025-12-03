/**
 * E-Book Store JavaScript
 * Handles book purchases via Stripe
 */

(function () {
    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:8000'
        : 'https://doesthisfeelright.com';

    document.addEventListener('DOMContentLoaded', () => {
        setupBuyButtons();
        checkPurchaseStatus();
    });

    function setupBuyButtons() {
        const buyButtons = document.querySelectorAll('.book-buy-btn');

        buyButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const bookId = btn.dataset.bookId;
                const price = parseInt(btn.dataset.price);
                await purchaseBook(bookId, price);
            });
        });
    }

    async function purchaseBook(bookId, price) {
        try {
            // Show loading state
            const btn = document.querySelector(`[data-book-id="${bookId}"]`);
            const originalText = btn.textContent;
            btn.textContent = 'Processing...';
            btn.disabled = true;

            const response = await fetch(`${API_BASE}/api/books/checkout`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    book_id: bookId,
                    price: price * 100 // Convert to cents
                })
            });

            const data = await response.json();

            if (data.url) {
                // Redirect to Stripe Checkout
                window.location.href = data.url;
            } else {
                throw new Error('No checkout URL received');
            }

        } catch (error) {
            console.error('Purchase failed:', error);
            alert('Unable to process purchase. Please try again or contact support.');

            // Reset button
            const btn = document.querySelector(`[data-book-id="${bookId}"]`);
            btn.textContent = 'Buy Now';
            btn.disabled = false;
        }
    }

    function checkPurchaseStatus() {
        const urlParams = new URLSearchParams(window.location.search);
        const success = urlParams.get('success');
        const sessionId = urlParams.get('session_id');

        if (success === 'true' && sessionId) {
            showSuccessMessage();
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }

    function showSuccessMessage() {
        const message = document.createElement('div');
        message.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #22c55e;
            color: white;
            padding: 1.5rem 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            font-weight:600;
            max-width: 90%;
            text-align: center;
        `;
        message.innerHTML = `
            <div>✓ Purchase successful!</div>
            <div style="margin-top: 0.5rem; font-size: 0.9rem; opacity: 0.9;">
                Check your email for the download link
            </div>
        `;

        document.body.appendChild(message);

        setTimeout(() => {
            message.style.transition = 'opacity 0.3s';
            message.style.opacity = '0';
            setTimeout(() => message.remove(), 300);
        }, 5000);
    }
})();
