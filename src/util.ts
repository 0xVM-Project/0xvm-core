import axios from "axios";
import { setTimeout as timersSetTimeout } from "timers/promises";
import { walletAccountUrl } from "./config";

const retry = async <T = any>(_function: {
  (): Promise<T>;
}): Promise<T | any> => {
  const delay = Math.floor(Math.random() * (100 - 10 + 1)) + 20000;
  let success = false;
  let result: T;

  while (!success) {
    try {
      result = await _function();
      success = true;
      return result;
    } catch (error) {
      console.error("retry: ", error);
    }

    await new Promise((resolve) => setTimeout(resolve, delay));
  }
};

export const autoRetry = async <T = any>(_function: {
  (): Promise<T>;
}): Promise<T> =>
  retry<T>(
    () =>
      new Promise((resolve, reject) => {
        _function().then(resolve, reject);
        timersSetTimeout(30000).then(reject);
      })
  );

export const getBtcWalletAccountByXvmAccount = async (_xvmAccount?: string) => {
  try {
    if (_xvmAccount) {
      const response = await axios.get(
        walletAccountUrl + "/address-mapping/" + _xvmAccount,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      console.log("getBtcWalletAccountByXvmAccount", response?.data?.data);

      if (
        response &&
        response?.data &&
        response?.data?.data &&
        response?.data?.data?.btcAddress
      ) {
        return response?.data?.data?.btcAddress;
      }
    }

    return "";
  } catch (error) {
    console.error("getBtcWalletAccountByXvmAccount error", error);
    return "";
  }
};
