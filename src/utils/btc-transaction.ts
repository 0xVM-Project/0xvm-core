import axios, { AxiosError } from 'axios';
import * as bitcoin from 'bitcoinjs-lib';
import { Signer } from 'bitcoinjs-lib';
import { ECPairAPI, ECPairFactory, ECPairInterface } from 'ecpair';
import * as ecc from 'tiny-secp256k1';

export type BTCNetwork = 'mainnet' | 'testnet';

interface txOutput {
  address: string;
  value: number;
}

interface Utxo {
  txid: string;
  vout: number;
  satoshis: number;
  scriptPk?: string;
  addressType?: number;
  inscriptions?: any[];
  atomicals?: any[];
  runes?: any[];
  pubkey?: string;
  height?: number;
}

interface UTXOResponse {
  code: number;
  msg: string;
  data: Array<Utxo>;
}

export class BTCTransaction {
  private readonly keyPair: ECPairInterface;
  private readonly dummyKeyPair: ECPairInterface;
  private readonly ECPair: ECPairAPI;
  private readonly p2tr: bitcoin.payments.Payment;
  private readonly internalPubkey: Buffer;
  private readonly bNetwork: bitcoin.networks.Network;

  private readonly unisatBaseUrl = {
    testnet: 'https://wallet-api-testnet.unisat.io/v5',
    mainnet: 'https://wallet-api.unisat.io/v5',
  };

  constructor(hexPrivateKey: string, network: BTCNetwork = 'testnet') {
    this.bNetwork =
      network == 'mainnet'
        ? bitcoin.networks.bitcoin
        : bitcoin.networks.testnet;
    this.ECPair = ECPairFactory(ecc);
    const privateKeyBuffer = Buffer.from(hexPrivateKey, 'hex');
    this.keyPair = this.ECPair.fromPrivateKey(privateKeyBuffer, {
      network: this.bNetwork,
    });
    this.dummyKeyPair = this.ECPair.makeRandom({ network: this.bNetwork });
    this.internalPubkey = this.keyPair.publicKey.subarray(1);
    this.p2tr = bitcoin.payments.p2tr({
      internalPubkey: this.internalPubkey,
      network: this.bNetwork,
    });
  }

  estimateTransactionFee(
    inputCount: number,
    outputCount: number,
    feeRate: number,
  ): number {
    const keyPair = this.ECPair.makeRandom({ network: this.bNetwork });
    const psbt = new bitcoin.Psbt({ network: this.bNetwork });
    // dummy value
    const dummyInputValue = 100000;
    // Add dummy inputs and outputs
    for (let i = 0; i < inputCount; i++) {
      psbt.addInput({
        hash: (
          BigInt(
            `0x${'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'}`,
          ) + BigInt(i)
        ).toString(16), // dummy txid
        index: i,
        witnessUtxo: {
          script: bitcoin.payments.p2wpkh({
            pubkey: keyPair.publicKey,
            network: this.bNetwork,
          }).output!,
          value: dummyInputValue,
        },
      });
    }
    const dummyFee = 10;
    const avgValue = Math.floor(dummyInputValue / outputCount);
    const lastValue = dummyInputValue - avgValue * (outputCount - 1);
    for (let i = 0; i < outputCount; i++) {
      const dummyOutputValue = i == outputCount - 1 ? lastValue : avgValue;
      psbt.addOutput({
        address: bitcoin.payments.p2wpkh({
          pubkey: keyPair.publicKey,
          network: this.bNetwork,
        }).address!,
        value: dummyOutputValue - dummyFee, // dummy value
      });
    }
    psbt.signAllInputs(keyPair);
    psbt.finalizeAllInputs();
    const virtualSize = psbt.extractTransaction().virtualSize();
    return virtualSize * feeRate;
  }

  async broadcastTransaction(txHex: string, network: BTCNetwork = 'testnet') {
    const url = `https://mempool.space${network == 'testnet' ? '/testnet' : ''}/api/tx`;
    try {
      const response = await axios.post(url, txHex, {
        headers: { 'Content-Type': 'text/plain' },
      });
      return response.data;
    } catch (error) {
      console.error(
        'Error broadcasting transaction:',
        error instanceof AxiosError ? error.response?.data : error,
      );
      throw error;
    }
  }

