import axios, { AxiosInstance } from "axios";
import { latestBlock, latestTimestamp, vmRpcUrl } from "./config";

export default class Vm {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: vmRpcUrl,
      headers: {
        Accept: "application/json",
      },
    });
  }

  private call = async <R, T extends any[]>(_method?: string, _params?: T) => {
    if (_method && _params) {
      try {
        const request: VM.Request = {
          jsonrpc: "2.0",
          method: _method,
          params: _params,
          id: 0,
        };

        const response = await this.client.post<VM.Response<R>>("", request);

        if (response?.data && !response?.data?.error) {
          return response.data;
        } else {
          console.error("call error: ", response);
        }

        return undefined;
      } catch (error) {
        console.error("call error: ", error);
        return undefined;
      }
    } else {
      return undefined;
    }
  };

  public getLatestBlock = async () => {
    const result = await this.call<string, null[]>("eth_blockNumber", []);

    if (result && result?.result && !result?.error) {
      return parseInt(result?.result, 16);
    }

    return latestBlock;
  };

  public getLatestTimestampByHeight = async (_height?: number) => {
    if (_height) {
      const result = await this.call<
        {
          timestamp?: string;
        },
        [string, boolean]
      >("eth_getBlockByNumber", [_height?.toString(16), true]);

      if (result && result?.result?.timestamp && !result?.error) {
        return parseInt(result?.result?.timestamp, 16);
      }
    }

    return latestTimestamp;
  };

  public sendRawTransaction = async (_string?: string) => {
    if (_string) {
      const result = await this.call<string, string[]>(
        "eth_sendRawTransaction",
        [_string]
      );

      if (result && result?.result && !result?.error) {
        return result?.result;
      } else {
        console.error("sendRawTransaction error: ", result);
      }
    }

    return "";
  };

  public createBlock = async () => {
    const result = await this.call<false, any[]>("engine_createBlock", [
      true,
      false,
      null,
    ]);

    if (result && result?.result && !result?.error) {
      return true;
    }

    return false;
  };
}
