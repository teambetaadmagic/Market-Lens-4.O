import React, { useState, useMemo, useRef } from 'react';
import { ChevronDown, ChevronUp, Check, Save, X, Clock, TrendingUp, Minus, Plus, Truck, Camera, Image as ImageIcon, History, Lock, Calendar, AlertCircle, Trash2, Info, Edit2, Send } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { DailyLog } from '../types';
import { compressImage } from '../services/geminiService';
import { canEditView } from '../utils/permissions';

interface PickupViewProps {
    setView?: (view: string) => void;
}

export const PickupView: React.FC<PickupViewProps> = ({ setView }) => {
    const storeData = useStore();
    const { dailyLogs = [], products = [], suppliers = [], processPickup, deleteLog, getTodayDate, setPreviewImage, user, updateLogSupplier } = storeData;
    const today = getTodayDate();

    // Check if user can edit this view
    const canEdit = user ? canEditView(user.role, 'pickup') : false;
    const isAdmin = user?.role === 'admin';
    const [isClearingHistory, setIsClearingHistory] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);

    // Calculate Progress (Today Only for the graph)
    const { totalOrdered, totalPicked, progress } = useMemo(() => {
        const todayLogs = dailyLogs.filter(l => l.date === today);
        let ord = 0;
        let pck = 0;

        todayLogs.forEach(log => {
            const ordValues = Object.values(log.orderedQty || {});
            ordValues.forEach((v: any) => ord += (Number(v) || 0));

            const pickValues = Object.values(log.pickedQty || {});
            pickValues.forEach((v: any) => pck += (Number(v) || 0));
        });

        const pct = ord > 0 ? Math.min(100, Math.round((pck / ord) * 100)) : 0;
        return { totalOrdered: ord, totalPicked: pck, progress: pct };
    }, [dailyLogs, today]);

    // Active items for pickup (ALL pending orders)
    // Exclude items where all quantities have been fully dispatched
    const activeLogs = dailyLogs.filter(l => {
        // Only include items with these statuses
        if (!['ordered', 'picked_partial', 'picked_full'].includes(l.status)) {
            return false;
        }

        // Calculate remaining quantity (ordered - dispatched)
        const orderedTotal = (Object.values(l.orderedQty || {}) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
        const dispatchedTotal = (Object.values(l.dispatchedQty || {}) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
        const remaining = orderedTotal - dispatchedTotal;

        // Only show items that have remaining quantity
        return remaining > 0;
    }).sort((a, b) => {
        // Sort by date desc (newest first)
        return new Date(b.date).getTime() - new Date(a.date).getTime();
    });


    const totalPendingQty = activeLogs.reduce((acc: number, log) => {
        const ord: number = (Object.values(log.orderedQty || {}) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
        const dispatched: number = (Object.values(log.dispatchedQty || {}) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
        return acc + Math.max(0, ord - dispatched);
    }, 0);

    // Group by Supplier only (no date grouping)
    const groupedBySupplier = useMemo(() => {
        const supplierMap: Record<string, DailyLog[]> = {};

        activeLogs.forEach(log => {
            let supName = 'Unassigned';
            if (log.supplierId) {
                const s = suppliers.find(sup => sup.id === log.supplierId);
                if (s) supName = s.name;
            }
            if (!supplierMap[supName]) supplierMap[supName] = [];
            supplierMap[supName].push(log);
        });

        const supplierGroups = Object.entries(supplierMap).map(([supName, logs]) => {
            const firstLog = logs[0];
            const supplier = suppliers.find(s => s.id === firstLog.supplierId);

            // Group logs by image hash to combine same products from different orders
            const logsByHash: Record<string, DailyLog[]> = {};
            logs.forEach(log => {
                const product = products.find(p => p.id === log.productId);
                const hashKey = product?.imageHash || log.productId; // Use image hash if available, fallback to productId
                if (!logsByHash[hashKey]) {
                    logsByHash[hashKey] = [];
                }
                logsByHash[hashKey].push(log);
            });

            // Merge logs with same image hash into a single combined log
            const mergedLogs = Object.entries(logsByHash).map(([hashKey, hashLogs]) => {
                if (hashLogs.length === 1) {
                    return hashLogs[0]; // If only one, return as is
                }

                // Combine quantities from multiple logs with same image hash
                const combinedLog = { ...hashLogs[0] };
                const combinedOrderedQty: Record<string, number> = {};
                const combinedDispatchedQty: Record<string, number> = {};

                hashLogs.forEach(log => {
                    // Merge ordered quantities
                    Object.entries(log.orderedQty).forEach(([size, qty]) => {
                        combinedOrderedQty[size] = (combinedOrderedQty[size] || 0) + (qty || 0);
                    });
                    // Merge dispatched quantities
                    Object.entries(log.dispatchedQty || {}).forEach(([size, qty]) => {
                        combinedDispatchedQty[size] = (combinedDispatchedQty[size] || 0) + (qty || 0);
                    });
                });

                combinedLog.orderedQty = combinedOrderedQty;
                combinedLog.dispatchedQty = combinedDispatchedQty;
                // Keep original log ID for dispatch operations - don't use hash

                return combinedLog;
            });

            const totalPending = mergedLogs.reduce((acc, log) => {
                const ord: number = (Object.values(log.orderedQty || {}) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
                const dispatched: number = (Object.values(log.dispatchedQty || {}) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
                return acc + Math.max(0, ord - dispatched);
            }, 0);

            return {
                name: supName,
                id: firstLog.supplierId || 'unknown',
                logs: mergedLogs.sort((a, b) => (b.history[0]?.timestamp || 0) - (a.history[0]?.timestamp || 0)),
                totalPendingQty: totalPending
            };
        });

        return supplierGroups.sort((a, b) => b.totalPendingQty - a.totalPendingQty);
    }, [activeLogs, suppliers, products]);

    // Dispatch History
    const historyLogs = useMemo(() => {
        return dailyLogs.filter(l =>
            ['dispatched', 'received_partial', 'received_full'].includes(l.status)
        ).sort((a, b) => {
            // Find dispatch timestamp
            const getDispatchTime = (log: DailyLog) => {
                const entry = log.history.slice().reverse().find(h => h.action.includes('dispatch'));
                return entry ? entry.timestamp : 0;
            };
            return getDispatchTime(b) - getDispatchTime(a);
        }).slice(0, 30);
    }, [dailyLogs]);

    const handleClearHistory = async () => {
        if (!isAdmin) {
            alert('You do not have permission to clear history');
            return;
        }

        const confirmed = window.confirm(`Are you sure you want to delete all ${historyLogs.length} recent dispatches? This action cannot be undone.`);
        if (!confirmed) return;

        setIsClearingHistory(true);
        try {
            for (const log of historyLogs) {
                await deleteLog(log.id);
            }
            alert('History cleared successfully');
        } catch (error: any) {
            console.error('Error clearing history:', error);
            alert(`Error clearing history: ${error?.message || error}`);
        } finally {
            setIsClearingHistory(false);
        }
    };

    return (
        <div className="pb-36 pt-0 px-3 max-w-lg mx-auto min-h-screen relative">
            {/* Read-Only Banner */}
            {!canEdit && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
                    <Lock size={18} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs font-semibold text-amber-800">Read-only mode: You can view but cannot process pickups</p>
                </div>
            )}

            {/* Sticky Header */}
            <div className="flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur-sm z-30 py-3 mb-4 border-b border-gray-100 -mx-3 px-4">
                <h1 className="text-xl font-bold text-gray-900 tracking-tight">Pickup List</h1>
                {activeLogs.length > 0 && (
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                        {totalPendingQty} Qty Pending
                    </span>
                )}
            </div>

            {/* Progress Card (Today) */}
            {totalOrdered > 0 && (
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm mb-6 animate-in slide-in-from-top-2">
                    <div className="flex justify-between items-center mb-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                                <TrendingUp size={18} />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Today's Progress</div>
                                <div className="text-xl font-bold text-gray-900 leading-none">{progress}% Done</div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-bold text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                                {totalPicked} / {totalOrdered}
                            </span>
                        </div>
                    </div>

                    <div className="relative w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                        <div
                            className={`absolute top-0 left-0 h-full rounded-full transition-all duration-700 ease-out ${progress === 100 ? 'bg-green-500' : 'bg-blue-600'}`}
                            style={{ width: `${progress}%` }}
                        ></div>
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:1rem_1rem] opacity-30"></div>
                    </div>
                </div>
            )}

            {groupedBySupplier.length === 0 && historyLogs.length === 0 && (
                <div className="text-center text-gray-400 mt-20 text-sm flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Check size={32} className="text-gray-300" />
                    </div>
                    <p className="font-medium">All caught up!</p>
                    <p className="text-xs mt-1">No pending orders.</p>
                </div>
            )}

            {/* Suppliers List (No Date Grouping) */}
            {groupedBySupplier.map((supplierGroup) => (
                <SupplierGroup
                    key={supplierGroup.id}
                    supplierId={supplierGroup.id}
                    supplierName={supplierGroup.name}
                    logs={supplierGroup.logs}
                    products={products}
                    suppliers={suppliers}
                    onPickup={processPickup}
                    onDelete={deleteLog}
                    canEdit={canEdit}
                    isAdmin={user?.role === 'admin'}
                />
            ))}

            {/* Dispatch History Section */}
            {historyLogs.length > 0 && (
                <div className="mt-8 border-t border-gray-100 pt-6 mb-10">
                    <div className="flex items-center justify-between mb-4 px-2">
                        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <History size={14} /> Recent Dispatches
                        </h2>
                        {isAdmin && (
                            <button
                                onClick={handleClearHistory}
                                disabled={isClearingHistory}
                                className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-full border border-red-200 active:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title={`Delete all ${historyLogs.length} dispatch records`}
                            >
                                Clear History
                            </button>
                        )}
                    </div>

                    {/* Pagination Logic */}
                    {(() => {
                        const itemsPerPage = 25;
                        const totalPages = Math.ceil(historyLogs.length / itemsPerPage);
                        const startIndex = (historyPage - 1) * itemsPerPage;
                        const endIndex = startIndex + itemsPerPage;
                        const paginatedLogs = historyLogs.slice(startIndex, endIndex);

                        return (
                            <>
                                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                                    {paginatedLogs.map(log => {
                                        const product = products.find(p => p.id === log.productId);
                                        const supplier = suppliers.find(s => s.id === log.supplierId);

                                        // Get dispatch time
                                        const dispatchEntry = log.history.slice().reverse().find(h => h.action.includes('dispatch'));
                                        let timeStr = '';
                                        if (dispatchEntry) {
                                            const d = new Date(dispatchEntry.timestamp);
                                            timeStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).replace(',', '');
                                        }

                                        // Total Picked Qty
                                        const qty = Object.values(log.pickedQty).reduce((a: number, b: number) => a + (b || 0), 0);

                                        return (
                                            <div key={log.id} className="p-3 border-b border-gray-50 last:border-0 flex gap-3 opacity-90 hover:bg-gray-50 transition-colors">
                                                <div
                                                    className="w-10 h-10 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden cursor-pointer shadow-sm"
                                                    onClick={() => {
                                                        if (product?.imageUrl) {
                                                            setPreviewImage(product.imageUrl, {
                                                                title: product?.description,
                                                                qty: `Sent: ${qty}`,
                                                                tag: 'DISPATCHED'
                                                            });
                                                        }
                                                    }}
                                                >
                                                    {product?.imageUrl && <img src={product.imageUrl} className="w-full h-full object-cover" alt="" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start">
                                                        <div className="text-xs font-bold text-gray-900 truncate pr-2">{product?.description}</div>
                                                        <span className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded flex-shrink-0">
                                                            {timeStr}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-end mt-1">
                                                        <div className="text-[10px] text-gray-500 font-medium">{supplier?.name || 'Unknown'}</div>
                                                        <div className="flex items-center gap-2">
                                                            {log.pickupProofUrl && (
                                                                <button
                                                                    onClick={() => setPreviewImage(log.pickupProofUrl || null, { tag: 'PROOF' })}
                                                                    className="text-[9px] text-blue-600 flex items-center gap-0.5 bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 font-bold"
                                                                >
                                                                    <ImageIcon size={10} /> Proof
                                                                </button>
                                                            )}
                                                            <div className="text-[10px] font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                                                                Sent: {qty}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="mt-4 flex items-center justify-between gap-3">
                                        <div className="text-xs font-bold text-gray-600">
                                            Page <span className="text-blue-600">{historyPage}</span> of <span className="text-gray-900">{totalPages}</span>
                                            <span className="text-gray-400 ml-2">({historyLogs.length} total)</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setHistoryPage(prev => Math.max(1, prev - 1))}
                                                disabled={historyPage === 1}
                                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                title="Previous page"
                                            >
                                                <ChevronUp size={16} className="text-gray-600" />
                                            </button>
                                            <button
                                                onClick={() => setHistoryPage(prev => Math.min(totalPages, prev + 1))}
                                                disabled={historyPage === totalPages}
                                                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                                title="Next page"
                                            >
                                                <ChevronDown size={16} className="text-gray-600" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

const SupplierEditor: React.FC<{ current: string; suppliers: any[]; logId: string; updateLogSupplier: (logId: string, supplierName: string) => Promise<void> | void }> = ({ current, suppliers, logId, updateLogSupplier }) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(current || '');
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        const name = (value || '').trim();
        if (!name) {
            alert('Supplier name cannot be empty');
            return;
        }
        setSaving(true);
        try {
            await updateLogSupplier(logId, name);
            setEditing(false);
            alert('Supplier updated');
        } catch (e) {
            console.error('Failed to update supplier', e);
            alert('Failed to update supplier');
        } finally {
            setSaving(false);
        }
    };

    if (!editing) {
        return (
            <button onClick={(e) => { e.stopPropagation(); setValue(current || ''); setEditing(true); }} title="Change supplier" className="text-[11px] text-gray-500 hover:text-gray-700 flex items-center gap-1">
                <Edit2 size={14} />
            </button>
        );
    }

    return (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <input list={`supplier-list-${logId}`} value={value} onChange={e => setValue(e.target.value)} onClick={(e) => e.stopPropagation()} className="text-xs border border-gray-200 rounded px-2 py-1" />
            <datalist id={`supplier-list-${logId}`}>
                {suppliers.map(s => <option key={s.id} value={s.name} />)}
            </datalist>
            <button onClick={(e) => { e.stopPropagation(); handleSave(); }} disabled={saving} className="text-green-600 p-1">
                <Check size={14} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setEditing(false); }} className="text-gray-400 p-1">
                <X size={14} />
            </button>
        </div>
    );
};

const SupplierGroup: React.FC<{
    supplierId: string;
    supplierName: string;
    logs: DailyLog[];
    products: any[];
    suppliers: any[];
    onPickup: (logId: string, picked: Record<string, number>, notes?: string, proofImage?: string, price?: number, supplierName?: string, supplierPhone?: string) => Promise<void>;
    onDelete: (logId: string) => Promise<void>;
    canEdit: boolean;
    isAdmin: boolean;
}> = ({ supplierId, supplierName, logs, products, suppliers, onPickup, onDelete, canEdit, isAdmin }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isSendingPO, setIsSendingPO] = useState(false);

    // Calculate total pending quantity for this supplier (ordered - dispatched)
    const totalPendingQty = logs.reduce((acc: number, log) => {
        const orderedTotal = (Object.values(log.orderedQty || {}) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
        const dispatchedTotal = (Object.values(log.dispatchedQty || {}) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
        return acc + Math.max(0, orderedTotal - dispatchedTotal);
    }, 0);

    const handleDeleteAllSupplier = async (e: React.MouseEvent) => {
        e.stopPropagation();

        if (!isAdmin) {
            alert('You do not have permission to delete entries');
            return;
        }

        const confirmed = window.confirm(`Are you sure you want to delete all ${logs.length} entries from ${supplierName}? This action cannot be undone.`);
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            // Delete all logs for this supplier
            for (const log of logs) {
                await onDelete(log.id);
            }
            alert('All entries deleted successfully');
        } catch (error: any) {
            console.error('Error deleting entries:', error);
            alert(`Error deleting entries: ${error?.message || error}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const generateWatermarkedImage = async (log: DailyLog, product: any, supplierName?: string): Promise<{ blob: Blob; mimeType: string } | null> => {
        if (!product?.imageUrl) return null;

        return new Promise(async (resolve) => {
            try {
                const originalResponse = await fetch(product.imageUrl);
                const originalBlob = await originalResponse.blob();
                const originalMimeType = originalBlob.type || 'image/jpeg';

                const img = new Image();
                img.crossOrigin = "anonymous";
                img.src = product.imageUrl;

                img.onload = () => {
                    const originalWidth = img.width;
                    const originalHeight = img.height;
                    const originalAspect = originalWidth / originalHeight;

                    const MAX_DIMENSION = 1200;

                    let canvasWidth: number;
                    let canvasHeight: number;

                    if (originalAspect >= 1) {
                        canvasWidth = MAX_DIMENSION;
                        canvasHeight = Math.round(MAX_DIMENSION / originalAspect);
                    } else {
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

                    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvasWidth, canvasHeight);

                    const overlayWidthRatio = 0.84;
                    const overlayHeightRatio = 0.26;
                    const rectW = Math.round(canvasWidth * overlayWidthRatio);
                    const rectH = Math.round(canvasHeight * overlayHeightRatio);
                    const rectX = (canvasWidth - rectW) / 2;
                    const rectY = (canvasHeight - rectH) / 2;
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.fillRect(rectX, rectY, rectW, rectH);

                    const orderedTotal = Object.values(log.orderedQty).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
                    let line1 = `Total Qty: ${orderedTotal}`;
                    let line2 = "";
                    if (log.hasSizes) {
                        line2 = Object.entries(log.orderedQty).map(([k, v]) => `${k}:${v}`).join(', ');
                    }

                    const centerX = canvasWidth / 2;
                    const fontSizeBase = Math.round(canvasHeight * 0.064);
                    const supplierFontSize = Math.round(canvasHeight * 0.044);
                    const sizesFontSize = Math.round(canvasHeight * 0.044);

                    ctx.textAlign = 'center';
                    ctx.fillStyle = '#ffffff';
                    ctx.font = `bold ${fontSizeBase}px sans-serif`;
                    const line1Y = rectY + Math.round(rectH * 0.35);
                    ctx.fillText(line1, centerX, line1Y);

                    if (supplierName) {
                        ctx.font = `${supplierFontSize}px sans-serif`;
                        ctx.fillStyle = '#60a5fa';
                        const supplierY = rectY + Math.round(rectH * 0.65);
                        ctx.fillText(`Supplier: ${supplierName}`, centerX, supplierY);
                    }

                    if (line2) {
                        ctx.font = `${sizesFontSize}px sans-serif`;
                        ctx.fillStyle = '#fbbf24';
                        const line2Y = rectY + Math.round(rectH * (supplierName ? 0.95 : 0.78));
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

    const handleSendPO = async () => {
        if (logs.length === 0) {
            alert('No items to send');
            return;
        }

        const supplier = suppliers.find(s => s.id === supplierId);
        if (!supplier?.phone) {
            alert('Supplier phone number not available');
            return;
        }

        setIsSendingPO(true);
        try {
            // Generate watermarked images
            const images: { blob: Blob; filename: string; mimeType: string }[] = [];

            for (let i = 0; i < logs.length; i++) {
                const log = logs[i];
                const product = products.find(p => p.id === log.productId);

                if (product?.imageUrl) {
                    try {
                        const watermarked = await generateWatermarkedImage(log, product, supplierName);
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
                        title: `Pickup: ${supplierName}`,
                        files: files.length > 0 ? files : undefined
                    };

                    if (navigator.canShare && navigator.canShare(shareData)) {
                        // Native share with files
                        await navigator.share(shareData);
                        return;
                    } else if (files.length > 0 && navigator.canShare({ files: [files[0]] })) {
                        // Try sharing just the first image
                        await navigator.share({
                            title: `Pickup: ${supplierName}`,
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

            // Fallback to WhatsApp Web with clipboard
            const phoneNumber = supplier.phone.replace(/[^0-9]/g, '');

            // Copy first image to clipboard silently
            try {
                const firstImage = images[0];
                await navigator.clipboard.write([new ClipboardItem({ 'image/jpeg': firstImage.blob })]);
            } catch (e) {
                console.error("Copy to clipboard failed", e);
            }

            // Open WhatsApp Web without text message or alert
            const whatsappLink = `https://wa.me/${phoneNumber}`;
            window.open(whatsappLink, '_blank');
        } catch (error: any) {
            console.error('Error sending PO:', error);
            alert(`Error: ${error?.message || 'Could not send PO'}`);
        } finally {
            setIsSendingPO(false);
        }
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
            {/* Header: Supplier Name with Quantity Badge */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className={`w-full p-3 border-b border-gray-200 cursor-pointer transition-colors ${supplierName === 'Unknown Supplier' ? 'bg-amber-100 border-amber-200' : 'bg-slate-100 hover:bg-slate-200'}`}
            >
                <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-900 text-sm truncate">{supplierName}</span>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-full border border-gray-200 text-gray-500 shadow-sm">
                            {totalPendingQty} Items
                        </span>

                        <button
                            onClick={(e) => { e.stopPropagation(); handleSendPO(); }}
                            disabled={isSendingPO}
                            className="bg-green-600 text-white px-3 py-1.5 rounded-lg hover:bg-green-700 transition active:scale-95 disabled:opacity-50 text-[10px] font-bold flex items-center gap-1 whitespace-nowrap"
                            title="Send pickup order via WhatsApp"
                        >
                            {isSendingPO ? <span className="inline-block animate-spin">⏳</span> : <Send size={14} />}
                            Send PO
                        </button>

                        {isAdmin && (
                            <button
                                onClick={handleDeleteAllSupplier}
                                disabled={isDeleting}
                                className="p-1.5 rounded text-red-500 hover:bg-red-50 active:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title={`Delete all ${logs.length} entries`}
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                        <div className="text-gray-400">
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                    </div>
                </div>
            </div>

            {isExpanded && (
                <div className="p-3 space-y-4">
                    {logs.map(log => (
                        <PickupItem
                            key={log.id}
                            log={log}
                            product={products.find(p => p.id === log.productId)}
                            currentSupplierName={supplierName}
                            suppliers={suppliers}
                            onSave={async (picked, notes, proof, price, supName, supPhone) => await onPickup(log.id, picked, notes, proof, price, supName, supPhone)}
                            onDelete={onDelete}
                            canEdit={canEdit}
                            isAdmin={isAdmin}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

const PickupItem: React.FC<{
    log: DailyLog;
    product: any;
    currentSupplierName: string;
    suppliers: any[];
    onSave: (picked: Record<string, number>, notes?: string, proofImage?: string, price?: number, supplierName?: string, supplierPhone?: string) => Promise<void>;
    onDelete: (logId: string) => Promise<void>;
    canEdit: boolean;
    isAdmin: boolean;
}> = ({ log, product, currentSupplierName, suppliers, onSave, onDelete, canEdit, isAdmin }) => {
    const { setPreviewImage, updateLogSupplier } = useStore();
    const [pickedValues, setPickedValues] = useState<Record<string, number>>({ ...log.pickedQty });
    // Optimistic supplier selection so market person sees immediate feedback
    const [currentSupplierIdLocal, setCurrentSupplierIdLocal] = useState<string>(log.supplierId || '');

    // Notes state
    const [showNotes, setShowNotes] = useState(!!log.notes);
    const [noteText, setNoteText] = useState(log.notes || '');

    // Proof Image State
    const [proofImage, setProofImage] = useState<string | null>(null);
    const [highlightProof, setHighlightProof] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDelete = async () => {
        if (!isAdmin) {
            alert('You do not have permission to delete entries');
            return;
        }

        const confirmed = window.confirm(`Are you sure you want to delete this entry from ${currentSupplierName}? This action cannot be undone.`);
        if (!confirmed) return;

        setIsDeleting(true);
        try {
            await onDelete(log.id);
            alert('Entry deleted successfully');
        } catch (error: any) {
            console.error('Error deleting entry:', error);
            alert(`Error deleting entry: ${error?.message || error}`);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSave = async () => {
        // Check permission first
        if (!canEdit) {
            alert('You do not have permission to process pickups');
            return;
        }

        if (!proofImage) {
            setHighlightProof(true);
            setTimeout(() => setHighlightProof(false), 800);
            return;
        }

        // Validate that at least 1 item is selected
        let isValid = false;
        for (const [size, picked] of Object.entries(pickedValues)) {
            if ((picked as number) > 0) {
                isValid = true;
                break;
            }
        }

        if (!isValid) {
            alert('Please select at least 1 item to dispatch');
            return;
        }

        setIsLoading(true);
        try {
            console.log('Dispatching with data:', { pickedValues, noteText, proofImageSize: proofImage?.length });
            await onSave(pickedValues, noteText, proofImage || undefined, undefined, undefined, undefined);
            // Reset form after successful dispatch
            setPickedValues({});
            setProofImage(null);
            setNoteText('');
            setShowNotes(false);
            alert('Dispatch successful!');
        } catch (error: any) {
            console.error('Error saving pickup:', error);
            alert(`Error dispatching: ${error?.message || error}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleProofCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = async () => {
            const raw = reader.result as string;
            const compressed = await compressImage(raw);
            setProofImage(compressed);
        };
        reader.readAsDataURL(file);
    };

    const updateQty = (size: string, delta: number) => {
        if (!canEdit) return;

        // Calculate remaining quantity (ordered - dispatched)
        const orderedQty = log.orderedQty[size] || 0;
        const dispatchedQty = log.dispatchedQty?.[size] || 0;
        const maxLimit = Math.max(0, orderedQty - dispatchedQty);

        setPickedValues(prev => {
            const current = prev[size] || 0;
            const next = current + delta;

            // Cannot go below 0
            if (next < 0) return prev;
            // Cannot go above remaining qty
            if (next > maxLimit) return prev;

            return { ...prev, [size]: next };
        });
    };

    const createdEntry = log.history.find(h => h.action === 'created');
    let timeStr = '';
    if (createdEntry) {
        const d = new Date(createdEntry.timestamp);
        timeStr = d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).replace(',', '');
    }

    const handlePreview = () => {
        if (!product?.imageUrl) return;

        let sizeDetails = "";
        let totalQty = 0;

        if (log.hasSizes) {
            sizeDetails = Object.entries(log.orderedQty).map(([k, v]) => `${k}:${v}`).join('  ');
            // Fixed type error for reduce accumulator/current value
            totalQty = (Object.values(log.orderedQty) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
        } else {
            totalQty = log.orderedQty['Total'] || 0;
        }

        setPreviewImage(product.imageUrl, {
            title: currentSupplierName, // Using supplier name as per request
            qty: `Order Qty: ${totalQty}`,
            sizeDetails: sizeDetails,
            tag: 'PICKUP'
        });
    };

    return (
        <div className="border-b border-gray-100 pb-4 last:border-0">
            <div className="flex gap-4 mb-3">
                <img
                    src={product?.imageUrl}
                    className="w-14 h-14 rounded-lg object-cover bg-gray-100 shadow-sm cursor-pointer border border-gray-100"
                    alt="prod"
                    onClick={handlePreview}
                />
                <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                        {/* Replaced Item Description with Supplier Name as requested */}
                        <div className="flex items-center gap-2">
                            {/* If user can edit (market person), show a dropdown of existing suppliers so they can change per-entry supplier */}
                            {canEdit ? (
                                <select
                                    value={currentSupplierIdLocal}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={async (e) => {
                                        e.stopPropagation();
                                        const supId = e.target.value;
                                        // update UI immediately
                                        setCurrentSupplierIdLocal(supId);
                                        const found = suppliers.find((s: any) => s.id === supId);
                                        const name = found ? found.name : '';
                                        try {
                                            await updateLogSupplier(log.id, name);
                                        } catch (err) {
                                            console.error('Failed to update supplier', err);
                                            alert('Failed to update supplier');
                                            // rollback UI on failure
                                            setCurrentSupplierIdLocal(log.supplierId || '');
                                        }
                                    }}
                                    className="text-sm font-bold text-gray-900 bg-white border border-gray-200 rounded px-2 py-1 focus:outline-none"
                                >
                                    <option value="">Unassigned</option>
                                    {suppliers.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            ) : (
                                <div className="text-sm font-bold text-gray-900 line-clamp-1">{currentSupplierName}</div>
                            )}
                            {/* Keep quick inline editor (icon) for non-dropdown flows if needed */}
                            {!canEdit && (
                                <SupplierEditor current={currentSupplierName} suppliers={suppliers} logId={log.id} updateLogSupplier={updateLogSupplier} />
                            )}
                        </div>

                        {/* Timestamp and Info/Delete Buttons */}
                        <div className="flex items-center gap-2">
                            {/* Purchase Entry Info Icon */}
                            <button
                                onClick={() => setShowHistory(true)}
                                className="text-gray-400 hover:text-gray-600 p-1 transition"
                                title="View purchase history"
                            >
                                <Info size={14} />
                            </button>

                            {timeStr && (
                                <div className="text-[10px] font-medium text-gray-400 whitespace-nowrap">
                                    {timeStr}
                                </div>
                            )}
                            {isAdmin && (
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                    className="p-1 rounded text-red-500 hover:bg-red-50 active:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title="Delete entry"
                                >
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-1.5 mb-4">
                {Object.entries(log.orderedQty).map(([size, ordQty]) => {
                    // Calculate remaining quantity (ordered - dispatched)
                    const dispatchedQty = log.dispatchedQty?.[size] || 0;
                    const remainingQty = Math.max(0, (ordQty as number) - dispatchedQty);
                    const picked = pickedValues[size] || 0;
                    const isComplete = picked >= remainingQty;

                    return (
                        <div key={size} className="flex items-center justify-between bg-gray-50 py-1.5 px-2.5 rounded-lg border border-gray-50">
                            <span className="text-xs font-bold text-gray-700 w-12">{size === 'Total' ? 'Qty' : size}</span>

                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <span className="text-[8px] text-gray-400 uppercase font-bold block">Remaining</span>
                                    <span className="text-sm font-bold text-gray-900">{remainingQty}</span>
                                </div>

                                <div className="flex items-center gap-1 bg-white rounded-lg border border-gray-200 p-1 shadow-sm">
                                    <button
                                        onClick={() => updateQty(size, -1)}
                                        disabled={!canEdit}
                                        className="w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-gray-100 rounded text-gray-600 active:bg-gray-200 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Minus size={14} />
                                    </button>
                                    <div className="w-10 text-center font-bold text-sm text-blue-600">
                                        {picked}
                                    </div>
                                    <button
                                        onClick={() => updateQty(size, 1)}
                                        disabled={isComplete || !canEdit}
                                        className={`w-8 h-8 flex items-center justify-center rounded text-white active:scale-95 transition-transform ${isComplete || !canEdit ? 'bg-gray-200 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="mb-4">
                <button
                    onClick={() => setShowNotes(!showNotes)}
                    className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-gray-600 mb-2"
                >
                    {showNotes ? <Minus size={10} /> : <Plus size={10} />} {log.notes ? 'Edit Note' : 'Add Note'}
                </button>
                {showNotes && (
                    <textarea
                        className="w-full text-xs p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-900 placeholder-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        rows={2}
                        placeholder="Add a note (e.g. 'Partial pickup', 'Damaged')..."
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                    />
                )}
            </div>

            {/* ACTION FOOTER: Proof & Dispatch Side-by-Side - SLIMMER */}
            <div className="flex gap-3 items-stretch">
                {/* Proof Section */}
                <div className={`flex-1 min-w-0 transition-all duration-300 ${highlightProof ? 'ring-2 ring-red-400 rounded-xl animate-pulse' : ''}`}>
                    {proofImage ? (
                        <div className="relative h-10 w-full group">
                            <img
                                src={proofImage}
                                className="h-full w-full object-cover rounded-xl border border-gray-200 shadow-sm cursor-pointer"
                                alt="Proof"
                                onClick={() => setPreviewImage(proofImage, { tag: 'PROOF' })}
                            />
                            <button
                                onClick={() => setProofImage(null)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 z-10"
                            >
                                <X size={10} />
                            </button>
                        </div>
                    ) : (
                        <div
                            onClick={() => fileInputRef.current?.click()}
                            className={`h-10 w-full border border-dashed rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors active:scale-[0.98] ${highlightProof ? 'border-red-400 bg-red-50 text-red-500' : 'border-gray-300 text-gray-500 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600'}`}
                        >
                            <Camera size={16} />
                            <span className="text-[10px] font-bold">{highlightProof ? 'Required!' : 'Proof'}</span>
                        </div>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        capture="environment"
                        onChange={handleProofCapture}
                    />
                </div>

                {/* Dispatch Button */}
                <button
                    onClick={handleSave}
                    disabled={!canEdit || !proofImage || isLoading}
                    className={`flex-[2] h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${!proofImage || !canEdit || isLoading ? 'bg-gray-200 text-gray-400 hover:bg-gray-300 disabled:cursor-not-allowed' : 'bg-gray-900 text-white hover:bg-black active:scale-[0.98]'}`}
                >
                    <Truck size={16} /> {isLoading ? 'Dispatching...' : 'Dispatch'}
                </button>
            </div>

            {/* History Modal */}
            {showHistory && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-10">
                        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <History size={20} className="text-blue-600" />
                                Purchase History
                            </h3>
                            <button onClick={() => setShowHistory(false)} className="p-2 hover:bg-gray-200 rounded-full bg-white border border-gray-200 shadow-sm">
                                <X size={18} className="text-gray-600" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {log.history.map((entry, idx) => (
                                <div key={idx} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                    <div className="flex items-start gap-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-bold text-gray-700 mb-1">
                                                {entry.action.charAt(0).toUpperCase() + entry.action.slice(1).replace(/_/g, ' ')}
                                            </div>
                                            <div className="text-sm font-bold text-gray-900 mb-1">
                                                {new Date(entry.timestamp).toLocaleString('en-GB', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: 'numeric',
                                                    minute: '2-digit',
                                                    hour12: true
                                                })}
                                            </div>
                                            {entry.details && (
                                                <div className="text-xs text-gray-600">{entry.details}</div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4 bg-white border-t border-gray-100 safe-area-pb">
                            <button
                                onClick={() => setShowHistory(false)}
                                className="w-full bg-gray-900 hover:bg-black text-white py-2.5 rounded-lg font-bold text-sm transition active:scale-95"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
