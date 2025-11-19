
export const getEnv = (key: string): string => {
  try {
    // Check if process is defined (Node.js or polyfilled environment)
    if (typeof process !== 'undefined' && process.env) {
      return process.env[key] || '';
    }
  } catch (e) {
    // Ignore ReferenceError if process is not defined
  }
  return '';
};
