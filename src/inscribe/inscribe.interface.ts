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
