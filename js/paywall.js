/**
 * Premium Essay Paywall JavaScript
 * Handles payment checkout and access validation
 */

(function () {
    const API_BASE = window.location.hostname === 'localhost'
        ? 'http://localhost:8000'
        : 'https://doesthisfeelright.com';

    // Check if user has access on page load
    document.addEventListener('DOMContentLoaded', async () => {
        const premiumContent = document.querySelector('.premium-content');
        const paywall = document.querySelector('.premium-paywall');

        if (!premiumContent || !paywall) return;

        // Check URL params for successful payment
        const urlParams = new URLSearchParams(window.location.search);
        const sessionId = urlParams.get('session_id');
        const success = urlParams.get('success');

        if (sessionId && success === 'true') {
            await verifyAndUnlock(sessionId);
            return;
        }

        // Check if user has existing access
        const email = localStorage.getItem('premium_email');
        if (email) {
            await checkAccess(email);
        }

        // Set up unlock buttons
        setupPaywallButtons();
    });

    async function verifyAndUnlock(sessionId) {
        try {
            const response = await fetch(`${API_BASE}/api/premium/verify/${sessionId}`);
            const data = await response.json();

            if (data.access_granted) {
                // Store email for future visits
                localStorage.setItem('premium_email', data.email);

                // Unlock content
                unlockContent();

                // Show success message
                showSuccessMessage('Payment successful! Enjoy your premium essay.');
            }
        } catch (error) {
            console.error('Verification failed:', error);
            showErrorMessage('Unable to verify payment. Please contact support.');
        }
    }

    async function checkAccess(email) {
        const essaySlug = getEssaySlug();

        try {
            const response = await fetch(`${API_BASE}/api/premium/access/${essaySlug}?email=${encodeURIComponent(email)}`);
            const data = await response.json();

            if (data.has_access) {
                unlockContent();
            }
        } catch (error) {
            console.error('Access check failed:', error);
        }
    }

    function setupPaywallButtons() {
        // Essay unlock buttons
        const unlockButtons = document.querySelectorAll('.unlock-essay');
        unlockButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                const slug = btn.dataset.essaySlug;
                const tier = btn.dataset.tier;
                await createEssayCheckout(slug, tier);
            });
        });

        // Subscription buttons
        const subscribeButtons = document.querySelectorAll('.subscribe-btn');
        subscribeButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                await createSubscriptionCheckout();
            });
        });
    }

    async function createEssayCheckout(slug, tier) {
        const title = document.querySelector('h1')?.textContent || 'Premium Essay';
        const email = localStorage.getItem('premium_email') || '';

        try {
            const response = await fetch(`${API_BASE}/api/premium/checkout/essay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    essay_slug: slug,
                    essay_tier: tier,
                    essay_title: title,
                    customer_email: email || undefined
                })
            });

            const data = await response.json();

            if (data.url) {
                // Redirect to Stripe Checkout
                window.location.href = data.url;
            }
        } catch (error) {
            console.error('Checkout failed:', error);
            showErrorMessage('Unable to process payment. Please try again.');
        }
    }

    async function createSubscriptionCheckout() {
        const email = localStorage.getItem('premium_email') || '';

        try {
            const response = await fetch(`${API_BASE}/api/premium/checkout/subscription`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    customer_email: email || undefined
                })
            });

            const data = await response.json();

            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error) {
            console.error('Subscription checkout failed:', error);
            showErrorMessage('Unable to process subscription. Please try again.');
        }
    }

    function unlockContent() {
        const premiumContent = document.querySelector('.premium-content');
        const paywall = document.querySelector('.premium-paywall');

        if (premiumContent && paywall) {
            paywall.style.display = 'none';
            premiumContent.style.display = 'block';

            // Scroll to where paywall was
            paywall.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function getEssaySlug() {
        // Extract slug from URL
        const path = window.location.pathname;
        const match = path.match(/\/posts\/(.+)\.html/);
        return match ? match[1] : '';
    }

    function showSuccessMessage(message) {
        const notification = createNotification(message, 'success');
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    function showErrorMessage(message) {
        const notification = createNotification(message, 'error');
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    function createNotification(message, type) {
        const div = document.createElement('div');
        div.className = `paywall-notification ${type}`;
        div.textContent = message;
        div.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'success' ? '#22c55e' : '#ef4444'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;
        return div;
    }

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
    `;
    document.head.appendChild(style);
})();
