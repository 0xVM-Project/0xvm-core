import axios, { AxiosInstance } from "axios";
import { autoRetry } from "./util";
import { ordUrl } from "./config";

export default class Ordinal {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: ordUrl,
      headers: {
        Accept: "application/json",
      },
    });
  }

  private getClient = async <T>(_path?: string, _params?: string) =>
    _path && _params
      ? await autoRetry(async () => {
          return (await this.client.get<T>(`/${_path}/${_params}`)).data;
        })
      : undefined;

  public getBlockByHeight = async (_height?: number) => {
    let result = undefined;

    if (_height) {
      result = await this.getClient<ORDINAL.Block>(
        "api/inscriptions/block",
        String(_height)
      );
    }

    console.log("getBlockByHeight: ", result);
    return result;
  };

  public getOutputById = async (_id?: string) => {
    let result = undefined;

    if (_id && _id.length > 2 && _id[_id.length - 2] === "i") {
      const hash = _id.slice(0, -2) + ":1";
      result = await this.getClient<ORDINAL.Output>("output", hash);
    }

    console.log("getOutputById: ", result);
    return result;
  };
}
