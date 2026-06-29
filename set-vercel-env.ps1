# Set M-Pesa Daraja environment variables in Vercel

# Clean up any existing vars
Write-Host "Removing existing M-Pesa variables..." -ForegroundColor Yellow
vercel env rm MPESA_CONSUMER_KEY production --yes 2>$null
vercel env rm MPESA_CONSUMER_SECRET production --yes 2>$null
vercel env rm MPESA_PASSKEY production --yes 2>$null
vercel env rm MPESA_SHORTCODE production --yes 2>$null
vercel env rm MPESA_ENVIRONMENT production --yes 2>$null
vercel env rm MPESA_CALLBACK_URL production --yes 2>$null

Write-Host "`nAdding M-Pesa environment variables..." -ForegroundColor Green

# Add MPESA_CONSUMER_KEY
Write-Host "P5K0wSGunjLUsA3ScyItbSUS5nvIk8vGJ5WTeG8JlYAjrPWw" | vercel env add MPESA_CONSUMER_KEY production

# Add MPESA_CONSUMER_SECRET
Write-Host "DyGp3b8IGW8q6ePhpETGpHGrkBnFfaHizrNroVC1xZqoW3G2zpHd7H3N3ivscm4v" | vercel env add MPESA_CONSUMER_SECRET production

# Add MPESA_PASSKEY
Write-Host "9c79f92c1fe6fe1144dfdb4a4543d0d0b8772f52f43d125f611e772121c507e8" | vercel env add MPESA_PASSKEY production

# Add MPESA_SHORTCODE
Write-Host "4501895" | vercel env add MPESA_SHORTCODE production

# Add MPESA_ENVIRONMENT
Write-Host "production" | vercel env add MPESA_ENVIRONMENT production

# Add MPESA_CALLBACK_URL
Write-Host "https://gamics.vercel.app/api/mpesa-callback" | vercel env add MPESA_CALLBACK_URL production

Write-Host "`n✅ All M-Pesa environment variables added!" -ForegroundColor Green
Write-Host "Next: Run 'vercel --prod' to deploy" -ForegroundColor Cyan
