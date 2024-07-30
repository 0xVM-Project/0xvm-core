import { Injectable } from '@nestjs/common';
import * as bitcoin from 'bitcoinjs-lib';
import { testnet } from 'bitcoinjs-lib/src/networks';
import { bech32 } from 'bech32'

@Injectable()
export class BlockProcessService {

    bufferToString(buffer: Buffer) {
        return buffer.toString('hex')
    }

    private calculateTxid(rawTx: Buffer): string {
        const txid = bitcoin.crypto.hash256(rawTx);
        return txid.reverse().toString('hex');
    }

    // Helper function to detect script type
    classifyScript(script: Buffer): string {
        try {
            if (bitcoin.payments.p2pkh({ output: script }).address) return 'pubkeyhash';
            if (bitcoin.payments.p2sh({ output: script }).address) return 'scripthash';
            if (bitcoin.payments.p2wpkh({ output: script }).address) return 'witnesspubkeyhash';
            if (bitcoin.payments.p2wsh({ output: script }).address) return 'witnessscripthash';
            if (bitcoin.payments.p2tr({ output: script }).address) return 'witness_v1_taproot';
            if (script.length > 0 && script[0] === bitcoin.opcodes.OP_RETURN) return 'nulldata';
        } catch (e) {
            return 'unknown';
        }
        return 'unknown';
    }

    private processTransaction(tx: bitcoin.Transaction) {
        const txid = tx.getId()
        const rawTx = tx.toBuffer()
        const hash = this.calculateTxid(rawTx)
        return {
            version: tx.version,
            locktime: tx.locktime,
            txid: txid,
            hash: hash,
            ins: tx.ins.map(input => ({
                hash: this.bufferToString(input.hash),
                index: input.index,
                script: this.bufferToString(input.script),
                sequence: input.sequence,
                witness: input.witness.map(wit => this.bufferToString(wit))
            })),
            outs: tx.outs.map((output: bitcoin.TxOutput) => {
                let address = '';
                if (output.script.toString('hex') == '5120e1ee013c0c9d7caa779705f8bf6e3649ef8cc36216c87b3c92491cf022d42e65') {
                    if (output.script[0] === 0x51 && output.script[1] === 0x20) {
                        // witness version 1, 32-byte program (Taproot)
                        const program: Buffer = output.script.subarray(2)
                        const words = bech32.toWords(program);
                        words.unshift(1)
                        address = bech32.encode('tb', words);
                        console.log(address);
                    } else {
                        console.error('Invalid Taproot script');
                    }
                }
                return {
                    script: output.script.toString('hex'),
                    value: output.value,
                    address: address
                }
            })
        };
    }

    processBlock(blockHex: string) {
        const blockBuffer = Buffer.from(blockHex, 'hex')
        const block = bitcoin.Block.fromBuffer(blockBuffer)
        const processedBlock = {
            version: block.version,
            prevHash: this.bufferToString(block.prevHash),
            merkleRoot: this.bufferToString(block.merkleRoot),
            timestamp: block.timestamp,
            witnessCommit: this.bufferToString(block.witnessCommit),
            bits: block.bits,
            nonce: block.nonce,
            transactions: block.transactions.map((tx: bitcoin.Transaction) => this.processTransaction(tx))
        }
        return processedBlock
    }
}
