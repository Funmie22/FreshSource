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

Load the environment variables in `backend/.env` in your shell or process manager. Set `DATABASE_URL` to the Supabase PostgreSQL connection string from Project Settings > Database. The backend and frontend then read the same Supabase tables. Twilio credentials are optional during development: without them, outbound helper calls use mock logging. Keep `AUTO_CREATE_TABLES=false` in production and apply [migrations/001_shared_supabase.sql](migrations/001_shared_supabase.sql) once. For a new project, use [schema.sql](schema.sql) instead.

For an existing or empty Supabase project, run the complete [migrations/001_shared_supabase.sql](migrations/001_shared_supabase.sql) file in Supabase SQL Editor. It is idempotent and creates the required `users`, `listings`, and `orders` tables before applying indexes and security settings. For a completely new project, [schema.sql](schema.sql) contains the same base schema.

Production architecture:

```text
React/Vite + Supabase Auth/Realtime
        |
      Supabase PostgreSQL
        |
FastAPI + SQLAlchemy + Twilio + AI extraction
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

Then demonstrate the automation with the same payload a Twilio webhook sends:

```powershell
Invoke-WebRequest -Method Post -Uri http://127.0.0.1:8001/webhook `
  -ContentType "application/x-www-form-urlencoded" `
  -Body @{ From = "whatsapp:+2348012345678"; Body = "I have 50 bags of maize in Ilorin for 35000 naira per bag" }
```

Explain the response in this order: the backend receives the WhatsApp text, extracts the crop/quantity/location/price, saves a new inventory record, confirms the listing to the farmer, and alerts the matching buyer. With no OpenAI or Twilio credentials, extraction uses the local parser and buyer alerts are logged as mock WhatsApp messages; the same flow switches to Ollama/OpenAI and Twilio when configured.

## Twilio WhatsApp webhook

Configure the Twilio WhatsApp sender's incoming message webhook as:

```text
POST https://your-public-host.example/webhook
```

For local development, expose port 8000 using a tunneling service such as ngrok. Twilio sends form fields named `From` and `Body`; the endpoint also accepts normalized JSON:

```json
{"sender": "whatsapp:+2348012345678", "body": "LIST"}
```

For a real Twilio test, open the Twilio WhatsApp Sandbox, add its join code from your WhatsApp phone, and set the Sandbox incoming-message URL to your public URL plus `/webhook` using POST. For the demo command above, expose port 8001 with `ngrok http 8001`. Put your Account SID, Auth Token, and WhatsApp sender number in `backend/.env`, then start Uvicorn with `--env-file backend/.env`. Set `TWILIO_VALIDATE_SIGNATURE=true` after the webhook is behind HTTPS.

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
