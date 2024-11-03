import { Injectable, Logger } from '@nestjs/common';

export interface Inscription {
    blockHeight?: number
    inscriptionId: string
    contentType: string
    contentLength: number
    content: string
    timestamp?: number
    hash?: string;
}

@Injectable()
export class InscriptionService {
    private readonly logger = new Logger(InscriptionService.name)

    constructor() { }

    private parse(txinWitness: string[]) {
        let rawWitness: Buffer
        let contentStart: number
        let contentType: string = ''
        let isInscription: boolean
        let data = {
            contentType: '',
            contentLength: 0,
            rawContentData: Buffer.alloc(0)
        }
        if (txinWitness && txinWitness.length > 1) {
            rawWitness = Buffer.from(txinWitness[1], 'hex')
            for (let index = 0; index < rawWitness.length; index++) {
                if (index + 1 == rawWitness.length) {
                    // Invalid content-length
                    break
                }
                const opIf = rawWitness[index].toString(16)
                const opPushbytes3 = rawWitness[index + 1].toString(16)
                // ord keyword
                const opPushbytes3Data = rawWitness.subarray(index + 2, index + 5).toString('hex')
                // find ord
                // OP_IF(0x63) -> OP_PUSHBYTES_3(0x03) -> ord hex(0x6f7264)
                if (opIf == '63' && opPushbytes3 == '3' && opPushbytes3Data == '6f7264') {
                    // parse content type
                    let typeLength = rawWitness[index + 7]
                    const typeStartIndex = index + 8
                    for (let tIndex = 0; tIndex < typeLength; tIndex++) {
                        contentType += String.fromCharCode(rawWitness[typeStartIndex + tIndex])
                    }
                    // op_push startIndex= index+2+3+3+typeLength+1
                    contentStart = index + 2 + 3 + 3 + typeLength + 1
                    isInscription = true;
                    break
                }
            }
            // parse content data
            if (isInscription) {
                const _rawContentData = this._getAllContent(rawWitness, contentStart)
                data.rawContentData = _rawContentData
                data.contentLength = _rawContentData.length
            }
        }
        return data
    }

    getInscriptionContentData(txid: string, txinWitness: string[]): Inscription | null {
        const { contentType, contentLength, rawContentData } = this.parse(txinWitness)
        if (contentLength == 0) {
            return null
        }
        return {
            inscriptionId: `${txid}i0`,
            contentType: contentType,
            contentLength: contentLength,
            content: rawContentData.toString('utf8')
        } as Inscription
    }

    getInscriptionContentHex(txid: string, txinWitness: string[]): Inscription | null {
        const { contentType, contentLength, rawContentData } = this.parse(txinWitness)
        if (contentLength == 0) {
            return null
        }
        return {
            inscriptionId: `${txid}i0`,
            contentType: contentType,
            contentLength: contentLength,
            content: rawContentData.toString('hex')
        } as Inscription
    }

    private _getContent(rawWitness: Buffer, existing: Buffer, startIndex: number) {
        let op_1 = rawWitness[startIndex];
        let offset = startIndex
        let newIndex: number = 0
        if (op_1 > 0 && op_1 < 76) {
            // The next opcode bytes is data to be pushed onto the stack
            let nb = rawWitness[startIndex]
            offset++
            newIndex = offset + nb
            // existing = Buffer.concat([existing, this.rawWitness.subarray(startIndex + 1, newIndex)]);
        } else if (op_1 == 76) {
            // The byte length uses 1 bytes
            let nb = rawWitness[startIndex + 1]
            offset += 2
            newIndex = offset + nb
            // existing = Buffer.concat([existing, this.rawWitness.subarray(startIndex + 2, newIndex)]);
        } else if (op_1 == 77) {
            // The next 2 bytes contain the number of bytes to be pushed onto the stack.
            let nb = rawWitness[startIndex + 1] + (rawWitness[startIndex + 2] * 256)
            offset += 3
            newIndex = offset + nb;
            // existing = Buffer.concat([existing, this.rawWitness.subarray(startIndex + 3, newIndex)]);
        }
        existing = Buffer.concat([existing, rawWitness.subarray(offset, newIndex)]);
        return { existing, newIndex }
    }

    private _getAllContent(rawWitness: Buffer, startIndex: number) {
        let newIndex = startIndex
        let existing = Buffer.alloc(0)
        while (newIndex !== 0) {
            const newContent = this._getContent(rawWitness, existing, newIndex)
            newIndex = newContent.newIndex
            existing = newContent.existing
        }
        return existing
    }
}
