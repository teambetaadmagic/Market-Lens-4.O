import React, { useState, useMemo, useRef } from 'react';
import { useStore } from '../context/StoreContext';
import { ChevronDown, ChevronUp, Upload, AlertCircle, Trash2, DollarSign, Percent } from 'lucide-react';
import { BillingEntry, DailyLog } from '../types';
import { canEditView } from '../utils/permissions';

export const BillingView: React.FC = () => {
  const storeData = useStore();
  const { billingEntries = [], dailyLogs = [], suppliers = [], products = [], user, createOrUpdateBillingEntry, uploadBillingProof, updateBillingGST, deleteBillingEntry } = storeData;

  // Check if user can edit this view
  const canEdit = user ? canEditView(user.role, 'billing') : false;

  // Get received/confirmed inward logs
  const receivedLogs = useMemo(() => {
    return dailyLogs.filter(l => ['received_full', 'received_partial'].includes(l.status));
  }, [dailyLogs]);

  // Group by supplier and date
  const groupedBySupplier = useMemo(() => {
    const supplierMap: Record<string, Record<string, DailyLog[]>> = {};

    receivedLogs.forEach(log => {
      const supName = suppliers.find(s => s.id === log.supplierId)?.name || 'Unknown';
      const supId = log.supplierId || 'unknown';

      if (!supplierMap[supId]) {
        supplierMap[supId] = {};
      }

      if (!supplierMap[supId][log.date]) {
        supplierMap[supId][log.date] = [];
      }

      supplierMap[supId][log.date].push(log);
    });

    // Convert to array format
    return Object.entries(supplierMap).map(([supId, dateMap]) => ({
      supplierId: supId,
      supplierName: suppliers.find(s => s.id === supId)?.name || 'Unknown',
      dates: Object.entries(dateMap)
        .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
        .map(([date, logs]) => ({
          date,
          logs,
          totalReceivedQty: logs.reduce((sum, log) => {
            const qty = Object.values(log.receivedQty || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
            return sum + qty;
          }, 0)
        }))
    }));
  }, [receivedLogs, suppliers]);

  return (
    <div className="pb-36 pt-0 px-3 max-w-lg mx-auto min-h-screen relative">
      {/* Read-Only Banner */}
      {!canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 flex items-center gap-2">
          <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
          <p className="text-xs font-semibold text-amber-800">Read-only mode: You cannot edit billing entries</p>
        </div>
      )}

      {/* Sticky Header */}
      <div className="flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur-sm z-30 py-3 mb-4 border-b border-gray-100 -mx-3 px-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Billing</h1>
        <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full">
          {groupedBySupplier.length} Suppliers
        </span>
      </div>

      {groupedBySupplier.length === 0 ? (
        <div className="text-center text-gray-400 mt-20 text-sm flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
            <DollarSign size={32} className="text-gray-300" />
          </div>
          <p className="font-medium">No confirmed inward receipts</p>
          <p className="text-xs mt-1">Complete warehouse inward to start billing</p>
        </div>
      ) : (
        groupedBySupplier.map((supplierGroup) => (
          <SupplierBillingGroup
            key={supplierGroup.supplierId}
            supplierGroup={supplierGroup}
            products={products}
            billingEntries={billingEntries}
            canEdit={canEdit}
            onCreateEntry={createOrUpdateBillingEntry}
            onUploadProof={uploadBillingProof}
            onUpdateGST={updateBillingGST}
            onDelete={deleteBillingEntry}
          />
        ))
      )}
    </div>
  );
};

interface SupplierBillingGroupProps {
  supplierGroup: any;
  products: any[];
  billingEntries: any[];
  canEdit: boolean;
  onCreateEntry: (inwardLogId: string, pricePerUnit: number, gstEnabled?: boolean) => Promise<string>;
  onUploadProof: (billingId: string, proofType: 'bill' | 'payment', imageBase64: string) => Promise<void>;
  onUpdateGST: (billingId: string, gstEnabled: boolean) => Promise<void>;
  onDelete: (billingId: string) => Promise<void>;
}

