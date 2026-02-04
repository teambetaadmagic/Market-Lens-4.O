import React, { useState, useMemo, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { DailyLog } from '../types';
import { Edit2, Clock, CheckCircle2, Truck, AlertCircle, History, Minus, Plus, Calendar, X, Camera, ChevronDown, ChevronUp, AlertTriangle, Banknote, User, Phone, Lock, Trash2, Info } from 'lucide-react';
import { canEditView } from '../utils/permissions';

export const WarehouseView: React.FC = () => {
  const storeData = useStore();
  const { dailyLogs = [], products = [], suppliers = [], processReceiving, updateLogSupplier, deleteLog, setPreviewImage, user } = storeData;
  
    // Check if user can edit this view
    // Explicitly disallow market persons from editing inward even if permission util returns true
    const canEdit = user ? (canEditView(user.role, 'warehouse') && user.role !== 'market_person') : false;
  const isAdmin = user?.role === 'admin';

  // Track which supplier groups are expanded (key: dateLabel + supplierId)
  // Initialize with all collapsed by using a ref to track expanded ones instead
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());
  const [expandedIncoming, setExpandedIncoming] = useState<Set<string>>(new Set());
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [deletingSupplier, setDeletingSupplier] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'yesterday' | 'custom'>('today');
  const [customDate, setCustomDate] = useState<string>('');

  // Helper function to get date range for filtering
  const getDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (dateFilter) {
      case 'today':
        return { start: today, end: tomorrow };
      case 'yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return { start: yesterday, end: today };
      case 'custom':
        if (!customDate) return { start: new Date(0), end: new Date(9999, 11, 31) };
        const customDateObj = new Date(customDate);
        customDateObj.setHours(0, 0, 0, 0);
        const nextDay = new Date(customDateObj);
        nextDay.setDate(nextDay.getDate() + 1);
        return { start: customDateObj, end: nextDay };
      case 'all':
      default:
        return { start: new Date(0), end: new Date(9999, 11, 31) };
    }
  };

  // Generate watermarked image for sharing


  // --- 1. GROUP INCOMING BY SUPPLIER, THEN MERGE DUPLICATE PRODUCTS ---
  const incomingGroups = useMemo(() => {
    const logs = dailyLogs.filter(l => l.status === 'dispatched');
    const groups: Record<string, { 
        supplierId: string, 
        supplierName: string, 
        logs: DailyLog[], 
        totalQty: number, 
        totalAmount: number 
    }> = {};

    logs.forEach(log => {
        const supId = log.supplierId || 'unknown';
        if (!groups[supId]) {
            const s = suppliers.find(x => x.id === supId);
            groups[supId] = {
                supplierId: supId,
                supplierName: s?.name || 'Unknown',
                logs: [],
                totalQty: 0,
                totalAmount: 0
            };
        }
        
        // For incoming, we use pickedQty because that's what was dispatched
        const qty = (Object.values(log.pickedQty || {}) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
        const amt = qty * (log.price || 0);
        
        groups[supId].logs.push(log);
        groups[supId].totalQty += qty;
        groups[supId].totalAmount += amt;
    });

    // Merge duplicate products within each supplier group (by image hash)
    const mergedGroups = Object.values(groups).map(group => {
        const productMap: Record<string, DailyLog> = {};
        const mergingHistory: Record<string, DailyLog[]> = {};
        
        group.logs.forEach(log => {
            const product = products.find(p => p.id === log.productId);
            const hashKey = product?.imageHash || log.productId; // Use image hash if available
            
            if (!productMap[hashKey]) {
                productMap[hashKey] = { ...log };
                mergingHistory[hashKey] = [log];
            } else {
                // Merge quantities
                const existing = productMap[hashKey];
                const newLog = { ...log };
                
                // Merge pickedQty
                const mergedPickedQty = { ...existing.pickedQty };
                Object.entries(newLog.pickedQty || {}).forEach(([size, qty]) => {
                    mergedPickedQty[size] = (mergedPickedQty[size] || 0) + (qty || 0);
                });
                
                // Merge dispatchedQty
                const mergedDispatchedQty = { ...existing.dispatchedQty };
                Object.entries(newLog.dispatchedQty || {}).forEach(([size, qty]) => {
                    mergedDispatchedQty[size] = (mergedDispatchedQty[size] || 0) + (qty || 0);
                });
                
                // Update the merged log
                existing.pickedQty = mergedPickedQty;
                existing.dispatchedQty = mergedDispatchedQty;
                existing.history = [
                    ...existing.history,
                    {
                        action: 'merged_dispatch',
                        timestamp: Date.now(),
                        details: `Merged with dispatch from ${new Date(log.history[0]?.timestamp || Date.now()).toLocaleString()}`
                    }
                ];
                
                mergingHistory[hashKey].push(log);
                productMap[hashKey] = existing;
            }
        });
        
        return {
            ...group,
            logs: Object.values(productMap)
        };
    });

    return mergedGroups.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [dailyLogs, suppliers]);


  // --- 2. GROUP HISTORY BY SUPPLIER AND DATE, THEN MERGE DUPLICATE PRODUCTS ---
  const historyGroups = useMemo(() => {
    const dateRange = getDateRange();
    
    const receivedLogs = dailyLogs.filter(l => {
        if (l.status !== 'received_full' && l.status !== 'received_partial') return false;
        
        // Apply date filter
        const receivedEntry = l.history.slice().reverse().find(h => h.action === 'received');
        const dateObj = receivedEntry ? new Date(receivedEntry.timestamp) : new Date();
        
        return dateObj >= dateRange.start && dateObj < dateRange.end;
    });

    const supplierGroups: Record<string, { 
        supplierId: string,
        supplierName: string,
        dateGroups: Record<string, {
            dateLabel: string,
            logs: DailyLog[]
        }>,
        totalQty: number,
        totalAmount: number
    }> = {};

    receivedLogs.forEach(log => {
        const supId = log.supplierId || 'unknown';
        if (!supplierGroups[supId]) {
            const s = suppliers.find(x => x.id === supId);
            supplierGroups[supId] = {
                supplierId: supId,
                supplierName: s?.name || 'Unknown',
                dateGroups: {},
                totalQty: 0,
                totalAmount: 0
            };
        }
        
        // Get the received date
        const receivedEntry = log.history.slice().reverse().find(h => h.action === 'received');
        const dateObj = receivedEntry ? new Date(receivedEntry.timestamp) : new Date();
        const dateLabel = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
        
        if (!supplierGroups[supId].dateGroups[dateLabel]) {
            supplierGroups[supId].dateGroups[dateLabel] = {
                dateLabel,
                logs: []
            };
        }
        
        const qty = (Object.values(log.receivedQty || {}) as number[]).reduce((a, b) => a + (b||0), 0);
        const amt = qty * (log.price || 0);
        
        supplierGroups[supId].dateGroups[dateLabel].logs.push(log);
        supplierGroups[supId].totalQty += qty;
        supplierGroups[supId].totalAmount += amt;
    });

    // Merge duplicate products within each date group (by image hash)
    const mergedSupplierGroups = Object.values(supplierGroups).map(supplier => {
        const mergedDateGroups = Object.entries(supplier.dateGroups).reduce((acc, [dateLabel, dateGroup]) => {
            const productMap: Record<string, DailyLog> = {};
            
            dateGroup.logs.forEach(log => {
                const product = products.find(p => p.id === log.productId);
                const hashKey = product?.imageHash || log.productId; // Use image hash if available
                
                if (!productMap[hashKey]) {
                    productMap[hashKey] = { ...log };
                } else {
                    // Merge quantities
                    const existing = productMap[hashKey];
                    const newLog = { ...log };
                    
                    // Merge receivedQty
                    const mergedReceivedQty = { ...existing.receivedQty };
                    Object.entries(newLog.receivedQty || {}).forEach(([size, qty]) => {
                        mergedReceivedQty[size] = (mergedReceivedQty[size] || 0) + (qty || 0);
                    });
                    
                    // Update the merged log
                    existing.receivedQty = mergedReceivedQty;
                    existing.history = [
                        ...existing.history,
                        {
                            action: 'merged_receipt',
                            timestamp: Date.now(),
                            details: `Merged with receipt from ${new Date(log.history[0]?.timestamp || Date.now()).toLocaleString()}`
                        }
                    ];
                    
                    productMap[hashKey] = existing;
                }
            });
            
            acc[dateLabel] = {
                dateLabel,
                logs: Object.values(productMap)
            };
            return acc;
        }, {} as Record<string, { dateLabel: string; logs: DailyLog[] }>);
        
        return {
            ...supplier,
            dateGroups: mergedDateGroups
        };
    });

    return mergedSupplierGroups.sort((a, b) => b.totalAmount - a.totalAmount);
  }, [dailyLogs, suppliers, dateFilter, customDate]);

  const handleDeleteSupplierGroup = async (supplierName: string, logs: DailyLog[], e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isAdmin) {
      alert('You do not have permission to delete entries');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete all ${logs.length} entries from ${supplierName}? This action cannot be undone.`);
    if (!confirmed) return;

    setDeletingSupplier(supplierName);
    try {
      for (const log of logs) {
        await deleteLog(log.id);
      }
      alert('All entries deleted successfully');
    } catch (error: any) {
      console.error('Error deleting entries:', error);
      alert(`Error deleting entries: ${error?.message || error}`);
    } finally {
      setDeletingSupplier(null);
    }
  };

  // No need to initialize all as collapsed - expandedSuppliers starts empty (all collapsed)

  return (
    <div className="pb-36 pt-0 px-3 max-w-lg mx-auto">
      {/* Read-Only Banner */}
      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
          <Lock size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs font-semibold text-amber-800">Read-only mode: You can view but cannot process inward receipts</p>
        </div>
      )}
      
      {/* Sticky Header */}
      <div className="flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-30 py-3 mb-4 border-b border-gray-100 -mx-3 px-4">
          <h1 className="text-xl font-bold text-gray-900 tracking-tight">Warehouse Inward</h1>
      </div>
      
      {incomingGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-gray-400 mt-20 mb-8 text-sm bg-gray-50 py-10 rounded-2xl border-2 border-dashed border-gray-200 animate-in fade-in">
              <Truck size={40} className="mb-3 opacity-20" />
              <span className="font-medium text-gray-500">No dispatched items yet</span>
              <span className="text-xs text-gray-400 mt-1">Wait for Pickup Team to dispatch</span>
          </div>
      ) : (
          <div className="space-y-6 mb-8 animate-in slide-in-from-bottom-2">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-widest px-1 flex items-center gap-2">
                  <Truck size={14} />
                  Incoming
              </div>
              
              {incomingGroups.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                      <div className="text-sm font-bold text-blue-900">
                          Total Pieces: <span className="text-blue-700">{incomingGroups.reduce((sum, group) => sum + group.totalQty, 0)}</span>
                      </div>
                  </div>
              )}
              
              {incomingGroups.map((group) => {
                  const isExpanded = expandedIncoming.has(group.supplierId);
                  return (
                  <div key={group.supplierId} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                      {/* Supplier Header for Incoming - Highlighted */}
                      <button 
                          onClick={() => {
                              const newExpanded = new Set(expandedIncoming);
                              if (newExpanded.has(group.supplierId)) {
                                  newExpanded.delete(group.supplierId);
                              } else {
                                  newExpanded.add(group.supplierId);
                              }
                              setExpandedIncoming(newExpanded);
                          }}
                          className="w-full bg-slate-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                          <div className="flex items-center gap-2 flex-1 text-left">
                              <ChevronDown 
                                  size={16} 
                                  className={`text-gray-600 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                              />
                              <div className="font-bold text-gray-800 text-sm">{group.supplierName}</div>
                          </div>
                          <div className="flex items-center gap-2">
                              {group.totalAmount > 0 && (
                                  <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                                      ₹{group.totalAmount.toLocaleString()}
                                  </span>
                              )}
                              <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-gray-200 text-gray-500">
                                  {group.totalQty} Items
                              </span>
                              {isAdmin && (
                                  <button
                                      onClick={(e) => handleDeleteSupplierGroup(group.supplierName, group.logs, e)}
                                      disabled={deletingSupplier === group.supplierName}
                                      className="p-1.5 rounded text-red-500 hover:bg-red-50 active:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                      title={`Delete all ${group.logs.length} entries`}
                                  >
                                      <Trash2 size={14} />
                                  </button>
                              )}
                          </div>
                      </button>

                      {isExpanded && (
                      <div className="divide-y divide-gray-50">
                          {group.logs.map(log => {
                              const product = products.find(p => p.id === log.productId);
                              return (
                                  <WarehouseItem 
                                    key={log.id} 
                                    log={log} 
                                    product={product!} 
                                    supplierName={group.supplierName}
                                    supplierPhone={suppliers.find(s => s.id === group.supplierId)?.phone}
                                    onVerify={(rec, price, supName, supPhone) => processReceiving(log.id, rec, price, supName, supPhone)}
                                    onUpdateSupplier={(name) => updateLogSupplier(log.id, name)}
                                    onDelete={deleteLog}
                                    canEdit={canEdit}
                                    isAdmin={user?.role === 'admin'}
                                  />
                              );
                          })}
                      </div>
                      )}
                  </div>
                  );
              })}
          </div>
      )}

      {historyGroups.length > 0 && (
          <div className="border-t border-gray-200 pt-8 mt-8 mb-10">
               <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex-1">
                        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                            <History size={14} /> Recent History
                        </h2>
                        <div className="mt-2 space-y-1 px-1">
                            <div className="text-sm font-bold text-gray-900">
                                Total Pieces: <span className="text-blue-600">{historyGroups.reduce((sum, group) => sum + group.totalQty, 0)}</span>
                            </div>
                            <div className="text-sm font-bold text-gray-900">
                                Total: ₹{historyGroups.reduce((sum, group) => sum + group.totalAmount, 0).toLocaleString('en-IN')}
                            </div>
                        </div>
                    </div>
                    <div className="relative">
                        <select
                            value={dateFilter}
                            onChange={(e) => {
                                const value = e.target.value as 'all' | 'today' | 'yesterday' | 'custom';
                                setDateFilter(value);
                                if (value !== 'custom') {
                                    setCustomDate('');
                                }
                            }}
                            className="text-[11px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 appearance-none cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                        >
                            <option value="all">All</option>
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="custom">Custom Date</option>
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
               </div>

               {dateFilter === 'custom' && (
                    <div className="mb-4 px-1">
                        <input
                            type="date"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="text-sm font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
               )}
               
               <div className="space-y-4">
                   {historyGroups.map((supplierGroup) => {
                       const collapseKey = supplierGroup.supplierId;
                       const isExpanded = expandedSuppliers.has(collapseKey);
                       
                       return (
                       <div key={collapseKey} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                           {/* Supplier Header - With Info Icon */}
                           <button 
                               onClick={() => {
                                   const newExpanded = new Set(expandedSuppliers);
                                   if (newExpanded.has(collapseKey)) {
                                       newExpanded.delete(collapseKey);
                                   } else {
                                       newExpanded.add(collapseKey);
                                   }
                                   setExpandedSuppliers(newExpanded);
                               }}
                               className="w-full bg-slate-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center hover:bg-slate-200 transition-colors cursor-pointer"
                           >
                               <div className="flex items-center gap-2 flex-1 text-left">
                                   <ChevronDown 
                                       size={16} 
                                       className={`text-gray-600 transition-transform ${isExpanded ? '' : '-rotate-90'}`}
                                   />
                                   <div className="font-bold text-gray-700 text-sm">{supplierGroup.supplierName}</div>
                               </div>
                               <div className="flex items-center gap-2">
                                   {supplierGroup.totalAmount > 0 && (
                                       <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                                           ₹{supplierGroup.totalAmount.toLocaleString()}
                                       </span>
                                   )}
                                   <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-gray-200 text-gray-500">
                                       {supplierGroup.totalQty} Items
                                   </span>
                                   
                                   {isAdmin && (
                                       <button
                                           onClick={(e) => handleDeleteSupplierGroup(supplierGroup.supplierName, Object.values(supplierGroup.dateGroups).flatMap(dg => dg.logs), e)}
                                           disabled={deletingSupplier === supplierGroup.supplierName}
                                           className="p-1.5 rounded text-red-500 hover:bg-red-50 active:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                           title={`Delete all ${supplierGroup.totalQty} entries`}
                                       >
                                           <Trash2 size={14} />
                                       </button>
                                   )}
                               </div>
                           </button>

                           {isExpanded && (
                               <div className="divide-y divide-gray-50">
                                   {Object.entries(supplierGroup.dateGroups)
                                       .sort(([dateA], [dateB]) => {
                                           // Parse dates in format "DD Mon YYYY" and sort in descending order (newest first)
                                           const dateObjA = new Date(dateA);
                                           const dateObjB = new Date(dateB);
                                           return dateObjB.getTime() - dateObjA.getTime();
                                       })
                                       .map(([dateLabel, dateGroup]) => {
                                       const dateKey = `${supplierGroup.supplierId}-${dateLabel}`;
                                       const isDateExpanded = expandedDates.has(dateKey);
                                       
                                       // Calculate total amount for this date
                                       const dateTotal = dateGroup.logs.reduce((sum, log) => {
                                           const qty = (Object.values(log.receivedQty || {}) as number[]).reduce((a, b) => a + (b||0), 0);
                                           return sum + (qty * (log.price || 0));
                                       }, 0);
                                       
                                       return (
                                           <div key={dateLabel}>
                                               {/* Date Header */}
                                               <button
                                                   onClick={() => {
                                                       const newExpanded = new Set(expandedDates);
                                                       if (newExpanded.has(dateKey)) {
                                                           newExpanded.delete(dateKey);
                                                       } else {
                                                           newExpanded.add(dateKey);
                                                       }
                                                       setExpandedDates(newExpanded);
                                                   }}
                                                   className="w-full bg-gray-50 px-4 py-2 flex items-center justify-between hover:bg-gray-100 transition-colors cursor-pointer border-b border-gray-200"
                                               >
                                                   <div className="flex items-center gap-2">
                                                       <ChevronDown 
                                                           size={14} 
                                                           className={`text-gray-600 transition-transform ${isDateExpanded ? '' : '-rotate-90'}`}
                                                       />
                                                       <Calendar size={12} className="text-gray-500" />
                                                       <span className="text-xs font-semibold text-gray-700">{dateLabel}</span>
                                                   </div>
                                                   <div className="flex items-center gap-2">
                                                       {dateGroup.logs.length > 0 && (
                                                           <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-100">
                                                               {dateGroup.logs.reduce((sum, log) => sum + ((Object.values(log.receivedQty || {}) as number[]).reduce((a, b) => a + (b||0), 0)), 0)} Items
                                                           </span>
                                                       )}
                                                       {dateTotal > 0 && (
                                                           <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                                                               ₹{dateTotal.toLocaleString()}
                                                           </span>
                                                       )}
                                                   </div>
                                               </button>
                                               
                                               {/* Products under date */}
                                               {isDateExpanded && (
                                                   <div className="divide-y divide-gray-50">
                                                       {dateGroup.logs.map(log => {
                                                           const product = products.find(p => p.id === log.productId);
                                                           const receivedEntry = log.history.slice().reverse().find(h => h.action === 'received');
                                                           const timeStr = receivedEntry 
                                                               ? new Date(receivedEntry.timestamp).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
                                                               : '';
                                                           const qty = (Object.values(log.receivedQty || {}) as number[]).reduce((a, b) => a + (b||0), 0);
                                                           const sizeDetails = log.hasSizes 
                                                               ? Object.entries(log.receivedQty).map(([k,v]) => `${k}:${v}`).join(' ')
                                                               : '';
                                                           
                                                           return (
                                                               <div key={log.id} className="p-3 flex gap-3 items-center">
                                                                   <img 
                                                                       src={product?.imageUrl} 
                                                                       className="w-10 h-10 rounded-lg object-cover bg-gray-100" 
                                                                       alt=""
                                                                   />
                                                                   <div className="flex-1 min-w-0">
                                                                       <div className="text-xs font-bold text-gray-900 truncate">
                                                                           {product?.description && !product.description.toLowerCase().includes('item from order')
                                                                               ? product.description
                                                                               : 'Item'}
                                                                       </div>
                                                                       <div className="flex flex-col gap-1 mt-0.5">
                                                                           <div className="flex items-center gap-2">
                                                                               <span className="text-[9px] text-gray-500">{timeStr}</span>
                                                                               <span className="text-[9px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">Qty: {qty}</span>
                                                                               {log.price && (
                                                                                   <span className="text-[9px] font-semibold text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">₹{log.price}</span>
                                                                               )}
                                                                           </div>
                                                                           {sizeDetails && (
                                                                               <div className="text-[8px] text-gray-500 font-mono">{sizeDetails}</div>
                                                                           )}
                                                                       </div>
                                                                   </div>
                                                               </div>
                                                           );
                                                       })}
                                                   </div>
                                               )}
                                           </div>
                                       );
                                   })}
                               </div>
                           )}
                       </div>
                       );
                   })}
               </div>
          </div>
      )}

      {historyGroups.length === 0 && (
          <div className="border-t border-gray-200 pt-8 mt-8 mb-10">
               <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex-1">
                        <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                            <History size={14} /> Recent History
                        </h2>
                    </div>
                    <div className="relative">
                        <select
                            value={dateFilter}
                            onChange={(e) => {
                                const value = e.target.value as 'all' | 'today' | 'yesterday' | 'custom';
                                setDateFilter(value);
                                if (value !== 'custom') {
                                    setCustomDate('');
                                }
                            }}
                            className="text-[11px] font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 appearance-none cursor-pointer hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                        >
                            <option value="all">All</option>
                            <option value="today">Today</option>
                            <option value="yesterday">Yesterday</option>
                            <option value="custom">Custom Date</option>
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                    </div>
               </div>

               {dateFilter === 'custom' && (
                    <div className="mb-4 px-1">
                        <input
                            type="date"
                            value={customDate}
                            onChange={(e) => setCustomDate(e.target.value)}
                            className="text-sm font-medium text-gray-700 border border-gray-300 rounded-lg px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
               )}

               <div className="flex flex-col items-center justify-center text-gray-400 py-12 text-sm bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 animate-in fade-in">
                    <History size={32} className="mb-3 opacity-20" />
                    <span className="font-medium text-gray-500">No entries</span>
                    <span className="text-xs text-gray-400 mt-1">No purchases received in the selected period</span>
               </div>
          </div>
      )}
    </div>
  );
};

