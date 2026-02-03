export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const { accessToken, shopifyDomain, orderName } = req.body;

        if (!accessToken || !shopifyDomain || !orderName) {
            return res.status(400).json({
                success: false,
                message: 'Access token, domain, and order name are required'
            });
        }

        const cleanDomain = shopifyDomain.replace('.myshopify.com', '').trim();
        const fullDomain = `${cleanDomain}.myshopify.com`;

        console.log('[Shopify Order API] Starting order search for:', orderName, 'at', fullDomain);

        let order = null;

        try {
            // Simple and reliable: Just fetch recent orders and filter client-side
            console.log('[Shopify Order API] Fetching recent orders...');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);

            const response = await fetch(
                `https://${fullDomain}/admin/api/2024-01/orders.json?limit=250&status=any&order=created_at:desc`,
                {
                    method: 'GET',
                    cache: 'no-store',
                    signal: controller.signal,
                    headers: {
                        'X-Shopify-Access-Token': accessToken.trim(),
                        'Content-Type': 'application/json',
                    },
                }
            );

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.error(`[Shopify Order API] Shopify API returned ${response.status}`);
                const errorText = await response.text();
                console.error('[Shopify Order API] Error:', errorText);
                
                if (response.status === 401) {
                    return res.status(401).json({
                        success: false,
                        message: 'Invalid access token or insufficient permissions'
                    });
                }
                
                return res.status(response.status).json({
                    success: false,
                    message: `Shopify API error: ${response.status}`
                });
            }

            const data = await response.json();

            if (!data.orders || data.orders.length === 0) {
                console.log('[Shopify Order API] No orders found on Shopify');
                return res.status(404).json({
                    success: false,
                    message: `No orders found. Store may have no orders yet.`
                });
            }

            console.log(`[Shopify Order API] Retrieved ${data.orders.length} orders from Shopify`);

            // Search for exact match
            order = data.orders.find(o => o.name === orderName);

            if (!order) {
                console.log(`[Shopify Order API] Order "${orderName}" not found in ${data.orders.length} orders`);
                console.log('[Shopify Order API] Available orders:', data.orders.slice(0, 5).map(o => o.name).join(', '));
                return res.status(404).json({
                    success: false,
                    message: `Order "${orderName}" not found in this store`
                });
            }
            console.log('[Shopify Order API] ✅ Order found:', order.name, 'with', order.line_items.length, 'items');

        } catch (err) {
            if (err.name === 'AbortError') {
                console.error('[Shopify Order API] Request timeout');
                return res.status(504).json({
                    success: false,
                    message: 'Request timeout - Shopify API took too long to respond'
                });
            }
            console.error('[Shopify Order API] Fetch error:', err.message);
            throw err;
        }

        // 2. Map line items to include product images and variants
        const lineItemsWithDetails = await Promise.all(order.line_items.map(async (item) => {
            // If item doesn't have a product_id, it might be a custom item
            if (!item.product_id) {
                return {
                    id: item.id,
                    title: item.title,
                    variant_title: item.variant_title,
                    quantity: item.quantity,
                    price: item.price,
                    sku: item.sku,
                    image_url: null
                };
            }

            // Fetch product to get image
            const productUrl = `https://${fullDomain}/admin/api/2024-01/products/${item.product_id}.json`;
            const productResponse = await fetch(productUrl, {
                headers: { 'X-Shopify-Access-Token': accessToken.trim() }
            });

            let imageUrl = null;
            if (productResponse.ok) {
                const productData = await productResponse.json();
                // Try to find image for this variant
                if (item.variant_id) {
                    const variantImage = productData.product.images.find(img => img.variant_ids.includes(item.variant_id));
                    imageUrl = variantImage ? variantImage.src : (productData.product.image ? productData.product.image.src : null);
                } else {
                    imageUrl = productData.product.image ? productData.product.image.src : null;
                }
            }

            return {
                id: item.id,
                product_id: item.product_id,
                variant_id: item.variant_id,
                title: item.title,
                variant_title: item.variant_title,
                quantity: item.quantity,
                price: item.price,
                sku: item.sku,
                image_url: imageUrl
            };
        }));

        return res.json({
            success: true,
            orderId: order.id,
            orderName: order.name,
            customer: order.customer ? `${order.customer.first_name} ${order.customer.last_name}` : 'No Customer',
            lineItems: lineItemsWithDetails
        });

    } catch (error) {
        console.error('[Shopify Order API] Unexpected error:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while fetching order'
        });
    }
}
