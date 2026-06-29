# Set M-Pesa environment variables properly (without newlines)

$env:MPESA_CONSUMER_KEY = "P5K0wSGunjLUsA3ScyItbSUS5nvIk8vGJ5WTeG8JlYAjrPWw"
$env:MPESA_CONSUMER_SECRET = "DyGp3b8IGW8q6ePhpETGpHGrkBnFfaHizrNroVC1xZqoW3G2zpHd7H3N3ivscm4v"
$env:MPESA_PASSKEY = "9c79f92c1fe6fe1144dfdb4a4543d0d0b8772f52f43d125f611e772121c507e8"

Write-Host "Setting MPESA_CONSUMER_KEY..."
vercel env add MPESA_CONSUMER_KEY production --force

Write-Host "Setting MPESA_CONSUMER_SECRET..."
vercel env add MPESA_CONSUMER_SECRET production --force

Write-Host "Setting MPESA_PASSKEY..."
vercel env add MPESA_PASSKEY production --force

Write-Host "Done!"
