# Market Lens API Server

This is the backend API server for Market Lens that handles Shopify credential verification.

## Why is this needed?

The frontend cannot directly verify Shopify credentials due to CORS (Cross-Origin Resource Sharing) restrictions. This server acts as a proxy to verify credentials with Shopify's API.

## Setup

1. Install dependencies:
```bash
cd server
npm install
```

2. Start the server:
```bash
npm start
```

The server will run on `http://localhost:3001`

## API Endpoints

### POST /api/shopify/verify

Verifies Shopify credentials.

**Request Body:**
```json
{
  "accessToken": "shpat_xxxxxxxxxxxxx",
  "shopifyDomain": "mystore"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Successfully connected to My Store!",
  "shopName": "My Store",
  "shopDomain": "mystore.myshopify.com",
  "shopEmail": "admin@mystore.com"
}
```

**Error Response (401/404/403):**
```json
{
  "success": false,
  "message": "Invalid access token or insufficient permissions"
}
```

## Development

For development, you need to run both servers:

1. **API Server** (Terminal 1):
```bash
cd server
npm start
```

2. **Frontend** (Terminal 2):
```bash
npm run dev
```

The frontend will automatically connect to the API server on port 3001.
