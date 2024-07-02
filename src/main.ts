import Bitcoin from "./bitcoin";
import Vm from "./vm";
import Ordinal from "./ordinal";
import Core from "./core";
import Progress from "progress";

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
      console.log("fetch ordinalBlock: ", ordinalBlock);

      if (ordinalBlock) {
        const blockCount = ordinalBlock?.block_count ?? 0;
        const inscriptionList = ordinalBlock?.inscriptions ?? [];

        if (_progress.total !== blockCount) {
          _progress.total = blockCount;
        }

        await Promise.all(
          inscriptionList.map(async (inscription) => {
            const inscriptionId = inscription?.entry?.id;
            const inscriptionContent = inscription?.content;

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

                            if ([4, 5].includes(transactionAction)) {
                              transactionSigned =
                                await this.core.formatTransaction(
                                  transactionAction as CORE.Action,
                                  transaction
                                );
                            }

                            console.log(
                              "transactionSigned: ",
                              transactionSigned
                            );

                            if (transactionSigned) {
                              const transactionSignedResult =
                                await this.vm.sendRawTransaction(
                                  transactionSigned
                                );

                              if (transactionSignedResult) {
                                const inscriptionTransaction =
                                  await this.core.addInscriptionTransaction(
                                    transaction
                                  );

                                if (inscriptionTransaction) {
                                  const inscriptionTransactionResult =
                                    await this.vm.sendRawTransaction(
                                      inscriptionTransaction
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
            console.log("newBlock: ", newBlock);

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
    const latestBlockNumber = await this.vm.getLatestBlock();
    // const latestBlockNumber = 2865304;
    console.log("latestBlockNumber: ", latestBlockNumber);

    if (latestBlockNumber) {
      const ordinalBlock = await this.ordinal.getBlockByHeight(
        latestBlockNumber
      );
      console.log("ordinalBlock: ", ordinalBlock);
      const blockCount = ordinalBlock?.block_count;
      // const blockCount = 2865305;
      console.log("blockCount: ", blockCount);

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
            console.log("newBlock: ", newBlock);

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
