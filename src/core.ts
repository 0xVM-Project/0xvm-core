import {
  inscriptionAccuracy,
  inscriptionLabel,
  inscriptionVersion,
  btcAddress,
  tokenAddress,
  sendTokenPrivateKey,
  vmRpcUrl,
  chainId,
} from "./config";
import * as Flatbuffers from "./flatbuffers/output/zxvm";
import * as flatbuffers from "flatbuffers";
import { BigNumber, ethers } from "ethers";
import Database from "./database";
import Ordinal from "./ordinal";

export default class Core {
  private ordinal;
  private provider: ethers.providers.Provider;
  private wallet: ethers.Wallet;
  private nonce: { address: string; nonce: number }[] = [];

  constructor() {
    this.ordinal = new Ordinal();
    this.provider = new ethers.providers.JsonRpcProvider(vmRpcUrl);
    this.wallet = new ethers.Wallet(sendTokenPrivateKey, this.provider);
  }

  public parseTransaction = async (_string?: string) => {
    let result = "";

    if (_string && _string.length >= 6) {
      const _label = _string.substring(0, 3);
      const _version = _string.substring(3, 6);

      if (inscriptionLabel === _label && inscriptionVersion === _version) {
        result = _string.substring(6);
      }
    }

    if (result) {
      console.log(
        "current inscription content: ",
        _string,
        "parseTransaction: ",
        result
      );
    } else {
      console.log(
        "current inscription content: ",
        _string ? _string?.slice(0, 6) : ""
      );
    }

    return result;
  };

  public base64DecodeTransaction = async (_string?: string) => {
    let result = new Uint8Array();

    if (_string) {
      try {
        result = new Uint8Array(Buffer.from(_string, "base64"));
      } catch (error) {
        console.error("base64DecodeTransaction error: ", error);
      }
    }

    if (result) {
      console.log("base64DecodeTransaction: ", result);
    }

    return result;
  };

  public decodeTransaction = async (_string?: Uint8Array) => {
    let result: CORE.JsonObjectList = [];

    if (_string && _string?.length > 0) {
      const transactions = Flatbuffers.Transaction.getRootAsTransaction(
        new flatbuffers.ByteBuffer(_string)
      );

      if (transactions && transactions?.contentLength() > 0) {
        for (let i = 0; i < transactions?.contentLength(); i++) {
          const content = transactions.content(i);
          const action = content?.action();
          const data = content?.data();

          if (content && action && [1, 2, 3, 4, 5].includes(action) && data) {
            result.push({ action: action as CORE.Action, data });
          }
        }
      }
    }

    if (result?.length > 0) {
      console.log("decodeTransaction: ", result);
    }

    return result;
  };

  public unSignTransaction = async (_string?: string) => {
    let result = undefined;

    if (_string) {
      result = ethers.utils.parseTransaction(_string);
    }

    if (result) {
      console.log("unSignTransaction: ", result);
    }

    return result;
  };

  public formatTransaction = async (
    _action?: CORE.Action,
    _string?: ethers.Transaction,
    _inscriptionId?: string
  ) => {
    let result = undefined;

    if (_action && _string) {
      let _transaction: CORE.Transaction | undefined = undefined;

      // if (_action === 1 || _action === 2 || _action === 3) {
      //   _transaction = {
      //     ..._string,
      //     type: _string?.type ?? undefined,
      //     gasPrice: _string?.gasPrice?.mul(inscriptionAccuracy),
      //     gasLimit: _string?.gasLimit?.mul(inscriptionAccuracy),
      //     value: _string?.value?.mul(inscriptionAccuracy),
      //   };
      // }

      if (_action === 4 && _inscriptionId) {
        const fromAddress = _string?.from;

        if (fromAddress) {
          const gasPrice = await this.provider.getGasPrice();
          let nonce = this.nonce?.find(
            (_item) => _item.address.toLowerCase() === fromAddress.toLowerCase()
          )?.nonce;

          if (!nonce) {
            nonce = await this.provider.getTransactionCount(
              fromAddress,
              "latest"
            );
          }

          nonce += 1;
          this.nonce.push({ address: fromAddress.toLowerCase(), nonce });
          const feeData = await this.provider.getFeeData();
          const output = await this.ordinal.getOutputById(_inscriptionId);

          if (output && output?.address === btcAddress && output?.value) {
            const value = BigNumber.from(output?.value).mul(
              inscriptionAccuracy
            );

            _transaction = {
              ..._string,
              type: _string?.type ?? undefined,
              from: tokenAddress,
              to: fromAddress,
              nonce,
              gasPrice,
              data: "",
              value,
              chainId,
              //   maxFeePerGas: feeData.maxFeePerGas ?? undefined,
              //   maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
            };

            const gasLimit = await this.provider.estimateGas(_transaction);
            _transaction = { ..._transaction, gasLimit };
          }
        }
      }

      if (_action === 5) {
        try {
          const fromAddress = _string?.from;
          const hash = _string?.hash;
          const value = _string?.value?.mul(inscriptionAccuracy);

          if (hash && fromAddress && value && value.gt(BigNumber.from(0))) {
            const receipt = await this.provider.getTransactionReceipt(hash);

            if (
              receipt &&
              receipt.to === tokenAddress &&
              receipt.status === 1
            ) {
              const database = new Database();
              const _result = await database.insertWithdrawBtc(
                btcAddress,
                fromAddress,
                value.toNumber(),
                hash
              );

              if (_result) {
                return "true";
              }
            }
          }
        } catch (error) {
          console.error("buildTransaction: ", error);
        }
      }

      if (_transaction) {
        result = await this.wallet.signTransaction(
          Object.assign({}, _transaction, {
            v: undefined,
            r: undefined,
            s: undefined,
          })
        );
      }
    }

    if (result) {
      console.log("buildTransaction: ", result);
    }

    return result;
  };

  public addInscriptionTransaction = async (_string?: ethers.Transaction) => {
    let result = undefined;
    const fromAddress = _string?.from;

    if (_string && fromAddress) {
      const gasPrice = await this.provider.getGasPrice();
      const feeData = await this.provider.getFeeData();
      const value = ethers.utils.parseEther(
        BigNumber.from(546).mul(inscriptionAccuracy).toString()
      );
      let nonce = this.nonce?.find(
        (_item) => _item.address.toLowerCase() === fromAddress.toLowerCase()
      )?.nonce;

      if (!nonce) {
        nonce = await this.provider.getTransactionCount(fromAddress, "latest");
      }

      nonce += 1;
      this.nonce.push({ address: fromAddress.toLowerCase(), nonce });

      const _transaction = {
        to: _string?.to ?? "",
        from: tokenAddress,
        nonce,
        gasLimit: _string?.gasLimit,
        gasPrice,
        data: "",
        value,
        chainId,
        // type: _string?.type ?? undefined,
        //   maxFeePerGas: feeData.maxFeePerGas ?? undefined,
        //   maxPriorityFeePerGas: feeData.maxPriorityFeePerGas ?? undefined,
      };

      if (_transaction) {
        console.log("addInscriptionTransaction transaction: ", _transaction);
        result = await this.wallet.signTransaction(_transaction);
      }
    }

    if (result) {
      console.log("addInscriptionTransaction result: ", result);
    }

    return result;
  };
}
