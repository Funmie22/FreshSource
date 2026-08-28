# FreshSource Meta WhatsApp Migration - Deployment & Verification Guide

## Phase 1: Pre-Deployment Checklist

### Configuration Files ✓
- [x] `backend/.env.example` - Meta credentials placeholders
- [x] `backend/.env.production.example` - Production Meta + DB + AI config
- [x] `backend/.env` - Local dev defaults
- [x] `backend/requirements.txt` - Twilio removed
- [x] `backend/main.py` - Meta webhook parsing, async outbound
- [x] `backend/whatsapp_service.py` - Async httpx client, Meta Graph API v18.0
- [x] `render.yaml` - Build/start commands, environment variables
- [x] `backend/README.md` - Updated with Meta configuration

### Database Schema ✓
- [x] `backend/models.py` - InboundMessage model added
- [x] `backend/schema.sql` - inbound_messages table defined
- [x] `backend/migrations/001_shared_supabase.sql` - Migration includes inbound_messages

### Environment Variables (Critical) ⚠️

Before deploying, configure these in your deployment platform:

```
# Required for production
DATABASE_URL=postgresql+psycopg://user:pass@host:5432/db
WHATSAPP_TOKEN=your_meta_system_user_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_from_meta_console
WHATSAPP_VERIFY_TOKEN=your_custom_verification_token_123

# Optional but recommended
INVENTORY_API_KEY=strong_random_key_here
AUTO_CREATE_TABLES=false
CORS_ORIGINS=https://your-frontend-domain.com
LOG_LEVEL=INFO
OPENAI_API_KEY=sk-your_openai_key_here
OLLAMA_ENABLED=false
```

### Verification Steps (Before Going Live)

**Do NOT deploy to production without:**

1. ✓ Testing GET /webhook with Meta challenge
2. ✓ Testing POST /webhook with sample Meta payload
3. ✓ Verifying database schema created
4. ✓ Testing order creation with atomic stock decrement
5. ✓ Testing extraction pipeline
6. ✓ Checking logs for any errors/warnings

---

## Phase 2: Deployment Steps

### 1. Supabase Setup

Run the migration SQL to ensure `inbound_messages` table exists:

```sql
-- In Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.inbound_messages (
  id text primary key,
  sender text not null,
  body text not null,
  status text not null default 'queued',
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS inbound_messages_status_idx ON public.inbound_messages(status);
```

### 2. Render Deployment (or similar platform)

1. Push to GitHub repository
2. Create new Render Web Service
3. Select Python runtime
4. Set environment variables (see Phase 1)
5. Render will automatically:
   - Run `pip install -r backend/requirements.txt`
   - Run `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`

### 3. Meta Developer Console Configuration

1. Go to Meta App Console → Your App → Settings
2. Set Webhook Callback URL: `https://your-render-service.onrender.com/webhook`
3. Set Verify Token: Use the value from `WHATSAPP_VERIFY_TOKEN`
4. Subscribe to `messages` webhook field
5. Save and verify endpoint (Meta will send GET challenge)

### 4. Vercel/Frontend Deployment

Frontend is already configured in `vercel.json` to route `/webhook` to the backend.

1. Frontend environment variables (`.env.local`):
   ```
   VITE_API_BASE_URL=https://your-render-service.onrender.com
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_anon_key
   ```
2. Deploy via `npm run build`

---

## Phase 3: End-to-End Verification

### Test 1: Meta Webhook Verification Challenge

**What it tests:** Meta's ability to verify the endpoint

```powershell
# Replace with your actual Render URL and verify token
$uri = "https://your-render-service.onrender.com/webhook?hub.mode=subscribe&hub.verify_token=your_custom_verification_token_123&hub.challenge=test_challenge_12345"
$response = Invoke-WebRequest -Uri $uri -Method Get
if ($response.StatusCode -eq 200 -and $response.Content -eq "test_challenge_12345") {
    Write-Host "✓ Webhook verification passed"
} else {
    Write-Host "✗ Webhook verification failed"
}
```

