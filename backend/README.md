# FreshSource API

A small FastAPI service for FreshSource WhatsApp ordering and local inventory persistence.

## Setup

From the repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
```

Load the environment variables in `backend/.env` in your shell or process manager. Set `DATABASE_URL` to the Supabase PostgreSQL connection string from Project Settings > Database. Configure `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_VERIFY_TOKEN` from your Meta Developer Console. During local development without Meta credentials, outbound messages are logged as mock messages. Keep `AUTO_CREATE_TABLES=false` in production and apply [migrations/001_shared_supabase.sql](migrations/001_shared_supabase.sql) once. For a new project, use [schema.sql](schema.sql) instead.

For an existing or empty Supabase project, run the complete [migrations/001_shared_supabase.sql](migrations/001_shared_supabase.sql) file in Supabase SQL Editor. It is idempotent and creates the required `users`, `listings`, and `orders` tables before applying indexes and security settings. For a completely new project, [schema.sql](schema.sql) contains the same base schema.

Production architecture:

```text
React/Vite + Supabase Auth/Realtime
        |
      Supabase PostgreSQL
        |
FastAPI + SQLAlchemy + Meta WhatsApp + AI extraction
```

The browser and API must point to the same Supabase project. The browser uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; the API uses the PostgreSQL `DATABASE_URL` and should run with a restricted server-side database role or pooler connection.

Run the service:

```powershell
uvicorn backend.main:app --reload
```

Open interactive API documentation at http://127.0.0.1:8000/docs.

## Judge demo flow

Use a separate demo database so the presentation starts with predictable data:

```powershell
$env:DATABASE_URL = "sqlite:///./judge-demo.db"
\.venv\Scripts\python.exe -m backend.seed_demo
\.venv\Scripts\uvicorn.exe backend.main:app --host 127.0.0.1 --port 8001
```

Then demonstrate the automation with a Meta webhook payload:

```powershell
$json = @{
    entry = @(
        @{
            changes = @(
                @{
                    value = @{
                        messages = @(
                            @{
                                id = "wamid.test_msg_1"
                                from = "2348012345678"
                                text = @{ body = "I have 50 bags of maize in Ilorin for 35000 naira per bag" }
                            }
                        )
                    }
                }
            )
        }
    )
} | ConvertTo-Json -Depth 10
Invoke-WebRequest -Method Post -Uri http://127.0.0.1:8001/webhook `
  -ContentType "application/json" `
  -Body $json
```

Explain the response in this order: the backend receives the WhatsApp text, extracts the crop/quantity/location/price, saves a new inventory record, confirms the listing to the farmer, and alerts the matching buyer. With no OpenAI or Meta credentials, extraction uses the local parser and buyer alerts are logged as mock WhatsApp messages; the same flow switches to Ollama/OpenAI and Meta when configured.

## Meta WhatsApp Webhook Configuration

Configure Meta's webhook in the Meta Developer Console:

1. **Verify Endpoint**: Meta sends a GET request with `hub.mode=subscribe`, `hub.verify_token`, and `hub.challenge`.
2. **Inbound Webhook URL**: Set to `POST https://your-public-host.example/webhook`.
3. **Verify Token**: Use the value from `WHATSAPP_VERIFY_TOKEN` in your environment.

For local development, expose port 8000 using a tunneling service such as ngrok:

```powershell
ngrok http 8000
```

Meta sends JSON payloads with inbound messages nested under `entry[0].changes[0].value.messages[0]`. The endpoint extracts `id`, `from`, and `text.body`, validates idempotency, and queues async processing.

Supported messages:

- `LIST` shows in-stock produce and prices.
- `ORDER <item_id> <quantity>` creates a pending order and reserves stock.
- `STATUS` shows the sender's five most recent orders.
- Any other message returns the command menu.

OpenAI extraction is optional. For a free local AI setup, install Ollama from https://ollama.com, then run:

```powershell
ollama pull llama3.2:3b
```

Set `OLLAMA_ENABLED=true` in `backend/.env`. The backend sends farmer messages to Ollama at `http://127.0.0.1:11434`. If Ollama is unavailable, the local parser handles common English phrasing.

OpenAI extraction (optional paid alternative):

```text
OPENAI_API_KEY=sk-your_api_key
OPENAI_MODEL=gpt-4o-mini
```

Natural-language listing messages are also supported, for example: `I have 50 bags of maize in Ilorin for 35000 naira per bag`. OpenAI extracts the crop, quantity, location, and price, then the backend saves the listing and alerts matching buyers. Without `OPENAI_API_KEY`, a local parser handles common English phrasing for development.

## API examples

Add inventory:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/inventory `
  -ContentType 'application/json' `
  -Body '{"name":"Tomatoes","unit":"kg","price_per_unit":1800,"quantity":500,"location":"Lagos"}'
```

List inventory:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/inventory
```

Create an order directly:

```powershell
Invoke-RestMethod -Method Post http://127.0.0.1:8000/orders `
  -ContentType 'application/json' `
  -Body '{"phone":"whatsapp:+2348012345678","item_id":1,"quantity":10}'
```
