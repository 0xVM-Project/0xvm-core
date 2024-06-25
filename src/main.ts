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

        Promise.all(
          inscriptionList.map(async (inscription) => {
            const inscriptionId = inscription?.entry?.id;
            const inscriptionContent = inscription?.content;

            if (inscriptionId && inscriptionContent) {
              const transactionParsed =
                this.core.parseTransaction(inscriptionContent);

              if (transactionParsed) {
                const transactionBase64Decoded =
                  this.core.base64DecodeTransaction(transactionParsed);

                if (transactionBase64Decoded) {
                  const transactionDecodedList = this.core.decodeTransaction(
                    transactionBase64Decoded
                  );

                  if (transactionDecodedList?.length) {
                    return Promise.all(
                      transactionDecodedList.map(async (transactionDecoded) => {
                        const transactionAction =
                          transactionDecoded?.action ?? 0;
                        const transactionData = transactionDecoded?.data ?? "";

                        const transaction =
                          this.core.unSignTransaction(transactionData);

                        if (
                          transactionAction &&
                          [1, 2, 3, 4, 5].includes(transactionAction) &&
                          transaction
                        ) {
                          const transactionSigned =
                            await this.core.formatTransaction(
                              transactionAction as CORE.Action,
                              transaction
                            );

                          if (transactionSigned) {
                            const transactionSignedResult =
                              await this.vm.sendRawTransaction(
                                transactionSigned
                              );
                            console.log(
                              "transactionSignedResult: ",
                              transactionSignedResult
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
                                console.log(
                                  "inscriptionTransactionResult: ",
                                  inscriptionTransactionResult
                                );
                                return inscriptionTransactionResult;
                              }
                            }
                          }
                        }
                      })
                    )
                      .then((transactionDecodedListResult) => {
                        console.log(
                          "transactionDecodedListResult",
                          transactionDecodedListResult
                        );
                        return transactionDecodedListResult;
                      })
                      .catch((error) => {
                        console.error(
                          "transactionDecodedListResult error: ",
                          error
                        );
                        return undefined;
                      });
                  }
                }
              }
            }

            return undefined;
          })
        )
          .then((inscriptionListResult) => {
            console.log("inscriptionListResult", inscriptionListResult);
          })
          .catch((error) => {
            console.error("inscriptionListResult error: ", error);
          })
          .finally(async () => {
            const createBlockResult = await this.vm.createBlock();
            console.log("createBlockResult", createBlockResult);

            // const btcBlockHash = await this.bitcoin.getBlockHashByHeight(_height);
            // console.log("btcBlockHash: ", btcBlockHash);

            // if(btcBlockHash){
            //   const btcBlock = await this.bitcoin.getBlockByHash(btcBlockHash);
            //   console.log("btcBlock: ", btcBlock);
            //   const latestTimestamp = await this.vm.getLatestTimestampByHeight(_height)
            //   console.log("latestTimestamp: ", latestTimestamp);

            //   if(btcBlock && latestTimestamp){
            //     const timestamp = btcBlock.time > latestTimestamp ? btcBlock.time : latestTimestamp + 1
            //   }
            // }

            _progress.tick();

            if (_height >= blockCount) {
              while (true) {
                const newBlock = await this.ordinal.getBlockByHeight(_height);
                console.log("newBlock: ", newBlock);

                if (
                  newBlock?.block_count &&
                  newBlock?.block_count > blockCount
                ) {
                  break;
                }

                await new Promise((resolve) => setTimeout(resolve, 10000));
              }
            }

            await this.fetch(_height + 1, _progress);
          });
      }
    }
  };

  public initial = async () => {
    const latestBlockNumber = await this.vm.getLatestBlock();
    // const latestBlockNumber = 113;
    console.log("latestBlockNumber: ", latestBlockNumber);

    if (latestBlockNumber) {
      const ordinalBlock = await this.ordinal.getBlockByHeight(
        latestBlockNumber
      );
      console.log("ordinalBlock: ", ordinalBlock);
      const blockCount = ordinalBlock?.block_count;

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

            await new Promise((resolve) => setTimeout(resolve, 10000));
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