const SupplierBillingGroup: React.FC<SupplierBillingGroupProps> = ({
  supplierGroup,
  products,
  billingEntries,
  canEdit,
  onCreateEntry,
  onUploadProof,
  onUpdateGST,
  onDelete
}) => {
  const [expandedSupplier, setExpandedSupplier] = useState(false);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const toggleDateExpand = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const totalQty = useMemo(() => {
    return supplierGroup.dates.reduce((sum: number, dateGroup: any) => sum + dateGroup.totalReceivedQty, 0);
  }, [supplierGroup.dates]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
      {/* Supplier Header */}
      <div
        onClick={() => setExpandedSupplier(!expandedSupplier)}
        className="w-full p-3 border-b border-gray-200 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
      >
        <div className="flex justify-between items-center">
          <span className="font-bold text-gray-900 text-sm truncate">{supplierGroup.supplierName}</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold bg-white px-2 py-1 rounded-full border border-gray-200 text-gray-500 shadow-sm">
              {totalQty} Items
            </span>
            <div className="text-gray-400">
              {expandedSupplier ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
          </div>
        </div>
      </div>

      {expandedSupplier && (
        <div className="p-3 space-y-4">
          {supplierGroup.dates.map((dateGroup: any) => (
            <DateBillingGroup
              key={dateGroup.date}
              date={dateGroup.date}
              logs={dateGroup.logs}
              totalReceivedQty={dateGroup.totalReceivedQty}
              products={products}
              billingEntries={billingEntries}
              canEdit={canEdit}
              onCreateEntry={onCreateEntry}
              onUploadProof={onUploadProof}
              onUpdateGST={onUpdateGST}
              onDelete={onDelete}
              isExpanded={expandedDates.has(dateGroup.date)}
              onToggleExpand={() => toggleDateExpand(dateGroup.date)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface DateBillingGroupProps {
  date: string;
  logs: DailyLog[];
  totalReceivedQty: number;
  products: any[];
  billingEntries: any[];
  canEdit: boolean;
  onCreateEntry: (inwardLogId: string, pricePerUnit: number, gstEnabled?: boolean) => Promise<string>;
  onUploadProof: (billingId: string, proofType: 'bill' | 'payment', imageBase64: string) => Promise<void>;
  onUpdateGST: (billingId: string, gstEnabled: boolean) => Promise<void>;
  onDelete: (billingId: string) => Promise<void>;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const DateBillingGroup: React.FC<DateBillingGroupProps> = ({
  date,
  logs,
  totalReceivedQty,
  products,
  billingEntries,
  canEdit,
  onCreateEntry,
  onUploadProof,
  onUpdateGST,
  onDelete,
  isExpanded,
  onToggleExpand
}) => {
  const formatDate = new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      {/* Date Header */}
      <div
        onClick={onToggleExpand}
        className="p-3 bg-gray-100 hover:bg-gray-150 cursor-pointer transition-colors flex justify-between items-center"
      >
        <span className="text-sm font-bold text-gray-900">{formatDate}</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-bold bg-white px-2 py-0.5 rounded border border-gray-200 text-gray-600">
            {totalReceivedQty} Qty
          </span>
          <div className="text-gray-400">
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3 space-y-4">
          {logs.map(log => (
            <BillingEntryCard
              key={log.id}
              log={log}
              product={products.find(p => p.id === log.productId)}
              billingEntry={billingEntries.find(b => b.inwardLogId === log.id)}
              canEdit={canEdit}
              onCreateEntry={onCreateEntry}
              onUploadProof={onUploadProof}
              onUpdateGST={onUpdateGST}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface BillingEntryCardProps {
  log: DailyLog;
  product: any;
  billingEntry: BillingEntry | undefined;
  canEdit: boolean;
  onCreateEntry: (inwardLogId: string, pricePerUnit: number, gstEnabled?: boolean) => Promise<string>;
  onUploadProof: (billingId: string, proofType: 'bill' | 'payment', imageBase64: string) => Promise<void>;
  onUpdateGST: (billingId: string, gstEnabled: boolean) => Promise<void>;
  onDelete: (billingId: string) => Promise<void>;
}

const BillingEntryCard: React.FC<BillingEntryCardProps> = ({
  log,
  product,
  billingEntry,
  canEdit,
  onCreateEntry,
  onUploadProof,
  onUpdateGST,
  onDelete
}) => {
  const [editPrice, setEditPrice] = useState(billingEntry?.pricePerUnit.toString() || '');
  const [isEditingPrice, setIsEditingPrice] = useState(!billingEntry);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const billProofInputRef = useRef<HTMLInputElement>(null);
  const paymentProofInputRef = useRef<HTMLInputElement>(null);

  const totalReceivedQty = useMemo(() => {
    return Object.values(log.receivedQty || {}).reduce((a: number, b: any) => a + (Number(b) || 0), 0);
  }, [log.receivedQty]);

  const handleSavePrice = async () => {
    if (!editPrice || isNaN(parseFloat(editPrice))) {
      return;
    }

    setIsSaving(true);
    try {
      await onCreateEntry(log.id, parseFloat(editPrice), billingEntry?.gstEnabled || false);
      setIsEditingPrice(false);
    } catch (error: any) {
      console.error('Error saving price:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleGST = async () => {
    if (!billingEntry) {
      alert('Please save price first');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdateGST(billingEntry.id, !billingEntry.gstEnabled);
    } catch (error: any) {
      console.error('Error updating GST:', error);
      alert(`Error: ${error?.message || 'Failed to update GST'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleProofUpload = async (file: File, proofType: 'bill' | 'payment') => {
    if (!billingEntry) {
      alert('Please save price first');
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageBase64 = reader.result as string;
        try {
          await onUploadProof(billingEntry.id, proofType, imageBase64);
          alert(`${proofType === 'bill' ? 'Bill' : 'Payment'} proof uploaded successfully`);
        } catch (error: any) {
          console.error('Error uploading proof:', error);
          alert(`Error: ${error?.message || 'Failed to upload proof'}`);
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (e) {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!billingEntry) return;

    const confirmed = window.confirm('Are you sure you want to delete this billing entry?');
    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await onDelete(billingEntry.id);
      alert('Billing entry deleted successfully');
    } catch (error: any) {
      console.error('Error deleting entry:', error);
      alert(`Error: ${error?.message || 'Failed to delete'}`);
    } finally {
      setIsDeleting(false);
    }
  };

  // Status indicators
  const billProofStatus = billingEntry?.supplierBillProof ? 'green' : 'red';
  const paymentProofStatus = billingEntry?.paymentProof ? 'green' : 'red';

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-3">
      {/* Product Info */}
      <div className="flex gap-3">
        {product?.imageUrl && (
          <img
            src={product.imageUrl}
            alt="product"
            className="w-12 h-12 rounded-lg object-cover bg-gray-100 border border-gray-100"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-gray-900">
            {product?.description && !product.description.toLowerCase().includes('item from order')
              ? product.description
              : 'Item'}
          </div>
          <div className="text-xs text-gray-500 mt-1">Received: {totalReceivedQty} units</div>
        </div>
      </div>

      {/* Pricing Section */}
      {isEditingPrice ? (
        <div className="space-y-2 bg-blue-50 p-2 rounded-lg border border-blue-200">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-gray-700 uppercase block mb-1">Price Per Unit (₹)</label>
              <input
                type="number"
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={!canEdit}
              />
            </div>
            <button
              onClick={handleSavePrice}
              disabled={!canEdit || isSaving || !editPrice}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-1.5 rounded font-bold text-[10px] transition-colors"
            >
              {isSaving ? '...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 p-2 rounded-lg border border-green-200">
          <div className="flex justify-between items-center gap-2">
            <div className="flex-1">
              <div className="text-[10px] font-bold text-gray-600 uppercase">Price</div>
              <div className="text-base font-bold text-gray-900">₹{billingEntry.pricePerUnit}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-gray-600">Total</div>
              <div className="text-sm font-bold text-gray-900">₹{billingEntry.totalAmount}</div>
            </div>
            {canEdit && (
              <button
                onClick={() => setIsEditingPrice(true)}
                className="text-blue-600 hover:text-blue-700 font-bold text-[10px] px-2 py-1 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
              >
                Edit
              </button>
            )}
            <button
              onClick={handleToggleGST}
              disabled={!canEdit || isSaving}
              className={`px-2 py-1.5 rounded font-bold text-[10px] flex items-center gap-0.5 transition-colors ${
                billingEntry.gstEnabled
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } disabled:opacity-50`}
              title="Toggle 5% GST"
            >
              <Percent size={12} />
              GST
            </button>
          </div>

          {billingEntry.gstEnabled && (
            <div className="text-[9px] bg-white p-1.5 rounded border border-amber-200 mt-2">
              <div className="flex justify-between">
                <span className="text-gray-600">GST (5%)</span>
                <span className="font-bold text-amber-700">₹{billingEntry.gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-gray-900">Final</span>
                <span className="text-green-700">₹{billingEntry.finalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {billingEntry && (
        <>
          {/* Image Proofs */}
          <div className="grid grid-cols-2 gap-2">
            {/* Vendor Bill Proof */}
            <button
              onClick={() => billProofInputRef.current?.click()}
              disabled={!canEdit || isUploading}
              className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-gray-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Upload size={16} className="text-gray-400" />
              <span className="text-sm font-bold text-gray-700">Vendor Bill</span>
              {billingEntry.supplierBillProof && (
                <div className={`w-2.5 h-2.5 rounded-full ml-auto ${billProofStatus === 'green' ? 'bg-green-500' : 'bg-red-500'}`}></div>
              )}
            </button>
            <input
              ref={billProofInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleProofUpload(file, 'bill');
              }}
              style={{ display: 'none' }}
            />

            {/* Paid Proof */}
            <button
              onClick={() => paymentProofInputRef.current?.click()}
              disabled={!canEdit || isUploading}
              className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center hover:border-gray-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              <Upload size={16} className="text-gray-400" />
              <span className="text-sm font-bold text-gray-700">Paid Proof</span>
              {billingEntry.paymentProof && (
                <div className={`w-2.5 h-2.5 rounded-full ml-auto ${paymentProofStatus === 'green' ? 'bg-green-500' : 'bg-red-500'}`}></div>
              )}
            </button>
            <input
              ref={paymentProofInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleProofUpload(file, 'payment');
              }}
              style={{ display: 'none' }}
            />
          </div>

          {/* Delete Button */}
          {canEdit && (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="w-full bg-red-50 hover:bg-red-100 text-red-600 font-bold text-sm py-2 rounded-lg border border-red-200 transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete Entry'}
            </button>
          )}
        </>
      )}
    </div>
  );
};
