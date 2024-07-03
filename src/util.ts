import { setTimeout as timersSetTimeout } from "timers/promises";

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
