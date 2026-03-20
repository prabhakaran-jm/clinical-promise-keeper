import { AsyncLocalStorage } from "node:async_hooks";

type RequestHeaders = Record<string, string | string[] | undefined>;

const storage = new AsyncLocalStorage<RequestHeaders>();

export function runWithHeaders<T>(headers: RequestHeaders, fn: () => T): T {
  return storage.run(headers, fn);
}

export function getCurrentHeaders(): RequestHeaders {
  return storage.getStore() ?? {};
}
