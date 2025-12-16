# PowerShell Script to Setup Cloudflare Tunnel for Studio OS
Write-Host "Setting up Cloudflare Tunnel for Studio OS Backend..." -ForegroundColor Cyan

# 1. Check if cloudflared is installed
if (Get-Command "cloudflared" -ErrorAction SilentlyContinue) {
    Write-Host "Cloudflared is already installed." -ForegroundColor Green
} else {
    Write-Host "Cloudflared not found. Installing via Winget..." -ForegroundColor Yellow
    winget install Cloudflare.cloudflared
    if ($?) {
        Write-Host "Cloudflared installed successfully." -ForegroundColor Green
    } else {
        Write-Host "Winget failed. Please install cloudflared manually: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" -ForegroundColor Red
        exit 1
    }
}

# 2. Login (Conditional)
if (-not (Test-Path "$env:USERPROFILE\.cloudflared\cert.pem")) {
    Write-Host "Please login to Cloudflare..." -ForegroundColor Cyan
    cloudflared tunnel login
}

# 3. Create Tunnel (Optional - usually user does quick tunnel or named tunnel)
Write-Host "To expose your local server (port 8000) to the world, run:" -ForegroundColor Cyan
Write-Host "cloudflared tunnel --url http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "Copy the URL provided (e.g., https://warm-mountain-123.trycloudflare.com) and update content/studio.md with it." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to run the tunnel now..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

cloudflared tunnel --url http://localhost:8000
