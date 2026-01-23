document.addEventListener('DOMContentLoaded', function () {
    const customTrigger = document.getElementById('custom-support-trigger');

    if (customTrigger) {
        customTrigger.addEventListener('click', function (e) {
            e.preventDefault();

            // Try to find the BMC button
            const bmcButton = document.querySelector('#bmc-wbtn');

            if (bmcButton) {
                // If button exists, click it
                bmcButton.click();
            } else {
                // If not found, it might be loading or blocked.
                // Try to find the iframe directly
                const bmcIframe = document.querySelector('iframe[title="Buy Me a Coffee"]');
                if (bmcIframe) {
                    // If iframe exists but button doesn't (rare), maybe we can't trigger it easily.
                    // Fallback to new tab
                    window.open('https://buymeacoffee.com/doesthisfeelright', '_blank');
                } else {
                    // Widget not loaded at all
                    console.log('BMC Widget not found, opening new tab.');
                    window.open('https://buymeacoffee.com/doesthisfeelright', '_blank');
                }
            }
        });
    }
});
