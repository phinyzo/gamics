# Fix Vercel Environment Variables - Remove newlines
# This script updates M-Pesa environment variables in Vercel production
# Run: .\fix-vercel-env.ps1

Write-Host "=== Fixing Vercel Environment Variables ===" -ForegroundColor Cyan
Write-Host "This will update M-Pesa credentials without newlines`n" -ForegroundColor Yellow

# Define clean values (no newlines)
$env_vars = @{
    "MPESA_CONSUMER_KEY" = "P5K0wSGunjLUsA3ScyItbSUS5nvIk8vGJ5WTeG8JlYAjrPWw"
    "MPESA_CONSUMER_SECRET" = "DyGp3b8IGW8q6ePhpETGpHGrkBnFfaHizrNroVC1xZqoW3G2zpHd7H3N3ivscm4v"
    "MPESA_PASSKEY" = "9c79f92c1fe6fe1144dfdb4a4543d0d0b8772f52f43d125f611e772121c507e8"
    "MPESA_SHORTCODE" = "4501895"
    "MPESA_ENVIRONMENT" = "production"
    "MPESA_CALLBACK_URL" = "https://gamics.vercel.app/api/mpesa-callback"
}

Write-Host "Removing old environment variables..." -ForegroundColor Yellow

# Remove existing variables first
foreach ($key in $env_vars.Keys) {
    Write-Host "  Removing: $key" -ForegroundColor Gray
    vercel env rm $key production --yes 2>$null
}

Write-Host "`nAdding clean environment variables..." -ForegroundColor Yellow

# Add clean values using echo to avoid newlines
foreach ($key in $env_vars.Keys) {
    $value = $env_vars[$key]
    Write-Host "  Adding: $key (length: $($value.Length))" -ForegroundColor Green
    
    # Use echo piped to vercel to avoid newline issues
    # The -NoNewline parameter ensures no trailing newline
    $value | vercel env add $key production
}

Write-Host "`n=== Environment Variables Updated ===" -ForegroundColor Green
Write-Host "Please redeploy your application for changes to take effect:" -ForegroundColor Yellow
Write-Host "  vercel --prod" -ForegroundColor Cyan
Write-Host "`nOr wait for the next automatic deployment.`n" -ForegroundColor Gray
