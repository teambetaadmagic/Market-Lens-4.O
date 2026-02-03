# Shopify Credentials Verification Fix

## Problem
The Shopify credentials verification was failing on Vercel because the frontend was trying to connect to `http://localhost:3001`, which doesn't exist in production.

## Solution
We've implemented a three-tier verification system:

### 1. **Vercel Serverless Function** (Recommended for Production)
- Location: `/api/shopify/verify.ts`
- Automatically deployed with your Vercel project
- No additional server setup required
- Handles CORS properly on server-side

### 2. **Local Backend** (For Development)
- Location: `/server/index.js`
- Run with: `npm start` (from `/server` directory)
- Requires Node.js to be installed
- Used when `VITE_API_URL=http://localhost:3001`

### 3. **Direct Shopify API** (Fallback)
- Used automatically if backend is unavailable
- Works from the browser directly to Shopify
- May have CORS limitations depending on your network

## Setup Instructions

### For Vercel Deployment
1. Push the code to your Git repository
2. The `/api/shopify/verify.ts` file will be automatically deployed as a serverless function
3. No environment variables needed - the frontend will automatically use `/api/shopify/verify`

### For Local Development
1. Install Node.js (v18 or higher recommended)
2. Navigate to the server directory: `cd server`
3. Install dependencies: `npm install`
4. Start the server: `npm start`
5. The server will run on `http://localhost:3001`

### Environment Variables
See `.env.example` for available configuration options.

## How It Works

When a user enters Shopify credentials:

1. **Format Validation** - Checks token format and domain validity
2. **Backend Verification** - First tries the backend API (Vercel function or local server)
3. **Fallback** - If backend fails, tries direct Shopify API verification
4. **Error Handling** - Provides specific error messages for different failure scenarios

## Common Issues

### "Failed to verify credentials. Please check your backend server is running."
- **On Vercel**: Make sure you've redeployed after adding the `/api/shopify/verify.ts` file
- **Locally**: Ensure the backend server is running with `npm start` in the `/server` directory

### "CORS error. Please deploy a backend server or use Vercel serverless functions"
- The direct Shopify API call is being blocked by CORS
- Either use the Vercel serverless function or run the local backend

### "Invalid access token or insufficient permissions"
- The token format is valid but Shopify rejected it
- Verify the token is correct in your Shopify Admin settings
- Check that the custom app has the required scopes

### "Store domain not found"
- The domain doesn't exist or is in the wrong format
- Example correct format: `mystore.myshopify.com` or just `mystore`
