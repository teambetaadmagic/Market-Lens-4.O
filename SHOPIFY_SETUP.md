# Shopify Integration Setup Guide

This guide explains how to set up and verify Shopify credentials in Market Lens.

## Prerequisites

You need Node.js installed on your system to run the API server.

## Setup Instructions

### 1. Install Dependencies

First, install dependencies for both the frontend and API server:

```bash
# Install frontend dependencies
npm install

# Install API server dependencies
cd server
npm install
cd ..
```

### 2. Start the Servers

You need to run **both** servers for Shopify verification to work:

**Terminal 1 - API Server:**
```bash
cd server
npm start
```

You should see:
```
🚀 Market Lens API Server running on http://localhost:3001
📡 Ready to verify Shopify credentials
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

The frontend will run on `http://localhost:3000`

### 3. Configure Shopify Credentials

1. Log in to Market Lens as Admin (username: `Admagic`, password: `Admagic@2025`)
2. Navigate to the **Settings** tab
3. You can now connect **multiple Shopify stores**:
   - Click "Add Store"
   - Enter **Custom App Access Token** (starts with `shpat_`)
   - Enter **Shopify Store Domain** (e.g., `mystore` for `mystore.myshopify.com`)
   - Click "Save & Connect"
4. Your connected stores will appear in a list where you can manage them individually.

### 4. How to Get Shopify Credentials

1. Go to your Shopify Admin panel
2. Navigate to **Settings** → **Apps and sales channels**
3. Click **Develop apps**
4. Click **Create an app** or select an existing custom app
5. Go to **API credentials** tab
6. Click **Install app** (if not already installed)
7. Reveal and copy the **Admin API access token**
8. Note your store domain from the URL (e.g., `mystore.myshopify.com`)

### 5. Required API Scopes

Make sure your Shopify custom app has the following scopes enabled:
- `read_products`
- `write_products`
- `read_inventory`
- `write_inventory`

## How It Works

1. When you enter credentials and click "Save Settings", the frontend sends them to the API server
2. The API server makes a request to Shopify's API to verify the credentials
3. If valid, Shopify returns store information and the credentials are saved
4. If invalid, you'll see an error message explaining what went wrong

## Troubleshooting

### "Cannot connect to verification server"

**Problem:** The API server is not running.

**Solution:** Make sure you started the API server in a separate terminal:
```bash
cd server
npm start
```

### "Invalid access token or insufficient permissions"

**Problem:** The token is incorrect or doesn't have the required permissions.

**Solution:** 
1. Double-check you copied the entire token from Shopify
2. Verify the custom app has the required API scopes
3. Try regenerating the access token in Shopify

### "Store domain not found"

**Problem:** The store domain is incorrect.

**Solution:** 
1. Enter only the store name (e.g., `mystore`, not `mystore.myshopify.com`)
2. Verify the store exists and is active

## Production Deployment

For production, you'll need to:

1. Deploy the API server to a hosting service (e.g., Heroku, Railway, Render)
2. Set the `VITE_API_URL` environment variable to your API server URL
3. Update CORS settings in `server/index.js` to allow your production domain

Example:
```bash
# Set environment variable
export VITE_API_URL=https://your-api-server.com

# Build frontend
npm run build
```
