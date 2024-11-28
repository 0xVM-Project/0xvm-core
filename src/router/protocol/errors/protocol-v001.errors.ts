export class SendRawTransactionRequestError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SendRawTransactionRequestError';
    }
}