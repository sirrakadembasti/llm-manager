import type { NetworkOptions } from './core.js';
export interface LookupAddress {
  address: string;
  family: number;
}
export interface LookupAllOptions {
  all: true;
  family?: number;
  verbatim?: boolean;
}
export interface LookupOneOptions {
  all?: false;
  family?: number;
}
export interface PublicLookup {
  (
    hostname: string,
    options: LookupAllOptions,
    callback: (error: Error | null, addresses: LookupAddress[]) => void
  ): void;
  (
    hostname: string,
    options: LookupOneOptions | number,
    callback: (error: Error | null, address: string, family: number) => void
  ): void;
}
export function createPublicLookup(options?: {
  resolver?: (
    hostname: string,
    options: LookupAllOptions,
    callback: (error: Error | null, addresses: LookupAddress[]) => void
  ) => void;
  allowLoopback?: boolean;
  allowPrivate?: boolean;
}): PublicLookup;
export function providerFetch(
  url: string | URL,
  options?: RequestInit &
    NetworkOptions & {
      stream?: boolean;
      maxStreamBytes?: number;
    }
): Promise<Response>;
