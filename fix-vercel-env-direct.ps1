# Direct Vercel Environment Variable Update
# This uses vercel env pull and proper formatting

Write-Host "=== Direct Vercel Environment Update ===" -ForegroundColor Cyan

# Method 1: Using temporary files (most reliable)
$tempDir = "$env:TEMP\vercel-env-fix"
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

Write-Host "`nCreating temporary value files..." -ForegroundColor Yellow

# Create temporary files with exact values (no newlines)
@{
    "MPESA_CONSUMER_KEY" = "P5K0wSGunjLUsA3ScyItbSUS5nvIk8vGJ5WTeG8JlYAjrPWw"
    "MPESA_CONSUMER_SECRET" = "DyGp3b8IGW8q6ePhpETGpHGrkBnFfaHizrNroVC1xZqoW3G2zpHd7H3N3ivscm4v"
    "MPESA_PASSKEY" = "9c79f92c1fe6fe1144dfdb4a4543d0d0b8772f52f43d125f611e772121c507e8"
    "MPESA_SHORTCODE" = "4501895"
    "MPESA_ENVIRONMENT" = "production"
    "MPESA_CALLBACK_URL" = "https://gamics.vercel.app/api/mpesa-callback"
}.GetEnumerator() | ForEach-Object {
    $key = $_.Key
    $value = $_.Value
    $file = "$tempDir\$key.txt"
    
    # Write value without newline using .NET method
    [System.IO.File]::WriteAllText($file, $value, [System.Text.Encoding]::ASCII)
    
    Write-Host "  Removing old $key..." -ForegroundColor Gray
    vercel env rm $key production --yes 2>$null | Out-Null
    
    Write-Host "  Adding clean $key (length: $($value.Length))" -ForegroundColor Green
    Get-Content $file -Raw | vercel env add $key production
}

# Cleanup
Remove-Item -Recurse -Force $tempDir

Write-Host "`n=== Complete ===" -ForegroundColor Green
Write-Host "Redeploy to apply changes:" -ForegroundColor Yellow
Write-Host "  vercel --prod`n" -ForegroundColor Cyan
