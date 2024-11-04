export interface CreateRequest {
  content: string;
  receiverAddress: string;
  feeRate: number;
  depositAmount?: number;
}

export interface CommitRequest {
  id: number;
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

export interface UnisatResponse<T = any> {
  code: number;
  msg: string;
  data: T;
}

export interface FeeRate {
  list: [
    {
      title: 'Slow';
      desc: string;
      feeRate: number;
    },
    {
      title: 'Avg';
      desc: string;
      feeRate: number;
    },
    {
      title: 'Fast';
      desc: string;
      feeRate: number;
    },
  ];
}
