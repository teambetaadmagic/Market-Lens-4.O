import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3001;

// Enable CORS for the frontend
app.use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'],
    credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Market Lens API Server' });
});

// Shopify connection verification endpoint
app.post('/api/shopify/verify', async (req, res) => {
    try {
        const { accessToken, shopifyDomain } = req.body;

        console.log('[API] Received verification request for domain:', shopifyDomain);

        // Validate inputs
        if (!accessToken || !shopifyDomain) {
            console.warn('[API] Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Access token and domain are required'
            });
        }

        // Validate token format
        const tokenPattern = /^(shpat_|shpca_|shpss_|shpua_|shppa_)/;
        if (!tokenPattern.test(accessToken.trim())) {
            console.warn('[API] Invalid token format');
            return res.status(400).json({
                success: false,
                message: 'Invalid access token format. Token should start with shpat_, shpca_, or shpss_'
            });
        }

        // Validate domain format
        const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/;
        const cleanDomain = shopifyDomain.replace('.myshopify.com', '').trim();

        if (!domainPattern.test(cleanDomain)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid store domain format'
            });
        }

        const fullDomain = cleanDomain.includes('.myshopify.com')
            ? cleanDomain
            : `${cleanDomain}.myshopify.com`;

        // Make request to Shopify API
        const shopifyUrl = `https://${fullDomain}/admin/api/2024-01/shop.json`;

        console.log(`Verifying Shopify credentials for: ${fullDomain}`);

        // Create an abort controller with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        let response;
        try {
            response = await fetch(shopifyUrl, {
                method: 'GET',
                headers: {
                    'X-Shopify-Access-Token': accessToken.trim(),
                    'Content-Type': 'application/json',
                },
                signal: controller.signal,
            });
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                console.error(`✗ Request timeout for: ${fullDomain}`);
                return res.status(500).json({
                    success: false,
                    message: 'Request timeout. Shopify API took too long to respond. Please try again.'
                });
            }
            console.error(`✗ Network error for: ${fullDomain}`, fetchError.message);
            return res.status(500).json({
                success: false,
                message: `Network error: ${fetchError.message}`
            });
        }

        clearTimeout(timeoutId);

        if (response.ok) {
            const data = await response.json();
            console.log(`✓ Successfully connected to: ${data.shop.name}`);

            return res.json({
                success: true,
                message: `Successfully connected to ${data.shop.name}!`,
                shopName: data.shop.name,
                shopDomain: data.shop.domain,
                shopEmail: data.shop.email
            });
        } else if (response.status === 401) {
            console.log(`✗ Authentication failed for: ${fullDomain}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid access token or insufficient permissions'
            });
        } else if (response.status === 404) {
            console.log(`✗ Store not found: ${fullDomain}`);
            return res.status(404).json({
                success: false,
                message: 'Store domain not found. Please check your store URL'
            });
        } else if (response.status === 403) {
            return res.status(403).json({
                success: false,
                message: 'Access forbidden. Check your API permissions and scopes'
            });
        } else {
            const errorText = await response.text();
            console.log(`✗ Connection error: ${response.status} - ${errorText}`);
            return res.status(response.status).json({
                success: false,
                message: `Connection error: ${response.statusText}`
            });
        }
    } catch (error) {
        console.error('Shopify verification error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify credentials. Please try again.'
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Market Lens API Server running on http://localhost:${PORT}`);
    console.log(`📡 Ready to verify Shopify credentials`);
});
