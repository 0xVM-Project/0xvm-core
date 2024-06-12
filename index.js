'use strict';

var axios = require('axios');
var dotenv = require('dotenv');
var promises = require('timers/promises');
var flatbuffers = require('flatbuffers');
var ethers = require('ethers');
var mysql = require('mysql2/promise');
var Progress = require('progress');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var flatbuffers__namespace = /*#__PURE__*/_interopNamespaceDefault(flatbuffers);

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol */


function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9;
dotenv.config();
const vmRpcUrl = (_b = (_a = process.env) === null || _a === void 0 ? void 0 : _a.VM_RPC_URL) !== null && _b !== void 0 ? _b : "";
const bitcoinRpcUrl = (_d = (_c = process.env) === null || _c === void 0 ? void 0 : _c.BITCOIN_RPC_URL) !== null && _d !== void 0 ? _d : "";
const bitcoinRpcUser = (_f = (_e = process.env) === null || _e === void 0 ? void 0 : _e.BITCOIN_RPC_USER) !== null && _f !== void 0 ? _f : "";
const bitcoinRpcPassword = (_h = (_g = process.env) === null || _g === void 0 ? void 0 : _g.BITCOIN_RPC_PASSWORD) !== null && _h !== void 0 ? _h : "";
const ordUrl = (_k = (_j = process.env) === null || _j === void 0 ? void 0 : _j.ORD_URL) !== null && _k !== void 0 ? _k : "";
(_m = (_l = process.env) === null || _l === void 0 ? void 0 : _l.NETWORK) !== null && _m !== void 0 ? _m : "";
const chainId = ((_o = process.env) === null || _o === void 0 ? void 0 : _o.CHAIN_ID) ? Number((_p = process.env) === null || _p === void 0 ? void 0 : _p.CHAIN_ID) : 42;
(_r = (_q = process.env) === null || _q === void 0 ? void 0 : _q.DB_PATH) !== null && _r !== void 0 ? _r : "";
const btcAddress = (_t = (_s = process.env) === null || _s === void 0 ? void 0 : _s.BTC_ADDRESS) !== null && _t !== void 0 ? _t : "";
const tokenAddress = (_v = (_u = process.env) === null || _u === void 0 ? void 0 : _u.TOKEN_ADDRESS) !== null && _v !== void 0 ? _v : "";
const sendTokenPrivateKey = (_x = (_w = process.env) === null || _w === void 0 ? void 0 : _w.SEND_TOKEN_PRIVATE_KEY) !== null && _x !== void 0 ? _x : "";
const databaseHost = (_z = (_y = process.env) === null || _y === void 0 ? void 0 : _y.DATABASE_HOST) !== null && _z !== void 0 ? _z : "";
const databaseUser = (_1 = (_0 = process.env) === null || _0 === void 0 ? void 0 : _0.DATABASE_USER) !== null && _1 !== void 0 ? _1 : "";
const databasePassword = (_3 = (_2 = process.env) === null || _2 === void 0 ? void 0 : _2.DATABASE_PASSWORD) !== null && _3 !== void 0 ? _3 : "";
const databaseName = (_5 = (_4 = process.env) === null || _4 === void 0 ? void 0 : _4.DATABASE_NAME) !== null && _5 !== void 0 ? _5 : "";
const latestBlock = ((_6 = process.env) === null || _6 === void 0 ? void 0 : _6.LATEST_BLOCK)
    ? Number((_7 = process.env) === null || _7 === void 0 ? void 0 : _7.LATEST_BLOCK)
    : 822267;
const latestTimestamp = ((_8 = process.env) === null || _8 === void 0 ? void 0 : _8.LATEST_TIMESTAMP)
    ? Number((_9 = process.env) === null || _9 === void 0 ? void 0 : _9.LATEST_TIMESTAMP)
    : Math.floor(Date.now() / 1000);
const inscriptionLabel = "0f0";
const inscriptionVersion = "001";
const inscriptionAccuracy = 1e10;

