<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Market Lens 4.0

A Progressive Web App (PWA) for inventory management with Shopify integration.

View your app in AI Studio: https://ai.studio/apps/drive/1U7NYZMIT_nuwf52JkiwonazxbQ5NuHlX

## Features

- 📦 Inventory Management
- 🛍️ **Multi-Store Shopify Integration** (Connect multiple stores!)
- 🛒 Order Tracking
- 🚚 Pickup & Receiving Management
- 👥 Supplier Management
- 🔐 Role-based Access Control
- 🛍️ Shopify Integration
- 📱 Progressive Web App (PWA)

## Quick Start

**Prerequisites:** Node.js

### Option 1: Automated Setup (Recommended)

Run the development script that starts both servers:

```bash
./start-dev.sh
```

This will:
- Install all dependencies automatically
- Start the API server on port 3001
- Start the frontend on port 3000

### Option 2: Manual Setup

1. **Install dependencies:**
   ```bash
   npm install
   cd server
   npm install
   cd ..
   ```

2. **Set the `GEMINI_API_KEY` in [.env.local](.env.local)** to your Gemini API key

3. **Start the API server** (Terminal 1):
   ```bash
   cd server
   npm start
   ```

4. **Start the frontend** (Terminal 2):
   ```bash
   npm run dev
   ```

## Shopify Integration

To connect your Shopify store, see the [Shopify Setup Guide](SHOPIFY_SETUP.md).

### 3. Configure Shopify Credentials

1. Log in to Market Lens as Admin (username: `Admagic`, password: `Admagic@2025`)
2. Navigate to the **Settings** tab
3. You can now connect **multiple Shopify stores**:
   - Click "Add Store"
   - Enter **Custom App Access Token** (starts with `shpat_`)
   - Enter **Shopify Store Domain** (e.g., `mystore`)
   - Click "Save & Connect"
4. Your connected stores will appear in a list where you can manage them or remove them.

## User Roles

- **Admin** - Full access to all features including settings
  - Username: `Admagic`
  - Password: `Admagic@2025`
  
- **Warehouse** - Manage inventory and receiving
  - Username: `Neha`
  - Password: `Neha@01`
  
- **Market Person** - Create orders and manage pickups
  - Username: `Sunil`
  - Password: `Sunil@001`

## Documentation

- [Shopify Setup Guide](SHOPIFY_SETUP.md) - Detailed Shopify integration instructions
- [PWA Documentation](PWA_DOCUMENTATION_INDEX.md) - PWA features and setup
- [API Server README](server/README.md) - Backend API documentation

## Project Structure

```
Market-Lens-4.O/
├── components/        # React components
├── views/            # Main view components
├── context/          # React context providers
├── services/         # Firebase and API services
├── server/           # Backend API server
│   ├── index.js     # Express server
│   └── package.json # Server dependencies
├── public/          # Static assets
└── scripts/         # Build scripts
```

## Development

The app uses:
- **Frontend**: React + TypeScript + Vite
- **Backend**: Express.js (for Shopify verification)
- **Database**: Firebase Firestore
- **AI**: Google Gemini API
- **Styling**: Tailwind CSS

## Building for Production

```bash
npm run build
```

The build output will be in the `dist/` directory.

## License

MIT