  tapTweakHash(pubKey: Buffer, h: Buffer | undefined): Buffer {
    return bitcoin.crypto.taggedHash(
      'TapTweak',
      Buffer.concat(h ? [pubKey, h] : [pubKey]),
    );
  }

  toXOnly(pubkey: Buffer): Buffer {
    return pubkey.subarray(1, 33);
  }

  tweakSigner(signer: Signer, opts: any = {}): Signer {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    let privateKey: Uint8Array | undefined = signer.privateKey!;
    if (!privateKey) {
      throw new Error('Private key is required for tweaking signer!');
    }
    if (signer.publicKey[0] === 3) {
      privateKey = ecc.privateNegate(privateKey);
    }

    const tweakedPrivateKey = ecc.privateAdd(
      privateKey,
      this.tapTweakHash(this.toXOnly(signer.publicKey), opts.tweakHash),
    );
    if (!tweakedPrivateKey) {
      throw new Error('Invalid tweaked private key!');
    }

    return this.ECPair.fromPrivateKey(Buffer.from(tweakedPrivateKey), {
      network: opts.network,
    });
  }

  validateSchnorrSignature(
    pubkey: Buffer,
    msghash: Buffer,
    signature: Buffer,
  ): boolean {
    return ecc.verifySchnorr(msghash, pubkey, signature);
  }