class Bitcoin {
    constructor() {
        this.getBlockHashByHeight = (_height) => __awaiter(this, void 0, void 0, function* () {
            if (_height) {
                try {
                    const blockInfoResponse = yield this.client.post("", {
                        jsonrpc: "1.0",
                        method: "getblockhash",
                        params: [_height],
                        id: "getblockhash",
                    });
                    return blockInfoResponse.data.result;
                }
                catch (error) {
                    console.error("getBlockHashByHeight error: ", error);
                    return "";
                }
            }
            else {
                return "";
            }
        });
        this.getBlockByHash = (_hash) => __awaiter(this, void 0, void 0, function* () {
            if (_hash) {
                try {
                    const blockInfoResponse = yield this.client.post("", {
                        jsonrpc: "1.0",
                        method: "getblock",
                        params: [_hash],
                        id: "getblock",
                    });
                    return blockInfoResponse.data.result;
                }
                catch (error) {
                    console.error("getBlockByHash error: ", error);
                    return undefined;
                }
            }
            else {
                return undefined;
            }
        });
        this.client = axios.create({
            baseURL: bitcoinRpcUrl,
            auth: {
                username: bitcoinRpcUser,
                password: bitcoinRpcPassword,
            },
            headers: {
                "Content-Type": "text/plain",
            },
        });
    }
}

class Vm {
    constructor() {
        this.call = (_method, _params) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            if (_method && _params) {
                try {
                    const request = {
                        jsonrpc: "2.0",
                        method: _method,
                        params: _params,
                        id: 0,
                    };
                    const response = yield this.client.post("", request);
                    if ((response === null || response === void 0 ? void 0 : response.data) && !((_a = response === null || response === void 0 ? void 0 : response.data) === null || _a === void 0 ? void 0 : _a.error)) {
                        return response.data;
                    }
                    return undefined;
                }
                catch (error) {
                    console.error("getBlockHashByHeight error: ", error);
                    return undefined;
                }
            }
            else {
                return undefined;
            }
        });
        this.getLatestBlock = () => __awaiter(this, void 0, void 0, function* () {
            const result = yield this.call("eth_blockNumber", []);
            if (result && (result === null || result === void 0 ? void 0 : result.result) && !(result === null || result === void 0 ? void 0 : result.error)) {
                return parseInt(result === null || result === void 0 ? void 0 : result.result, 16);
            }
            return latestBlock;
        });
        this.getLatestTimestampByHeight = (_height) => __awaiter(this, void 0, void 0, function* () {
            var _b, _c;
            if (_height) {
                const result = yield this.call("eth_getBlockByNumber", [_height === null || _height === void 0 ? void 0 : _height.toString(16), true]);
                if (result && ((_b = result === null || result === void 0 ? void 0 : result.result) === null || _b === void 0 ? void 0 : _b.timestamp) && !(result === null || result === void 0 ? void 0 : result.error)) {
                    return parseInt((_c = result === null || result === void 0 ? void 0 : result.result) === null || _c === void 0 ? void 0 : _c.timestamp, 16);
                }
            }
            return latestTimestamp;
        });
        this.sendRawTransaction = (_string) => __awaiter(this, void 0, void 0, function* () {
            if (_string) {
                const result = yield this.call("eth_sendRawTransaction", [_string]);
                if (result && (result === null || result === void 0 ? void 0 : result.result) && !(result === null || result === void 0 ? void 0 : result.error)) {
                    return result === null || result === void 0 ? void 0 : result.result;
                }
            }
            return "";
        });
        this.createBlock = () => __awaiter(this, void 0, void 0, function* () {
            const result = yield this.call("engine_createBlock", [
                true,
                false,
                null,
            ]);
            if (result && (result === null || result === void 0 ? void 0 : result.result) && !(result === null || result === void 0 ? void 0 : result.error)) {
                return true;
            }
            return false;
        });
        this.client = axios.create({
            baseURL: vmRpcUrl,
            headers: {
                Accept: "application/json",
            },
        });
    }
}

const retry = (_function) => __awaiter(void 0, void 0, void 0, function* () {
    const delay = Math.floor(Math.random() * (100 - 10 + 1)) + 10;
    let success = false;
    let result;
    while (!success) {
        try {
            result = yield _function();
            success = true;
            return result;
        }
        catch (error) {
            console.error("retry: ", error);
        }
        yield new Promise((resolve) => setTimeout(resolve, delay));
    }
});
const autoRetry = (_function) => __awaiter(void 0, void 0, void 0, function* () {
    return retry(() => new Promise((resolve, reject) => {
        _function().then(resolve, reject);
        promises.setTimeout(1000).then(reject);
    }));
});

