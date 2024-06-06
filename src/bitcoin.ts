import axios, { AxiosInstance } from "axios";
import { bitcoinRpcPassword, bitcoinRpcUrl, bitcoinRpcUser } from "./config";

export default class Bitcoin {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: bitcoinRpcUrl,
      auth: {
        username: bitcoinRpcUser,
        password: bitcoinRpcPassword,
      },
      headers: {
        "Content-Type": "text/plain",
      },
    });
  }

  public getBlockHashByHeight = async (_height?: number) => {
    if (_height) {
      try {
        const blockInfoResponse = await this.client.post<
          BITCOIN.Response<string>
        >("", {
          jsonrpc: "1.0",
          method: "getblockhash",
          params: [_height],
          id: "getblockhash",
        });

        return blockInfoResponse.data.result;
      } catch (error) {
        console.error("getBlockHashByHeight error: ", error);
        return "";
      }
    } else {
      return "";
    }
  };

  public getBlockByHash = async (_hash?: string) => {
    if (_hash) {
      try {
        const blockInfoResponse = await this.client.post<
          BITCOIN.Response<BITCOIN.Block>
        >("", {
          jsonrpc: "1.0",
          method: "getblock",
          params: [_hash],
          id: "getblock",
        });

        return blockInfoResponse.data.result;
      } catch (error) {
        console.error("getBlockByHash error: ", error);
        return undefined;
      }
    } else {
      return undefined;
    }
  };
}
