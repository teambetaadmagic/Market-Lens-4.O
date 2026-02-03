import { UserRole } from '../types';

export interface ViewPermissions {
  canEdit: boolean;
  canView: boolean;
  mode: 'edit' | 'view';
}
 
export const getPermissions = (userRole: UserRole, view: string): ViewPermissions => {
  const permissions: Record<UserRole, Record<string, ViewPermissions>> = {
    admin: {
      orders: { canEdit: true, canView: true, mode: 'edit' },
      pickup: { canEdit: true, canView: true, mode: 'edit' },
      warehouse: { canEdit: true, canView: true, mode: 'edit' },
      suppliers: { canEdit: true, canView: true, mode: 'edit' },
    },
    warehouse: {
      orders: { canEdit: true, canView: true, mode: 'edit' },
      pickup: { canEdit: false, canView: true, mode: 'view' },
      warehouse: { canEdit: true, canView: true, mode: 'edit' },
      suppliers: { canEdit: true, canView: true, mode: 'edit' },
    },
    market_person: {
      orders: { canEdit: false, canView: true, mode: 'view' },
      pickup: { canEdit: true, canView: true, mode: 'edit' },
      warehouse: { canEdit: false, canView: true, mode: 'view' },
      suppliers: { canEdit: true, canView: true, mode: 'edit' },
    },
  };

  return permissions[userRole][view] || { canEdit: false, canView: false, mode: 'view' };
};

export const canEditView = (userRole: UserRole, view: string): boolean => {
  return getPermissions(userRole, view).canEdit;
};

export const canViewContent = (userRole: UserRole, view: string): boolean => {
  return getPermissions(userRole, view).canView;
};
