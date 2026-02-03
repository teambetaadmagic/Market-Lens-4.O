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

        // 1. Find the order by name with timeout handling and multiple search strategies
        const fetchOrder = async (searchParams, description = '') => {
            const searchUrl = `https://${fullDomain}/admin/api/2024-01/orders.json?${searchParams}&limit=250&status=any`;
            console.log('[Shopify Order API]', description, 'Searching with URL params:', searchParams);
            
            try {
                // Create an abort controller with 30-second timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);
                
                const res = await fetch(searchUrl, {
                    method: 'GET',
                    cache: 'no-store',
                    signal: controller.signal,
                    headers: {
                        'X-Shopify-Access-Token': accessToken.trim(),
                        'Content-Type': 'application/json',
                    },
                });
                
                clearTimeout(timeoutId);
                
                if (!res.ok) {
                    console.warn(`[Shopify Order API] ${description} - Non-OK response: ${res.status} from ${fullDomain}`);
                    return null;
                }
                
                const data = await res.json();
                if (data.orders && data.orders.length > 0) {
                    console.log('[Shopify Order API]', description, `Found ${data.orders.length} matching orders`);
                    return data.orders[0];
                }
                console.log('[Shopify Order API]', description, 'No orders found');
                return null;
            } catch (err) {
                if (err.name === 'AbortError') {
                    console.error(`[Shopify Order API] ${description} - Request timeout for ${fullDomain}`);
                } else {
                    console.error(`[Shopify Order API] ${description} - Fetch error for ${fullDomain}:`, err.message);
                }
                return null;
            }
        };

        // Try multiple search strategies in sequence
        let order = null;

        // Strategy 1: Try exact name match with # (as provided)
        order = await fetchOrder(`name=${encodeURIComponent(orderName)}`, 'Strategy 1 (exact name)');
        
        // Strategy 2: Use financial_status for better search
        if (!order) {
            order = await fetchOrder(`name=${encodeURIComponent(orderName)}&financial_status=paid`, 'Strategy 2 (paid orders)');
        }

        // Strategy 3: Use fulfillment_status for better search
        if (!order) {
            order = await fetchOrder(`name=${encodeURIComponent(orderName)}&fulfillment_status=fulfilled`, 'Strategy 3 (fulfilled orders)');
        }

        // Strategy 4: Loose search with query parameter (Shopify's fallback search)
        if (!order) {
            order = await fetchOrder(`query=${encodeURIComponent(orderName)}`, 'Strategy 4 (loose query search)');
        }

        // Strategy 5: Search all orders and filter client-side (last resort for hundreds of orders)
        if (!order) {
            console.log('[Shopify Order API] Strategy 5 - Searching all recent orders...');
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);
                
                const res = await fetch(`https://${fullDomain}/admin/api/2024-01/orders.json?limit=250&status=any&order=created_at:desc`, {
                    method: 'GET',
                    cache: 'no-store',
                    signal: controller.signal,
                    headers: {
                        'X-Shopify-Access-Token': accessToken.trim(),
                        'Content-Type': 'application/json',
                    },
                });
                
                clearTimeout(timeoutId);
                
                if (res.ok) {
                    const data = await res.json();
                    
                    if (data.orders && data.orders.length > 0) {
                        // Search by exact order name (with #)
                        order = data.orders.find(o => o.name === orderName);
                        
                        if (order) {
                            console.log('[Shopify Order API] Strategy 5 - Found order in recent orders:', order.name);
                        } else {
                            console.log('[Shopify Order API] Strategy 5 - Order not found in recent orders');
                        }
                    }
                }
            } catch (err) {
                console.warn('[Shopify Order API] Strategy 5 failed:', err.message);
            }
        }

        if (!order) {
            console.log('[Shopify Order API] Order not found in any strategy for:', orderName);
            return res.status(404).json({
                success: false,
                message: `Order "${orderName}" not found in Shopify. Tried 5 different search strategies.`
            });
        }

        console.log('[Shopify Order API] Found order:', order.name, 'with', order.line_items.length, 'items');

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
