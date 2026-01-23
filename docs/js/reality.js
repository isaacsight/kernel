document.addEventListener('DOMContentLoaded', () => {
    const realitySwitch = document.getElementById('reality-switch');
    const body = document.body;
    const icon = realitySwitch.querySelector('.reality-icon');

    // Check localStorage
    const currentMode = localStorage.getItem('realityMode');
    if (currentMode === 'machine') {
        enableMachineMode();
    }

    realitySwitch.addEventListener('click', () => {
        if (body.classList.contains('machine-mode')) {
            disableMachineMode();
        } else {
            enableMachineMode();
        }
    });

    function enableMachineMode() {
        body.classList.add('machine-mode');
        localStorage.setItem('realityMode', 'machine');
        icon.textContent = '🤖';

        // Optional: Add a glitch effect or sound here
        console.log("System: Machine Mode Activated. Accessing hidden data layers...");
    }

    function disableMachineMode() {
        body.classList.remove('machine-mode');
        localStorage.setItem('realityMode', 'human');
        icon.textContent = '👁️';
        console.log("System: Human Mode Restored.");
    }
});