  async generateTransferHex(
    recipient: string,
    value: number,
    feeRate: number,
    utxos: Utxo[],
    maxFeeRate: number = 20,
  ) {
    const psbt = new bitcoin.Psbt({ network: this.bNetwork });
    psbt.setMaximumFeeRate(maxFeeRate);
    const sender = this.p2tr.address;
    if (!sender) {
      throw new Error(`sender address error, sender=${sender}`);
    }
    if (!utxos || utxos.length === 0) {
      throw new Error(`No UTXOs found for address.`);
    }
    const satoshisTotal = utxos
      .map((d) => d.satoshis)
      .reduce((prev, current) => prev + current);
    console.log(
      `${sender} utxo amount: ${utxos.length} total: ${satoshisTotal} sats`,
    );
    utxos.forEach((utxo) => {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: this.p2tr.output!,
          value: utxo.satoshis,
        },
        tapInternalKey: this.internalPubkey,
      });
    });

    const fee = this.estimateTransactionFee(psbt.inputCount, 2, feeRate);
    if (fee + value > satoshisTotal) {
      throw new Error(
        `Insufficient funds. satoshisTotal:${satoshisTotal} sats  transfer+fee:${value + fee} sats fee:${fee} sats`,
      );
    }
    if (value < 0) {
      value = satoshisTotal - fee;
    }
    psbt.addOutput({
      address: recipient,
      value: value,
    });
    let refundFunds = satoshisTotal - fee - value;
    if (refundFunds > 0) {
      psbt.addOutput({
        address: sender,
        value: refundFunds,
      });
    }
    const validator = psbt.signAllInputs(
      this.tweakSigner(this.keyPair, { network: this.bNetwork }),
    );
    const isValid = validator.validateSignaturesOfAllInputs(
      this.validateSchnorrSignature,
    );
    if (isValid) {
      psbt.finalizeAllInputs();
      const txHex = psbt.extractTransaction().toHex();
      return {
        sender: sender,
        recipientAddress: recipient,
        txHex: txHex,
        fee: fee,
        transferAmount: value,
        availableBalance: refundFunds,
      };
    } else {
      throw new Error(`Inputs Signatures fail`);
    }
  }

  async generateTransferToMultipleAddressesHex(
    recipients: txOutput[],
    feeRate: number,
    utxos: Utxo[],
    maxFeeRate: number = 20,
  ) {
    const psbt = new bitcoin.Psbt({ network: this.bNetwork });
    psbt.setMaximumFeeRate(maxFeeRate);
    const sender = this.p2tr.address;
    if (!sender) {
      throw new Error(`sender address error, sender=${sender}`);
    }
    if (!utxos || utxos.length === 0) {
      throw new Error(`No UTXOs found for address.`);
    }
    const satoshisTotal = utxos
      .map((d) => d.satoshis)
      .reduce((prev, current) => prev + current);
    utxos.forEach((utxo) => {
      psbt.addInput({
        hash: utxo.txid,
        index: utxo.vout,
        witnessUtxo: {
          script: this.p2tr.output!,
          value: utxo.satoshis,
        },
        tapInternalKey: this.internalPubkey,
      });
    });

    const fee = this.estimateTransactionFee(
      psbt.inputCount,
      recipients.length + 1,
      feeRate,
    );
    const transferTotal = recipients
      .map((d) => d.value)
      .reduce((prev, current) => prev + current);
    console.log(
      `${sender} utxo amount: ${utxos.length} inputTotal: ${satoshisTotal} sats, recipient address: ${recipients.length}, transfer: ${transferTotal}, fee: ${fee}`,
    );
    if (fee + transferTotal > satoshisTotal) {
      throw new Error(
        `Insufficient funds. satoshisTotal:${satoshisTotal} sats  transfer+fee:${transferTotal + fee} sats`,
      );
    }
    psbt.addOutputs(recipients);
    let refundFunds = satoshisTotal - fee - transferTotal;
    if (refundFunds > 0) {
      psbt.addOutput({
        address: sender,
        value: refundFunds,
      });
    }
    const validator = psbt.signAllInputs(
      this.tweakSigner(this.keyPair, { network: this.bNetwork }),
    );
    const isValid = validator.validateSignaturesOfAllInputs(
      this.validateSchnorrSignature,
    );
    if (isValid) {
      psbt.finalizeAllInputs();
      const txHex = psbt.extractTransaction().toHex();
      return {
        sender: sender,
        txHex: txHex,
        fee: fee,
        transferAmount: transferTotal,
        availableBalance: refundFunds,
      };
    } else {
      throw new Error(`Inputs Signatures fail`);
    }
  }

  async transferToMultipleAddresses(
    recipients: txOutput[],
    feeRate: number,
    network: BTCNetwork = 'testnet',
    utxos: Utxo[] = [],
  ) {
    const utxoResponse = await this.getUTXOs(this.p2tr.address!, network);
    if (!utxos || utxos.length == 0) {
      utxos = utxoResponse.data;
    }
    if (!utxos || utxos.length === 0) {
      throw new Error(`No UTXOs found for address.`);
    }
    const { sender, txHex, fee, availableBalance } =
      await this.generateTransferToMultipleAddressesHex(
        recipients,
        feeRate,
        utxos,
      );
    for (const recipient of recipients) {
      console.log(
        `transfer ${sender}->${recipient.address} ${recipient.value} fee:${fee}`,
      );
    }
    const hash = await this.broadcastTransaction(txHex, network);
    const availableUTXO: Utxo = {
      txid: hash,
      vout: 1,
      satoshis: availableBalance,
    };
    return availableUTXO;
  }

  async transfer(
    recipient: string,
    value: number,
    feeRate: number,
    network: BTCNetwork = 'testnet',
    utxos: Utxo[] = [],
  ) {
    const utxoResponse = await this.getUTXOs(this.p2tr.address!, network);
    if (!utxos || utxos.length == 0) {
      utxos = utxoResponse.data;
    }
    if (!utxos || utxos.length === 0) {
      throw new Error(`No UTXOs found for address.`);
    }
    const {
      sender,
      txHex,
      recipientAddress,
      transferAmount,
      fee,
      availableBalance,
    } = await this.generateTransferHex(recipient, value, feeRate, utxos);
    console.log(
      `transfer ${sender} -> ${recipientAddress} ${transferAmount} fee:${fee}`,
    );
    let hash = '';
    hash = await this.broadcastTransaction(txHex, network);
    const availableUTXO: Utxo = {
      txid: hash,
      vout: 1,
      satoshis: availableBalance,
    };
    return availableUTXO;
  }

  async getUTXOs(
    address: string,
    network: BTCNetwork = 'testnet',
  ): Promise<UTXOResponse> {
    const url = this.unisatBaseUrl[network] + '/address/btc-utxo';
    const response = await axios.get(url, { params: { address: address } });
    return response.data;
  }
}
