import React from 'react';
import { ShoppingBag, Package, Warehouse, Users, Settings } from 'lucide-react';
import { useStore } from '../context/StoreContext';
 
interface NavigationProps {
  currentView: string;
  setView: (view: string) => void;
}
 
interface NavItem {
  id: string;
  label: string;
  icon: any;
}

export const Navigation: React.FC<NavigationProps> = ({ currentView, setView }) => {
  const { user } = useStore();
  const isAdmin = user?.role === 'admin';

  const navItems: NavItem[] = [
    { id: 'orders', label: 'Purchase', icon: ShoppingBag },
    { id: 'pickup', label: 'Pickup', icon: Package },
    { id: 'warehouse', label: 'Inward', icon: Warehouse },
    { id: 'suppliers', label: 'Suppliers', icon: Users },
  ];

  // Add settings tab only for admin users
  const adminNavItems = isAdmin ? [...navItems, { id: 'admin-settings', label: 'Settings', icon: Settings }] : navItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 mx-auto max-w-md bg-white/95 backdrop-blur-md border-t border-gray-200 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] pb-[env(safe-area-inset-bottom)]">
      <div className="flex justify-between items-center h-16 px-2">
        {adminNavItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className="flex flex-col items-center justify-center flex-1 h-full active:scale-90 transition-transform duration-150"
            >
              <div className={`p-1.5 rounded-2xl mb-0.5 transition-all duration-200 ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-200' : 'text-gray-400 hover:bg-gray-50'}`}>
                <item.icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className={`text-[10px] font-bold ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
