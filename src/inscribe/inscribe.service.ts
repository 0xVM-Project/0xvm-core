import { HttpService } from '@nestjs/axios';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from 'bitcoinjs-lib';
import { firstValueFrom } from 'rxjs';
import defaultConfig from 'src/config/default.config';
import { HashMapping } from 'src/entities/hash-mapping.entity';
import { LastTxHash } from 'src/entities/last-tx-hash.entity';
import { PreBroadcastTx } from 'src/entities/pre-broadcast-tx.entity';
import { createCommit, createReveal, relay } from 'src/utils/inscribe';
import { Repository } from 'typeorm';
import {
  CommitRequest,
  CreateRequest,
  CreateResponse,
  FeeRate,
  UnisatResponse,
} from './inscribe.interface';

@Injectable()
export class InscribeService {
  constructor(
    @InjectRepository(PreBroadcastTx)
    private readonly preBroadcastTx: Repository<PreBroadcastTx>,
    @InjectRepository(LastTxHash)
    private readonly lastTxHash: Repository<LastTxHash>,
    @InjectRepository(HashMapping)
    private readonly hashMappingRepository: Repository<HashMapping>,
    @Inject(defaultConfig.KEY)
    private readonly defaultConf: ConfigType<typeof defaultConfig>,
    private readonly httpService: HttpService,
  ) {}

  async create(request: CreateRequest): Promise<CreateResponse> {
    const { payPrivateKey, payAddress, amount } = await createCommit(
      request.content,
      request.receiverAddress,
      request.feeRate,
      request.depositAmount,
    );

    const inscribe_id = crypto.randomUUID();

    const inscribeItem = this.preBroadcastTx.create({
      inscribeId: inscribe_id,
      privateKey: payPrivateKey,
      content: request.content,
      receiverAddress: request.receiverAddress,
      feeRate: request.feeRate,
      depositAmount: request.depositAmount,
      commitTx: '',
    });
    this.preBroadcastTx.save(inscribeItem);

    return {
      id: inscribe_id,
      address: payAddress,
      amount: amount,
    };
  }

  async commit(request: CommitRequest) {
    const inscribeItem = await this.preBroadcastTx.findOne({
      where: [{ inscribeId: request.id }],
    });

    if (!inscribeItem) {
      throw new Error('Commit inscribe param error, invalid id: ' + request.id);
    }

    const revealResult = await createReveal(
      inscribeItem.privateKey,
      inscribeItem.content,
      inscribeItem.receiverAddress,
      inscribeItem.feeRate,
      inscribeItem.depositAmount,
      request.tx,
    );

    // update db
    if (revealResult.success) {
      try {
        await relay(request.tx);
        await relay(revealResult.signedTx);
        const lastTxHash = await this.lastTxHash.findOne({});
        inscribeItem.commitTx = request.tx;
        inscribeItem.commitTxHash = Transaction.fromHex(request.tx).getId();
        inscribeItem.revealHash = revealResult.txHash;
        inscribeItem.status = 3;
        inscribeItem.previous = lastTxHash?.hash ?? '';
        this.preBroadcastTx.save(inscribeItem);
        this.lastTxHash.update(
          {},
          {
            hash: revealResult.txHash,
          },
        );
        this.hashMappingRepository.update(
          { xvmHash: inscribeItem.xvmBlockHash },
          { btcHash: revealResult.txHash },
        );
      } catch (e) {
        throw new Error(
          'Commit inscribe param error, failed to relay tx: ' + e,
        );
      }
    }

    return true;
  }

  async preCommit() {
    const feeSummary = await firstValueFrom(
      this.httpService.get<UnisatResponse<FeeRate>>(
        'https://wallet-api-testnet.unisat.io/v5/default/fee-summary',
        {
          headers: {
            'Content-Type': 'application/json',
            'user-agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
          },
        },
      ),
    );

    if (
      feeSummary &&
      feeSummary?.data &&
      feeSummary?.data?.code === 0 &&
      feeSummary?.data?.msg === 'ok'
    ) {
      const feeRate = feeSummary?.data?.data?.list?.find(
        (_item) => _item?.title === 'Avg',
      )?.feeRate;

      if (feeRate && feeRate > 0 && feeRate <= 500) {
        const pendingTx = await this.preBroadcastTx.findOne({
          where: {
            status: 2,
          },
          order: {
            id: 'ASC',
          },
        });

        if (pendingTx) {
          const txHash = await this.commit({
            id: pendingTx?.inscribeId,
            tx: pendingTx?.commitTx,
          });
        }

        const readyTx = await this.preBroadcastTx.findOne({
          where: {
            status: 1,
          },
          order: {
            id: 'ASC',
          },
        });

        if (readyTx) {
          // todo: transfer and commit
        }

        const initialTx = await this.preBroadcastTx.findOne({
          where: {
            status: 0,
          },
          order: {
            id: 'ASC',
          },
        });

        if (initialTx) {
          const txData = await this.create({
            content: initialTx?.content,
            receiverAddress: this.defaultConf.xvm.sysBtcAddress,
            feeRate,
          });

          if (txData) {
            // todo: transfer and commit
          }
        }
      }
    }

    return null;
  }
}
