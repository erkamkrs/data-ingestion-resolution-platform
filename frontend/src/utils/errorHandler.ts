/**
 * Extracts a readable error message from various error formats
 */
export function getErrorMessage(error: unknown, fallback: string = "An error occurred"): string {
  if (!error) {
    return fallback;
  }

  // If it's already a string
  if (typeof error === "string") {
    return error;
  }

  // If it's an Error object or has a message property
  if (error && typeof error === "object") {
    const err = error as any;
    
    if (err.message && typeof err.message === "string") {
      return err.message;
    }
    
    // Try toString if it's not "[object Object]"
    if (err.toString && typeof err.toString === "function") {
      const str = err.toString();
      if (str !== "[object Object]") {
        return str;
      }
    }
  }

  return fallback;
}
