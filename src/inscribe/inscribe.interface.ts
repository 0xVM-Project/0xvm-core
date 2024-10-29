export interface CreateRequest {
  content: string;
  receiverAddress: string;
  feeRate: number;
  depositAmount?: number;
}

export interface CommitRequest {
  id: string;
  tx: string;
}

export interface CreateResponse {
  id: string;
  address: string;
  amount: number;
}

export interface CommitResponse {
  hash: string;
}
