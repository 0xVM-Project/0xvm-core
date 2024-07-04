import Bitcoin from "./bitcoin";
import Vm from "./vm";
import Ordinal from "./ordinal";
import Core from "./core";
import Progress from "progress";
import { latestBlock } from "./config";
import Database from "./database";

export default class Main {
  private bitcoin;
  private vm;
  private ordinal;
  private core;

  constructor() {
    this.bitcoin = new Bitcoin();
    this.vm = new Vm();
    this.ordinal = new Ordinal();
    this.core = new Core();
  }

  private fetch = async (_height?: number, _progress?: Progress) => {
    if (_height && _progress) {
      const ordinalBlock = await this.ordinal.getBlockByHeight(_height);
      // console.log(
      //   "fetch ordinalBlock: ",
      //   ordinalBlock?.inscriptions?.length ?? 0
      // );

      if (ordinalBlock) {
        const blockCount = ordinalBlock?.block_count ?? 0;
        const inscriptionList = ordinalBlock?.inscriptions ?? [];
        console.log(
          "current BTC block height: ",
          blockCount,
          " current XVM block height: ",
          _height,
          " current inscription length: ",
          inscriptionList?.length ?? 0
        );

        if (_progress.total !== blockCount) {
          _progress.total = blockCount;
        }

        await Promise.all(
          inscriptionList.map(async (inscription, _index) => {
            const inscriptionId = inscription?.entry?.id;
            const inscriptionContent = inscription?.content;

            console.log(
              "current inscription index: ",
              _index + 1,
              " current inscription id: ",
              inscriptionId
            );

            if (inscriptionId && inscriptionContent) {
              const transactionParsed = await this.core.parseTransaction(
                inscriptionContent
              );

              if (transactionParsed) {
                const transactionBase64Decoded =
                  await this.core.base64DecodeTransaction(transactionParsed);

                if (transactionBase64Decoded) {
                  const transactionDecodedList =
                    await this.core.decodeTransaction(transactionBase64Decoded);

                  if (transactionDecodedList?.length) {
                    return await Promise.all(
                      transactionDecodedList.map(async (transactionDecoded) => {
                        const transactionAction =
                          transactionDecoded?.action ?? 0;
                        const transactionData = transactionDecoded?.data ?? "";

                        if (transactionAction && transactionData) {
                          const transaction = await this.core.unSignTransaction(
                            transactionData
                          );

                          if (transaction) {
                            let transactionSigned: string | undefined = "";

                            if ([1, 2, 3].includes(transactionAction)) {
                              transactionSigned = transactionData;
                            }

                            if (transactionAction === 4) {
                              transactionSigned =
                                await this.core.formatTransaction(
                                  transactionAction as CORE.Action,
                                  transaction,
                                  inscriptionId
                                );
                            }

                            if (transactionAction === 5) {
                              transactionSigned =
                                await this.core.formatTransaction(
                                  transactionAction as CORE.Action,
                                  transaction,
                                  inscriptionId,
                                  transactionData
                                );
                            }

                            if (transactionSigned) {
                              const transactionSignedResult =
                                await this.vm.sendRawTransaction(
                                  transactionAction === 5
                                    ? transactionData
                                    : transactionSigned
                                );

                              if (transactionSignedResult) {
                                console.log(
                                  "transaction hash:",
                                  transactionSignedResult
                                );

                                if (transactionAction === 5) {
                                  const database = new Database();
                                  const params = JSON.parse(transactionSigned);
                                  console.log(
                                    "insertWithdrawBtc params: ",
                                    transactionSigned,
                                    " insertWithdrawBtc hash: ",
                                    transactionSignedResult
                                  );
                                  const insertWithdrawBtcResult =
                                    await database.insertWithdrawBtc(
                                      params?.fromAddress ?? "",
                                      params?.toAddress ?? "",
                                      params?.value ?? 0,
                                      transactionSignedResult
                                    );

                                  if (!insertWithdrawBtcResult) {
                                    return undefined;
                                  }
                                }

                                const inscriptionTransaction =
                                  await this.core.addInscriptionTransaction(
                                    transaction
                                  );
                                if (inscriptionTransaction) {
                                  const inscriptionTransactionResult =
                                    await this.vm.sendRawTransaction(
                                      inscriptionTransaction
                                    );
                                  console.log(
                                    "inscription hash:",
                                    inscriptionTransactionResult
                                  );
                                  return inscriptionTransactionResult;
                                }
                              }
                            }
                          }
                        }
                      })
                    );
                  }
                }
              }
            }

            return undefined;
          })
        );

        // console.log("inscriptionListResult", inscriptionListResult);
        const createBlockResult = await this.vm.createBlock();
        console.log("createBlockResult", createBlockResult);

        // const btcBlockHash = await this.bitcoin.getBlockHashByHeight(_height);
        // console.log("btcBlockHash: ", btcBlockHash);

        // if (btcBlockHash) {
        //   const btcBlock = await this.bitcoin.getBlockByHash(btcBlockHash);
        //   console.log("btcBlock: ", btcBlock);
        //   const latestTimestamp = await this.vm.getLatestTimestampByHeight(
        //     _height
        //   );
        //   console.log("latestTimestamp: ", latestTimestamp);

        //   if (btcBlock && latestTimestamp) {
        //     const timestamp =
        //       btcBlock.time > latestTimestamp
        //         ? btcBlock.time
        //         : latestTimestamp + 1;
        //   }
        // }

        _progress.tick();

        if (_height >= blockCount) {
          while (true) {
            const newBlock = await this.ordinal.getBlockByHeight(_height);
            console.log(`no new block: ${_height} / ${blockCount}`);
            // console.log("newBlock: ", newBlock?.inscriptions?.length ?? 0);

            if (newBlock?.block_count && newBlock?.block_count > blockCount) {
              break;
            }

            await new Promise((resolve) => setTimeout(resolve, 60000));
          }
        }

        await this.fetch(_height + 1, _progress);
      }
    }
  };

