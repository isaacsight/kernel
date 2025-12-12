const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = require('is-dev');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

function createWindow() {
    console.log("Creating window...");
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
        title: "Mission Control"
    });

    const startUrl = isDev
        ? 'http://localhost:5173'
        : `file://${path.join(__dirname, 'dist/index.html')}`;

    console.log(`Loading URL: ${startUrl}`);
    mainWindow.loadURL(startUrl);

    mainWindow.on('closed', () => (mainWindow = null));
}

function startBackend() {
    const rootDir = path.join(__dirname, '../../'); // Go up to blog design root
    // Spawn uvicorn
    backendProcess = spawn('uvicorn', ['admin.api.main:app', '--port', '8000'], {
        cwd: rootDir,
        shell: true,
    });

    backendProcess.stdout.on('data', (data) => {
        console.log(`Backend: ${data}`);
    });

    backendProcess.stderr.on('data', (data) => {
        console.error(`Backend Error: ${data}`);
    });
}

app.on('ready', () => {
    if (!isDev) {
        startBackend();
    }
    // In dev, we assume uvicorn is run by the npm script 'electron' or externally
    setTimeout(createWindow, 1000);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('will-quit', () => {
    if (backendProcess) {
        backendProcess.kill();
    }
});
