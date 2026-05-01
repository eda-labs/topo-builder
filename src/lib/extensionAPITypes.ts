/** Response shape for the EDA node profiles list API. */
export interface NodeProfileResponse {
  items?: {
    metadata?: {
      name?: string;
    };
  }[];
}

/** Messages received from the EDA browser extension via postMessage. */
export interface EdaPongMessage {
  type: 'eda-pong';
  status?: string;
  edaUrl?: string;
}

export interface EdaResponseMessage {
  type: 'eda-response';
  id: string;
  ok: boolean;
  status: number;
  body: string;
}

export interface EdaStatusChangedMessage {
  type: 'eda-status-changed';
  status: string;
  edaUrl: string;
}

export type ExtensionMessage = EdaPongMessage | EdaResponseMessage | EdaStatusChangedMessage;
