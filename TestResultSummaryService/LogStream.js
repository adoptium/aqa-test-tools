const got = require('got');
const url = require('url');
const { logger, addCredential } = require('./Utils');
const ArgParser = require("./ArgParser");

class LogStream {
    constructor(options) {
        this.credentails = ArgParser.getConfig();
        const build = options.build || 'lastBuild';
        this.url = addCredential(this.credentails, options.baseUrl) + '/job/' + options.job + '/' + build + '/logText/progressiveText';
    }
    async next(startPtr) {
        try {
            logger.debug(`LogStream: next(): url: ${this.url} startPtr: ${startPtr}`);
            const response = await got.get(this.url, {
                followRedirect: true,
                query: { start: startPtr },
                timeout : 4 * 60 * 1000,
            });
            if (response.body.length === 0) {
                return "";
            } else {
                return response.body;
            }
        } catch (e) {
            logger.debug("LogStreamError: next(): ", this.url, e);
            // if return code is 404, it means this build no longer exists.
            if (e.toString().includes("Response code 404 (Not Found)")) {
                return `${this.url} no longer exists`;
            }
        }
    }

    // check the response size using http head request
    async getSize() {
        try {
            logger.debug(`LogStream: getSize(): url: ${this.url}`);
            // set timeout to 4 mins
            const timeout = 4 * 60 * 1000;
            const { headers } = await got.head(this.url, { timeout });
            if (headers && headers["x-text-size"]) {
                logger.debug(`LogStream: getSize(): size: ${headers["x-text-size"]}`);
                return headers["x-text-size"];
            } else {
                return -1;
            }
        } catch (e) {
            logger.debug("LogStreamError: getSize(): ", this.url, e);
            // if return code is 404, it means this build no longer exists.
            if (e.toString().includes("Response code 404 (Not Found)")) {
                return 0;
            }
        }
    }
}

module.exports = LogStream;