**Expected result:** HTTP 200 with plain text response `test_challenge_12345`

---

### Test 2: Inbound Message Processing (LIST Command)

**What it tests:** Meta webhook parsing, idempotency, async processing

```powershell
$json = @{
    entry = @(@{
        changes = @(@{
            value = @{
                messages = @(@{
                    id = "wamid.test_" + (Get-Random -Maximum 999999)
                    from = "2348012345678"
                    type = "text"
                    text = @{ body = "LIST" }
                    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
                })
            }
        })
    })
} | ConvertTo-Json -Depth 10

$response = Invoke-WebRequest -Uri "https://your-render-service.onrender.com/webhook" `
    -Method Post `
    -ContentType "application/json" `
    -Body $json

if ($response.StatusCode -eq 200) {
    Write-Host "✓ Message webhook accepted (HTTP 200)"
} else {
    Write-Host "✗ Message webhook failed: $($response.StatusCode)"
}
```

**Expected result:** 
- HTTP 200 JSON response: `{"status": "received"}`
- Message queued asynchronously
- Check logs or database after 2-3 seconds:

```sql
SELECT id, sender, body, status FROM inbound_messages WHERE sender = '2348012345678' ORDER BY created_at DESC LIMIT 1;
```

---

### Test 3: Listing Extraction & Buyer Alert

**What it tests:** AI extraction, listing creation, buyer alert queuing

```powershell
$json = @{
    entry = @(@{
        changes = @(@{
            value = @{
                messages = @(@{
                    id = "wamid.test_extract_" + (Get-Random -Maximum 999999)
                    from = "2348055554321"
                    type = "text"
                    text = @{ body = "I have 50 bags of maize in Ilorin for 35000 naira per bag" }
                    timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
                })
            }
        })
    })
} | ConvertTo-Json -Depth 10

Invoke-WebRequest -Uri "https://your-render-service.onrender.com/webhook" `
    -Method Post `
    -ContentType "application/json" `
    -Body $json

# Wait 2 seconds for async processing
Start-Sleep -Seconds 2

# Verify listing was created
$listings = Invoke-WebRequest -Uri "https://your-render-service.onrender.com/inventory" | ConvertFrom-Json
$freshListing = $listings | Where-Object { $_.crop_type -eq "Maize" -and $_.location -eq "Ilorin" } | Select-Object -First 1
if ($freshListing) {
    Write-Host "✓ Listing created: crop=$($freshListing.crop_type), qty=$($freshListing.quantity), location=$($freshListing.location)"
} else {
    Write-Host "✗ Listing not found; check extraction or backend logs"
}
```

**Expected result:**
- HTTP 200 response to webhook
- New `listings` row visible within 3 seconds
- `inbound_messages` status updated to `processed`

---

### Test 4: Atomic Order Creation & Stock Decrement

**What it tests:** Race condition prevention, stock verification

```powershell
# First, get a listing ID from the previous test
$listings = Invoke-WebRequest -Uri "https://your-render-service.onrender.com/inventory" | ConvertFrom-Json
$listingId = $listings[0].id

# Create an order
$orderPayload = @{
    phone = "2348055554321"
    item_id = $listingId
    quantity = 10
} | ConvertTo-Json

$orderResponse = Invoke-WebRequest -Uri "https://your-render-service.onrender.com/orders" `
    -Method Post `
    -ContentType "application/json" `
    -Body $orderPayload | ConvertFrom-Json

if ($orderResponse.id) {
    Write-Host "✓ Order created: id=$($orderResponse.id), qty=$($orderResponse.quantity), total=NGN $($orderResponse.total_price)"
    Write-Host "  Verify in database: SELECT * FROM orders WHERE id = '$($orderResponse.id)'"
} else {
    Write-Host "✗ Order creation failed"
}

