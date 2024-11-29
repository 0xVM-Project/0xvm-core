import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HashMapping } from 'src/entities/hash-mapping.entity';
import { QueryFailedError, Repository } from 'typeorm';
import { HashMappingInterface } from './hash.interface';

@Injectable()
export class HashMappingService {
    private readonly logger = new Logger(HashMappingService.name)

    constructor(
        @InjectRepository(HashMapping) private readonly hashMappingRepository: Repository<HashMapping>,
    ) { }

    async bindHash(hashMapping: HashMappingInterface) {
        try {
            await this.hashMappingRepository.save(hashMapping)
            return hashMapping
        } catch (error) {
            if (error instanceof QueryFailedError && error.driverError?.errno == 1062) {
                this.logger.warn(`hash mapping already exists`)
                return hashMapping
            }
            this.logger.error(error)
            throw error
        }
    }

    /**
     * Query the largest logindex mapping hash based on txid
     * @param txid : txid is equivalent to btcHash
     * @returns 
     */
    async getMappingHashByTxid(txid: string): Promise<HashMapping> {
        const _txid = txid.startsWith('0x') ? txid.slice(2) : txid
        return await this.hashMappingRepository.findOne({
            where: [{ btcHash: _txid }, { btcHash: `0x${_txid}` }],
            order: { logIndex: 'DESC' }
        })
    }
}
