// src/types.d.ts
declare module 'qrcode' {
  function toString(text: string, options: any, cb: (err: Error | null, result: string) => void): void;
  function toDataURL(text: string, options: any, cb: (err: Error | null, url: string) => void): void;
  // Add other methods if needed
}