# Verify stock was decremented
$updatedListing = Invoke-WebRequest -Uri "https://your-render-service.onrender.com/inventory" | ConvertFrom-Json | Where-Object { $_.id -eq $listingId } | Select-Object -First 1
Write-Host "  Stock now: $($updatedListing.quantity) (was 50, minus 10 = 40)"
```

**Expected result:**
- HTTP 201 with order details
- `listings.quantity` decremented exactly
- `orders` table shows pending status

---

### Test 5: Idempotency Check (Duplicate Message)

**What it tests:** Webhook duplicate protection

```powershell
# Send the SAME message twice (same id)
$messageId = "wamid.test_idem_12345"

@(1, 2) | ForEach-Object {
    $json = @{
        entry = @(@{
            changes = @(@{
                value = @{
                    messages = @(@{
                        id = $messageId  # Same ID both times
                        from = "2348012345678"
                        text = @{ body = "LIST" }
                    })
                }
            })
        })
    } | ConvertTo-Json -Depth 10
    
    Invoke-WebRequest -Uri "https://your-render-service.onrender.com/webhook" `
        -Method Post `
        -ContentType "application/json" `
        -Body $json | Out-Null
    
    Write-Host "Request $_"
}

# Check database - should see message only once
Write-Host "Query: SELECT COUNT(*) FROM inbound_messages WHERE id = '$messageId'"
Write-Host "Expected: 1 row (idempotency enforced)"
```

**Expected result:**
- Both requests return HTTP 200
- Database has only ONE row for that message ID (not two)
- Status is `processed` (from first execution)

---

## Phase 4: Production Monitoring

### Key Logs to Watch

```
# In Render/backend logs, look for:
✓ "FreshSource API started"
✓ "Mock WhatsApp message to ..." (if WHATSAPP_TOKEN not set)
✓ "Extraction successful" entries
✗ "Failed to send WhatsApp message to ... via Meta API"
✗ "Error executing background job"
✗ "Webhook command processing failed"
```

### Database Queries for Health Checks

```sql
-- Recent inbound messages
SELECT sender, status, COUNT(*) 
FROM inbound_messages 
WHERE created_at > now() - interval '1 hour'
GROUP BY sender, status
ORDER BY created_at DESC;

-- Orders created today
SELECT DATE(created_at), COUNT(*) 
FROM orders 
WHERE created_at > now() - interval '1 day'
GROUP BY DATE(created_at);

-- Stock checks for depletion
SELECT crop_type, location, quantity 
FROM listings 
WHERE quantity <= 5
ORDER BY quantity ASC;
```

### Alerting (Recommended)

Set up alerts for:
1. Webhook POST failures (HTTP 5xx)
2. Database connection failures
3. Meta API failures (check logs for 4xx/5xx)
4. Inbound messages stuck in `queued` status > 5 minutes

---

## Rollback Plan

If issues occur:

1. **Webhook Errors**: Temporarily point Meta webhook to old system or mock endpoint returning `{"status": "acknowledged"}`
2. **Database Issues**: Restore from Supabase backup (keep daily backups)
3. **API Crashes**: Render auto-restarts on failure; check logs for exception
4. **Stock Inconsistency**: Run inventory audit query to find mismatches

---

## Next Steps

1. [ ] Configure Meta Developer Console webhook
2. [ ] Set environment variables on deployment platform
3. [ ] Run Phase 2 (Deployment)
4. [ ] Run Phase 3 (Verification) - all 5 tests
5. [ ] Monitor logs for 24 hours
6. [ ] Enable production alerting
7. [ ] Archive old Twilio configuration

---

## Questions?

Refer to:
- Meta WhatsApp Cloud API docs: https://developers.facebook.com/docs/whatsapp/cloud-api/
- Render deployment guide: https://render.com/docs
- FreshSource README: [backend/README.md](backend/README.md)
- Migration audit notes: [/memories/repo/freshsource_meta_migration.md]
