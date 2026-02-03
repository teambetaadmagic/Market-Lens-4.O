
import React, { useState } from 'react';
import { Phone, UserPlus, Search, Edit2, Check, X, Tag } from 'lucide-react';
import { useStore } from '../context/StoreContext';

export const SuppliersView: React.FC = () => {
  const storeData = useStore();
  const { suppliers = [], addSupplier, updateSupplier } = storeData;
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newTag, setNewTag] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editTag, setEditTag] = useState('');

  const handleAdd = async () => {
    if (!newName) return;
    await addSupplier({ name: newName, phone: newPhone });
    setNewName('');
    setNewPhone('');
    setNewTag('');
    setIsAdding(false);
  };

  const startEdit = (supplier: any) => {
      setEditingId(supplier.id);
      setEditName(supplier.name);
      setEditPhone(supplier.phone || '');
      setEditTag(supplier.tag || '');
  };

  const saveEdit = async () => {
      if (editingId && editName) {
          await updateSupplier(editingId, { name: editName, phone: editPhone, tag: editTag });
          setEditingId(null);
      }
  };

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="pb-20 pt-2 px-3 max-w-lg mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold text-gray-800">Suppliers</h1>
        <button 
            onClick={() => setIsAdding(!isAdding)}
            className="text-blue-600 bg-blue-50 p-2 rounded-full hover:bg-blue-100 transition"
        >
            <UserPlus size={20} />
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-3 rounded-xl shadow-lg border border-blue-100 mb-4 animate-in fade-in slide-in-from-top-4">
            <h3 className="font-semibold mb-2 text-sm text-gray-800">Add New Supplier</h3>
            <input 
                className="w-full mb-2 p-2 border rounded bg-gray-50 text-gray-900 text-sm focus:border-blue-500 outline-none"
                placeholder="Supplier Name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
            />
            <input 
                className="w-full mb-2 p-2 border rounded bg-gray-50 text-gray-900 text-sm focus:border-blue-500 outline-none"
                placeholder="Phone Number"
                value={newPhone}
                onChange={e => setNewPhone(e.target.value)}
            />
            <input 
                className="w-full mb-2 p-2 border rounded bg-gray-50 text-gray-900 text-sm focus:border-blue-500 outline-none"
                placeholder="Tag (Max 20 chars)"
                value={newTag}
                onChange={e => setNewTag(e.target.value.slice(0, 20))}
                maxLength={20}
            />
            <button 
                onClick={handleAdd}
                className="w-full bg-blue-600 text-white py-2 rounded font-medium text-sm hover:bg-blue-700"
            >
                Save Supplier
            </button>
        </div>
      )}

      <div className="relative mb-4">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={16} />
          <input 
            className="w-full pl-9 pr-4 py-2 bg-gray-100 rounded-lg border-none focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 text-sm placeholder-gray-400"
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
      </div>

      <div className="space-y-2.5">
        {filtered.map(supplier => (
            <div key={supplier.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100">
                {editingId === supplier.id ? (
                    <div className="flex flex-col gap-2">
                        <input 
                            className="w-full p-1.5 border border-blue-300 rounded text-sm font-bold"
                            value={editName}
                            onChange={e => setEditName(e.target.value)}
                            placeholder="Name"
                        />
                        <input 
                            className="w-full p-1.5 border border-blue-300 rounded text-sm"
                            value={editPhone}
                            onChange={e => setEditPhone(e.target.value)}
                            placeholder="Phone"
                        />
                        <input 
                            className="w-full p-1.5 border border-blue-300 rounded text-sm"
                            value={editTag}
                            onChange={e => setEditTag(e.target.value.slice(0, 20))}
                            placeholder="Tag (Max 20 chars)"
                            maxLength={20}
                        />
                        <div className="flex gap-2 mt-1">
                            <button onClick={saveEdit} className="flex-1 bg-blue-600 text-white py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">
                                <Check size={14}/> Save
                            </button>
                            <button onClick={() => setEditingId(null)} className="flex-1 bg-gray-100 text-gray-600 py-1.5 rounded text-xs font-bold flex items-center justify-center gap-1">
                                <X size={14}/> Cancel
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-between items-start">
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-800 text-sm">{supplier.name}</h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {supplier.tag && (
                                    <div className="flex items-center gap-1 text-purple-600 text-xs bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                                        <Tag size={11} />
                                        <span>{supplier.tag}</span>
                                    </div>
                                )}
                                {supplier.phone && (
                                    <div className="flex items-center gap-1 text-gray-500 text-xs">
                                        <Phone size={12} />
                                        <span>{supplier.phone}</span>
                                    </div>
                                )}
                                {!supplier.phone && !supplier.tag && (
                                    <span className="text-gray-400 text-xs">No phone or tag</span>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => startEdit(supplier)}
                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"
                            >
                                <Edit2 size={16} />
                            </button>
                            {supplier.phone && (
                                <a 
                                    href={`https://wa.me/${supplier.phone.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="bg-green-100 text-green-700 px-2.5 py-1 rounded text-[10px] font-bold"
                                >
                                    Chat
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        ))}
        {filtered.length === 0 && (
            <p className="text-center text-gray-400 mt-8 text-sm">No suppliers found.</p>
        )}
      </div>
    </div>
  );
};
