# Final Fix for Vercel Environment Variables
# Uses Write-Host with -NoNewline to avoid trailing newlines

Write-Host "=== Fixing Vercel Environment Variables (Final Method) ===" -ForegroundColor Cyan

$env_vars = @{
    "MPESA_CONSUMER_KEY" = "P5K0wSGunjLUsA3ScyItbSUS5nvIk8vGJ5WTeG8JlYAjrPWw"
    "MPESA_CONSUMER_SECRET" = "DyGp3b8IGW8q6ePhpETGpHGrkBnFfaHizrNroVC1xZqoW3G2zpHd7H3N3ivscm4v"
    "MPESA_PASSKEY" = "9c79f92c1fe6fe1144dfdb4a4543d0d0b8772f52f43d125f611e772121c507e8"
    "MPESA_SHORTCODE" = "4501895"
    "MPESA_ENVIRONMENT" = "production"
    "MPESA_CALLBACK_URL" = "https://gamics.vercel.app/api/mpesa-callback"
}

Write-Host "`nUpdating environment variables..." -ForegroundColor Yellow

foreach ($key in $env_vars.Keys) {
    $value = $env_vars[$key]
    
    Write-Host "`n  Removing old $key..." -ForegroundColor Gray
    vercel env rm $key production --yes 2>$null | Out-Null
    
    Write-Host "  Adding clean $key (length: $($value.Length))" -ForegroundColor Green
    
    # Use Write-Host with -NoNewline and pipe to vercel
    Write-Host $value -NoNewline | vercel env add $key production
}

Write-Host "`n`n=== Complete ===" -ForegroundColor Green
Write-Host "Redeploy to apply changes:" -ForegroundColor Yellow
Write-Host "  vercel --prod`n" -ForegroundColor Cyan
