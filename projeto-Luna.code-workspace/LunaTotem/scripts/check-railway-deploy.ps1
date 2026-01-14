# Script to verify Railway deployment status

Write-Host "=== Railway Deployment Checker ===" -ForegroundColor Cyan
Write-Host ""

# Check health endpoint
Write-Host "1. Checking health endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "https://totemapi-production-e7c8.up.railway.app/api/health" -Method Get
    Write-Host "Response:" -ForegroundColor Green
    $health | ConvertTo-Json -Depth 3
    
    if ($health.build -eq "jwt-spam-fix-v2") {
        Write-Host "`n✅ Railway is UP TO DATE (commit f6370bc0+)" -ForegroundColor Green
    } else {
        Write-Host "`n❌ Railway is OUTDATED (missing build field)" -ForegroundColor Red
        Write-Host "Expected build: jwt-spam-fix-v2" -ForegroundColor Yellow
        Write-Host "Current: Old version without tracking" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Failed to reach health endpoint: $_" -ForegroundColor Red
}

Write-Host "`n2. Checking latest commits on GitHub..." -ForegroundColor Yellow
Write-Host "Recent commits:" -ForegroundColor Cyan
git log --oneline -5

Write-Host "`n3. Recommendations:" -ForegroundColor Yellow
Write-Host "- If Railway is outdated, go to:" -ForegroundColor White
Write-Host "  https://railway.app/project/totemapi" -ForegroundColor Cyan
Write-Host "- Click 'Deployments' tab" -ForegroundColor White
Write-Host "- Verify latest deployment commit hash matches: 21755c69" -ForegroundColor White
Write-Host "- If not, click 'Redeploy' button" -ForegroundColor White

Write-Host "`n4. Alternative: Force redeploy via empty commit" -ForegroundColor Yellow
Write-Host "Run: git commit --allow-empty -m 'chore: trigger railway redeploy' && git push origin master" -ForegroundColor Cyan