const HistoryLogItem: React.FC<{
    log: DailyLog;
    product: any;
    supplierName: string;
    onUpdateSupplier: (name: string) => void;
    onDelete: (logId: string) => Promise<void>;
    canEdit: boolean;
    isAdmin: boolean;
}> = ({ log, product, supplierName, onUpdateSupplier, onDelete, canEdit, isAdmin }) => {
    const { setPreviewImage } = useStore();
    const [isEditingSup, setIsEditingSup] = useState(false);
    const [tempSup, setTempSup] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    const handleDelete = async () => {
        if (!isAdmin) {
            alert('You do not have permission to delete entries');
            return;
        }

        const confirmed = window.confirm(`Are you sure you want to delete this entry from ${supplierName}? This action cannot be undone.`);
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

    const qty = (Object.values(log.receivedQty || {}) as number[]).reduce((a, b) => a + (b||0), 0);
    const amount = qty * (log.price || 0);

    const receivedEntry = log.history.slice().reverse().find(h => h.action === 'received');
    
    let timeStr = '';
    if (receivedEntry) {
        const d = new Date(receivedEntry.timestamp);
        timeStr = d.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
    }

    return (
        <>
        <div className="p-4 flex gap-4 opacity-80 hover:opacity-100 transition-opacity">
            <div 
                className="w-12 h-12 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden cursor-pointer shadow-sm"
                onClick={() => {
                    if (product?.imageUrl) {
                        const cleanDescription = product?.description && !product.description.toLowerCase().includes('item from order')
                            ? product.description
                            : 'Item';
                        setPreviewImage(product.imageUrl, {
                            title: cleanDescription,
                            qty: `Received: ${qty}`,
                            tag: 'RECEIVED'
                        });
                    }
                }}
            >
                {product?.imageUrl && <img src={product.imageUrl} className="w-full h-full object-cover" alt="" />}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                    <div className="text-xs font-bold text-gray-900 truncate pr-2">
                        {product?.description && !product.description.toLowerCase().includes('item from order')
                            ? product.description
                            : 'Item'}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded flex-shrink-0">
                            {timeStr}
                        </span>
                        {isAdmin && (
                            <button
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="p-1 rounded text-red-500 hover:bg-red-50 active:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                title="Delete entry"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex justify-between items-end mt-1">
                    <div className="flex-1 min-w-0 pr-2">
                        {isEditingSup ? (
                             <div className="flex gap-1 flex-1 items-center animate-in fade-in max-w-[180px]">
                                 <input 
                                    className="border text-xs w-full px-1.5 py-0.5 rounded text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" 
                                    value={tempSup} 
                                    onChange={e => setTempSup(e.target.value)} 
                                    placeholder="Supplier Name"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && tempSup.trim()) {
                                            onUpdateSupplier(tempSup);
                                            setIsEditingSup(false);
                                        }
                                    }}
                                 />
                                 <button 
                                    onClick={() => { 
                                        if(tempSup.trim()) { 
                                            onUpdateSupplier(tempSup); 
                                            setIsEditingSup(false); 
                                        } 
                                    }} 
                                    className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white px-1.5 py-0.5 rounded font-bold"
                                 >
                                    OK
                                 </button>
                                 <button 
                                    onClick={() => setIsEditingSup(false)} 
                                    className="text-gray-400 hover:text-gray-600 p-0.5"
                                 >
                                    <X size={12}/>
                                 </button>
                             </div>
                        ) : (
                             <div className="flex items-center gap-1.5 group">
                                <div className="text-[10px] text-gray-500 truncate">{supplierName}</div>
                                <button 
                                    onClick={() => { 
                                        if (canEdit) {
                                            setTempSup(supplierName === 'Unknown' ? '' : supplierName); 
                                            setIsEditingSup(true);
                                        }
                                    }}
                                    disabled={!canEdit}
                                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-blue-500 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Edit2 size={10}/>
                                </button>
                             </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {amount > 0 && (
                             <span className="text-[10px] font-medium text-gray-500">
                                 ₹{amount}
                             </span>
                        )}
                        <span className="text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full border border-gray-200">
                            Qty: {qty}
                        </span>
                        <div className="text-green-600">
                            <CheckCircle2 size={16} />
                        </div>
                    </div>
                </div>
                {log.pickupProofUrl && (
                    <div className="mt-2">
                        <button 
                            onClick={() => setPreviewImage(log.pickupProofUrl || null, { tag: 'PROOF' })}
                            className="flex items-center gap-1 text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
                        >
                            <Camera size={10} /> View Proof
                        </button>
                    </div>
                )}
            </div>
        </div>

        {/* History Modal */}
        {showHistory && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
                <div className="bg-white w-full rounded-t-3xl p-4 max-h-[80vh] overflow-y-auto animate-in slide-in-from-bottom">
                    <div className="flex items-center justify-between mb-4 sticky top-0 bg-white">
                        <div className="flex items-center gap-2">
                            <History size={18} className="text-gray-600" />
                            <h3 className="text-lg font-bold text-gray-900">Purchase History</h3>
                        </div>
                        <button
                            onClick={() => setShowHistory(false)}
                            className="p-1 hover:bg-gray-100 rounded transition"
                        >
                            <X size={20} />
                        </button>
                    </div>
                    
                    <div className="space-y-2">
                        {log.history.map((entry, idx) => (
                            <div key={idx} className="p-3 bg-gray-50 rounded-lg text-sm">
                                <div className="font-bold text-gray-900">
                                    {new Date(entry.timestamp).toLocaleString('en-GB', { 
                                        day: 'numeric', 
                                        month: 'short', 
                                        year: 'numeric',
                                        hour: 'numeric', 
                                        minute: '2-digit', 
                                        hour12: true 
                                    })}
                                </div>
                                <div className="text-[10px] text-gray-600 mt-1">{entry.action}</div>
                                {entry.details && <div className="text-[10px] text-gray-500 mt-1">{entry.details}</div>}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
        </>
    );
}

const WarehouseItem: React.FC<{ 
    log: DailyLog; 
    product: any; 
    supplierName: string; 
    supplierPhone?: string;
    onVerify: (rec: Record<string, number>, price?: number, supName?: string, supPhone?: string) => void;
    onUpdateSupplier: (name: string) => void;
    onDelete: (logId: string) => Promise<void>;
    canEdit: boolean;
    isAdmin: boolean;
}> = ({ log, product, supplierName, supplierPhone, onVerify, onUpdateSupplier, onDelete, canEdit, isAdmin }) => {
    const { setPreviewImage } = useStore();
    // Initialize received quantity to 0 for all picked items
    const [received, setReceived] = useState<Record<string, number>>(() => {
        const initial: Record<string, number> = {};
        Object.keys(log.pickedQty).forEach(key => {
            initial[key] = 0;
        });
        return initial;
    });
    
    const [isSaved, setIsSaved] = useState(false);
    const [isEditingSup, setIsEditingSup] = useState(false);
    const [tempSup, setTempSup] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!isAdmin) {
            alert('You do not have permission to delete entries');
            return;
        }

        const confirmed = window.confirm(`Are you sure you want to delete this entry from ${supplierName}? This action cannot be undone.`);
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

    // Mandatory Field State
    // Initialize price even when it's 0. Treat undefined/null as missing.
    const [price, setPrice] = useState<string>(log.price !== undefined && log.price !== null ? String(log.price) : '');
    const [priceError, setPriceError] = useState(false);

    // Supplier mandatory check if unknown
    const isSupplierUnknown = supplierName === 'Unknown Supplier' || supplierName === 'Unknown';
    // If supplier is known but phone is missing
    const isPhoneMissing = !supplierPhone && !isSupplierUnknown; 
    
    const [missingSupName, setMissingSupName] = useState('');
    const [missingSupPhone, setMissingSupPhone] = useState('');
    const [supError, setSupError] = useState(false);
    const [phoneError, setPhoneError] = useState(false);

    const isPriceMissing = log.price === undefined || log.price === null;

    const handleSave = () => {
        // Check permission first
        if (!canEdit) {
            alert('You do not have permission to confirm receipts');
            return;
        }
        
        let hasError = false;

        // Check Mandatory Supplier Name (only if supplier is unknown)
        if (isSupplierUnknown && !missingSupName) {
            setSupError(true);
            hasError = true;
        }

        if (hasError) return;

        // Price and Phone are now optional
        const finalPrice = price ? parseFloat(price) : undefined;
        onVerify(received, finalPrice, missingSupName || undefined, missingSupPhone || undefined);
        setIsSaved(true);
    };

    const updateQty = (size: string, delta: number) => {
        if (!canEdit) return;
        
        const limit = log.pickedQty[size] || 0;
        setReceived(prev => {
            const current = prev[size] ?? 0;
            const next = current + delta;

            // Enforce constraints
            if (next < 0) return prev;
            if (next > limit) return prev;

            return { ...prev, [size]: next };
        });
    };

    if (isSaved) return null;

    const pickupEntry = log.history.slice().reverse().find(h => 
        h.action === 'pickup' || h.action === 'pickup_full_dispatch' || h.action === 'pickup_split_dispatch'
    );
    const pickupTime = pickupEntry 
        ? new Date(pickupEntry.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).replace(',', '')
        : '';

    const handlePreview = () => {
        if (!product?.imageUrl) return;
        
        let sizeDetails = "";
        let totalQty = 0;
        
        if (log.hasSizes) {
            // Show picked qty here as that's what we are receiving
            sizeDetails = Object.entries(log.pickedQty).map(([k,v]) => `${k}:${v}`).join('  ');
            // Fixed type error for reduce accumulator/current value
            totalQty = (Object.values(log.pickedQty) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
        } else {
            totalQty = log.pickedQty['Total'] || 0;
        }

        setPreviewImage(product.imageUrl, {
            title: product.description,
            qty: `Dispatched: ${totalQty}`,
            sizeDetails: sizeDetails,
            tag: 'INCOMING'
        });
    };

    return (
        <div className="p-4">
            <div className="flex gap-4 mb-3">
                <img 
                    src={product.imageUrl} 
                    className="w-14 h-14 rounded-xl object-cover bg-gray-100 cursor-pointer border border-gray-100 shadow-sm" 
                    alt="p"
                    onClick={handlePreview}
                />
                <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                        <div className="flex items-center gap-1.5">
                             {pickupTime && (
                                 <div className="flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-100">
                                     <Clock size={10} />
                                     <span className="text-[9px] font-bold uppercase">Picked: {pickupTime}</span>
                                 </div>
                             )}
                        </div>
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

                    <div className="flex justify-between items-center min-h-[24px]">
                        {isEditingSup ? (
                             <div className="flex gap-2 flex-1 items-center animate-in fade-in">
                                 <input 
                                    className="border text-xs w-full px-2 py-1 rounded text-gray-900 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500" 
                                    value={tempSup} 
                                    onChange={e => setTempSup(e.target.value)} 
                                    placeholder="Supplier Name"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && tempSup.trim()) {
                                            onUpdateSupplier(tempSup);
                                            setIsEditingSup(false);
                                        }
                                    }}
                                 />
                                 <button 
                                    onClick={() => { 
                                        if(tempSup.trim()) { 
                                            onUpdateSupplier(tempSup); 
                                            setIsEditingSup(false); 
                                        } 
                                    }} 
                                    className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded font-bold"
                                 >
                                    OK
                                 </button>
                                 <button 
                                    onClick={() => setIsEditingSup(false)} 
                                    className="text-gray-400 hover:text-gray-600 p-1"
                                 >
                                    <X size={14}/>
                                 </button>
                             </div>
                        ) : (
                             <>
                                <div className="text-[10px] font-bold text-gray-400 uppercase">{supplierName}</div>
                                <button 
                                    onClick={() => { 
                                        setTempSup(supplierName === 'Unknown' ? '' : supplierName); 
                                        setIsEditingSup(true); 
                                    }}
                                    className="p-1 hover:bg-gray-100 rounded transition-colors"
                                >
                                    <Edit2 size={12} className="text-gray-400"/>
                                </button>
                             </>
                        )}
                    </div>

                    <div className="font-bold text-gray-900 text-xs mt-0.5 line-clamp-1">
                        {product.description && !product.description.toLowerCase().includes('item from order') 
                            ? product.description 
                            : 'Item'}
                    </div>
                    
                    {/* Display Note if exists - HIDDEN FOR CLEANER UI */}
                    {/* {log.notes && (
                        <div className="mt-2 flex items-start gap-2 bg-yellow-50 text-yellow-800 p-2 rounded-lg text-[10px] border border-yellow-100">
                            <AlertCircle size={12} className="mt-0.5 shrink-0" />
                            <span className="font-medium">{log.notes}</span>
                        </div>
                    )} */}
                    
                    {/* Pickup Proof Image */}
                    {log.pickupProofUrl && (
                        <div className="mt-2">
                             <div className="text-[9px] font-bold text-gray-400 mb-1 flex items-center gap-1">
                                 <Camera size={10} /> PICKUP PROOF
                             </div>
                             <img 
                                src={log.pickupProofUrl} 
                                className="h-24 w-full object-cover rounded-xl border border-gray-200 cursor-pointer shadow-sm" 
                                alt="Pickup Proof"
                                onClick={() => setPreviewImage(log.pickupProofUrl || null, { tag: 'PROOF' })}
                             />
                         </div>
                    )}
                </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-3 space-y-2 mb-4 border border-gray-100">
                {Object.entries(log.pickedQty).map(([size, pickedVal]) => {
                    const currentReceived = received[size] ?? 0;
                    const isMaxed = currentReceived >= pickedVal;
                    // Get ordered qty, fallback to 0. Use log.orderedQty
                    const orderedVal = log.orderedQty[size] || 0;
                    
                    return (
                        <div key={size} className="flex items-center justify-between">
                            <span className="font-bold w-10 text-xs text-gray-700">{size === 'Total' ? 'Qty' : size}</span>
                            <div className="flex items-center gap-3">
                                <div className="text-right">
                                    <span className="block text-[8px] text-gray-400 font-bold uppercase">Ord</span>
                                    <span className="font-bold text-gray-700 text-sm">{orderedVal}</span>
                                </div>
                                <div className="text-right">
                                    <span className="block text-[8px] text-gray-400 font-bold uppercase">Picked</span>
                                    <span className="font-bold text-gray-700 text-sm">{pickedVal}</span>
                                </div>
                                
                                <div className="flex flex-col items-center">
                                    <span className="block text-[8px] text-blue-600 font-bold mb-1 uppercase">Received</span>
                                    <div className="flex items-center gap-1">
                                        <button 
                                            onClick={() => canEdit && updateQty(size, -1)}
                                            disabled={!canEdit}
                                            className="w-8 h-8 flex items-center justify-center bg-white border border-gray-200 hover:bg-gray-100 active:bg-gray-200 rounded text-gray-600 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <Minus size={14} strokeWidth={2.5} />
                                        </button>
                                        
                                        <div className="w-10 h-8 flex items-center justify-center bg-white border border-gray-200 rounded text-sm font-bold text-gray-900">
                                            {currentReceived}
                                        </div>

                                        <button 
                                            onClick={() => canEdit && updateQty(size, 1)}
                                            disabled={isMaxed || !canEdit}
                                            className={`w-8 h-8 flex items-center justify-center rounded shadow-sm transition-colors ${
                                                isMaxed || !canEdit
                                                ? 'bg-gray-200 text-gray-300 cursor-not-allowed' 
                                                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-md'
                                            }`}
                                        >
                                            <Plus size={14} strokeWidth={2.5} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* OPTIONAL DETAILS SECTION */}
            {(canEdit || isPriceMissing || isSupplierUnknown || isPhoneMissing) && (
                <div className="mb-4 bg-blue-50/50 p-3 rounded-xl border border-blue-100 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-center gap-1 text-blue-800 mb-2">
                        <AlertTriangle size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Additional Details (Optional)</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                        {/* Price Input (editable by warehouse staff). If user cannot edit, show read-only price when present. */}
                        {canEdit ? (
                            <div className="relative">
                                <div className="absolute left-2 top-2 text-gray-400"><Banknote size={12}/></div>
                                <input 
                                    type="number" 
                                    disabled={!canEdit}
                                    className={`w-full pl-6 pr-2 py-1.5 text-xs font-bold rounded-lg border focus:outline-none focus:ring-1 bg-white disabled:opacity-60 disabled:cursor-not-allowed ${priceError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200'}`}
                                    placeholder="Price (₹)"
                                    value={price}
                                    onChange={(e) => { if(canEdit) setPrice(e.target.value); setPriceError(false); }}
                                />
                            </div>
                        ) : (
                            log.price !== undefined && log.price !== null && (
                                <div className="relative">
                                    <div className="absolute left-2 top-2 text-gray-400"><Banknote size={12}/></div>
                                    <div className="w-full pl-6 pr-2 py-1.5 text-xs font-bold rounded-lg border bg-white">
                                        ₹{String(log.price)}
                                    </div>
                                </div>
                            )
                        )}

                        {/* Supplier Name Input (if unknown) */}
                        {isSupplierUnknown && (
                            <div className="relative">
                                <div className="absolute left-2 top-2 text-gray-400"><User size={12}/></div>
                                <input 
                                    disabled={!canEdit}
                                    className={`w-full pl-6 pr-2 py-1.5 text-xs font-bold rounded-lg border focus:outline-none focus:ring-1 bg-white disabled:opacity-60 disabled:cursor-not-allowed ${supError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200'}`}
                                    placeholder="Sup. Name"
                                    value={missingSupName}
                                    onChange={(e) => { if(canEdit) setMissingSupName(e.target.value); setSupError(false); }}
                                />
                            </div>
                        )}

                        {/* Supplier Phone Input */}
                        {(isPhoneMissing || missingSupName) && (
                            <div className="relative col-span-2">
                                 <div className="absolute left-2 top-2 text-gray-400"><Phone size={12}/></div>
                                <input 
                                    type="tel"
                                    disabled={!canEdit}
                                    className={`w-full pl-6 pr-2 py-1.5 text-xs font-bold rounded-lg border focus:outline-none focus:ring-1 bg-white disabled:opacity-60 disabled:cursor-not-allowed ${phoneError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200'}`}
                                    placeholder="Supplier Phone Number"
                                    value={missingSupPhone}
                                    onChange={(e) => { if(canEdit) setMissingSupPhone(e.target.value); setPhoneError(false); }}
                                />
                            </div>
                        )}
                    </div>
                </div>
            )}
 
            <button 
                onClick={handleSave}
                disabled={!canEdit}
                className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black text-xs shadow-lg active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
            >
                Confirm Receipt
            </button>
        </div>
    );
};
