
export type Size = string; // Dynamic strings now

export type UserRole = 'warehouse' | 'market_person' | 'admin';

export interface User {
  id: string;
  username: string;
  role: UserRole;
}

export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  tag?: string;
  lastUsedAt: number;
}

export interface ProductMaster {
  id: string;
  imageUrl: string; // Changed from imageBase64 to imageUrl
  imageHash: string;
  description: string;
  category?: string;
  lastSupplierId?: string; // Memory for auto-suggest
  lastPrice?: number; // Memory for auto-suggest price
  createdAt: number;
}

export type LogStatus = 'ordered' | 'picked_partial' | 'picked_full' | 'dispatched' | 'received_partial' | 'received_full' | 'discrepancy';

export interface ActionHistory {
  action: string;
  timestamp: number;
  details?: string;
  userId?: string; 
}

export interface DailyLog {
  id: string;
  productId: string;
  supplierId?: string; // Optional
  date: string; // YYYY-MM-DD
  
  hasSizes: boolean; // Toggle for dynamic sizing
  
  // Quantities
  // If hasSizes=false, use a standard key like 'Total'
  orderedQty: Record<string, number>;      // Original order qty (never changes)
  pickedQty: Record<string, number>;       // Current picked qty (can change on revisit)
  dispatchedQty: Record<string, number>;   // Cumulative dispatched qty
  receivedQty: Record<string, number>;
  
  price?: number; // Purchase price per unit

  status: LogStatus;
  notes?: string;
  pickupProofUrl?: string; // Optional image proof of pickup/dispatch
  history: ActionHistory[];
}

export interface ProductSignature {
  description: string;
  keywords: string[];
  category: string;
}

export interface PreviewMetadata {
  title?: string;
  qty?: string;
  sizeDetails?: string;
  price?: string;
  tag?: string; // e.g. "PICKUP PROOF"
}

export interface ShopifyLineItem {
  id: string;
  title: string;
  variant_title?: string;
  quantity: number;
  price: number;
  sku?: string;
  image_url?: string;
  product_id?: string;
  variant_id?: string;
}

export type ShopifyOrderStatus = 'pending' | 'confirmed' | 'dispatched' | 'delivered' | 'cancelled' | 'archived';

export interface ShopifyOrder {
  id: string;
  orderName: string; // E.g., "#1001"
  shopName?: string;
  shopifyDomain: string;
  lineItems: ShopifyLineItem[];
  totalPrice?: number;
  customerEmail?: string;
  customerName?: string;
  status: ShopifyOrderStatus;
  createdAt: number; // Firebase timestamp
  syncedAt: number; // When order was synced to app
  notes?: string;
}

export type PurchaseOrderStatus = 'pending' | 'confirmed' | 'partial_received' | 'completed' | 'cancelled';

export interface PurchaseOrderItem {
  id: string; // Daily log ID
  productId: string;
  title: string;
  quantity: Record<string, number>;
  price: number;
  hasSizes: boolean;
  imageUrl?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string; // Auto-generated PO number
  supplierId?: string;
  supplierName: string;
  supplierPhone?: string;
  items: PurchaseOrderItem[];
  totalAmount: number; // Sum of all items with quantities
  status: PurchaseOrderStatus;
  createdAt: number;
  updatedAt: number;
  linkedShopifyOrderId?: string; // Reference to Shopify order if created from scan
  notes?: string;
  history: ActionHistory[];
}

export interface AppState {
  suppliers: Supplier[];
  products: ProductMaster[];
  dailyLogs: DailyLog[];
  shopifyOrders?: ShopifyOrder[]; // Optional for backward compatibility
  purchaseOrders?: PurchaseOrder[]; // Optional for backward compatibility
}
