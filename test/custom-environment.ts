import NodeEnvironment from 'jest-environment-node'
import chalk from 'chalk'

class CustomEnvironment extends NodeEnvironment {
    async setup() {
        await super.setup();
        this.global.console.log = (message) => {
            process.stdout.write(`\x1B[0m${this.fotmat(message)}\x1B[0m\n`);
        };
        this.global.console.error = (message) => {
            process.stderr.write(`\x1B[31m${this.fotmat(message)}\x1B[0m\n`);
        };
        this.global.console.warn = (message) => {
            process.stdout.write(`\x1B[33m${this.fotmat(message)}\x1B[0m\n`);
        };
        this.global.console.debug = (message) => {
            process.stdout.write(`\x1B[36m${this.fotmat(message)}\x1B[0m\n`);
        };
    }

    fotmat(message: any) {
        return typeof message == 'object' ? JSON.stringify(message) : message
    }
}

module.exports = CustomEnvironment;