class Ordinal {
    constructor() {
        this.getClient = (_path, _params) => __awaiter(this, void 0, void 0, function* () {
            return _path && _params
                ? yield autoRetry(() => __awaiter(this, void 0, void 0, function* () {
                    return (yield this.client.get(`/${_path}/${_params}`)).data;
                }))
                : undefined;
        });
        this.getBlockByHeight = (_height) => __awaiter(this, void 0, void 0, function* () {
            let result = undefined;
            if (_height) {
                result = yield this.getClient("api/inscriptions/block", String(_height));
            }
            console.log("getBlockByHeight: ", result);
            return result;
        });
        this.getOutputById = (_id) => __awaiter(this, void 0, void 0, function* () {
            let result = undefined;
            if (_id && _id.length > 2 && _id[_id.length - 2] === "i") {
                const hash = _id.slice(0, -2) + ":1";
                result = yield this.getClient("output", hash);
            }
            console.log("getOutputById: ", result);
            return result;
        });
        this.client = axios.create({
            baseURL: ordUrl,
            headers: {
                Accept: "application/json",
            },
        });
    }
}

// automatically generated by the FlatBuffers compiler, do not modify
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
class Data {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsData(bb, obj) {
        return (obj || new Data()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsData(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers__namespace.SIZE_PREFIX_LENGTH);
        return (obj || new Data()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    action() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readInt32(this.bb_pos + offset) : 0;
    }
    data(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    static startData(builder) {
        builder.startObject(2);
    }
    static addAction(builder, action) {
        builder.addFieldInt32(0, action, 0);
    }
    static addData(builder, dataOffset) {
        builder.addFieldOffset(1, dataOffset, 0);
    }
    static endData(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createData(builder, action, dataOffset) {
        Data.startData(builder);
        Data.addAction(builder, action);
        Data.addData(builder, dataOffset);
        return Data.endData(builder);
    }
}

// automatically generated by the FlatBuffers compiler, do not modify
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
class Transaction {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsTransaction(bb, obj) {
        return (obj || new Transaction()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsTransaction(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers__namespace.SIZE_PREFIX_LENGTH);
        return (obj || new Transaction()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    content(index, obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new Data()).__init(this.bb.__indirect(this.bb.__vector(this.bb_pos + offset) + index * 4), this.bb) : null;
    }
    contentLength() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    static startTransaction(builder) {
        builder.startObject(1);
    }
    static addContent(builder, contentOffset) {
        builder.addFieldOffset(0, contentOffset, 0);
    }
    static createContentVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startContentVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static endTransaction(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static finishTransactionBuffer(builder, offset) {
        builder.finish(offset);
    }
    static finishSizePrefixedTransactionBuffer(builder, offset) {
        builder.finish(offset, undefined, true);
    }
    static createTransaction(builder, contentOffset) {
        Transaction.startTransaction(builder);
        Transaction.addContent(builder, contentOffset);
        return Transaction.endTransaction(builder);
    }
}

class Database {
    constructor() {
        this.insertWithdrawBtc = (_fromAddress, _toAddress, _amount, _hash) => __awaiter(this, void 0, void 0, function* () {
            if (_fromAddress && _toAddress && _amount && _hash) {
                try {
                    const insertQuery = `
        INSERT INTO withdraw (from_address, to_address, amount, tx_hash)
        VALUES (?, ?, ?, ?)
    `;
                    const values = [_fromAddress, _toAddress, _amount, _hash];
                    const [results] = yield this.database.execute(insertQuery, values);
                    console.log("insertWithdrawBtc:", results);
                    return true;
                }
                catch (error) {
                    console.error("insertWithdrawBtc:", error);
                }
            }
            return false;
        });
        this.database = mysql.createPool({
            host: databaseHost,
            user: databaseUser,
            password: databasePassword,
            database: databaseName,
            waitForConnections: true,
            queueLimit: 0,
            enableKeepAlive: true,
            keepAliveInitialDelay: 0,
        });
    }
}

class Core {
    constructor() {
        this.nonce = [];
        this.parseTransaction = (_string) => {
            let result = "";
            if (_string && _string.length >= 6) {
                const _label = _string.substring(0, 3);
                const _version = _string.substring(3, 6);
                if (inscriptionLabel === _label && inscriptionVersion === _version) {
                    result = _string.substring(6);
                }
            }
            console.log("parseTransaction: ", result);
            return result;
        };
        this.base64DecodeTransaction = (_string) => {
            let result = new Uint8Array();
            if (_string &&
                /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(_string)) {
                result = new Uint8Array(Buffer.from(_string, "base64"));
            }
            console.log("base64DecodeTransaction: ", result);
            return result;
        };
        this.decodeTransaction = (_string) => {
            let result = [];
            if (_string && (_string === null || _string === void 0 ? void 0 : _string.length) > 0) {
                const transactions = Transaction.getRootAsTransaction(new flatbuffers__namespace.ByteBuffer(_string));
                if (transactions && (transactions === null || transactions === void 0 ? void 0 : transactions.contentLength()) > 0) {
                    for (let i = 0; i < (transactions === null || transactions === void 0 ? void 0 : transactions.contentLength()); i++) {
                        const content = transactions.content(i);
                        const action = content === null || content === void 0 ? void 0 : content.action();
                        const data = content === null || content === void 0 ? void 0 : content.data();
                        if (content && action && [1, 2, 3, 4, 5].includes(action) && data) {
                            result.push({ action: action, data });
                        }
                    }
                }
            }
            console.log("decodeTransaction: ", result);
            return result;
        };
        this.unSignTransaction = (_string) => {
            let result = undefined;
            if (_string) {
                result = ethers.ethers.utils.parseTransaction(_string);
            }
            console.log("unSignTransaction: ", result);
            return result;
        };
        this.formatTransaction = (_action, _string, _inscriptionId) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h;
            let result = undefined;
            if (_action && _string) {
                let _transaction = undefined;
                if (_action === 1 || _action === 2 || _action === 3) {
                    _transaction = Object.assign(Object.assign({}, _string), { type: (_a = _string === null || _string === void 0 ? void 0 : _string.type) !== null && _a !== void 0 ? _a : undefined, gasPrice: (_b = _string === null || _string === void 0 ? void 0 : _string.gasPrice) === null || _b === void 0 ? void 0 : _b.mul(inscriptionAccuracy), gasLimit: (_c = _string === null || _string === void 0 ? void 0 : _string.gasLimit) === null || _c === void 0 ? void 0 : _c.mul(inscriptionAccuracy), value: (_d = _string === null || _string === void 0 ? void 0 : _string.value) === null || _d === void 0 ? void 0 : _d.mul(inscriptionAccuracy) });
                }
                if (_action === 4 && _inscriptionId) {
                    const fromAddress = _string === null || _string === void 0 ? void 0 : _string.from;
                    if (fromAddress) {
                        const gasPrice = yield this.provider.getGasPrice();
                        let nonce = (_f = (_e = this.nonce) === null || _e === void 0 ? void 0 : _e.find((_item) => _item.address.toLowerCase() === fromAddress.toLowerCase())) === null || _f === void 0 ? void 0 : _f.nonce;
                        if (!nonce) {
                            nonce = yield this.provider.getTransactionCount(fromAddress, "latest");
                        }
                        nonce += 1;
                        this.nonce.push({ address: fromAddress.toLowerCase(), nonce });
                        yield this.provider.getFeeData();
                        const output = yield this.ordinal.getOutputById(_inscriptionId);
                        if (output && (output === null || output === void 0 ? void 0 : output.address) === btcAddress && (output === null || output === void 0 ? void 0 : output.value)) {
                            const value = ethers.BigNumber.from((output === null || output === void 0 ? void 0 : output.value) * inscriptionAccuracy);
                            _transaction = Object.assign(Object.assign({}, _string), { type: (_g = _string === null || _string === void 0 ? void 0 : _string.type) !== null && _g !== void 0 ? _g : undefined, from: tokenAddress, to: fromAddress, nonce,
                                gasPrice, data: "", value,
                                chainId });
                            const gasLimit = yield this.provider.estimateGas(_transaction);
                            _transaction = Object.assign(Object.assign({}, _transaction), { gasLimit });
                        }
                    }
                }
                if (_action === 5) {
                    try {
                        const fromAddress = _string === null || _string === void 0 ? void 0 : _string.from;
                        const hash = _string === null || _string === void 0 ? void 0 : _string.hash;
                        const value = (_h = _string === null || _string === void 0 ? void 0 : _string.value) === null || _h === void 0 ? void 0 : _h.mul(inscriptionAccuracy);
                        if (hash && fromAddress && value && value.gt(ethers.BigNumber.from(0))) {
                            const receipt = yield this.provider.getTransactionReceipt(hash);
                            if (receipt &&
                                receipt.to === tokenAddress &&
                                receipt.status === 1) {
                                const database = new Database();
                                const _result = yield database.insertWithdrawBtc(btcAddress, fromAddress, value.toNumber(), hash);
                                if (_result) {
                                    return "true";
                                }
                            }
                        }
                    }
                    catch (error) {
                        console.error("buildTransaction: ", error);
                    }
                }
                if (_transaction) {
                    result = yield this.wallet.signTransaction(Object.assign({}, _transaction, {
                        v: undefined,
                        r: undefined,
                        s: undefined,
                    }));
                }
            }
            console.log("buildTransaction: ", result);
            return result;
        });
        this.addInscriptionTransaction = (_string) => __awaiter(this, void 0, void 0, function* () {
            var _j, _k, _l, _m;
            let result = undefined;
            const fromAddress = _string === null || _string === void 0 ? void 0 : _string.from;
            if (_string && fromAddress) {
                const gasPrice = yield this.provider.getGasPrice();
                yield this.provider.getFeeData();
                const value = ethers.ethers.utils.formatEther(546 * inscriptionAccuracy);
                let nonce = (_k = (_j = this.nonce) === null || _j === void 0 ? void 0 : _j.find((_item) => _item.address.toLowerCase() === fromAddress.toLowerCase())) === null || _k === void 0 ? void 0 : _k.nonce;
                if (!nonce) {
                    nonce = yield this.provider.getTransactionCount(fromAddress, "latest");
                }
                nonce += 1;
                this.nonce.push({ address: fromAddress.toLowerCase(), nonce });
                const _transaction = Object.assign(Object.assign({}, _string), { type: (_l = _string === null || _string === void 0 ? void 0 : _string.type) !== null && _l !== void 0 ? _l : undefined, from: tokenAddress, to: (_m = _string === null || _string === void 0 ? void 0 : _string.to) !== null && _m !== void 0 ? _m : "", nonce,
                    gasPrice, data: "", value,
                    chainId });
                if (_transaction) {
                    result = yield this.wallet.signTransaction(_transaction);
                }
            }
            console.log("addInscriptionTransaction: ", result);
            return result;
        });
        this.ordinal = new Ordinal();
        this.provider = new ethers.ethers.providers.JsonRpcProvider(vmRpcUrl);
        this.wallet = new ethers.ethers.Wallet(sendTokenPrivateKey, this.provider);
    }
}

class Main {
    constructor() {
        this.fetch = (_height, _progress) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (_height && _progress) {
                const ordinalBlock = yield this.ordinal.getBlockByHeight(_height);
                console.log("fetch ordinalBlock: ", ordinalBlock);
                if (ordinalBlock) {
                    const blockCount = (_a = ordinalBlock === null || ordinalBlock === void 0 ? void 0 : ordinalBlock.block_count) !== null && _a !== void 0 ? _a : 0;
                    const inscriptionList = (_b = ordinalBlock === null || ordinalBlock === void 0 ? void 0 : ordinalBlock.inscriptions) !== null && _b !== void 0 ? _b : [];
                    if (_progress.total !== blockCount) {
                        _progress.total = blockCount;
                    }
                    Promise.all(inscriptionList.map((inscription) => __awaiter(this, void 0, void 0, function* () {
                        var _c;
                        const inscriptionId = (_c = inscription === null || inscription === void 0 ? void 0 : inscription.entry) === null || _c === void 0 ? void 0 : _c.id;
                        const inscriptionContent = inscription === null || inscription === void 0 ? void 0 : inscription.content;
                        if (inscriptionId && inscriptionContent) {
                            const transactionParsed = this.core.parseTransaction(inscriptionContent);
                            if (transactionParsed) {
                                const transactionBase64Decoded = this.core.base64DecodeTransaction(transactionParsed);
                                if (transactionBase64Decoded) {
                                    const transactionDecodedList = this.core.decodeTransaction(transactionBase64Decoded);
                                    if (transactionDecodedList === null || transactionDecodedList === void 0 ? void 0 : transactionDecodedList.length) {
                                        return Promise.all(transactionDecodedList.map((transactionDecoded) => __awaiter(this, void 0, void 0, function* () {
                                            var _d, _e;
                                            const transactionAction = (_d = transactionDecoded === null || transactionDecoded === void 0 ? void 0 : transactionDecoded.action) !== null && _d !== void 0 ? _d : 0;
                                            const transactionData = (_e = transactionDecoded === null || transactionDecoded === void 0 ? void 0 : transactionDecoded.data) !== null && _e !== void 0 ? _e : "";
                                            const transaction = this.core.unSignTransaction(transactionData);
                                            if (transactionAction &&
                                                [1, 2, 3, 4, 5].includes(transactionAction) &&
                                                transaction) {
                                                const transactionSigned = yield this.core.formatTransaction(transactionAction, transaction);
                                                if (transactionSigned) {
                                                    const transactionSignedResult = yield this.vm.sendRawTransaction(transactionSigned);
                                                    console.log("transactionSignedResult: ", transactionSignedResult);
                                                    if (transactionSignedResult) {
                                                        const inscriptionTransaction = yield this.core.addInscriptionTransaction(transaction);
                                                        if (inscriptionTransaction) {
                                                            const inscriptionTransactionResult = yield this.vm.sendRawTransaction(inscriptionTransaction);
                                                            console.log("inscriptionTransactionResult: ", inscriptionTransactionResult);
                                                            return inscriptionTransactionResult;
                                                        }
                                                    }
                                                }
                                            }
                                        })))
                                            .then((transactionDecodedListResult) => {
                                            console.log("transactionDecodedListResult", transactionDecodedListResult);
                                            return transactionDecodedListResult;
                                        })
                                            .catch((error) => {
                                            console.error("transactionDecodedListResult error: ", error);
                                            return undefined;
                                        });
                                    }
                                }
                            }
                        }
                        return undefined;
                    })))
                        .then((inscriptionListResult) => {
                        console.log("inscriptionListResult", inscriptionListResult);
                    })
                        .catch((error) => {
                        console.error("inscriptionListResult error: ", error);
                    })
                        .finally(() => __awaiter(this, void 0, void 0, function* () {
                        const createBlockResult = yield this.vm.createBlock();
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
                                const newBlock = yield this.ordinal.getBlockByHeight(_height);
                                console.log("newBlock: ", newBlock);
                                if ((newBlock === null || newBlock === void 0 ? void 0 : newBlock.block_count) &&
                                    (newBlock === null || newBlock === void 0 ? void 0 : newBlock.block_count) > blockCount) {
                                    break;
                                }
                                yield new Promise((resolve) => setTimeout(resolve, 1000));
                            }
                        }
                        yield this.fetch(_height + 1, _progress);
                    }));
                }
            }
        });
        this.initial = () => __awaiter(this, void 0, void 0, function* () {
            const latestBlockNumber = yield this.vm.getLatestBlock();
            // const latestBlockNumber = 113;
            console.log("latestBlockNumber: ", latestBlockNumber);
            if (latestBlockNumber) {
                const ordinalBlock = yield this.ordinal.getBlockByHeight(latestBlockNumber);
                console.log("ordinalBlock: ", ordinalBlock);
                const blockCount = ordinalBlock === null || ordinalBlock === void 0 ? void 0 : ordinalBlock.block_count;
                if (ordinalBlock && blockCount) {
                    const progress = new Progress(":bar :current/:total", {
                        total: blockCount,
                        curr: latestBlockNumber - 1,
                    });
                    progress.tick();
                    if (latestBlockNumber >= blockCount) {
                        while (true) {
                            const newBlock = yield this.ordinal.getBlockByHeight(latestBlockNumber);
                            console.log("newBlock: ", newBlock);
                            if ((newBlock === null || newBlock === void 0 ? void 0 : newBlock.block_count) && (newBlock === null || newBlock === void 0 ? void 0 : newBlock.block_count) > blockCount) {
                                break;
                            }
                            yield new Promise((resolve) => setTimeout(resolve, 1000));
                        }
                    }
                    yield this.fetch(latestBlockNumber + 1, progress);
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
        });
        this.bitcoin = new Bitcoin();
        this.vm = new Vm();
        this.ordinal = new Ordinal();
        this.core = new Core();
    }
}

(() => __awaiter(void 0, void 0, void 0, function* () {
    console.log("start");
    const main = new Main();
    yield main.initial();
    console.log("end");
}))();
