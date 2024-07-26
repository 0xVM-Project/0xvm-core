import { Logger } from '@nestjs/common';

Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']);

const originalLog = Logger.prototype.log;
Logger.prototype.log = function (message: any, ...optionalParams: any[]) {
    originalLog.call(this, message, ...optionalParams);
    console.log(message, ...optionalParams);
};

const originalError = Logger.prototype.error;
Logger.prototype.error = function (message: any, ...optionalParams: any[]) {
    originalError.call(this, message, ...optionalParams);
    console.error(message, ...optionalParams);
};

const originalWarn = Logger.prototype.warn;
Logger.prototype.warn = function (message: any, ...optionalParams: any[]) {
    originalWarn.call(this, message, ...optionalParams);
    console.warn(message, ...optionalParams);
};

const originalDebug = Logger.prototype.debug;
Logger.prototype.debug = function (message: any, ...optionalParams: any[]) {
    originalDebug.call(this, message, ...optionalParams);
    console.debug(message, ...optionalParams);
};

const originalVerbose = Logger.prototype.verbose;
Logger.prototype.verbose = function (message: any, ...optionalParams: any[]) {
    originalVerbose.call(this, message, ...optionalParams);
    console.log(message, ...optionalParams);
};