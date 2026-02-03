// Debug utility for troubleshooting app issues
export const DEBUG = {
  log: (section: string, message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const style = 'background: #1e40af; color: white; padding: 2px 6px; border-radius: 3px;';
    console.log(`%c[${timestamp}] ${section}`, style, message, data || '');
  },

  error: (section: string, message: string, error?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const style = 'background: #dc2626; color: white; padding: 2px 6px; border-radius: 3px;';
    console.error(`%c[${timestamp}] ${section}`, style, message, error || '');
  },

  warn: (section: string, message: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    const style = 'background: #f59e0b; color: white; padding: 2px 6px; border-radius: 3px;';
    console.warn(`%c[${timestamp}] ${section}`, style, message, data || '');
  },

  group: (label: string) => {
    console.group(`%c${label}`, 'font-weight: bold; color: #1e40af;');
  },

  groupEnd: () => {
    console.groupEnd();
  }
};

// Monitor component render cycles
export const monitorRender = (componentName: string) => {
  DEBUG.log('RENDER', `${componentName} rendered at ${new Date().toLocaleTimeString()}`);
};
