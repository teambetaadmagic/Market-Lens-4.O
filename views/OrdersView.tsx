import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Search, Plus, Loader2, Save, Clock, Trash2, Image as ImageIcon, Layers, Minus, Plus as PlusIcon, Banknote, Phone, Send, Edit2, X, Copy, Share2, ChevronDown, ChevronUp, FileText, Check, MessageCircle, Calendar, Tag, Lock, GitMerge, AlertCircle, Info, ScanLine as Scan } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { Html5QrcodeScanner, Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { DailyLog, PurchaseOrderItem, Supplier } from '../types';
import { computeImageHash, compressImage } from '../services/geminiService';
import { canEditView } from '../utils/permissions';
import { saveShopifyOrder, recordProductSupplierAssignment } from '../services/firestore';

const QUICK_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'];

export const OrdersView: React.FC = () => {
    const { suppliers, addOrUpdateDailyLog, findProductByHash, dailyLogs, products, getTodayDate, updateSupplier, updateLogSupplier, updateLogDetails, deleteLog, setPreviewImage, user, mergeLogsManual, fetchShopifyOrder, savePurchaseOrder, getMostRecentSupplierForProduct } = useStore();

    // Check if user can edit this view
    const canEdit = user ? canEditView(user.role, 'orders') : false;

    // State
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSharing, setIsSharing] = useState(false);
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);

    const [draftImage, setDraftImage] = useState<string | null>(null);
    const [draftHash, setDraftHash] = useState<string>("");

    // Options
    const [description, setDescription] = useState("");
    const [hasSizes, setHasSizes] = useState(false);
    const [price, setPrice] = useState('');

    // Supplier Input State
    const [supplierInput, setSupplierInput] = useState("");
    const [supplierPhone, setSupplierPhone] = useState("");
    const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

    // PO Modal State
    const [poModalOpen, setPoModalOpen] = useState(false);
    const [poImage, setPoImage] = useState<string | null>(null);
    const [poLogs, setPoLogs] = useState<DailyLog[]>([]);
    const [poSupplierData, setPoSupplierData] = useState<{ name: string, phone: string, total: number } | null>(null);
    const [isGeneratingPO, setIsGeneratingPO] = useState(false);

    // Quantity State
    const [quantities, setQuantities] = useState<Record<string, string>>({ '': '' });
    const [totalQty, setTotalQty] = useState('');

    // Merge Mode State
    const [mergeMode, setMergeMode] = useState(false);
    const [selectedForMerge, setSelectedForMerge] = useState<Set<string>>(new Set());

    // History Modal State
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedHistoryLog, setSelectedHistoryLog] = useState<DailyLog | null>(null);

    // Barcode Scanner State
    const [showScanner, setShowScanner] = useState(false);
    const [isScanning, setIsScanning] = useState(false);
    const [scanStatus, setScanStatus] = useState<'idle' | 'searching' | 'processing' | 'success' | 'error'>('idle');
    const [scanError, setScanError] = useState<string | null>(null);
    const [scannedOrder, setScannedOrder] = useState<any>(null);
    const [lastScannedBarcode, setLastScannedBarcode] = useState<string>('');
    const [barcodeDetected, setBarcodeDetected] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Function to detect duplicate/mergeable entries (same product, same supplier)
    const detectMergeableDuplicates = useMemo(() => {
        const duplicateGroups: Record<string, DailyLog[]> = {};

        dailyLogs
            .filter(l => ['ordered', 'picked_partial', 'picked_full', 'dispatched'].includes(l.status))
            .forEach(log => {
                const key = `${log.productId}--${log.supplierId || 'unknown'}`;
                if (!duplicateGroups[key]) {
                    duplicateGroups[key] = [];
                }
                duplicateGroups[key].push(log);
            });

        // Only return groups with 2+ entries
        return Object.entries(duplicateGroups)
            .filter(([_, logs]) => logs.length > 1)
            .map(([_, logs]) => logs.sort((a, b) => a.history[0]?.timestamp || 0 - (b.history[0]?.timestamp || 0)));
    }, [dailyLogs]);

    // Derived: Duplicate Check
    const duplicateProduct = useMemo(() => {
        if (!draftHash) return null;
        return findProductByHash(draftHash);
    }, [draftHash, findProductByHash]);

    const filteredSuppliers = useMemo(() => {
        if (!supplierInput) return suppliers.slice(0, 5);
        return suppliers
            .filter(s => s.name.toLowerCase().includes(supplierInput.toLowerCase()))
            .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
            .slice(0, 5);
    }, [suppliers, supplierInput]);

    // Derived: Orders Grouped by Supplier Only (no date grouping)
    const groupedOrders = useMemo(() => {
        // Filter for ALL ordered items, not just today's
        const activeLogs = dailyLogs.filter(l => l.status === 'ordered');

        // Group by Supplier only
        const supplierMap: Record<string, DailyLog[]> = {};

        activeLogs.forEach(log => {
            let supName = 'Unassigned';
            // If supplierId is missing, check if we can resolve it from product history or keep unassigned
            if (log.supplierId) {
                const s = suppliers.find(sup => sup.id === log.supplierId);
                if (s) supName = s.name;
            }
            if (!supplierMap[supName]) supplierMap[supName] = [];
            supplierMap[supName].push(log);
        });

        // Create supplier groups
        const supplierGroups = Object.entries(supplierMap).map(([supName, logs]) => {
            const firstLog = logs[0];
            const supplier = suppliers.find(s => s.id === firstLog.supplierId);

            const totalAmount = logs.reduce((sum, log) => {
                const qty = Object.values(log.orderedQty).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
                return sum + (qty * (log.price || 0));
            }, 0);

            const totalQty = logs.reduce((sum, log) => {
                return sum + Object.values(log.orderedQty).reduce<number>((a, b) => a + (Number(b) || 0), 0);
            }, 0);

            return {
                name: supName,
                id: firstLog.supplierId || 'unknown',
                phone: supplier?.phone,
                tag: supplier?.tag,
                logs: logs.sort((a, b) => (b.history[0]?.timestamp || 0) - (a.history[0]?.timestamp || 0)),
                totalAmount,
                totalQty
            };
        });

        // Return as single group with all suppliers sorted by total amount
        return [{
            dateLabel: '',
            suppliers: supplierGroups.sort((a, b) => b.totalAmount - a.totalAmount)
        }];
    }, [dailyLogs, suppliers]);

    const grandTotalQty = useMemo(() => {
        return groupedOrders.reduce((acc, dateGroup) => {
            return acc + dateGroup.suppliers.reduce((sAcc, sup) => sAcc + sup.totalQty, 0);
        }, 0);
    }, [groupedOrders]);

    const handleMergeSelected = async () => {
        if (selectedForMerge.size < 2) {
            alert("Select at least 2 entries to merge");
            return;
        }

        const logsToMerge = Array.from(selectedForMerge)
            .map(id => dailyLogs.find(l => l.id === id))
            .filter((l): l is DailyLog => !!l);

        if (logsToMerge.length < 2) return;

        // Sort by timestamp - first one is target
        logsToMerge.sort((a, b) => (a.history[0]?.timestamp || 0) - (b.history[0]?.timestamp || 0));

        const targetLog = logsToMerge[0];
        const sourceLogIds = logsToMerge.slice(1).map(l => l.id);

        try {
            // Merge all source logs into target one by one
            for (const sourceId of sourceLogIds) {
                await mergeLogsManual(sourceId, targetLog.id);
            }

            alert(`Successfully merged ${sourceLogIds.length} entries!`);
            setSelectedForMerge(new Set());
            setMergeMode(false);
        } catch (e) {
            console.error("Merge failed:", e);
            alert("Failed to merge entries");
        }
    };

    const processFile = (file: File) => {
        setIsAnalyzing(true);
        setDraftImage(null);
        setQuantities({ '': '' });
        setTotalQty('');
        setPrice('');
        setDescription('');

        const reader = new FileReader();
        reader.onloadend = async () => {
            const rawBase64 = reader.result;

            if (typeof rawBase64 === 'string') {
                const compressedBase64 = await compressImage(rawBase64);
                setDraftImage(compressedBase64);

                const hash = await computeImageHash(compressedBase64);
                setDraftHash(hash);

                const existing = findProductByHash(hash);
                if (existing) {
                    setDescription(existing.description);
                    if (existing.lastSupplierId) {
                        const lastSup = suppliers.find(s => s.id === existing.lastSupplierId);
                        if (lastSup) {
                            setSupplierInput(lastSup.name);
                            setSupplierPhone(lastSup.phone || "");
                        }
                    }
                    if (existing.lastPrice !== undefined) {
                        setPrice(existing.lastPrice.toString());
                    }
                } else {
                    // New Item - Manual Entry (AI Removed)
                    setDescription("Item");
                }
                setIsAnalyzing(false);
            } else {
                setIsAnalyzing(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        // Check permission first
        if (!canEdit) {
            alert('You do not have permission to place purchase orders');
            return;
        }

        const fileList = e.target.files;
        if (!fileList || fileList.length === 0) return;

        // Fix: Explicitly cast to File[] to avoid unknown type inference issues
        const files = Array.from(fileList) as File[];

        setHasSizes(false);
        setSupplierInput("");
        setSupplierPhone("");

        const first = files[0];
        const rest = files.slice(1);

        setPendingFiles(rest);
        processFile(first);
    };

    const handleSave = async () => {
        console.log('[handleSave] Starting save process...');
        if (!draftImage || isSaving) return;

        const cleanQuantities: Record<string, number> = {};
        let total = 0;

        if (hasSizes) {
            Object.entries(quantities).forEach(([size, qtyStr]) => {
                const q = parseInt(String(qtyStr));
                if (size && !isNaN(q) && q > 0) {
                    cleanQuantities[size] = q;
                    total += q;
                }
            });
        } else {
            const q = parseInt(totalQty);
            if (!isNaN(q) && q > 0) {
                cleanQuantities['Total'] = q;
                total += q;
            }
        }

        if (total === 0) {
            alert("Please enter at least one quantity");
            return;
        }

        try {
            setIsSaving(true);
            const priceVal = price ? parseFloat(price) : undefined;
            console.log('[handleSave] Calling addOrUpdateDailyLog with:', { description, quantities: cleanQuantities, supplierInput });
            await addOrUpdateDailyLog(
                draftImage,
                draftHash,
                cleanQuantities,
                hasSizes,
                supplierInput || undefined,
                description || "Item",
                priceVal,
                supplierPhone || undefined
            );
            console.log('[handleSave] Successfully saved!');

            if (pendingFiles.length > 0) {
                const nextFile = pendingFiles[0];
                const remaining = pendingFiles.slice(1);
                setPendingFiles(remaining);
                if (nextFile) processFile(nextFile as File);
            } else {
                setDraftImage(null);
                setDraftHash("");
                setSupplierInput("");
                setSupplierPhone("");
                setQuantities({ '': '' });
                setTotalQty('');
                setHasSizes(false);
                setPrice('');
                setDescription('');
            }
        } catch (e: any) {
            console.error("Save failed", e);
            const msg = (e as any)?.message || "Unknown error";
            alert(`Failed to save: ${msg}`);
        } finally {
            setIsSaving(false);
        }
    };

    const addSizeRow = () => {
        setQuantities(prev => ({ ...prev, [`Size ${Object.keys(prev).length + 1}`]: '' }));
    };

    const addQuickSize = (size: string) => {
        const exists = Object.keys(quantities).some(k => k.toLowerCase() === size.toLowerCase());
        if (exists) return;

        const newQ = { ...quantities };
        if (Object.keys(newQ).length === 1 && Object.keys(newQ)[0] === '' && newQ[''] === '') {
            delete newQ[''];
        }

        setQuantities(prev => {
            const updated = { ...prev };
            if (Object.keys(updated).length === 1 && Object.keys(updated)[0] === '' && updated[''] === '') {
                delete updated[''];
            }
            return { ...updated, [size]: '' };
        });
    };

    const removeSizeRow = (key: string) => {
        const next = { ...quantities };
        delete next[key];
        setQuantities(next);
    };

    const adjustQuantity = (key: string, delta: number) => {
        setQuantities(prev => {
            const val = prev[key];
            const current = val === '' ? 0 : parseInt(val);
            if (isNaN(current)) return { ...prev, [key]: delta > 0 ? delta.toString() : '' };

            const next = Math.max(0, current + delta);
            return { ...prev, [key]: next === 0 ? '' : next.toString() };
        });
    };

    const adjustTotalQty = (delta: number) => {
        const current = totalQty === '' ? 0 : parseInt(totalQty);
        if (isNaN(current)) {
            setTotalQty(delta > 0 ? delta.toString() : '');
            return;
        }
        const next = Math.max(0, current + delta);
        setTotalQty(next === 0 ? '' : next.toString());
    };

    // --- BARCODE SCANNER LOGIC ---
    const scannerRef = useRef<Html5Qrcode | null>(null);
    const initStartedRef = useRef(false);

    useEffect(() => {
        if (showScanner && !initStartedRef.current) {
            initStartedRef.current = true;
            setLastScannedBarcode(''); // Reset last scanned barcode when opening scanner
            const startScanner = async () => {
                try {
                    // Reset error state and set processing immediately
                    setScanError(null);
                    setScanStatus('processing');

                    // 1. Check secure context
                    if (!window.isSecureContext) {
                        throw new Error("HTTPS_REQUIRED");
                    }

                    // 2. Clear any existing instance
                    if (scannerRef.current) {
                        try { await scannerRef.current.stop(); } catch (e) { }
                        scannerRef.current = null;
                    }

                    // 3. Wait for DOM element using requestAnimationFrame (faster than setTimeout)
                    await new Promise<void>((resolve) => {
                        const checkDOM = () => {
                            if (document.getElementById("barcode-reader")) {
                                resolve();
                            } else {
                                requestAnimationFrame(checkDOM);
                            }
                        };
                        requestAnimationFrame(checkDOM);
                    });

                    const html5QrCode = new Html5Qrcode("barcode-reader");
                    scannerRef.current = html5QrCode;

                    const config = {
                        fps: 30,
                        qrbox: { width: 280, height: 160 },
                        aspectRatio: 1.0,
                        disableFlip: false,
                        formatsToSupport: [
                            Html5QrcodeSupportedFormats.QR_CODE,
                            Html5QrcodeSupportedFormats.CODE_128,
                            Html5QrcodeSupportedFormats.CODE_39,
                            Html5QrcodeSupportedFormats.UPC_A,
                            Html5QrcodeSupportedFormats.UPC_E,
                            Html5QrcodeSupportedFormats.EAN_13,
                        ]
                    };

                    // Start with environment camera (back camera on mobile)
                    try {
                        await html5QrCode.start(
                            { facingMode: "environment" },
                            config,
                            (decodedText) => {
                                const trimmedText = decodedText.trim();
                                // Only process if this is a new barcode
                                if (trimmedText && trimmedText !== lastScannedBarcode) {
                                    if (navigator.vibrate) navigator.vibrate(100);
                                    setLastScannedBarcode(trimmedText);
                                    setBarcodeDetected(true);
                                    // Auto-fill the input field with scanned barcode
                                    const input = document.getElementById('order-input') as HTMLInputElement;
                                    if (input) {
                                        input.value = trimmedText;
                                        input.focus();
                                    }
                                    // Reset visual feedback after 1.5 seconds
                                    setTimeout(() => setBarcodeDetected(false), 1500);
                                }
                            },
                            () => { }
                        );
                        setScanStatus('idle');
                    } catch (envErr: any) {
                        console.warn("Environment camera failed:", envErr.message);
                        
                        // Try to get list of available cameras
                        try {
                            const cameras = await Html5Qrcode.getCameras();
                            if (!cameras || cameras.length === 0) {
                                throw new Error("NO_CAMERAS_FOUND");
                            }

                            // Fallback to first available camera
                            await html5QrCode.start(
                                cameras[0].id,
                                config,
                                (decodedText) => {
                                    const trimmedText = decodedText.trim();
                                    // Only process if this is a new barcode
                                    if (trimmedText && trimmedText !== lastScannedBarcode) {
                                        if (navigator.vibrate) navigator.vibrate(100);
                                        setLastScannedBarcode(trimmedText);
                                        setBarcodeDetected(true);
                                        // Auto-fill the input field with scanned barcode
                                        const input = document.getElementById('order-input') as HTMLInputElement;
                                        if (input) {
                                            input.value = trimmedText;
                                            input.focus();
                                        }
                                        // Reset visual feedback after 1.5 seconds
                                        setTimeout(() => setBarcodeDetected(false), 1500);
                                    }
                                },
                                () => { }
                            );
                            setScanStatus('idle');
                        } catch (fallbackErr: any) {
                            throw fallbackErr;
                        }
                    }
                } catch (err: any) {
                    console.error("Scanner Error:", err);

                    let friendlyError = "Camera access failed.";

                    if (err.message === "HTTPS_REQUIRED") {
                        friendlyError = "Camera blocked. Site must be on HTTPS.";
                    } else if (err.message === "NO_CAMERAS_FOUND") {
                        friendlyError = "No camera found on device.";
                    } else if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
                        friendlyError = "Camera permission denied. Try again.";
                    } else if (err.name === 'NotReadableError') {
                        friendlyError = "Camera is in use by another app.";
                    } else if (err.name === 'NotFoundError') {
                        friendlyError = "No camera device found.";
                    } else {
                        friendlyError = err.message?.substring(0, 50) || "Camera error.";
                    }

                    setScanError(friendlyError);
                    setScanStatus('error');
                    initStartedRef.current = false;
                }
            };

            startScanner();
        }

        // Cleanup: only stop scanner when component unmounts or showScanner is explicitly set to false
        return () => {
            // Only clean up if scanner was explicitly closed by user
            if (!showScanner && initStartedRef.current) {
                initStartedRef.current = false;
                if (scannerRef.current && scannerRef.current.isScanning) {
                    scannerRef.current.stop().catch(() => { });
                    scannerRef.current = null;
                }
            }
        };
    }, [showScanner]);

    const stopScanner = async () => {
        if (scannerRef.current) {
            try {
                if (scannerRef.current.isScanning) {
                    await scannerRef.current.stop();
                }
            } catch (err) {
                console.warn("Failed to stop scanner:", err);
            } finally {
                scannerRef.current = null;
            }
        }
        initStartedRef.current = false;
        setLastScannedBarcode(''); // Reset last scanned barcode
        setBarcodeDetected(false);
        setShowScanner(false);
        setScanStatus('idle');
    };

    const handleOrderScan = async (orderName: string) => {
        if (!orderName || !orderName.trim()) return;

        // Clean order name - Shopify orders often look like #1001 or 1001
        let cleanedName = orderName.trim();
        if (!cleanedName.startsWith('#') && /^\d+$/.test(cleanedName)) {
            cleanedName = `#${cleanedName}`;
        }

        console.log('[handleOrderScan] Starting scan with order:', cleanedName);
        setScanStatus('searching');
        setScanError(null);
        setScannedOrder(null);
        
        // Close scanner immediately - processing happens in background
        await stopScanner();

        try {
            console.log('[handleOrderScan] Calling fetchShopifyOrder with:', cleanedName);
            const orderData = await fetchShopifyOrder(cleanedName);
            console.log('[handleOrderScan] Successfully fetched order:', orderData);
            
            if (!orderData || !orderData.lineItems || orderData.lineItems.length === 0) {
                throw new Error("No items found in order");
            }

            setScanStatus('processing');

            // 1. Save Shopify order to Firebase
            const shopifyOrderId = await saveShopifyOrder(orderData);
            console.log('[OrdersView] Saved Shopify order to Firebase:', shopifyOrderId);

            // 2. Automatically create logs for each line item
            const logsCreated: DailyLog[] = [];
            let itemsProcessed = 0;

            for (const item of orderData.lineItems) {
                if (item.image_url) {
                    try {
                        console.log(`[OrdersView] Processing item: ${item.title}, Variant: ${item.variant_title}, Qty: ${item.quantity}`);
                        
                        // Fetch and convert image to base64
                        const imgRes = await fetch(item.image_url);
                        const blob = await imgRes.blob();
                        const reader = new FileReader();
                        const base64Promise = new Promise<string>((resolve) => {
                            reader.onloadend = () => resolve(reader.result as string);
                            reader.readAsDataURL(blob);
                        });

                        const imageBase64 = await base64Promise;
                        const compressedBase64 = await compressImage(imageBase64);
                        const hash = await computeImageHash(compressedBase64);

                        // Prepare quantities with size/variant
                        const itemQtys: Record<string, number> = {};
                        const hasSizes = item.variant_title && item.variant_title !== 'Default Title';
                        const itemSize = hasSizes ? item.variant_title : undefined;
                        
                        if (hasSizes) {
                            itemQtys[item.variant_title] = item.quantity;
                            console.log(`[OrdersView] Added size: ${item.variant_title} = ${item.quantity}`);
                        } else {
                            itemQtys['Total'] = item.quantity;
                            console.log(`[OrdersView] Added quantity: Total = ${item.quantity}`);
                        }

                        // Check if this product has a supplier history for auto-assignment
                        const productId = `shopify_${item.product_id || item.id}`;
                        const supplierHistory = getMostRecentSupplierForProduct(productId);
                        let autoAssignedSupplierName: string | undefined = undefined;
                        
                        if (supplierHistory && supplierHistory.supplierId !== 'unknown') {
                            autoAssignedSupplierName = supplierHistory.supplierName;
                            console.log(`[OrdersView] ✅ Auto-assigned to supplier: ${supplierHistory.supplierName}`);
                        }

                        // Save to daily logs - with auto-assigned supplier if available
                        await addOrUpdateDailyLog(
                            compressedBase64,
                            hash,
                            itemQtys,
                            hasSizes,
                            autoAssignedSupplierName, // auto-assigned supplier
                            `Item from order ${orderData.orderName}`, // generic description
                            undefined, // NO price
                            undefined // no supplier phone
                        );
                        logsCreated.push(item.title);
                        itemsProcessed++;
                        console.log(`[OrdersView] ✅ Processed item successfully`);
                    } catch (imgErr) {
                        console.error(`[OrdersView] Failed to process image for ${item.title}:`, imgErr);
                    }
                } else {
                    console.warn(`[OrdersView] Skipping item without image: ${item.title}`);
                }
            }

            if (itemsProcessed === 0) {
                throw new Error("Failed to process any items from the order - no items with images found");
            }
            
            console.log(`[OrdersView] Successfully processed ${itemsProcessed} items from order`);

            // 3. Create a Purchase Order from the Shopify order
            try {
                const poItems: PurchaseOrderItem[] = orderData.lineItems
                    .filter((item: any) => item.image_url) // Only items with images
                    .map((item: any, idx: number) => ({
                        id: `item_${Date.now()}_${idx}`,
                        productId: `shopify_${item.id}`,
                        title: item.title,
                        quantity: { 
                            [item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title : 'Total']: item.quantity 
                        },
                        price: 0, // NO price
                        hasSizes: !!(item.variant_title && item.variant_title !== 'Default Title'),
                        imageUrl: item.image_url
                    }));

                console.log(`[OrdersView] Creating PO with ${poItems.length} items from Shopify order`);

                await savePurchaseOrder({
                    supplierId: undefined,
                    supplierName: `Shopify - ${orderData.shopName || orderData.shopifyDomain}`,
                    supplierPhone: undefined,
                    items: poItems,
                    totalAmount: 0, // NO total amount
                    status: 'confirmed',
                    linkedShopifyOrderId: shopifyOrderId,
                    notes: `Auto-created from Shopify order ${cleanedName} - ${itemsProcessed} items scanned`,
                    history: [
                        {
                            action: 'created_from_shopify',
                            timestamp: Date.now(),
                            details: `Created from Shopify order ${cleanedName}`,
                            userId: user?.id
                        }
                    ]
                });
                console.log('[OrdersView] ✅ Purchase order created successfully');
            } catch (poErr) {
                console.error('[OrdersView] Failed to create purchase order:', poErr);
                // Continue anyway - daily logs were created successfully
            }

            setScanStatus('success');
            // Keep success message visible for 4 seconds then auto-dismiss
            setTimeout(() => {
                setScanStatus('idle');
                setScannedOrder(null);
                setScanError(null);
            }, 4000);
        } catch (err: any) {
            console.error("[handleOrderScan] ERROR:", err);
            console.error("[handleOrderScan] Error message:", err?.message);
            console.error("[handleOrderScan] Error code:", err?.code);
            
            let errorMsg = err.message || "Failed to process order. Try again.";
            
            // Provide specific error messages
            if (errorMsg.includes('permission-denied')) {
                errorMsg = "❌ Firestore permission denied. Check security rules.";
            } else if (errorMsg.includes('not found')) {
                errorMsg = `❌ Order not found. Check the order number and try again.`;
            } else if (errorMsg.includes('No Shopify stores')) {
                errorMsg = "❌ No Shopify stores connected. Add a store in Settings first.";
            } else if (errorMsg.includes('401') || errorMsg.includes('Unauthorized')) {
                errorMsg = "❌ Invalid Shopify access token. Check your credentials in Settings.";
            }
            
            setScanError(errorMsg);
            setScanStatus('error');
            
            // Keep error visible for 5 seconds
            setTimeout(() => {
                setScanStatus('idle');
                setScannedOrder(null);
                setScanError(null);
            }, 5000);
        }
    };


    // --- RECEIPT GENERATION LOGIC ---

    const generateReceipt = async (supplierName: string, logs: DailyLog[], totalAmount: number) => {
        setIsGeneratingPO(true);
        setPoModalOpen(true);
        setPoImage(null);
        setPoLogs(logs); // Store logs for individual image generation
        const phone = suppliers.find(s => s.name === supplierName)?.phone || '';
        setPoSupplierData({ name: supplierName, phone, total: totalAmount });

        try {
            // ... (Existing Canvas Logic) ...
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const HEADER_HEIGHT = 180;
            const ITEM_HEIGHT = 140;
            const FOOTER_HEIGHT = 120;
            const WIDTH = 800;
            const PADDING = 40;
            const totalHeight = HEADER_HEIGHT + (logs.length * ITEM_HEIGHT) + FOOTER_HEIGHT;
            canvas.width = WIDTH;
            canvas.height = totalHeight;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, WIDTH, totalHeight);
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, WIDTH, HEADER_HEIGHT - 40);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 40px sans-serif';
            ctx.fillText('PURCHASE ORDER', PADDING, 70);
            ctx.fillStyle = '#9CA3AF';
            ctx.font = '24px sans-serif';
            ctx.fillText(getTodayDate(), PADDING, 110);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 32px sans-serif';
            ctx.fillText(supplierName, WIDTH - PADDING, 70);
            ctx.fillStyle = '#60A5FA';
            ctx.font = '24px sans-serif';
            ctx.fillText(`${logs.length} Items`, WIDTH - PADDING, 110);
            ctx.textAlign = 'left';
            const imagePromises = logs.map(log => {
                const product = products.find(p => p.id === log.productId);
                return new Promise<HTMLImageElement | null>((resolve) => {
                    if (!product?.imageUrl) { resolve(null); return; }
                    const img = new Image();
                    img.crossOrigin = "Anonymous";
                    img.src = product.imageUrl;
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null);
                });
            });
            const loadedImages = await Promise.all(imagePromises);
            let currentY = HEADER_HEIGHT;
            logs.forEach((log, index) => {
                const product = products.find(p => p.id === log.productId);
                const img = loadedImages[index];
                ctx.beginPath();
                ctx.moveTo(PADDING, currentY);
                ctx.lineTo(WIDTH - PADDING, currentY);
                ctx.strokeStyle = '#E5E7EB';
                ctx.lineWidth = 2;
                ctx.stroke();
                const THUMB_SIZE = 100;
                const thumbY = currentY + 20;
                if (img) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect(PADDING, thumbY, THUMB_SIZE, THUMB_SIZE, 12);
                    ctx.clip();
                    const aspect = img.width / img.height;
                    let sw, sh, sx, sy;
                    if (aspect > 1) {
                        sh = img.height;
                        sw = img.height;
                        sx = (img.width - img.height) / 2;
                        sy = 0;
                    } else {
                        sw = img.width;
                        sh = img.width;
                        sx = 0;
                        sy = (img.height - img.width) / 2;
                    }
                    ctx.drawImage(img, sx, sy, sw, sh, PADDING, thumbY, THUMB_SIZE, THUMB_SIZE);
                    ctx.restore();
                } else {
                    ctx.fillStyle = '#F3F4F6';
                    ctx.fillRect(PADDING, thumbY, THUMB_SIZE, THUMB_SIZE);
                }
                const TEXT_X = PADDING + THUMB_SIZE + 30;
                ctx.fillStyle = '#111827';
                ctx.font = 'bold 28px sans-serif';
                const desc = product?.description || 'Item';
                ctx.fillText(desc.substring(0, 30) + (desc.length > 30 ? '...' : ''), TEXT_X, thumbY + 35);
                ctx.fillStyle = '#4B5563';
                ctx.font = '22px sans-serif';
                let qtyText = '';
                let totalItemQty = 0;
                if (log.hasSizes) {
                    const parts = Object.entries(log.orderedQty).map(([k, v]) => `${k}:${v}`);
                    qtyText = parts.join('  ');
                    totalItemQty = Object.values(log.orderedQty).reduce<number>((a, b) => a + (Number(b) || 0), 0);
                } else {
                    totalItemQty = log.orderedQty['Total'] || 0;
                    qtyText = `Qty: ${totalItemQty}`;
                }
                ctx.fillText(qtyText, TEXT_X, thumbY + 70);
                if (log.price) {
                    const amount = totalItemQty * log.price;
                    ctx.textAlign = 'right';
                    ctx.fillStyle = '#111827';
                    ctx.font = 'bold 28px sans-serif';
                    ctx.fillText(`₹${amount.toLocaleString()}`, WIDTH - PADDING, thumbY + 35);
                    ctx.fillStyle = '#6B7280';
                    ctx.font = '22px sans-serif';
                    ctx.fillText(`@ ₹${log.price}`, WIDTH - PADDING, thumbY + 70);
                    ctx.textAlign = 'left';
                }
                currentY += ITEM_HEIGHT;
            });
            ctx.fillStyle = '#F9FAFB';
            ctx.fillRect(0, currentY, WIDTH, FOOTER_HEIGHT);
            ctx.beginPath();
            ctx.moveTo(0, currentY);
            ctx.lineTo(WIDTH, currentY);
            ctx.strokeStyle = '#E5E7EB';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = '#111827';
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText('Grand Total', PADDING, currentY + 75);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#059669';
            ctx.font = 'bold 42px sans-serif';
            ctx.fillText(`₹${totalAmount.toLocaleString()}`, WIDTH - PADDING, currentY + 75);
            setPoImage(canvas.toDataURL('image/jpeg', 0.8));
        } catch (e) {
            console.error("Failed to generate receipt", e);
            alert("Could not generate receipt image.");
        } finally {
            setIsGeneratingPO(false);
        }
    };

    const handleShare = async () => {
        if (!poImage || isSharing) return;
        setIsSharing(true);
        try {
            const files: File[] = [];

            // 1. Receipt Image (Always first)
            const receiptBlob = await (await fetch(poImage)).blob();
            files.push(new File([receiptBlob], "00_PO_Receipt.jpg", { type: "image/jpeg" }));

            // 2. Individual Item Images
            for (let i = 0; i < poLogs.length; i++) {
                const log = poLogs[i];
                const product = products.find(p => p.id === log.productId);
                if (product?.imageUrl) {
                    try {
                        const res = await fetch(product.imageUrl);
                        const blob = await res.blob();
                        let ext = "jpg";
                        if (blob.type === "image/png") ext = "png";
                        else if (blob.type === "image/webp") ext = "webp";

                        const filename = `${String(i + 1).padStart(2, '0')}_Item.${ext}`;
                        files.push(new File([blob], filename, { type: blob.type }));
                    } catch (e) {
                        console.error("Error fetching product image for share", e);
                    }
                }
            }

            if (navigator.share) {
                const shareData = {
                    title: `PO: ${poSupplierData?.name}`,
                    files: files
                };

                // Check if we can share this payload
                if (navigator.canShare && navigator.canShare(shareData)) {
                    await navigator.share(shareData);
                } else {
                    // Fallback: Try sharing ONLY the receipt if the bundle is too big/invalid
                    if (files.length > 1 && navigator.canShare({ files: [files[0]] })) {
                        alert("Cannot share all images at once (limit reached). Sharing receipt only.");
                        await navigator.share({
                            title: 'Purchase Order',
                            files: [files[0]]
                        });
                    } else {
                        alert("Sharing not supported for these files.");
                    }
                }
            } else {
                alert("Sharing not supported on this device/browser. Please use 'Copy Receipt'.");
            }
        } catch (e: any) {
            if (e.name === 'AbortError' || e.message?.toLowerCase().includes('canceled')) { return; }
            console.error("Share failed", e);

            // Last resort fallback: Download the receipt
            const link = document.createElement('a');
            link.href = poImage;
            link.download = `PO_${poSupplierData?.name}_${getTodayDate()}.jpg`;
            link.click();
        } finally {
            setIsSharing(false);
        }
    };

    const handleCopy = async () => {
        if (!poImage) return;
        try {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = poImage;
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error("Canvas init failed");
            ctx.drawImage(img, 0, 0);
            const pngBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
            if (!pngBlob) throw new Error("Blob creation failed");
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
            alert("Receipt Image copied! Paste it in WhatsApp.");
        } catch (e) {
            alert("Copy failed. Try the Download button.");
        }
    };



    // Helper function to generate watermarked image for a product while preserving original format
    const generateWatermarkedImage = async (log: DailyLog, product: any, supplierName?: string): Promise<{ blob: Blob; mimeType: string } | null> => {
        if (!product?.imageUrl) return null;

        return new Promise(async (resolve) => {
            try {
                // First, fetch the original image to get its format
                const originalResponse = await fetch(product.imageUrl);
                const originalBlob = await originalResponse.blob();
                const originalMimeType = originalBlob.type || 'image/jpeg';

                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = product.imageUrl;

                img.onload = () => {
                    // Get the original aspect ratio - PRESERVE THIS EXACTLY
                    const originalWidth = img.width;
                    const originalHeight = img.height;
                    const originalAspect = originalWidth / originalHeight;

                    // Use higher resolution for better quality when sharing
                    const MAX_DIMENSION = 1200; // Higher resolution for sharing

                    // Calculate canvas dimensions to preserve aspect ratio
                    let canvasWidth: number;
                    let canvasHeight: number;

                    if (originalAspect >= 1) { // Landscape or square
                        canvasWidth = MAX_DIMENSION;
                        canvasHeight = Math.round(MAX_DIMENSION / originalAspect);
                    } else { // Portrait
                        canvasHeight = MAX_DIMENSION;
                        canvasWidth = Math.round(MAX_DIMENSION * originalAspect);
                    }

                    const canvas = document.createElement('canvas');
                    canvas.width = canvasWidth;
                    canvas.height = canvasHeight;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        resolve(null);
                        return;
                    }

                    // Debug: Log canvas dimensions to verify aspect ratio
                    console.log(`[Watermark] Canvas: ${canvasWidth}x${canvasHeight}, Original: ${originalWidth}x${originalHeight}, Aspect: ${originalAspect.toFixed(2)}`);

                    // 1. Draw Image (with original aspect ratio preserved)
                    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvasWidth, canvasHeight);

                    // 2. Overlay (centered middle with proportional sizing)
                    const overlayWidthRatio = 0.84; // 84% of canvas width
                    const overlayHeightRatio = 0.26; // 26% of canvas height
                    const rectW = Math.round(canvasWidth * overlayWidthRatio);
                    const rectH = Math.round(canvasHeight * overlayHeightRatio);
                    const rectX = (canvasWidth - rectW) / 2;
                    const rectY = (canvasHeight - rectH) / 2;
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.fillRect(rectX, rectY, rectW, rectH);

                    // 3. Text (centered)
                    const totalQty = Object.values(log.orderedQty).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
                    let line1 = `Total Qty: ${totalQty}`;
                    let line2 = "";
                    if (log.hasSizes) {
                        line2 = Object.entries(log.orderedQty).map(([k, v]) => `${k}:${v}`).join('  ');
                    }

                    const centerX = canvasWidth / 2; // canvas center
                    const fontSizeBase = Math.round(canvasHeight * 0.064); // Scale font based on canvas height
                    const supplierFontSize = Math.round(canvasHeight * 0.044);
                    const sizesFontSize = Math.round(canvasHeight * 0.044);

                    ctx.textAlign = 'center';
                    ctx.fillStyle = '#ffffff';
                    ctx.font = `bold ${fontSizeBase}px sans-serif`;
                    const line1Y = rectY + Math.round(rectH * 0.35);
                    ctx.fillText(line1, centerX, line1Y);

                    // Supplier Name Line
                    if (supplierName) {
                        ctx.font = `${supplierFontSize}px sans-serif`;
                        ctx.fillStyle = '#60a5fa'; // Blue-400
                        const supplierY = rectY + Math.round(rectH * 0.65);
                        ctx.fillText(`Supplier: ${supplierName}`, centerX, supplierY);
                    }

                    if (line2) {
                        ctx.font = `${sizesFontSize}px sans-serif`;
                        ctx.fillStyle = '#fbbf24'; // Amber-400
                        const line2Y = rectY + Math.round(rectH * (supplierName ? 0.95 : 0.78));
                        // If the sizes text is too long, reduce font size to fit
                        const maxWidth = rectW - Math.round(rectW * 0.12);
                        let measured = ctx.measureText(line2).width;
                        let fontSize = sizesFontSize;
                        while (measured > maxWidth && fontSize > Math.round(canvasHeight * 0.024)) {
                            fontSize -= 2;
                            ctx.font = `${fontSize}px sans-serif`;
                            measured = ctx.measureText(line2).width;
                        }
                        ctx.fillText(line2, centerX, line2Y);
                    }
                    ctx.textAlign = 'start';

                    // Export as JPEG with high quality to preserve watermark and aspect ratio
                    canvas.toBlob((blob) => {
                        if (blob) {
                            resolve({ blob, mimeType: 'image/jpeg' });
                        } else {
                            resolve(null);
                        }
                    }, 'image/jpeg', 0.9);
                };

                img.onerror = () => {
                    resolve(null);
                };
            } catch (e) {
                console.error("Error in watermark generation:", e);
                resolve(null);
            }
        });
    };
    const openWhatsAppText = async () => {
        if (!poSupplierData?.phone) return;

        const phoneNumber = poSupplierData.phone.replace(/[^0-9]/g, '');

        // Calculate total items quantity
        let totalItemsQty = 0;
        poLogs.forEach(log => {
            totalItemsQty += Object.values(log.orderedQty).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
        });

        const message = `*PURCHASE ORDER*\nDate: ${getTodayDate()}\nSupplier: ${poSupplierData.name}\nTotal Items: ${totalItemsQty}\nTotal Amount: ₹${poSupplierData.total.toLocaleString()}\n\nImages attached above 👆`;

        // Collect WATERMARKED images for all items (with aspect ratio preserved)
        const images: { blob: Blob; filename: string; mimeType: string }[] = [];

        for (let i = 0; i < poLogs.length; i++) {
            const log = poLogs[i];
            const product = products.find(p => p.id === log.productId);

            if (product?.imageUrl) {
                try {
                    const watermarked = await generateWatermarkedImage(log, product, poSupplierData?.name);
                    if (watermarked) {
                        let ext = 'jpg';
                        if (watermarked.mimeType === 'image/png') ext = 'png';
                        else if (watermarked.mimeType === 'image/webp') ext = 'webp';
                        const filename = `Item_${String(i + 1).padStart(2, '0')}_${product.description?.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
                        images.push({ blob: watermarked.blob, filename, mimeType: watermarked.mimeType });
                    }
                } catch (e) {
                    console.error("Error generating watermarked image", e);
                }
            }
        }

        // Try to share directly via native API (works with WhatsApp on mobile)
        if (navigator.share && images.length > 0) {
            try {
                const files = images.map(({ blob, filename, mimeType }) =>
                    new File([blob], filename, { type: mimeType })
                );

                const shareData = {
                    title: `PO: ${poSupplierData.name}`,
                    files: files
                };

                if (navigator.canShare && navigator.canShare(shareData)) {
                    // Native share with files - will open WhatsApp directly on mobile
                    await navigator.share(shareData);
                    return;
                } else if (navigator.canShare({ files: [files[0]] })) {
                    // Fallback: try sharing just the first image
                    await navigator.share({
                        title: `PO: ${poSupplierData.name}`,
                        files: [files[0]]
                    });
                    return;
                }
            } catch (e: any) {
                if (e.name === 'AbortError') {
                    // User cancelled, don't show error
                    return;
                }
                console.warn('Native share unavailable, using WhatsApp Web:', e);
            }
        }

        // Open WhatsApp Web with pre-filled message
        const encodedMessage = encodeURIComponent(message);
        const whatsappLink = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
        window.open(whatsappLink, '_blank');
    };

    // Function to send PO for individual vendor
    const sendVendorPO = async (vendorName: string, vendorPhone: string | undefined, logs: DailyLog[]) => {
        // Calculate total items quantity
        let totalItemsQty = 0;
        logs.forEach(log => {
            totalItemsQty += Object.values(log.orderedQty).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
        });

        // Calculate total amount
        const totalAmount = logs.reduce((sum, log) => {
            const qty = Object.values(log.orderedQty).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
            return sum + (qty * (log.price || 0));
        }, 0);

        const message = `*PURCHASE ORDER*\nDate: ${getTodayDate()}\nSupplier: ${vendorName}\nTotal Items: ${totalItemsQty}\nTotal Amount: ₹${totalAmount.toLocaleString()}\n\nImages attached above 👆`;

        // Collect WATERMARKED images for all items (with aspect ratio preserved)
        const images: { blob: Blob; filename: string; mimeType: string }[] = [];

        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            const product = products.find(p => p.id === log.productId);

            if (product?.imageUrl) {
                try {
                    const watermarked = await generateWatermarkedImage(log, product, vendorName);
                    if (watermarked) {
                        let ext = 'jpg';
                        if (watermarked.mimeType === 'image/png') ext = 'png';
                        else if (watermarked.mimeType === 'image/webp') ext = 'webp';
                        const filename = `Item_${String(i + 1).padStart(2, '0')}_${product.description?.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
                        images.push({ blob: watermarked.blob, filename, mimeType: watermarked.mimeType });
                    }
                } catch (e) {
                    console.error("Error generating watermarked image", e);
                }
            }
        }

        if (images.length === 0) {
            alert('No images to share');
            return;
        }

        // Try native share API first (works on mobile and some desktop browsers)
        if (navigator.share) {
            try {
                const files = images.map(({ blob, filename, mimeType }) =>
                    new File([blob], filename, { type: mimeType })
                );

                const shareData = {
                    title: `PO: ${vendorName}`,
                    files: files.length > 0 ? files : undefined
                };

                if (navigator.canShare && navigator.canShare(shareData)) {
                    // Native share with files
                    await navigator.share(shareData);
                    return;
                } else if (files.length > 0 && navigator.canShare({ files: [files[0]] })) {
                    // Try sharing just the first image
                    await navigator.share({
                        title: `PO: ${vendorName}`,
                        files: [files[0]]
                    });
                    return;
                }
            } catch (e: any) {
                if (e.name === 'AbortError') {
                    return;
                }
                console.warn('Native share failed:', e);
            }
        }

        // If phone is available, open WhatsApp Web
        if (vendorPhone) {
            const phoneNumber = vendorPhone.replace(/[^0-9]/g, '');

            // Copy first image to clipboard
            try {
                const firstImage = images[0];
                await navigator.clipboard.write([new ClipboardItem({ 'image/jpeg': firstImage.blob })]);
                alert(`Images copied! Click OK to open WhatsApp for ${vendorName}.\nPaste the images in the chat.`);
            } catch (e) {
                console.error("Copy to clipboard failed", e);
            }

            // Open WhatsApp Web with pre-filled message
            const encodedMessage = encodeURIComponent(message);
            const whatsappLink = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
            window.open(whatsappLink, '_blank');
        } else {
            // No phone available - copy first image to clipboard and prompt user
            try {
                const firstImage = images[0];
                await navigator.clipboard.write([new ClipboardItem({ 'image/jpeg': firstImage.blob })]);
                alert(`Images copied for ${vendorName}!\n\nNo phone number available.\n\nYou can:\n1. Paste images in your messaging app\n2. Add a phone number to this vendor to enable WhatsApp sharing`);
            } catch (e) {
                console.error("Copy to clipboard failed", e);
                alert(`Unable to copy images. Please add a phone number for ${vendorName} to send via WhatsApp.`);
            }
        }
    };

    return (
        <div className="pb-24 pt-0 px-3 max-w-lg mx-auto min-h-screen">
            {/* Read-Only Banner */}
            {!canEdit && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <Lock size={18} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-800">Read-only mode: You can view but cannot edit purchase orders</p>
                </div>
            )}

            {/* Sticky Native Header */}
            <div className="flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-30 py-3 mb-4 border-b border-gray-100 -mx-3 px-4">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Purchase Entry</h1>
                <div className="flex gap-2">
                    {false && <button
                        onClick={() => setMergeMode(!mergeMode)}
                        className={`${mergeMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'} px-3 py-1.5 rounded-full shadow-md hover:opacity-90 transition active:scale-95 flex items-center gap-1.5 text-xs font-bold`}
                        title="Merge duplicate entries"
                    >
                        <GitMerge size={16} />
                        <span>Merge</span>
                        {dailyLogs.filter(l => l.status === 'ordered').length > 1 && (
                            <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
                                {dailyLogs.filter(l => l.status === 'ordered').length}
                            </span>
                        )}
                    </button>}
                    <button
                        onClick={() => setShowScanner(true)}
                        className="bg-blue-600 text-white px-3 py-1.5 rounded-full shadow-md hover:bg-blue-700 transition active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
                        disabled={isSaving || !canEdit || scanStatus === 'searching'}
                    >
                        {scanStatus === 'searching' ? <Loader2 className="animate-spin" size={16} /> : <Scan size={16} strokeWidth={2.5} />}
                        <span className="font-bold text-xs">Scan Label</span>
                    </button>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-gray-900 text-white px-3 py-1.5 rounded-full shadow-md hover:bg-black transition active:scale-95 flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={isSaving || !canEdit}
                    >
                        <Plus size={16} strokeWidth={2.5} />
                        <span className="font-bold text-xs">New Order</span>
                    </button>
                </div>
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={!canEdit}
                />
            </div>

            {!draftImage && groupedOrders.length === 0 && (
                <div className="flex flex-col items-center justify-center mt-20 text-gray-400 animate-in fade-in slide-in-from-bottom-4">
                    <div
                        onClick={() => canEdit && fileInputRef.current?.click()}
                        className="w-20 h-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center mb-4 cursor-pointer active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <ImageIcon size={32} className="opacity-40" />
                    </div>
                    <p className="font-medium text-sm text-gray-500">No orders yet</p>
                    <p className="text-xs mt-1">Scan a shipping label or tap "New Order"</p>
                </div>
            )}

            {/* SCANNER MODAL */}
            {showScanner && (
                <div className="fixed inset-0 z-[9999] bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
                    <div className="w-full max-w-md bg-white rounded-[2.5rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="font-bold text-gray-900">Scan Shipping Label</h3>
                                <p className="text-[10px] text-gray-500 font-medium">Position the barcode inside the frame</p>
                            </div>
                            <button onClick={() => setShowScanner(false)} className="p-2 bg-gray-200 rounded-full hover:bg-gray-300 transition">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="relative bg-black group overflow-hidden">
                            <div id="barcode-reader" className="w-full min-h-[350px] flex items-center justify-center">
                                {scanStatus === 'error' ? (
                                    <div className="flex flex-col items-center gap-4 text-center px-10">
                                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500">
                                            <AlertCircle size={32} />
                                        </div>
                                        <div>
                                            <p className="text-white font-bold text-sm">Failed to open camera</p>
                                            <p className="text-white/60 text-xs mt-1">{scanError || "Check device permissions"}</p>
                                        </div>
                                        <button
                                            onClick={() => setShowScanner(false)}
                                            className="px-6 py-2 bg-white text-black rounded-full font-bold text-xs"
                                        >
                                            Close
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-3 text-white/50">
                                        <Loader2 className="animate-spin" size={32} />
                                        <span className="text-xs font-medium">Initializing Camera...</span>
                                    </div>
                                )}
                            </div>
                            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                                <div className="w-[280px] h-[160px] border-2 border-white/50 rounded-xl relative overflow-hidden">
                                    <div className="scanning-line"></div>
                                </div>
                                <p className="text-white/70 text-[10px] mt-4 font-medium px-4 text-center">
                                    Scan Order Barcode or 1D Shipping Label
                                </p>
                            </div>
                        </div>

                        <div className="p-6 bg-white border-t space-y-4">
                            <div className="flex flex-col items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Order Number</p>
                                    {barcodeDetected && (
                                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 py-1 rounded-full animate-pulse">
                                            ✓ Scanned
                                        </span>
                                    )}
                                </div>
                                <div className="flex w-full gap-2">
                                    <input
                                        type="text"
                                        id="order-input"
                                        placeholder="Order # (e.g. 1001)"
                                        className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold outline-none transition-all ${barcodeDetected 
                                            ? 'bg-green-50 border-2 border-green-500 focus:ring-2 focus:ring-green-500' 
                                            : 'bg-gray-100 border-none focus:ring-2 focus:ring-blue-500'
                                        }`}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const input = (e.target as HTMLInputElement).value;
                                                if (input.trim()) {
                                                    handleOrderScan(input);
                                                }
                                            }
                                        }}
                                        autoFocus
                                    />
                                    <button
                                        onClick={(e) => {
                                            const input = document.getElementById('order-input') as HTMLInputElement;
                                            if (input && input.value.trim()) {
                                                handleOrderScan(input.value);
                                            }
                                        }}
                                        className="bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-700 transition font-bold flex items-center gap-2 active:scale-95"
                                    >
                                        <Plus size={20} />
                                        <span className="text-sm">ADD</span>
                                    </button>
                                </div>
                            </div>
                            <p className="text-center text-[10px] text-gray-400">
                                Scan barcode or enter order number manually
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* SCAN RESULT MODAL - Show scanned order details (HIDDEN - Auto-processes) */}
            {false && scannedOrder && scanStatus !== 'idle' && !showScanner && (
                <div className="fixed inset-0 z-[9998] bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
                    <div className="w-full max-w-md bg-white rounded-[2rem] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-8">
                        {/* Header */}
                        <div className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white">
                                    <Scan size={24} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-900">Order Found</h3>
                                    <p className="text-sm text-blue-600 font-bold">{scannedOrder?.orderName}</p>
                                </div>
                            </div>
                        </div>

                        {/* Order Info */}
                        <div className="p-6 border-b space-y-4">
                            <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wide">Order Number</p>
                                <p className="text-2xl font-bold text-gray-900">{scannedOrder?.orderName}</p>
                            </div>

                            <div>
                                <p className="text-xs text-gray-500 uppercase font-bold tracking-wide mb-2">Items ({scannedOrder?.lineItems?.length || 0})</p>
                                <div className="space-y-2">
                                    {scannedOrder?.lineItems?.map((item: any, idx: number) => (
                                        <div key={idx} className="flex gap-3 bg-gray-50 rounded-lg p-3">
                                            {item.image_url && (
                                                <img src={item.image_url} alt={item.title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-sm text-gray-900 truncate">{item.title}</p>
                                                <p className="text-xs text-gray-600">
                                                    {item.variant_title && item.variant_title !== 'Default Title' ? item.variant_title : 'Standard'}
                                                </p>
                                                <p className="text-xs font-bold text-blue-600 mt-1">
                                                    Qty: {item.quantity}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Status Message */}
                        <div className="p-6 border-t bg-gray-50">
                            {scanStatus === 'searching' && (
                                <div className="flex items-center gap-3">
                                    <Loader2 className="animate-spin text-blue-600" size={20} />
                                    <div>
                                        <p className="font-bold text-sm text-gray-900">Searching Shopify...</p>
                                        <p className="text-xs text-gray-600">Looking in connected stores</p>
                                    </div>
                                </div>
                            )}
                            {scanStatus === 'processing' && (
                                <div className="flex items-center gap-3">
                                    <Layers className="animate-pulse text-amber-500" size={20} />
                                    <div>
                                        <p className="font-bold text-sm text-gray-900">Processing...</p>
                                        <p className="text-xs text-gray-600">Fetching images and creating entries</p>
                                    </div>
                                </div>
                            )}
                            {scanStatus === 'success' && (
                                <div className="flex items-center gap-3">
                                    <Check className="text-green-600" size={20} />
                                    <div>
                                        <p className="font-bold text-sm text-gray-900">Products Added!</p>
                                        <p className="text-xs text-gray-600">All items have been added to your purchase list</p>
                                    </div>
                                </div>
                            )}
                            {scanStatus === 'error' && (
                                <div className="flex items-center gap-3">
                                    <AlertCircle className="text-red-600" size={20} />
                                    <div>
                                        <p className="font-bold text-sm text-gray-900">Error</p>
                                        <p className="text-xs text-gray-600">{scanError || "Failed to process order"}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="p-6 border-t space-y-3">
                            {scanStatus === 'success' && (
                                <button
                                    onClick={() => {
                                        setScannedOrder(null);
                                        setScanStatus('idle');
                                        setScanError(null);
                                    }}
                                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition"
                                >
                                    Scan Another Order
                                </button>
                            )}
                            {(scanStatus === 'searching' || scanStatus === 'processing') && (
                                <div className="text-center">
                                    <p className="text-xs text-gray-500">Please wait...</p>
                                </div>
                            )}
                            {scanStatus === 'error' && (
                                <button
                                    onClick={() => {
                                        setScannedOrder(null);
                                        setScanStatus('idle');
                                        setScanError(null);
                                        setShowScanner(true);
                                    }}
                                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition"
                                >
                                    Try Again
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SCAN STATUS NOTIFICATION */}
            {scanStatus !== 'idle' && !showScanner && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                    <div className="animate-in zoom-in-95 duration-300">
                        {scanStatus === 'searching' && (
                            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm pointer-events-auto">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Loader2 className="animate-spin text-blue-600" size={28} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-900 text-base">Searching...</p>
                                        <p className="text-sm text-gray-600 mt-1">Looking up order in Shopify</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {scanStatus === 'processing' && (
                            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm pointer-events-auto">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Layers className="animate-pulse text-amber-600" size={28} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-900 text-base">Processing...</p>
                                        <p className="text-sm text-gray-600 mt-1">Creating purchase entries</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {scanStatus === 'success' && (
                            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm pointer-events-auto animate-in slide-in-from-bottom-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <Check className="text-green-600" size={28} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-900 text-base">Order Added!</p>
                                        <p className="text-sm text-gray-600 mt-1">Products created successfully</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {scanStatus === 'error' && (
                            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm pointer-events-auto">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                                        <AlertCircle className="text-red-600" size={28} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-900 text-base">Scan Failed</p>
                                        <p className="text-sm text-gray-600 mt-1">{scanError || "Unable to process order"}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* INPUT SECTION */}
            {
                draftImage && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-in zoom-in-95 duration-200 p-4 mb-6">
                        <div className="flex gap-4 items-start">
                            {/* LEFT SIDE: IMAGE */}
                            <div className="w-24 flex-shrink-0">
                                <div className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden shadow-inner">
                                    <img
                                        src={draftImage}
                                        className="w-full h-full object-cover cursor-pointer"
                                        alt="Product"
                                        onClick={() => setPreviewImage(draftImage)}
                                    />

                                    {isAnalyzing && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                                            <Loader2 className="animate-spin text-white" size={20} />
                                        </div>
                                    )}

                                    {pendingFiles.length > 0 && (
                                        <div className="absolute bottom-1 right-1 left-1 bg-black/60 text-white py-0.5 rounded-md text-[9px] font-bold backdrop-blur-md flex items-center justify-center gap-1">
                                            <Layers size={10} />
                                            <span>+{pendingFiles.length}</span>
                                        </div>
                                    )}
                                </div>

                                {duplicateProduct && !isAnalyzing && (
                                    <div className="mt-2 text-[9px] font-bold leading-tight text-center text-green-700 bg-green-50 rounded-md border border-green-100 p-1 flex items-center justify-center gap-1">
                                        <Clock size={10} /> Known Item
                                    </div>
                                )}
                            </div>

                            {/* RIGHT SIDE: CONTROLS */}
                            <div className="flex-1 min-w-0 flex flex-col gap-3">

                                {/* Description Input */}
                                <div className="relative">
                                    <div className="absolute left-3 top-2.5 text-gray-400">
                                        <Tag size={16} />
                                    </div>
                                    <input
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-gray-100 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl outline-none font-bold text-sm text-gray-900 placeholder:text-gray-400 transition-all"
                                        placeholder="Product Name"
                                        disabled={isAnalyzing}
                                    />
                                </div>

                                {/* Supplier Input (Filled Style) */}
                                <div className="relative z-10">
                                    <div className="relative">
                                        <input
                                            value={supplierInput}
                                            onChange={(e) => {
                                                setSupplierInput(e.target.value);
                                                setShowSupplierDropdown(true);
                                            }}
                                            onFocus={() => setShowSupplierDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
                                            className="w-full pl-3 pr-8 py-2 bg-gray-100 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-xl outline-none font-bold text-sm text-gray-900 placeholder:text-gray-400 transition-all"
                                            placeholder="Supplier..."
                                        />
                                        <Search className="absolute right-3 top-2.5 text-gray-400" size={16} />
                                    </div>

                                    {/* Dropdown */}
                                    {showSupplierDropdown && supplierInput && (
                                        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-100 rounded-xl shadow-xl max-h-40 overflow-y-auto z-20">
                                            {filteredSuppliers.map(s => (
                                                <button
                                                    key={s.id}
                                                    onClick={() => {
                                                        setSupplierInput(s.name);
                                                        setSupplierPhone(s.phone || "");
                                                        setShowSupplierDropdown(false);
                                                    }}
                                                    className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                                                >
                                                    <span className="font-bold text-gray-800 text-sm block">{s.name}</span>
                                                    {s.phone && <span className="text-xs text-gray-400">{s.phone}</span>}
                                                </button>
                                            ))}
                                            {!filteredSuppliers.find(s => s.name.toLowerCase() === supplierInput.toLowerCase()) && (
                                                <div className="px-4 py-3 text-xs text-blue-600 bg-blue-50 font-bold">
                                                    Create new: "{supplierInput}"
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Phone Input (if supplier exists) */}
                                {supplierInput && (
                                    <div className="relative animate-in fade-in slide-in-from-top-2">
                                        <input
                                            type="tel"
                                            value={supplierPhone}
                                            onChange={(e) => setSupplierPhone(e.target.value)}
                                            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium text-xs text-gray-800"
                                            placeholder="Phone (Optional)"
                                        />
                                        <Phone className="absolute left-3 top-2 text-gray-400" size={14} />
                                    </div>
                                )}

                                <div className="flex gap-3 items-center">
                                    {/* Size Toggle */}
                                    <div className="flex items-center gap-2">
                                        <label className="relative inline-flex items-center cursor-pointer scale-75 origin-left">
                                            <input type="checkbox" checked={hasSizes} onChange={e => setHasSizes(e.target.checked)} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                        </label>
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Sizes</span>
                                    </div>

                                    {/* Price Input */}
                                    <div className="flex-1 flex items-center relative">
                                        <div className="absolute left-3 text-gray-400">
                                            <Banknote size={16} />
                                        </div>
                                        <input
                                            type="number"
                                            className="w-full pl-9 pr-3 py-1.5 bg-gray-100 rounded-xl text-sm font-bold text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            placeholder="Price"
                                            value={price}
                                            onChange={e => setPrice(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Quantities Area */}
                                <div className="flex-1 flex flex-col gap-3 mt-1">
                                    {hasSizes ? (
                                        <>
                                            <div className="flex flex-wrap gap-1.5">
                                                {QUICK_SIZES.map(size => {
                                                    const isSelected = Object.keys(quantities).includes(size);
                                                    return (
                                                        <button
                                                            key={size}
                                                            onClick={() => addQuickSize(size)}
                                                            disabled={isSelected}
                                                            className={`px-3 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${isSelected
                                                                ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200 opacity-50'
                                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                                }`}
                                                        >
                                                            {size}
                                                        </button>
                                                    );
                                                })}
                                                <button
                                                    onClick={addSizeRow}
                                                    className="px-3 py-2 border-2 border-dashed border-blue-200 rounded-lg text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors flex items-center justify-center min-w-[40px]"
                                                    title="Add Custom Size"
                                                >
                                                    <Plus size={16} strokeWidth={3} />
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                {Object.entries(quantities).map(([key, qtyVal], idx) => (
                                                    <div key={idx} className="flex items-center gap-2 animate-in slide-in-from-left-2">
                                                        <input
                                                            className="w-14 bg-gray-100 py-2 rounded-lg font-bold text-xs text-gray-800 uppercase text-center focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                            placeholder="SZ"
                                                            value={key.startsWith('Size ') ? '' : key}
                                                            onChange={(e) => {
                                                                const newQ = { ...quantities };
                                                                const val = newQ[key];
                                                                delete newQ[key];
                                                                newQ[e.target.value] = val;
                                                                setQuantities(newQ);
                                                            }}
                                                        />

                                                        <div className="flex-1 flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                                                            <button
                                                                onClick={() => adjustQuantity(key, -1)}
                                                                className="h-6 w-8 flex items-center justify-center bg-white rounded border border-gray-200 shadow-sm text-gray-600 active:bg-gray-50"
                                                            >
                                                                <Minus size={14} strokeWidth={2.5} />
                                                            </button>

                                                            <input
                                                                type="number"
                                                                className="flex-1 bg-transparent text-center font-bold text-base text-gray-900 focus:outline-none p-0"
                                                                value={qtyVal}
                                                                placeholder="0"
                                                                onChange={(e) => {
                                                                    setQuantities(prev => ({ ...prev, [key]: e.target.value }));
                                                                }}
                                                            />

                                                            <button
                                                                onClick={() => adjustQuantity(key, 1)}
                                                                className="h-6 w-8 flex items-center justify-center bg-blue-600 rounded border border-blue-600 shadow-sm text-white active:bg-blue-700"
                                                            >
                                                                <PlusIcon size={14} strokeWidth={2.5} />
                                                            </button>
                                                        </div>
                                                        <button onClick={() => removeSizeRow(key)} className="w-8 h-8 flex items-center justify-center text-red-300 hover:text-red-500"><Trash2 size={16} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    ) : (
                                        <div className="mt-2">
                                            <div className="flex items-center gap-2 w-full">
                                                <button
                                                    onClick={() => adjustTotalQty(-1)}
                                                    className="h-10 w-12 flex items-center justify-center bg-white border border-gray-200 shadow-sm rounded-lg text-gray-600 active:scale-95 transition-all"
                                                >
                                                    <Minus size={18} strokeWidth={2.5} />
                                                </button>

                                                <div className="flex-1 h-10 flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg px-2">
                                                    <input
                                                        type="number"
                                                        className="w-full bg-transparent text-center font-bold text-xl text-gray-900 focus:outline-none"
                                                        placeholder="0"
                                                        value={totalQty}
                                                        onChange={(e) => setTotalQty(e.target.value)}
                                                    />
                                                </div>

                                                <button
                                                    onClick={() => adjustTotalQty(1)}
                                                    className="h-10 w-12 flex items-center justify-center bg-blue-600 border border-blue-600 shadow-md shadow-blue-100 rounded-lg text-white active:scale-95 transition-all"
                                                >
                                                    <PlusIcon size={18} strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Save Button */}
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className={`mt-2 w-full text-white py-2.5 rounded-xl font-bold text-sm shadow-md flex justify-center items-center active:scale-[0.98] transition-transform ${isSaving ? 'bg-gray-400 cursor-not-allowed' : 'bg-gray-900 hover:bg-black'}`}
                                >
                                    {isSaving ? <Loader2 size={18} className="animate-spin mr-2" /> : <Save size={18} className="inline mr-2" />}
                                    {isSaving ? "Saving..." : (pendingFiles.length > 0 ? `Save & Next (${pendingFiles.length})` : "Add to List")}
                                </button>

                            </div>
                        </div>
                    </div>
                )
            }

            {/* MERGE MODE UI */}
            {
                mergeMode && detectMergeableDuplicates.length > 0 && (
                    <div className="mt-4 mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-4">
                        <div className="flex items-start gap-2">
                            <AlertCircle size={18} className="text-blue-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <h3 className="font-bold text-sm text-blue-900 mb-1">Merge Duplicate Entries</h3>
                                <p className="text-xs text-blue-700 leading-relaxed">
                                    Found {detectMergeableDuplicates.length} group(s) of duplicate entries with the same product and supplier. Select entries to merge them together.
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setMergeMode(false);
                                    setSelectedForMerge(new Set());
                                }}
                                className="text-blue-400 hover:text-blue-600"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {detectMergeableDuplicates.map((group, groupIdx) => {
                            const firstLog = group[0];
                            const product = products.find(p => p.id === firstLog.productId);
                            const supplier = suppliers.find(s => s.id === firstLog.supplierId);

                            return (
                                <div key={groupIdx} className="bg-white p-3 rounded-lg border border-blue-100 space-y-2">
                                    <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
                                        <img
                                            src={product?.imageUrl}
                                            alt=""
                                            className="w-8 h-8 rounded object-cover"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-gray-900 truncate">{product?.description || 'Item'}</p>
                                            <p className="text-[10px] text-gray-500">{supplier?.name || 'Unassigned'}</p>
                                        </div>
                                        <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                            {group.length} entries
                                        </span>
                                    </div>

                                    <div className="space-y-1.5">
                                        {group.map(log => {
                                            const isSelected = selectedForMerge.has(log.id);
                                            const qty = Object.values(log.orderedQty).reduce((a: number, b: any) => a + (Number(b) || 0), 0);

                                            return (
                                                <label
                                                    key={log.id}
                                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer transition ${isSelected ? 'bg-blue-100' : 'hover:bg-gray-50'}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            const newSet = new Set(selectedForMerge);
                                                            if (e.target.checked) {
                                                                newSet.add(log.id);
                                                            } else {
                                                                newSet.delete(log.id);
                                                            }
                                                            setSelectedForMerge(newSet);
                                                        }}
                                                        className="w-4 h-4 accent-blue-600"
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs text-gray-700">
                                                            Qty: <span className="font-bold">{qty}</span>
                                                            {log.price && <span className="ml-2 text-gray-500">@ ₹{log.price}</span>}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400">
                                                            {new Date(log.history[0]?.timestamp || 0).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}

                        <button
                            onClick={handleMergeSelected}
                            disabled={selectedForMerge.size < 2 || !canEdit}
                            className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-blue-700 transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            <GitMerge size={16} />
                            Merge {selectedForMerge.size} Selected
                        </button>
                    </div>
                )
            }

            {/* ORDERS LIST (GROUPED BY DATE -> SUPPLIER) */}
            {
                groupedOrders.length > 0 && (
                    <div className="mt-8 space-y-6">
                        <div className="flex justify-between items-end px-2">
                            <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">
                                Order History
                            </h2>
                            <span className="text-[11px] font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded-full">Total: {grandTotalQty}</span>
                        </div>

                        <div className="space-y-4">
                            {groupedOrders[0]?.suppliers.map((supplier) => (
                                <SupplierGroupCard
                                    key={supplier.id}
                                    supplierName={supplier.name}
                                    supplierId={supplier.id}
                                    supplierPhone={supplier.phone}
                                    supplierTag={supplier.tag}
                                    totalAmount={supplier.totalAmount}
                                    totalQty={supplier.totalQty}
                                    logs={supplier.logs}
                                    products={products}
                                    availableSuppliers={suppliers}
                                    onUpdateLogs={updateLogSupplier}
                                    onUpdateDetails={updateLogDetails}
                                    onUpdatePhone={async (phone) => {
                                        if (supplier.id && supplier.id !== 'unknown') {
                                            await updateSupplier(supplier.id, { name: supplier.name, phone });
                                        }
                                    }}
                                    onUpdateTag={async (tag) => {
                                        if (supplier.id && supplier.id !== 'unknown') {
                                            await updateSupplier(supplier.id, { name: supplier.name, tag });
                                        }
                                    }}
                                    onAssignSupplier={async (selectedSupplierId: string) => {
                                        // Update all unassigned logs to the selected supplier
                                        for (const log of supplier.logs) {
                                            await updateLogSupplier(log.id, suppliers.find(s => s.id === selectedSupplierId)?.name || 'Unknown');
                                        }
                                    }}
                                    onDeleteLog={deleteLog}
                                    onGeneratePO={() => generateReceipt(supplier.name, supplier.logs, supplier.totalAmount)}
                                    onSendVendorPO={() => sendVendorPO(supplier.name, supplier.phone, supplier.logs)}
                                    canEdit={canEdit}
                                    mergeMode={mergeMode}
                                    selectedForMerge={selectedForMerge}
                                    onSelectForMerge={(logId, selected) => {
                                        const newSet = new Set(selectedForMerge);
                                        if (selected) {
                                            newSet.add(logId);
                                        } else {
                                            newSet.delete(logId);
                                        }
                                        setSelectedForMerge(newSet);
                                    }}
                                    onShowHistory={(log) => {
                                        setSelectedHistoryLog(log);
                                        setHistoryModalOpen(true);
                                    }}
                                    onMerge={handleMergeSelected}
                                />
                            ))}
                        </div>

                        {/* SUPPLIER SUMMARY - Shows breakdown of products by supplier */}
                        <div className="mt-8 pt-6 border-t border-gray-200">
                            <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-3">Product Distribution</h3>
                            <div className="grid grid-cols-2 gap-2 px-2">
                                {groupedOrders[0]?.suppliers.map((supplier) => {
                                    const totalItems = supplier.logs.reduce((sum, log) => 
                                        sum + Object.values(log.orderedQty).reduce((a, b) => a + (Number(b) || 0), 0), 0);
                                    const uniqueProducts = new Set(supplier.logs.map(l => l.productId)).size;
                                    
                                    return (
                                        <div 
                                            key={supplier.id} 
                                            className="bg-gradient-to-br from-blue-50 to-blue-50 border border-blue-200 rounded-lg p-3 hover:shadow-md transition"
                                        >
                                            <div className="text-sm font-bold text-gray-900 truncate">{supplier.name}</div>
                                            <div className="flex gap-3 mt-2 text-xs">
                                                <div className="flex flex-col">
                                                    <span className="text-gray-500 font-medium">Items</span>
                                                    <span className="text-lg font-bold text-blue-600">{totalItems}</span>
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-gray-500 font-medium">Products</span>
                                                    <span className="text-lg font-bold text-blue-600">{uniqueProducts}</span>
                                                </div>
                                            </div>
                                            {supplier.phone && (
                                                <div className="mt-2 text-[10px] text-gray-600 truncate">📞 {supplier.phone}</div>
                                            )}
                                        </div>
                                    );
                                })}
                                
                                {/* Unassigned Summary */}
                                {groupedOrders[0]?.suppliers.some(s => s.id === 'unknown') && (
                                    <div 
                                        className="bg-gradient-to-br from-amber-50 to-amber-50 border border-amber-200 rounded-lg p-3 hover:shadow-md transition"
                                    >
                                        <div className="text-sm font-bold text-gray-900">Unassigned</div>
                                        <div className="flex gap-3 mt-2 text-xs">
                                            <div className="flex flex-col">
                                                <span className="text-gray-500 font-medium">Items</span>
                                                <span className="text-lg font-bold text-amber-600">
                                                    {groupedOrders[0]?.suppliers
                                                        .find(s => s.id === 'unknown')?.logs
                                                        .reduce((sum, log) => 
                                                            sum + Object.values(log.orderedQty).reduce((a, b) => a + (Number(b) || 0), 0), 0) || 0}
                                                </span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-gray-500 font-medium">Products</span>
                                                <span className="text-lg font-bold text-amber-600">
                                                    {new Set(groupedOrders[0]?.suppliers
                                                        .find(s => s.id === 'unknown')?.logs
                                                        .map(l => l.productId) || []).size}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="mt-2 text-[10px] text-amber-700 font-medium">⚠️ Needs assignment</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* PO PREVIEW MODAL */}
            {
                poModalOpen && (
                    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm max-h-[90dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                    <FileText size={20} className="text-blue-600" />
                                    Purchase Order
                                </h3>
                                <button onClick={() => setPoModalOpen(false)} className="p-2 hover:bg-gray-200 rounded-full bg-white border border-gray-200 shadow-sm">
                                    <X size={18} className="text-gray-600" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-gray-100 p-6">
                                {isGeneratingPO ? (
                                    <div className="flex flex-col items-center justify-center py-10">
                                        <Loader2 size={32} className="text-blue-600 animate-spin mb-3" />
                                        <span className="text-sm font-bold text-gray-500">Generating Receipt...</span>
                                    </div>
                                ) : (
                                    <div className="space-y-6">
                                        {/* Main Receipt Image */}
                                        {poImage && (
                                            <div className="bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                                                <img src={poImage} className="w-full rounded-lg" alt="Receipt" />
                                            </div>
                                        )}

                                        {/* Individual Item Images */}
                                        {poLogs.length > 0 && (
                                            <div>
                                                <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 text-center">
                                                    Tap item to copy for WhatsApp
                                                </h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {poLogs.map(log => {
                                                        const product = products.find(p => p.id === log.productId);
                                                        return (
                                                            <WatermarkedCard
                                                                key={log.id}
                                                                log={log}
                                                                product={product}
                                                                supplierName={poSupplierData?.name}
                                                            />
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-white border-t border-gray-100 space-y-3 safe-area-pb">
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={handleCopy} className="flex flex-col items-center justify-center gap-1 bg-gray-50 hover:bg-gray-100 p-3 rounded-xl text-gray-800 transition active:scale-95">
                                        <Copy size={20} className="text-gray-600" />
                                        <span className="text-xs font-bold">Copy Receipt</span>
                                    </button>
                                    <button onClick={handleShare} disabled={isSharing} className="flex flex-col items-center justify-center gap-1 bg-gray-50 hover:bg-gray-100 p-3 rounded-xl text-gray-800 transition active:scale-95">
                                        <Share2 size={20} className="text-gray-600" />
                                        <span className="text-xs font-bold">{isSharing ? 'Sharing...' : 'Share All Images'}</span>
                                    </button>
                                </div>
                                <button
                                    onClick={openWhatsAppText}
                                    className="w-full bg-[#25D366] hover:bg-[#1ebd59] text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-green-100 active:scale-[0.98]"
                                >
                                    <Send size={18} />
                                    Share the details
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* HISTORY MODAL */}
            {
                historyModalOpen && selectedHistoryLog && (
                    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
                        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm max-h-[80dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
                            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                <div className="flex items-center gap-2">
                                    <GitMerge size={20} className="text-blue-600" />
                                    <h3 className="font-bold text-gray-900">Merge Details</h3>
                                </div>
                                <button
                                    onClick={() => {
                                        setHistoryModalOpen(false);
                                        setSelectedHistoryLog(null);
                                    }}
                                    className="p-2 hover:bg-gray-200 rounded-full bg-white border border-gray-200 shadow-sm"
                                >
                                    <X size={18} className="text-gray-600" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto bg-gray-50 p-3">
                                <div className="space-y-2">
                                    {selectedHistoryLog.history
                                        .filter(entry => entry.action === 'merged_entries')
                                        .map((entry, idx) => {
                                            const timestamp = new Date(entry.timestamp);
                                            const dateStr = timestamp.toLocaleString('en-GB', {
                                                day: 'numeric',
                                                month: 'short',
                                                year: '2-digit',
                                                hour: 'numeric',
                                                minute: '2-digit',
                                                hour12: true
                                            });

                                            // Extract dates from details
                                            const details = entry.details || '';
                                            const dateMatch = details.match(/Source Date: (\d+ \w+ \d{2}), Target Date: (\d+ \w+ \d{2})/);
                                            const sourceDate = dateMatch?.[1] || '';
                                            const targetDate = dateMatch?.[2] || '';
                                            const quantity = entry.quantity || 0;

                                            return (
                                                <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-shrink-0 w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                                            {idx + 1}
                                                        </div>
                                                        <div className="flex-1 text-sm">
                                                            <p className="text-gray-900 font-semibold">Qty: <span className="text-blue-600">{quantity}</span></p>
                                                            <p className="text-gray-600 text-xs">From: {sourceDate}</p>
                                                            <p className="text-gray-600 text-xs">Into: {targetDate}</p>
                                                            <p className="text-gray-500 text-[10px] mt-1">{dateStr}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    }

                                    {selectedHistoryLog.history.filter(e => e.action === 'merged_entries').length === 0 && (
                                        <div className="text-center py-8">
                                            <p className="text-gray-500 text-sm">No merge history for this entry</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="p-4 bg-white border-t border-gray-100 safe-area-pb">
                                <button
                                    onClick={() => {
                                        setHistoryModalOpen(false);
                                        setSelectedHistoryLog(null);
                                    }}
                                    className="w-full bg-gray-900 hover:bg-black text-white py-2.5 rounded-lg font-bold text-sm transition active:scale-95"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

// --- SUB COMPONENTS ---

const SupplierGroupCard: React.FC<{
    supplierName: string;
    supplierId?: string;
    supplierPhone?: string;
    supplierTag?: string;
    totalAmount: number;
    totalQty: number;
    logs: DailyLog[];
    products: any[];
    availableSuppliers: Supplier[];
    onUpdateLogs: (logId: string, name: string) => void;
    onUpdateDetails: (logId: string, qty: Record<string, number>, price?: number) => void;
    onUpdatePhone: (phone: string) => Promise<void>;
    onUpdateTag: (tag: string) => Promise<void>;
    onAssignSupplier: (supplierId: string) => Promise<void>;
    onDeleteLog: (logId: string) => void;
    onGeneratePO: () => void;
    onSendVendorPO: () => void;
    canEdit: boolean;
    mergeMode?: boolean;
    selectedForMerge?: Set<string>;
    onSelectForMerge?: (logId: string, selected: boolean) => void;
    onShowHistory?: (log: DailyLog) => void;
    onMerge?: () => void;
}> = ({ supplierName, supplierId, supplierPhone, supplierTag, totalAmount, totalQty, logs, products, availableSuppliers, onUpdateLogs, onUpdateDetails, onUpdatePhone, onUpdateTag, onAssignSupplier, onDeleteLog, onGeneratePO, onSendVendorPO, canEdit, mergeMode, selectedForMerge, onSelectForMerge, onShowHistory, onMerge }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm transition-all duration-300">
            {/* Clickable Header for Collapse */}
            <div onClick={() => setIsOpen(!isOpen)} className="cursor-pointer">
                <EditableSupplierHeader
                    supplierName={supplierName}
                    supplierId={supplierId}
                    supplierPhone={supplierPhone}
                    supplierTag={supplierTag}
                    totalAmount={totalAmount}
                    totalQty={totalQty}
                    logs={logs}
                    isOpen={isOpen}
                    onUpdateLogs={onUpdateLogs}
                    onUpdatePhone={onUpdatePhone}
                    onUpdateTag={onUpdateTag}
                    onGeneratePO={onGeneratePO}
                    onSendVendorPO={onSendVendorPO}
                    canEdit={canEdit}
                />
            </div>

            {/* Collapsible Content */}
            {isOpen && (
                <div className="divide-y divide-gray-50 animate-in slide-in-from-top-2 duration-200">
                    {logs.map(log => {
                        const product = products.find(p => p.id === log.productId);
                        const isSelected = selectedForMerge?.has(log.id) || false;

                        // Calculate total qty to ensure we only show entries with qty > 0
                        const totalQty = Object.values(log.orderedQty).reduce<number>((sum, qty) => sum + (Number(qty) || 0), 0);

                        // Skip entries with zero quantity
                        if (totalQty === 0) return null;

                        return (
                            <div key={log.id} className={mergeMode ? 'flex items-center' : ''}>
                                {mergeMode && (
                                    <label className="pl-3 flex items-center">
                                        <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={(e) => onSelectForMerge?.(log.id, e.target.checked)}
                                            className="w-5 h-5 accent-blue-600 cursor-pointer"
                                        />
                                    </label>
                                )}
                                <EditableLogItem
                                    key={log.id}
                                    log={log}
                                    product={product}
                                    supplierName={supplierName}
                                    onUpdate={(qty, pr) => onUpdateDetails(log.id, qty, pr)}
                                    onDelete={() => {
                                        if (!canEdit) {
                                            alert("You do not have permission to delete purchase orders");
                                            return;
                                        }
                                        onDeleteLog(log.id);
                                    }}
                                    canEdit={canEdit}
                                    onShowHistory={(log) => onShowHistory?.(log)}
                                    suppliers={suppliers}
                                    onSupplierChange={(supplierId, supplierName) => {
                                        updateLogSupplier(log.id, supplierName);
                                        // Record the assignment in history for auto-assignment next time
                                        recordProductSupplierAssignment(log.productId, supplierId, supplierName, 
                                            log.hasSizes ? Object.keys(log.orderedQty)[0] : undefined);
                                    }}
                                />
                            </div>
                        );
                    }).filter(Boolean)}

                    {/* Merge Button - shown when entries are selected */}
                    {mergeMode && selectedForMerge && selectedForMerge.size >= 2 && (
                        <div className="p-3 bg-blue-50 border-t border-blue-100">
                            <button
                                onClick={onMerge}
                                className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition active:scale-95 flex items-center justify-center gap-2"
                            >
                                <GitMerge size={16} />
                                Merge {selectedForMerge.size} Selected
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const WatermarkedCard: React.FC<{ log: DailyLog; product: any; supplierName?: string }> = ({ log, product, supplierName }) => {
    const [imgSrc, setImgSrc] = useState<string | null>(null);

    useEffect(() => {
        if (!product?.imageUrl) return;
        const generate = async () => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.src = product.imageUrl;
            await new Promise(r => { img.onload = r; });

            // Preserve original aspect ratio of the image
            const originalWidth = img.width;
            const originalHeight = img.height;
            const originalAspect = originalWidth / originalHeight;

            const MAX_DIMENSION = 600; // Max dimension for preview
            let canvasWidth: number;
            let canvasHeight: number;

            // Calculate canvas dimensions to preserve aspect ratio
            if (originalAspect >= 1) { // Landscape or square
                canvasWidth = MAX_DIMENSION;
                canvasHeight = Math.round(MAX_DIMENSION / originalAspect);
            } else { // Portrait
                canvasHeight = MAX_DIMENSION;
                canvasWidth = Math.round(MAX_DIMENSION * originalAspect);
            }

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // 1. Draw Image (with original aspect ratio preserved)
            ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvasWidth, canvasHeight);

            // 2. Overlay (centered middle with proportional sizing)
            const overlayWidthRatio = 0.84; // 84% of canvas width
            const overlayHeightRatio = 0.26; // 26% of canvas height
            const rectW = Math.round(canvasWidth * overlayWidthRatio);
            const rectH = Math.round(canvasHeight * overlayHeightRatio);
            const rectX = (canvasWidth - rectW) / 2;
            const rectY = (canvasHeight - rectH) / 2;
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(rectX, rectY, rectW, rectH);

            // 3. Text (centered)
            const totalQty = Object.values(log.orderedQty).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
            let line1 = `Total Qty: ${totalQty}`;
            let line2 = "";
            if (log.hasSizes) {
                line2 = Object.entries(log.orderedQty).map(([k, v]) => `${k}:${v}`).join('  ');
            }

            const centerX = canvasWidth / 2; // canvas center
            const fontSizeBase = Math.round(canvasHeight * 0.064); // Scale font based on canvas height
            const supplierFontSize = Math.round(canvasHeight * 0.044);
            const sizesFontSize = Math.round(canvasHeight * 0.044);

            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${fontSizeBase}px sans-serif`;
            const line1Y = rectY + Math.round(rectH * 0.35);
            ctx.fillText(line1, centerX, line1Y);

            // Supplier Name Line
            if (supplierName) {
                ctx.font = `${supplierFontSize}px sans-serif`;
                ctx.fillStyle = '#60a5fa'; // Blue-400
                const supplierY = rectY + Math.round(rectH * 0.65);
                ctx.fillText(`Supplier: ${supplierName}`, centerX, supplierY);
            }

            if (line2) {
                ctx.font = `${sizesFontSize}px sans-serif`;
                ctx.fillStyle = '#fbbf24'; // Amber-400
                const line2Y = rectY + Math.round(rectH * (supplierName ? 0.95 : 0.78));
                // If the sizes text is too long, reduce font size to fit
                const maxWidth = rectW - Math.round(rectW * 0.12);
                let measured = ctx.measureText(line2).width;
                let fontSize = sizesFontSize;
                while (measured > maxWidth && fontSize > Math.round(canvasHeight * 0.024)) {
                    fontSize -= 2;
                    ctx.font = `${fontSize}px sans-serif`;
                    measured = ctx.measureText(line2).width;
                }

                // Draw the sizes/line2 text centered within the overlay
                ctx.textAlign = 'center';
                ctx.fillText(line2, centerX, line2Y);
            }

            setImgSrc(canvas.toDataURL('image/jpeg', 0.85));
        };

        generate();
    }, [product, log, supplierName]);

    const copyImage = async () => {
        if (!imgSrc) return;
        try {
            const blob = await (await fetch(imgSrc)).blob();
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            alert("Image copied to clipboard!");
        } catch (e) {
            alert("Failed to copy image");
        }
    };

    if (!imgSrc) return <div className="h-40 bg-gray-100 rounded-xl animate-pulse"></div>;

    return (
        <div onClick={copyImage} className="relative group cursor-pointer active:scale-95 transition-transform">
            <img src={imgSrc} className="w-full rounded-xl border border-gray-200 shadow-sm" alt="Watermarked" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 bg-white/90 p-2 rounded-full shadow-lg transition-opacity">
                    <Copy size={20} className="text-gray-800" />
                </div>
            </div>
        </div>
    );
};

