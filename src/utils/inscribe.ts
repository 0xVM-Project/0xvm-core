import {
  Inscriber,
  JsonRpcDatasource,
  Ordit,
  UTXOLimited,
} from '@sadoprotocol/ordit-sdk';
import axios from 'axios';
import { address as BtcAddress, Transaction, address } from 'bitcoinjs-lib';
import { bitcoin, regtest, testnet } from 'bitcoinjs-lib/src/networks';
import ECPairFactory from 'ecpair';
import * as ecc from 'tiny-secp256k1';

export const POSTAGE = 1000; // base value of the inscription in sats
const BTC_NETWORK = 'testnet';
const BITCOINJS_NETWORK = new Map([
  ['mainnet', bitcoin],
  ['testnet', testnet],
  ['regtest', regtest],
]).get(BTC_NETWORK);

/**
 * @param content content of inscription
 * @param address receiver of inscription
 */
export async function createCommit(
  content: string,
  receiverAddress: string,
  feeRate: number,
) {
  const factory = ECPairFactory(ecc);

  const { privateKey: payPrivateKey } = factory.makeRandom();

  const wallet = new Ordit({
    privateKey: payPrivateKey.toString('hex'),
    network: BTC_NETWORK,
    type: 'taproot',
  });

  const inscriber = new Inscriber({
    network: BTC_NETWORK,
    address: wallet.selectedAddress,
    publicKey: wallet.publicKey,
    changeAddress: receiverAddress, // ensure when used.
    destinationAddress: receiverAddress,
    mediaContent: content,
    mediaType: 'text/plain',
    feeRate: feeRate,
    postage: POSTAGE,
  });

  const { address, revealFee } = await inscriber.generateCommit();

  // An increase in the size of an output is 43 vbytes.
  return {
    payPrivateKey: payPrivateKey.toString('hex'),
    payAddress: address,
    amount: revealFee,
  };
}

export async function createReveal(
  payPrivateKey: string,
  content: string,
  receiverAddress: string,
  feeRate: number,
  commitHex: string,
) {
  const wallet = new Ordit({
    privateKey: payPrivateKey,
    network: BTC_NETWORK,
    type: 'taproot',
  });

  let inscriber = new Inscriber({
    network: BTC_NETWORK,
    address: wallet.selectedAddress,
    publicKey: wallet.publicKey,
    changeAddress: receiverAddress,
    destinationAddress: receiverAddress,
    mediaContent: content,
    mediaType: 'text/plain',
    feeRate: feeRate,
    postage: POSTAGE,
  });

  const { address, revealFee } = await inscriber.generateCommit();

  await checkCommitTx(
    commitHex,
    revealFee,
    address,
  );

  // To implement the deposit by making use of change address.
  inscriber = new Inscriber({
    network: BTC_NETWORK,
    address: wallet.selectedAddress,
    publicKey: wallet.publicKey,
    changeAddress: receiverAddress,
    destinationAddress: receiverAddress,
    mediaContent: content,
    mediaType: 'text/plain',
    feeRate: feeRate,
    postage: POSTAGE,
    datasource: createProxyRpc({ commitHex, revealAddress: address }),
  });

  await inscriber.generateCommit();

  const ready = await inscriber.isReady();

  let result = {
    success: false,
    signedTx: '',
    txHash: '',
  };

  if (ready) {
    await inscriber.build();

    // add another output if depositAmount is greater than 0.
    const commitHex = inscriber.toHex();

    const signedTxHex = wallet.signPsbt(commitHex, {
      isRevealTx: true,
    });

    const txId = Transaction.fromHex(signedTxHex).getId();

    result = {
      success: true,
      signedTx: signedTxHex,
      txHash: txId,
    };
  }

  return result;
}

export async function relay(...txs: string[]) {
  for (const tx of txs) {
    console.log(
      `relay is called tx = ${tx}, txId = ${Transaction.fromHex(tx).getId()}`,
    );
    await postTx(tx);
  }

  return true;
}

async function postTx(rawtx: string): Promise<string> {
  try {
      const response = await axios.post(`https://wallet-api-testnet.unisat.io/v5/tx/broadcast`, { rawtx })
      if (response.data.code == 0) {
          return response.data.data
      }
      throw new Error(response.data.msg)
  } catch(error) {
      throw new Error(error)
  }
}

function createProxyRpc({
  commitHex,
  revealAddress,
}: {
  commitHex: string;
  revealAddress: string;
}) {
  const original = new JsonRpcDatasource({ network: BTC_NETWORK });

  const proxy = new Proxy(original, {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    get(target, p, receiver) {
      // console.log(`proxy get is called:  ${p.toString()}`);
      if (p === 'getSpendables') {
        return () => getSpendables(commitHex, revealAddress);
      }
      return target[p];
    },
  });

  return proxy;
}

function getSpendables(
  commitHex: string,
  revealAddress: string,
): Promise<UTXOLimited[]> {
  const transaction = Transaction.fromHex(commitHex);
  const outIndex = transaction.outs.findIndex((out) => {
    const address = BtcAddress.fromOutputScript(out.script, BITCOINJS_NETWORK);

    return address === revealAddress;
  });
  const out = transaction.outs[outIndex];

  const result = [
    {
      txid: transaction.getId(),
      n: outIndex,
      sats: out.value,
      // scriptPubKey: out.script.toString('hex'),
      scriptPubKey: {
        asm: '',
        desc: '',
        address: '',
        hex: out.script.toString('hex'),
        type: 'witness_v1_taproot',
      },
      confirmation:0
    },
  ];
  return Promise.resolve(result);
}

async function checkCommitTx(tx: string, amount: number, payAddress: string) {
  // console.debug(`tx: ${tx} amount: ${amount} payAddress: ${payAddress}`)
  const validTx = Transaction.fromHex(tx).outs.find((out) => {
    return (
      out.value === amount &&
      payAddress === address.fromOutputScript(out.script, BITCOINJS_NETWORK)
    );
  });

  if (!validTx) {
    throw new Error('Commit inscribe param error, invalid tx');
  }
}