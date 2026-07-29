export interface WebPushSubscriptionData {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushSubscriptionRecord {
  id: string;
  subscription: WebPushSubscriptionData;
  lineIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PushConfigResponse {
  enabled: boolean;
  publicKey: string | null;
}

export interface SavePushSubscriptionRequest {
  subscription: WebPushSubscriptionData;
  lineIds: string[];
}

export interface SavePushSubscriptionResponse {
  subscribed: true;
  lineIds: string[];
}

export interface DeletePushSubscriptionRequest {
  endpoint: string;
}