  public initial = async () => {
    let latestBlockNumber = await this.vm.getLatestBlock();
    // const latestBlockNumber = 2865303;
    console.log("XVM blockHeight: ", latestBlockNumber);

    if (latestBlockNumber || latestBlockNumber === 0) {
      while (latestBlockNumber < latestBlock) {
        const createBlockResult = await this.vm.createBlock();
        process.stdout.write(
          `\r fetch latest XVM blockHeight: ${latestBlockNumber} / ${latestBlock} createBlock: ${createBlockResult}`
        );

        if (createBlockResult) {
          latestBlockNumber = await this.vm.getLatestBlock();
        } else {
          console.error("createBlock failed");
          return;
        }
      }

      process.stdout.write(`\n`);

      const ordinalBlock = await this.ordinal.getBlockByHeight(
        latestBlockNumber
      );
      // console.log("ordinalBlock: ", ordinalBlock?.inscriptions?.length ?? 0);
      const blockCount = ordinalBlock?.block_count;
      // const blockCount = 2865305;
      // console.log("blockCount: ", blockCount);

      if (ordinalBlock && blockCount) {
        const progress = new Progress(":bar :current/:total", {
          total: blockCount,
          curr: latestBlockNumber - 1,
        });
        progress.tick();

        if (latestBlockNumber >= blockCount) {
          while (true) {
            const newBlock = await this.ordinal.getBlockByHeight(
              latestBlockNumber
            );
            console.log(`no new block: ${latestBlockNumber} / ${blockCount}`);

            if (newBlock?.block_count && newBlock?.block_count > blockCount) {
              break;
            }

            await new Promise((resolve) => setTimeout(resolve, 60000));
          }
        }

        await this.fetch(latestBlockNumber + 1, progress);

        //   const latestBlockHash = await bitcoin.getBlockHashByHeight(
        //     latestBlockNumber
        //   );
        //   console.log("latestBlockHash: ", latestBlockHash);

        //   if (latestBlockHash) {
        //     const latestBlockDetail = await bitcoin.getBlockByHash(latestBlockHash);
        //     console.log("latestBlockDetail: ", latestBlockDetail);

        //     if (latestBlockDetail) {
        //     }
        //   }
      }
    }
  };
}
