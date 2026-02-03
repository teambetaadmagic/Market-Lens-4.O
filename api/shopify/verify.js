export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const { accessToken, shopifyDomain } = req.body;

        console.log('[Shopify Verify API] Received verification request for domain:', shopifyDomain);

        // Validate inputs
        if (!accessToken || !shopifyDomain) {
            console.warn('[Shopify Verify API] Missing required fields');
            return res.status(400).json({
                success: false,
                message: 'Access token and domain are required'
            });
        }

        // Validate token format
        const tokenPattern = /^(shpat_|shpca_|shpss_|shpua_|shppa_)/;
        if (!tokenPattern.test(accessToken.trim())) {
            console.warn('[Shopify Verify API] Invalid token format');
            return res.status(400).json({
                success: false,
                message: 'Invalid access token format. Token should start with shpat_, shpca_, or shpss_'
            });
        }

        // Validate domain format
        const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$/;
        const cleanDomain = shopifyDomain.replace('.myshopify.com', '').trim();

        if (!domainPattern.test(cleanDomain)) {
            console.warn('[Shopify Verify API] Invalid domain format:', cleanDomain);
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

        console.log('[Shopify Verify API] Testing credentials for:', fullDomain);

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
            console.error('[Shopify Verify API] Fetch error:', fetchError.message);
            if (fetchError.name === 'AbortError') {
                return res.status(500).json({
                    success: false,
                    message: 'Request timeout. Shopify API took too long to respond. Please try again.'
                });
            }
            return res.status(500).json({
                success: false,
                message: `Network error: ${fetchError.message}`
            });
        }

        clearTimeout(timeoutId);

        console.log('[Shopify Verify API] Shopify API response status:', response.status);

        if (response.ok) {
            const data = await response.json();
            console.log('[Shopify Verify API] ✓ Successfully verified:', data.shop.name);

            return res.json({
                success: true,
                message: `Successfully connected to ${data.shop.name}!`,
                shopName: data.shop.name,
                shopDomain: data.shop.domain,
                shopEmail: data.shop.email
            });
        } else if (response.status === 401) {
            console.error('[Shopify Verify API] ✗ Authentication failed (401)');
            return res.status(401).json({
                success: false,
                message: 'Invalid access token or insufficient permissions'
            });
        } else if (response.status === 404) {
            console.error('[Shopify Verify API] ✗ Store not found (404):', fullDomain);
            return res.status(404).json({
                success: false,
                message: 'Store domain not found. Please check your store URL'
            });
        } else if (response.status === 403) {
            console.error('[Shopify Verify API] ✗ Access forbidden (403)');
            return res.status(403).json({
                success: false,
                message: 'Access forbidden. Check your API permissions and scopes'
            });
        } else {
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('[Shopify Verify API] ✗ Unexpected status:', response.status, errorText);
            return res.status(response.status).json({
                success: false,
                message: `Connection error: ${response.statusText}`
            });
        }
    } catch (error) {
        console.error('[Shopify Verify API] Unexpected error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to verify credentials. Please try again.'
        });
    }
}
