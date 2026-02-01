# Workshop Booking API Proxy

A lightweight Bun API proxy server that sits between the GHL-hosted form and the GHL API, keeping credentials secure server-side.

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  GHL Funnel     │────▶│  Bun API Proxy  │────▶│  GHL API        │
│  (Form Widget)  │◀────│  (Our Server)   │◀────│  (LeadConnector)│
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Project Structure

```
tutorelli-workshop-form/
├── src/
│   ├── index.ts          # Server entry point + routing
│   ├── config.ts         # Environment configuration
│   ├── ghl.ts            # GHL API client
│   ├── handlers.ts       # Route handlers
│   ├── validation.ts     # Zod schemas
│   └── types.ts          # TypeScript types
├── form.html             # Refactored form (for GHL)
├── file.html             # Original form (backup)
├── .env.example          # Environment template
├── .env                  # Local secrets (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

## Setup

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in your GHL credentials:

```bash
cp .env.example .env
```

Required variables:
- `GHL_API_BASE_URL` - GHL API base URL (default: https://services.leadconnectorhq.com)
- `GHL_ACCESS_TOKEN` - Your GHL API access token
- `GHL_LOCATION_ID` - Your GHL location ID
- `WORKSHOP_OFFERINGS_SCHEMA` - Custom object schema ID for offerings
- `BOOKINGS_SCHEMA` - Custom object schema ID for bookings
- `PORT` - Server port (default: 3000)

### 3. Run Development Server

```bash
bun run dev
```

The server will start with hot-reload at `http://localhost:3000`.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/offerings?yearGroup=gcse` | Get available workshops |
| GET | `/api/contacts?email=...` | Find contact by email |
| POST | `/api/contacts` | Create or update contact |
| POST | `/api/bookings` | Create booking record |

### Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format"
  }
}
```

## Testing

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Get Offerings
```bash
curl "http://localhost:3000/api/offerings?yearGroup=gcse"
```

### Find Contact
```bash
curl "http://localhost:3000/api/contacts?email=test@example.com"
```

### Create Contact
```bash
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "07123456789",
    "tags": ["parent", "workshop-gcse"]
  }'
```

### Create Booking
```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "parentContactId": "abc123",
    "studentContactId": "def456",
    "workshopOfferingId": "ghi789",
    "pricePaid": 49
  }'
```

## Build for Production

Build a single executable binary:

```bash
bun run build
```

This creates `./dist/workshop-api` which can be deployed as a standalone binary.

Run the production binary:

```bash
./dist/workshop-api
```

## Deployment

1. Build the binary: `bun run build`
2. Upload `./dist/workshop-api` to your server
3. Set environment variables on the server
4. Run the binary

Example with PM2:
```bash
PORT=3000 \
GHL_ACCESS_TOKEN=pit-xxx \
GHL_LOCATION_ID=xxx \
WORKSHOP_OFFERINGS_SCHEMA=xxx \
BOOKINGS_SCHEMA=xxx \
pm2 start ./dist/workshop-api --name workshop-api
```

## Form Integration

The `form.html` file is ready to be embedded in GHL. Before deploying:

1. Update the `API_URL` constant at the top of the script to point to your production server:
   ```js
   const API_URL = 'https://your-server.com/api';
   ```

2. Copy the HTML content into your GHL funnel page.

## Security

- All GHL credentials are kept server-side
- CORS is configured to allow all origins (`*`)
- Input validation using Zod schemas
- Request logging with timestamps
