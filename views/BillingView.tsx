import React, { useState, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { ChevronDown, Check, X, Upload, ToggleLeft, ToggleRight } from 'lucide-react';

export const BillingView: React.FC = () => {
  const { dailyLogs = [], suppliers = [], user } = useStore();

  // Only accountants and admins can see this
  const canView = user?.role === 'accountant' || user?.role === 'admin';

  if (!canView) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-600">You don't have access to billing</p>
      </div>
    );
  }

  // Group received items by supplier and date
  const billingData = useMemo(() => {
    const receivedLogs = dailyLogs.filter(l => 
      l.status === 'received_full' || l.status === 'received_partial'
    );

    const grouped: Record<string, { 
      supplierId: string;
      supplierName: string;
      dateGroups: Record<string, {
        date: string;
        logs: typeof receivedLogs;
      }>;
    }> = {};

    receivedLogs.forEach(log => {
      const supId = log.supplierId || 'unknown';
      if (!grouped[supId]) {
        const supplier = suppliers.find(s => s.id === supId);
        grouped[supId] = {
          supplierId: supId,
          supplierName: supplier?.name || 'Unknown',
          dateGroups: {}
        };
      }

      const date = log.date;
      if (!grouped[supId].dateGroups[date]) {
        grouped[supId].dateGroups[date] = {
          date,
          logs: []
        };
      }

      grouped[supId].dateGroups[date].logs.push(log);
    });

    return grouped;
  }, [dailyLogs, suppliers]);

  return (
    <div className="pb-36 pt-0 px-3 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-30 py-3 mb-4 border-b border-gray-100 -mx-3 px-4">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Billing</h1>
      </div>

      {Object.keys(billingData).length === 0 ? (
        <div className="flex flex-col items-center justify-center text-gray-400 mt-20 mb-8 text-sm bg-gray-50 py-10 rounded-2xl border-2 border-dashed border-gray-200">
          <span className="font-medium text-gray-500">No received items yet</span>
          <span className="text-xs text-gray-400 mt-1">Complete warehouse inward to start billing</span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Supplier Dropdown */}
          {Object.entries(billingData).map(([supplierId, supplierGroup]) => (
            <SupplierBillingGroup
              key={supplierId}
              supplierId={supplierId}
              supplierName={supplierGroup.supplierName}
              dateGroups={supplierGroup.dateGroups}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const SupplierBillingGroup: React.FC<{
  supplierId: string;
  supplierName: string;
  dateGroups: Record<string, { date: string; logs: any[] }>;
}> = ({ supplierId, supplierName, dateGroups }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Supplier Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full bg-slate-100 px-4 py-3 border-b border-gray-200 flex justify-between items-center hover:bg-slate-200 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 flex-1 text-left">
          <ChevronDown 
            size={16} 
            className={`text-gray-600 transition-transform ${expanded ? '' : '-rotate-90'}`}
          />
          <div className="font-bold text-gray-800 text-sm">{supplierName}</div>
        </div>
        <span className="text-[10px] font-bold bg-white px-2 py-0.5 rounded-full border border-gray-200 text-gray-500">
          {Object.keys(dateGroups).length} dates
        </span>
      </button>

      {expanded && (
        <div className="divide-y divide-gray-50">
          {/* Date-wise entries */}
          {Object.entries(dateGroups).map(([date, dateGroup]) => (
            <DateBillingEntry
              key={date}
              date={date}
              logs={dateGroup.logs}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const DateBillingEntry: React.FC<{
  date: string;
  logs: any[];
}> = ({ date, logs }) => {
  const [expanded, setExpanded] = useState(false);
  const [pricePerUnit, setPricePerUnit] = useState('');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [billProofUploaded, setBillProofUploaded] = useState(false);
  const [paymentProofUploaded, setPaymentProofUploaded] = useState(false);

  // Calculate total received quantity
  const totalQty = logs.reduce((sum, log) => {
    const qty = Object.values(log.receivedQty || {}).reduce((a: number, b: number) => a + b, 0);
    return sum + qty;
  }, 0);

  // Calculate amounts
  const baseAmount = totalQty * (parseFloat(pricePerUnit) || 0);
  const gstAmount = gstEnabled ? baseAmount * 0.05 : 0;
  const finalAmount = baseAmount + gstAmount;

  return (
    <div className="p-4 space-y-4">
      {/* Date Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex justify-between items-center hover:bg-gray-50 p-2 rounded transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChevronDown 
            size={14} 
            className={`text-gray-600 transition-transform ${expanded ? '' : '-rotate-90'}`}
          />
          <span className="font-semibold text-gray-800">{date}</span>
        </div>
        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
          {totalQty} Units
        </span>
      </button>

      {expanded && (
        <div className="space-y-4 bg-gray-50 p-3 rounded-lg">
          {/* Quantity (Read-only) */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase">Received Quantity</label>
            <div className="text-lg font-bold text-gray-900 mt-1">{totalQty} units</div>
            <div className="text-xs text-gray-500 mt-1">
              {logs.map((log, idx) => {
                const qty = Object.entries(log.receivedQty || {})
                  .map(([k, v]) => `${k}:${v}`)
                  .join(', ');
                return <div key={idx}>{qty}</div>;
              })}
            </div>
          </div>

          {/* Price Input */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase">Price Per Unit (₹)</label>
            <input
              type="number"
              value={pricePerUnit}
              onChange={(e) => setPricePerUnit(e.target.value)}
              className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>

          {/* GST Toggle */}
          <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-gray-200">
            <div>
              <div className="text-xs font-bold text-gray-600 uppercase">GST (5%)</div>
              <div className="text-sm text-gray-500 mt-0.5">Add 5% GST</div>
            </div>
            <button
              onClick={() => setGstEnabled(!gstEnabled)}
              className="transition-colors"
            >
              {gstEnabled ? (
                <ToggleRight size={24} className="text-blue-600" />
              ) : (
                <ToggleLeft size={24} className="text-gray-400" />
              )}
            </button>
          </div>

          {/* Amount Summary */}
          {pricePerUnit && (
            <div className="bg-white p-3 rounded-lg border border-gray-200 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Base Amount:</span>
                <span className="font-bold text-gray-900">₹{baseAmount.toFixed(2)}</span>
              </div>
              {gstEnabled && (
                <div className="flex justify-between text-sm border-t border-gray-100 pt-2">
                  <span className="text-gray-600">GST (5%):</span>
                  <span className="font-bold text-gray-900">₹{gstAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold border-t border-gray-100 pt-2">
                <span className="text-gray-900">Final Amount:</span>
                <span className="text-blue-600">₹{finalAmount.toFixed(2)}</span>
              </div>
            </div>
          )}

          {/* Image Uploads */}
          <div className="space-y-2">
            {/* Supplier Bill Proof */}
            <ProofUploadSection
              title="Supplier Bill Proof"
              uploaded={billProofUploaded}
              onUpload={() => setBillProofUploaded(!billProofUploaded)}
            />
            
            {/* Payment Proof */}
            <ProofUploadSection
              title="Payment Proof"
              uploaded={paymentProofUploaded}
              onUpload={() => setPaymentProofUploaded(!paymentProofUploaded)}
            />
          </div>

          {/* Status Indicators */}
          <div className="flex gap-3 justify-center pt-2">
            <div className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-full ${billProofUploaded ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-600">Bill</span>
            </div>
            <div className="flex items-center gap-1">
              <div className={`w-3 h-3 rounded-full ${paymentProofUploaded ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className="text-xs text-gray-600">Payment</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ProofUploadSection: React.FC<{
  title: string;
  uploaded: boolean;
  onUpload: () => void;
}> = ({ title, uploaded, onUpload }) => {
  return (
    <div className="bg-white p-3 rounded-lg border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-gray-600 uppercase">{title}</div>
          <div className="text-xs text-gray-500 mt-1">
            {uploaded ? 'Uploaded ✓' : 'Not uploaded'}
          </div>
        </div>
        <button
          onClick={onUpload}
          className="p-2 hover:bg-gray-100 rounded transition-colors text-blue-600"
        >
          <Upload size={16} />
        </button>
      </div>
      {/* Placeholder for image preview - will show uploaded image without blur */}
      {uploaded && (
        <div className="mt-2 bg-gray-100 rounded-lg h-20 flex items-center justify-center border border-dashed border-gray-300">
          <span className="text-xs text-gray-500">Image uploaded (clear & visible)</span>
        </div>
      )}
    </div>
  );
};
