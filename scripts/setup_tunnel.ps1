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

# 2. Run Tunnel (Free / Quick Mode)
Write-Host "Starting Free Cloudflare Tunnel..." -ForegroundColor Cyan
Write-Host "NOTE: This will generate a random URL (e.g. https://...trycloudflare.com)" -ForegroundColor Yellow
Write-Host "Keep this window OPEN to keep the site live." -ForegroundColor Yellow
Write-Host ""
Write-Host "To expose your local server (port 8000) to the world, run:" -ForegroundColor Cyan
Write-Host "cloudflared tunnel --url http://localhost:8000" -ForegroundColor White
Write-Host ""
Write-Host "Copy the URL provided (e.g., https://warm-mountain-123.trycloudflare.com) and update content/studio.md with it." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to run the tunnel now..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

cloudflared tunnel --url http://localhost:8000
