import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Transaction } from 'bitcoinjs-lib';
import { InscribeItem } from 'src/entities/inscribe.entity';
import { createCommit, createReveal, POSTAGE, relay } from 'src/utils/inscribe';
import { Repository } from 'typeorm';
import {
  CommitRequest,
  CommitResponse,
  CreateRequest,
  CreateResponse,
} from './inscribe.interface';

@Injectable()
export class InscribeService {
  constructor(
    @InjectRepository(InscribeItem)
    private readonly repository: Repository<InscribeItem>,
  ) {}

  async create(request: CreateRequest): Promise<CreateResponse> {
    if (request.depositAmount < POSTAGE) {
      throw new Error(
        'Create inscribe param error, deposit amount must be zero or larger than ' +
          POSTAGE,
      );
    }

    const { payPrivateKey, payAddress, amount } = await createCommit(
      request.content,
      request.receiverAddress,
      request.feeRate,
      request.depositAmount,
    );

    const inscribe_id = crypto.randomUUID();

    const inscribeItem = this.repository.create({
      inscribeId: inscribe_id,
      privateKey: payPrivateKey,
      content: request.content,
      receiverAddress: request.receiverAddress,
      feeRate: request.feeRate,
      depositAmount: request.depositAmount,
      commitTx: '',
    });
    this.repository.save(inscribeItem);

    return {
      id: inscribe_id,
      address: payAddress,
      amount: amount,
    };
  }

  async preCommit() {
    return null;
  }

  async commit(request: CommitRequest): Promise<CommitResponse> {
    const inscribeItem = await this.repository.findOne({
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
      inscribeItem.commitTx = request.tx;
      inscribeItem.commitTxHash = Transaction.fromHex(request.tx).getId();
      inscribeItem.revealHash = revealResult.txHash;
      inscribeItem.status = 1;
      this.repository.save(inscribeItem);

      // relay tx of two.
      try {
        await relay(request.tx);
        await relay(revealResult.signedTx);

        inscribeItem.status = 2;
        this.repository.save(inscribeItem);
      } catch (e) {
        throw new Error(
          'Commit inscribe param error, failed to relay tx: ' + e,
        );
      }
    }

    return {
      hash: revealResult.txHash,
    };
  }
}
