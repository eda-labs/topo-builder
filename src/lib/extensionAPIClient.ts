/**
 * EDA Browser Connector — Client-side adapter
 *
 * Communicates with the EDA Browser Connector extension via
 * window.postMessage. The extension handles EDA URL, auth tokens,
 * and CORS — web pages just send API paths.
 */

import type {
  ExtensionMessage,
  EdaPongMessage,
  EdaResponseMessage,
  EdaStatusChangedMessage,
} from './extensionAPITypes';

export interface EdaStatus {
  status: string;
  edaUrl: string;
}

function isExtensionMessage(data: unknown): data is ExtensionMessage {
  return typeof data === 'object' && data !== null && 'type' in data;
}

let extensionAvailable: boolean | null = null;

/** Detect the extension and return its current status. */
export function detectExtension(): Promise<EdaStatus & { available: boolean }> {
  return new Promise(resolve => {
    const timeout = setTimeout(() => {
      window.removeEventListener('message', handler);
      extensionAvailable = false;
      resolve({ available: false, status: 'disconnected', edaUrl: '' });
    }, 500);

    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (!isExtensionMessage(event.data)) return;
      if (event.data.type !== 'eda-pong') return;

      const msg: EdaPongMessage = event.data;
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      extensionAvailable = true;
      resolve({
        available: true,
        status: msg.status ?? 'disconnected',
        edaUrl: msg.edaUrl ?? '',
      });
    };

    window.addEventListener('message', handler);
    window.postMessage({ type: 'eda-ping' }, '*');
  });
}

export function isExtensionDetected(): boolean {
  return extensionAvailable === true;
}

let requestId = 0;

/** Make an authenticated API request through the extension. Only the path is needed. */
export function edaFetch(
  path: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
): Promise<{ ok: boolean; status: number; body: string }> {
  if (!extensionAvailable) {
    return Promise.reject(new Error('EDA Browser Extension not available'));
  }

  const id = `eda-req-${++requestId}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', handler);
      reject(new Error('EDA request timed out'));
    }, 30_000);

    const handler = (event: MessageEvent) => {
      if (event.source !== window) return;
      if (!isExtensionMessage(event.data)) return;
      if (event.data.type !== 'eda-response' || event.data.id !== id) return;

      const msg: EdaResponseMessage = event.data;
      clearTimeout(timer);
      window.removeEventListener('message', handler);
      resolve({ ok: msg.ok, status: msg.status, body: msg.body });
    };

    window.addEventListener('message', handler);
    window.postMessage({
      type: 'eda-request',
      id,
      path,
      method: init?.method ?? 'GET',
      headers: init?.headers ?? {},
      body: init?.body ?? null,
    }, '*');
  });
}

export type StatusChangeCallback = (status: EdaStatus) => void;

/** Listen for real-time status changes pushed by the extension. Returns an unsubscribe function. */
export function onEdaStatusChange(callback: StatusChangeCallback): () => void {
  const handler = (event: MessageEvent) => {
    if (event.source !== window) return;
    if (!isExtensionMessage(event.data)) return;
    if (event.data.type !== 'eda-status-changed') return;

    const msg: EdaStatusChangedMessage = event.data;
    callback({ status: msg.status, edaUrl: msg.edaUrl });
  };
  window.addEventListener('message', handler);
  return () => { window.removeEventListener('message', handler); };
}
