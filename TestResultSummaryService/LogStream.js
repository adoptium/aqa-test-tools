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
            const response = await got.get(this.url, {
                followRedirect: true,
                query: { start: startPtr },
            });
            if (response.body.length === 0) {
                return "";
            } else {
                return response.body;
            }
        }
        catch (e) {
            logger.warn("LogStreamError: ", this.url, e);
        }
    }
}

module.exports = LogStream;