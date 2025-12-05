
export const getEnv = (key: string): string => {
  // 1. Check Vite's import.meta.env (Browser/Build time)
  try {
    const meta = import.meta as any;
    if (typeof meta !== 'undefined' && meta.env && meta.env[`VITE_${key}`]) {
      return meta.env[`VITE_${key}`];
    }
    if (typeof meta !== 'undefined' && meta.env && meta.env[key]) {
      return meta.env[key];
    }
  } catch (e) {
    // Ignore if import.meta is not available
  }

  // 2. Check Node.js process.env (Server/SSR)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {
    // Ignore ReferenceError if process is not defined
  }

  return '';
};
