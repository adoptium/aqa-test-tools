const got = require('got');
const url = require('url');
const { logger, addCredential } = require('./Utils');
const ArgParser = require('./ArgParser');

class LogStream {
    constructor(options) {
        this.credentails = ArgParser.getConfig();
        const build = options.build || 'lastBuild';
        this.url =
            addCredential(this.credentails, options.baseUrl) +
            '/job/' +
            options.job +
            '/' +
            build +
            '/logText/progressiveText';
    }
    async next(startPtr) {
        logger.debug(
            `LogStream: next(): [CIServerRequest] url: ${this.url} startPtr: ${startPtr}`
        );
        const response = await got.get(this.url, {
            followRedirect: true,
            query: { start: startPtr },
            timeout: 4 * 60 * 1000,
        });
        if (response.body.length === 0) {
            return '';
        } else {
            return response.body;
        }
    }

    // check the response size using http head request
    async getSize() {
        logger.debug(
            `LogStream: getSize(): [CIServerRequest] url: ${this.url}`
        );
        // set timeout to 4 mins
        const timeout = 4 * 60 * 1000;
        const { headers } = await got.head(this.url, { timeout });
        if (headers && headers['x-text-size']) {
            logger.debug(
                `LogStream: getSize(): size: ${headers['x-text-size']}`
            );
            return headers['x-text-size'];
        } else {
            return -1;
        }
    }
}

module.exports = LogStream;
