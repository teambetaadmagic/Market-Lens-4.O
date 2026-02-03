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
        let pageInfo = null;

        // Fetch orders with pagination and filter client-side for more reliable search
        const searchOrdersWithPagination = async () => {
            console.log('[Shopify Order API] Using pagination-based search...');
            
            try {
                let hasNextPage = true;
                let cursor = null;
                let searchAttempts = 0;
                const maxAttempts = 5; // Search through up to 5 pages (250 orders per page)

                while (hasNextPage && searchAttempts < maxAttempts && !order) {
                    searchAttempts++;
                    console.log(`[Shopify Order API] Searching page ${searchAttempts}...`);

                    // Create request URL with pagination
                    let url = `https://${fullDomain}/admin/api/2024-01/orders.json?limit=250&status=any&order=created_at:desc`;
                    if (cursor) {
                        url += `&after=${cursor}`;
                    }

                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 30000);

                    const res = await fetch(url, {
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
                        console.warn(`[Shopify Order API] Non-OK response: ${res.status}`);
                        return null;
                    }

                    const data = await res.json();
                    
                    if (data.orders && data.orders.length > 0) {
                        console.log(`[Shopify Order API] Found ${data.orders.length} orders on page ${searchAttempts}`);
                        
                        // Search for exact match
                        order = data.orders.find(o => o.name === orderName);
                        
                        if (order) {
                            console.log('[Shopify Order API] ✅ Order found:', order.name);
                            return order;
                        }
                    }

                    // Check for next page
                    const linkHeader = res.headers.get('link');
                    hasNextPage = linkHeader && linkHeader.includes('rel="next"');
                    
                    if (hasNextPage) {
                        // Extract cursor from link header
                        const nextMatch = linkHeader.match(/after=([^&;]+)/);
                        cursor = nextMatch ? nextMatch[1] : null;
                    }
                }

                return order;
            } catch (err) {
                console.error('[Shopify Order API] Pagination search error:', err.message);
                return null;
            }
        };

        // Use pagination-based search (more reliable than API search parameter)
        order = await searchOrdersWithPagination();

        if (!order) {
            console.log('[Shopify Order API] Order not found in pagination search for:', orderName);
            return res.status(404).json({
                success: false,
                message: `Order "${orderName}" not found in Shopify after searching recent orders.`
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