const EditableSupplierHeader: React.FC<{
    supplierName: string;
    supplierId?: string;
    supplierPhone?: string;
    supplierTag?: string;
    totalAmount: number;
    totalQty: number;
    logs: DailyLog[];
    isOpen: boolean;
    onUpdateLogs: (logId: string, name: string) => void;
    onUpdatePhone: (phone: string) => Promise<void>;
    onUpdateTag: (tag: string) => Promise<void>;
    onGeneratePO: () => void;
    onSendVendorPO: () => void;
    canEdit: boolean;
}> = ({ supplierName, supplierId, supplierPhone, supplierTag, totalAmount, totalQty, logs, isOpen, onUpdateLogs, onUpdatePhone, onUpdateTag, onGeneratePO, onSendVendorPO, canEdit }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(supplierName);

    // Phone Edit
    const [isEditingPhone, setIsEditingPhone] = useState(false);
    const [tempPhone, setTempPhone] = useState(supplierPhone || '');

    // Tag Edit
    const [isEditingTag, setIsEditingTag] = useState(false);
    const [tempTag, setTempTag] = useState(supplierTag || '');

    const handleSaveName = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canEdit) {
            alert("You do not have permission to edit supplier information");
            return;
        }
        if (!newName.trim()) return;
        logs.forEach(log => onUpdateLogs(log.id, newName));
        setIsEditing(false);
    };

    const handleSavePhone = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canEdit) {
            alert("You do not have permission to edit supplier information");
            return;
        }
        await onUpdatePhone(tempPhone);
        setIsEditingPhone(false);
    };

    const handleSaveTag = async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canEdit) {
            alert("You do not have permission to edit supplier information");
            return;
        }
        const trimmedTag = tempTag.trim();
        if (!trimmedTag) {
            alert("Please enter a tag");
            return;
        }
        if (trimmedTag.length > 20) {
            alert("Tag must be maximum 20 characters");
            return;
        }
        await onUpdateTag(trimmedTag);
        setIsEditingTag(false);
    };

    return (
        // Highlighting Supplier Header
        <div className="bg-slate-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center backdrop-blur-sm group">
            <div className="flex-1">
                {isEditing ? (
                    <div className="flex items-center gap-2 mb-1" onClick={e => e.stopPropagation()}>
                        <input
                            className="w-40 text-sm p-1.5 border border-blue-300 rounded bg-white"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            autoFocus
                        />
                        <button onClick={handleSaveName} className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-bold">OK</button>
                        <button onClick={(e) => { e.stopPropagation(); setIsEditing(false); }} className="bg-gray-200 text-gray-500 px-2 py-1 rounded text-xs"><X size={12} /></button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 mb-1">
                        {supplierId === 'unknown' ? (
                            // Show dropdown for unassigned orders
                            <select
                                onChange={(e) => {
                                    if (e.target.value && canEdit) {
                                        onAssignSupplier(e.target.value);
                                    }
                                }}
                                disabled={!canEdit}
                                className="font-bold text-base px-2 py-1 border border-blue-300 rounded bg-white text-gray-900 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:border-blue-500 focus:border-blue-600 focus:outline-none"
                                defaultValue=""
                            >
                                <option value="">Select a vendor...</option>
                                {availableSuppliers.map(sup => (
                                    <option key={sup.id} value={sup.id}>
                                        {sup.name}
                                    </option>
                                ))}
                            </select>
                        ) : (
                            <>
                                <span className="font-bold text-base text-gray-900">{supplierName}</span>
                                <button
                                    onClick={(e) => { e.stopPropagation(); if (canEdit) { setIsEditing(true); setNewName(supplierName); } }}
                                    disabled={!canEdit}
                                    className="text-gray-300 hover:text-blue-600 p-1 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Edit2 size={12} />
                                </button>
                            </>
                        )}
                    </div>
                )}

                {/* Tag & Phone Badges */}
                {supplierId && (
                    <div className="mt-1 flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {/* Tag Badge */}
                        {isEditingTag ? (
                            <div className="flex items-center gap-1">
                                <input
                                    className="w-24 text-xs p-1 border rounded bg-white focus:border-purple-600 outline-none"
                                    placeholder="Max 20 chars"
                                    value={tempTag}
                                    onChange={e => setTempTag(e.target.value.slice(0, 20))}
                                    maxLength={20}
                                    autoFocus
                                />
                                <button onClick={handleSaveTag} className="bg-purple-600 text-white text-xs px-2 py-1 rounded hover:bg-purple-700">OK</button>
                            </div>
                        ) : (
                            <>
                                {supplierTag ? (
                                    <div className="flex items-center gap-1.5 text-xs text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                        <Tag size={11} /> {supplierTag}
                                        <button
                                            onClick={() => { if (canEdit) { setIsEditingTag(true); setTempTag(supplierTag); } }}
                                            disabled={!canEdit}
                                            className="text-purple-400 hover:text-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <Edit2 size={10} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => { if (canEdit) { setIsEditingTag(true); setTempTag(''); } }}
                                        disabled={!canEdit}
                                        className="text-[10px] text-purple-700 font-bold bg-purple-100 px-2 py-0.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed hover:bg-purple-200"
                                    >
                                        + Add Tag
                                    </button>
                                )}
                            </>
                        )}

                        {/* Phone Badge */}
                        {isEditingPhone ? (
                            <div className="flex items-center gap-1">
                                <input
                                    className="w-28 text-xs p-1 border rounded bg-white"
                                    placeholder="Phone"
                                    value={tempPhone}
                                    onChange={e => setTempPhone(e.target.value)}
                                    autoFocus
                                />
                                <button onClick={handleSavePhone} className="bg-blue-600 text-white text-xs px-2 py-1 rounded">OK</button>
                            </div>
                        ) : (
                            <>
                                {supplierPhone ? (
                                    <div className="flex items-center gap-1.5 text-xs text-gray-600 font-medium">
                                        <Phone size={12} /> {supplierPhone}
                                        <button
                                            onClick={() => { if (canEdit) { setIsEditingPhone(true); setTempPhone(supplierPhone); } }}
                                            disabled={!canEdit}
                                            className="ml-1 text-gray-400 hover:text-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <Edit2 size={10} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => { if (canEdit) { setIsEditingPhone(true); setTempPhone(''); } }}
                                        disabled={!canEdit}
                                        className="text-[10px] text-blue-700 font-bold bg-blue-100 px-2 py-0.5 rounded-full disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        + Add Phone
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-2">
                    {totalAmount > 0 && (
                        <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                            ₹{totalAmount.toLocaleString()}
                        </span>
                    )}
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-md border border-gray-200 text-gray-500 shadow-sm">
                            {totalQty} Items
                        </span>
                        <div className="text-gray-400 transform transition-transform duration-200" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                            <ChevronDown size={18} />
                        </div>
                    </div>
                </div>

                <button
                    onClick={(e) => { e.stopPropagation(); if (canEdit) onSendVendorPO(); }}
                    disabled={!canEdit}
                    className="flex items-center gap-1 bg-[#25D366] hover:bg-[#1ebd59] text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-sm transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={supplierPhone ? "Send PO via WhatsApp" : "Add phone to send via WhatsApp"}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.6 6.6 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592m3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.71 1.916.81 2.049c.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232" />
                    </svg> Send PO
                </button>
            </div>
        </div>
    );
};

const EditableLogItem: React.FC<{
    log: DailyLog;
    product: any;
    supplierName: string;
    onUpdate: (qty: Record<string, number>, price?: number) => void;
    onDelete: () => void;
    canEdit: boolean;
    onShowHistory: (log: DailyLog) => void;
    suppliers: Supplier[];
    onSupplierChange: (supplierId: string, supplierName: string) => void;
}> = ({ log, product, supplierName, onUpdate, onDelete, canEdit, onShowHistory, suppliers, onSupplierChange }) => {
    const { setPreviewImage } = useStore();
    const [isEditing, setIsEditing] = useState(false);

    // Edit State
    const [editPrice, setEditPrice] = useState(log.price?.toString() || '');
    const [editQtys, setEditQtys] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        Object.entries(log.orderedQty).forEach(([k, v]) => initial[k] = v.toString());
        return initial;
    });
    const [hasSizes, setHasSizes] = useState(() => {
        // If the log has multiple size keys (excluding 'Total'), it's a size-based entry
        const sizeKeys = Object.keys(log.orderedQty).filter(k => k !== 'Total');
        return log.hasSizes || sizeKeys.length > 0;
    });

    const createdEntry = log.history.find(h => h.action === 'created');
    let timeStr = '';
    if (createdEntry) {
        const d = new Date(createdEntry.timestamp);
        timeStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).replace(',', '');
    }

    const qtyText = log.hasSizes
        ? Object.entries(log.orderedQty).map(([k, v]) => `${k === 'Total' ? 'Free Size' : k}:${String(v)}`).join(', ')
        : `${log.orderedQty['Total'] || 0}`;

    // Prefer Supplier Name if product description is generic 'Item'
    const displayDescription = useMemo(() => {
        if (!product?.description || product.description === 'Item') {
            return supplierName || "Item";
        }
        return product.description;
    }, [product, supplierName]);

    const handlePreview = () => {
        if (!product?.imageUrl) return;

        let sizeDetails = "";
        let totalQty = 0;

        if (log.hasSizes) {
            sizeDetails = Object.entries(log.orderedQty).map(([k, v]) => `${k}:${v}`).join('  ');
            totalQty = (Object.values(log.orderedQty) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
        } else {
            totalQty = log.orderedQty['Total'] || 0;
        }

        setPreviewImage(product.imageUrl, {
            title: displayDescription,
            qty: `Qty: ${totalQty}`,
            sizeDetails: sizeDetails,
            price: log.price ? `₹${log.price}` : undefined,
            tag: 'ORDER ITEM'
        });
    };

    const handleSave = () => {
        if (!canEdit) {
            alert("You do not have permission to edit purchase orders");
            return;
        }

        const cleanQty: Record<string, number> = {};
        let total = 0;
        Object.entries(editQtys).forEach(([k, v]) => {
            const val = parseInt(String(v));
            if (!isNaN(val) && val > 0) {
                cleanQty[k] = val;
                total += val;
            }
        });

        if (total === 0) {
            alert("Qty cannot be zero");
            return;
        }

        const p = editPrice ? parseFloat(editPrice) : undefined;
        onUpdate(cleanQty, p);
        setIsEditing(false);
    };

    const addQuickSize = (size: string) => {
        if (editQtys[size]) return;
        setEditQtys(prev => ({ ...prev, [size]: '' }));
    };

    const updateQty = (key: string, val: string) => {
        setEditQtys(prev => ({ ...prev, [key]: val }));
    };

    const removeSize = (key: string) => {
        const n = { ...editQtys };
        delete n[key];
        setEditQtys(n);
    };

    if (isEditing) {
        return (
            <div className="p-4 bg-blue-50/30">
                <div className="flex gap-4 mb-3">
                    <div className="w-16 h-16 bg-gray-100 rounded-xl overflow-hidden shrink-0">
                        {product?.imageUrl && <img src={product.imageUrl} className="w-full h-full object-cover" alt="" />}
                    </div>
                    <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <Banknote size={14} className="absolute left-2.5 top-2.5 text-gray-400" />
                                <input
                                    className="w-full pl-8 pr-2 py-1.5 border border-blue-200 rounded-lg text-sm bg-white"
                                    placeholder="Price"
                                    type="number"
                                    value={editPrice}
                                    onChange={e => setEditPrice(e.target.value)}
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="relative inline-flex items-center cursor-pointer scale-[0.6] origin-left">
                                    <input type="checkbox" checked={hasSizes} onChange={e => {
                                        setHasSizes(e.target.checked);
                                        // Reset qtys when toggling
                                        setEditQtys(e.target.checked ? { 'S': '' } : { 'Total': '' });
                                    }} className="sr-only peer" />
                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                                <span className="text-[10px] font-bold text-gray-500 uppercase">Sizes</span>
                            </div>
                        </div>

                        {hasSizes ? (
                            <div className="space-y-2">
                                <div className="flex flex-wrap gap-1 mb-1">
                                    {QUICK_SIZES.slice(0, 8).map(s => (
                                        <button key={s} onClick={() => addQuickSize(s)} disabled={!!editQtys[s]} className={`px-2 py-1 text-[10px] border rounded-md ${editQtys[s] ? 'opacity-50' : 'bg-white shadow-sm'}`}>{s}</button>
                                    ))}
                                </div>
                                {Object.entries(editQtys).map(([size, val]) => (
                                    <div key={size} className="flex items-center gap-2">
                                        <span className="w-8 text-[11px] font-bold">{size === 'Total' ? 'Free Size' : size}</span>
                                        <input className="w-14 p-1.5 border border-blue-200 rounded text-center text-sm font-bold bg-white" value={val} onChange={e => updateQty(size, e.target.value)} placeholder="0" type="number" />
                                        <button onClick={() => removeSize(size)} className="text-red-400 p-1"><X size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-gray-600">Total Qty:</span>
                                <input
                                    className="w-20 p-1.5 border border-blue-200 rounded text-center text-sm font-bold bg-white"
                                    value={editQtys['Total'] || ''}
                                    onChange={e => updateQty('Total', e.target.value)}
                                    type="number"
                                />
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <button onClick={onDelete} disabled={!canEdit} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"><Trash2 size={14} /> Delete</button>
                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-bold">Cancel</button>
                    <button onClick={handleSave} disabled={!canEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 flex items-center gap-1 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"><Check size={14} /> Save</button>
                </div>
            </div>
        );
    }

    // Get merge history entries
    const mergeHistoryEntries = log.history.filter(h => h.action === 'merged_entries');

    return (
        <div className="flex gap-3 p-3 group active:bg-gray-50 transition-colors">
            <div className="w-12 h-12 bg-gray-100 rounded-xl overflow-hidden shrink-0 border border-gray-100 cursor-pointer shadow-sm" onClick={handlePreview}>
                {product?.imageUrl && <img src={product.imageUrl} className="w-full h-full object-cover" alt="" />}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <div className="flex justify-between items-start mb-0.5">
                    <div className="text-sm font-bold text-gray-900 truncate tracking-tight">
                        {displayDescription}
                    </div>

                    <div className="flex flex-col items-end gap-1">
                        <div className="text-[9px] text-gray-400 font-medium bg-gray-50 px-1.5 py-0.5 rounded">
                            {timeStr}
                        </div>
                        {mergeHistoryEntries.length > 0 && (
                            <div className="relative group/merge">
                                <button
                                    onClick={() => onShowHistory(log)}
                                    className="text-amber-600 hover:text-amber-700 p-0.5 hover:bg-amber-50 rounded transition flex items-center gap-1"
                                    title="View merge history"
                                >
                                    <GitMerge size={14} />
                                    <span className="text-[10px] font-bold">{mergeHistoryEntries.length}</span>
                                </button>

                                {/* Tooltip showing merge dates */}
                                <div className="absolute right-0 bottom-full mb-2 bg-gray-900 text-white text-[10px] rounded-lg p-2 whitespace-nowrap opacity-0 group-hover/merge:opacity-100 transition-opacity pointer-events-none z-40 shadow-lg">
                                    <div className="font-bold mb-1">Merged {mergeHistoryEntries.length}x</div>
                                    {mergeHistoryEntries.slice(-3).reverse().map((entry, idx) => {
                                        const d = new Date(entry.timestamp);
                                        const dateStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
                                        return <div key={idx} className="text-gray-300">{dateStr}</div>;
                                    })}
                                    {mergeHistoryEntries.length > 3 && <div className="text-gray-400 text-[9px] mt-1">+{mergeHistoryEntries.length - 3} more</div>}
                                </div>
                            </div>
                        )}
                        {log.notes && log.notes.includes('MERGED') && (
                            <div className="flex items-center gap-1">
                                <div className="text-[8px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border-l-2 border-blue-400 max-w-xs text-right">
                                    {log.notes.match(/\[MERGED:[^\]]+\]/)?.[0]?.replace('[MERGED: ', '').replace(']', '') || 'Merged entry'}
                                </div>
                                <button
                                    onClick={() => onShowHistory(log)}
                                    className="text-blue-500 hover:text-blue-700 p-0.5 hover:bg-blue-50 rounded transition"
                                    title="View merge history"
                                >
                                    <Info size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-end">
                    <div className="pb-0.5">
                        {log.price ? (
                            <div className="text-sm font-bold text-gray-700">
                                ₹{log.price}
                            </div>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-baseline gap-1">
                            <span className="text-xs font-medium text-gray-500">Qty</span>
                            <span className="text-base font-bold text-gray-900">{qtyText}</span>
                        </div>
                        <button
                            onClick={() => canEdit && setIsEditing(true)}
                            disabled={!canEdit}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-blue-600 bg-blue-50 p-1.5 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <Edit2 size={12} />
                        </button>
                    </div>
                </div>

                {/* Supplier Selector Dropdown */}
                <div className="mt-2 pt-2 border-t border-gray-100">
                    <select
                        value={log.supplierId || 'unknown'}
                        onChange={(e) => {
                            if (e.target.value && e.target.value !== 'unknown' && canEdit) {
                                const selectedSupplier = suppliers.find(s => s.id === e.target.value);
                                if (selectedSupplier) {
                                    onSupplierChange(e.target.value, selectedSupplier.name);
                                }
                            }
                        }}
                        disabled={!canEdit}
                        className="w-full px-2 py-1.5 text-xs border border-blue-200 rounded-lg bg-white text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed hover:border-blue-400 focus:border-blue-500 focus:outline-none transition"
                    >
                        <option value="unknown">Assign to supplier...</option>
                        {suppliers.map(sup => (
                            <option key={sup.id} value={sup.id}>
                                {sup.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
};
