namespace BITCOIN {
  interface Response<T> {
    result: T;
    error: string | null;
    id: string;
  }

  interface Block {
    hash: string;
    confirmations: number;
    height: number;
    version: number;
    versionHex: string;
    merkleroot: string;
    time: number;
    mediantime: number;
    nonce: number;
    bits: string;
    difficulty: number;
    chainwork: string;
    nTx: number;
    previousblockhash: string;
    nextblockhash: string;
    strippedsize: number;
    size: number;
    weight: number;
    tx: string[];
  }
}

namespace VM {
  interface Request {
    jsonrpc: string;
    method: string;
    params: any[];
    id: number;
  }

  interface Response<T> {
    jsonrpc: string;
    id: number;
    result?: T;
    error?: {
      code: number;
      message: string;
      data?: any;
    };
  }
}

namespace ORDINAL {
  interface Block {
    block_count: number;
    inscriptions: {
      entry: {
        charms: number;
        fee: number;
        height: number;
        id: string;
        inscription_number: number;
        parent: number | null;
        sat: number | null;
        sequence_number: number;
        timestamp: number;
      };
      content: string;
    }[];
  }

  interface Output {
    address: string;
    indexed: boolean;
    inscriptions: string[];
    runes: any[];
    sat_ranges: string;
    script_pubkey: string;
    spent: boolean;
    transaction: string;
    value: number;
  }
}

namespace CORE {
  type Action = 1 | 2 | 3 | 4 | 5; // 1: deploy 2: execute 3: transfer 4: deposit 5: withdraw

  interface JsonObject {
    action: Action;
    data: string;
  }

  type JsonObjectList = JsonObject[];

  interface Transaction {
    to?: string;
    from?: string;
    nonce: number;
    gasLimit?: BigNumberish;
    gasPrice?: BigNumberish;
    data: BytesLike;
    value: BigNumberish;
    chainId: number;
    type?: number;
    accessList?: AccessListish;
    maxPriorityFeePerGas?: BigNumberish;
    maxFeePerGas?: BigNumberish;
    customData?: Record<string, any>;
    ccipReadEnabled?: boolean;
  }
}
