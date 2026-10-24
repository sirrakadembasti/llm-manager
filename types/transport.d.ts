export function createPublicLookup(options?: {
  resolver?: (...args: any[]) => void;
  allowLoopback?: boolean;
}): (hostname: string, options: any, callback: (err: any, address: string, family: number) => void) => void;

export function providerFetch(
  url: string | URL,
  options?: RequestInit & {
    allowLocalHttp?: boolean;
    maxBytes?: number;
  }
): Promise<Response>;
