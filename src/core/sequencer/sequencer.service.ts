import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ethers } from 'ethers';
import defaultConfig from 'src/config/default.config';
import { BtcHistoryTx } from 'src/entities/sqlite-entities/btc-history-tx.entity';
import { IndexerService } from 'src/indexer/indexer.service';
import { RouterService } from 'src/router/router.service';
import { Repository } from 'typeorm';

@Injectable()
export class SequencerService {
    private readonly logger = new Logger(SequencerService.name)

    constructor(
        @Inject(defaultConfig.KEY) private readonly defaultConf: ConfigType<typeof defaultConfig>,
        @InjectRepository(BtcHistoryTx, 'sqlite') private btcHistoryTxRepository: Repository<BtcHistoryTx>,
        private readonly indexerService: IndexerService,
        private readonly routerService: RouterService,
    ) { }

    getActualSort(sort: number) {
        return Math.floor(sort / 10)
    }

    async syncSequencer(blockHeight: number): Promise<number> {
        const { inscriptionList, blockTimestamp } = await this.indexerService.fetchInscription0xvmByBlock(blockHeight)
        const dataList: BtcHistoryTx[] = []
        const latestHistoryTx = await this.btcHistoryTxRepository.findOne({
            where: {},
            order: { sort: 'DESC' },
        })

        // raw sort=70
        // This is the ranking value of a normal transaction
        // The actual serial number is 7, 0 represents a normal transaction placeholder, and 1 represents a precompute transaction placeholder
        // serial number is 7, 0 means normal transaction

        let latestHistoryTxSort = latestHistoryTx ? latestHistoryTx.sort : 0
        let actualSerialNumber = this.getActualSort(latestHistoryTxSort)
        let protocolService = null
        for (let index = 0; index < inscriptionList.length; index++) {
            const inscription = inscriptionList[index]
            protocolService = this.routerService.from(inscription.content)
            if (!protocolService.filterInscription(inscription)) {
                continue
            }
            // 9ecaec4178f8869dda136727618a658f8c87e9fcbb9c4ed986b156cba7ee2961
            // 0x0000000000000000000000000000000000000000000000000000000000000000
            const { isPrecompute, mineTimestamp, prevHash } = protocolService.isPrecomputeInscription(inscription.content)
            actualSerialNumber += 1
            let newSort = Number(`${actualSerialNumber}0`)
            let timestamp = blockTimestamp
            // precompute
            if (isPrecompute) {
                actualSerialNumber -= 1
                // Verify that precompute inscription is valid
                const inscriptionGenesisAddress = await this.indexerService.getGenesisInscriptionAddress(inscription.hash)
                if (inscriptionGenesisAddress != this.defaultConf.xvm.sysBtcAddress) {
                    this.logger.warn(`Invalid pre-execution inscription, not created by 0xvm`)
                    continue
                }
                if (ethers.ZeroHash.slice(2) == prevHash || ethers.ZeroHash == prevHash) {
                    newSort = 11
                } else {
                    const precomputePrevHistoryTx = await this.btcHistoryTxRepository.findOne({ where: { hash: prevHash } })
                    if (!precomputePrevHistoryTx) {
                        throw new Error(`prevHash{ ${prevHash} } is invalid or does not exist`)
                    }
                    newSort = Number(`${this.getActualSort(precomputePrevHistoryTx.sort) + 1}1`)
                }
                timestamp = mineTimestamp
            }
            dataList.push({
                blockHeight: blockHeight,
                blockTimestamp: timestamp,
                version: inscription.content.slice(0, 6),
                hash: inscription.hash,
                content: inscription.content,
                prev: prevHash,
                sort: newSort,
                isExecuted: false
            })
        }
        const newEntity = this.btcHistoryTxRepository.create(dataList)
        const result = await this.btcHistoryTxRepository.save(newEntity)
        return result.length
    }
}
