document.addEventListener('DOMContentLoaded', () => {
    const forms = document.querySelectorAll('.newsletter-form');

    forms.forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const container = form.closest('.newsletter-box');
            const successMsg = container.querySelector('.success-message');
            const input = form.querySelector('.newsletter-input');
            const button = form.querySelector('.newsletter-btn');

            // Simulate API call
            button.textContent = 'Subscribing...';
            button.disabled = true;
            input.disabled = true;

            setTimeout(() => {
                form.style.display = 'none';
                successMsg.style.display = 'block';

                // Optional: Save to local storage
                localStorage.setItem('subscribed', 'true');
            }, 800);
        });
    });
    // Mobile Menu Logic
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const mobileNavOverlay = document.querySelector('.mobile-nav-overlay');

    if (mobileMenuBtn && mobileNavOverlay) {
        mobileMenuBtn.addEventListener('click', () => {
            const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';

            mobileMenuBtn.setAttribute('aria-expanded', !isExpanded);
            mobileNavOverlay.classList.toggle('active');

            // Lock body scroll when menu is open
            document.body.style.overflow = !isExpanded ? 'hidden' : '';
        });

        // Close on click outside
        mobileNavOverlay.addEventListener('click', (e) => {
            if (e.target === mobileNavOverlay) {
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
                mobileNavOverlay.classList.remove('active');
                document.body.style.overflow = '';
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileNavOverlay.classList.contains('active')) {
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
                mobileNavOverlay.classList.remove('active');
                document.body.style.overflow = '';
                mobileMenuBtn.focus(); // Return focus to button
            }
        });
    }
});
