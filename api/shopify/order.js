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

        // 1. Find the order by name
        // Shopify order names usually include the prefix, e.g., "#1001"
        const searchUrl = `https://${fullDomain}/admin/api/2024-01/orders.json?name=${encodeURIComponent(orderName)}&status=any`;

        console.log('[Shopify Order API] Searching for order:', orderName, 'at', fullDomain);

        const orderResponse = await fetch(searchUrl, {
            method: 'GET',
            headers: {
                'X-Shopify-Access-Token': accessToken.trim(),
                'Content-Type': 'application/json',
            },
        });

        if (!orderResponse.ok) {
            const errorText = await orderResponse.text();
            console.error('[Shopify Order API] Order fetch failed:', orderResponse.status, errorText);
            return res.status(orderResponse.status).json({
                success: false,
                message: `Shopify API error: ${orderResponse.statusText}`
            });
        }

        const orderData = await orderResponse.json();

        if (!orderData.orders || orderData.orders.length === 0) {
            return res.status(404).json({
                success: false,
                message: `Order "${orderName}" not found in Shopify.`
            });
        }

        const order = orderData.orders[0];
        console.log('[Shopify Order API] Found order:', order.id, 'with', order.line_items.length, 'items');

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
