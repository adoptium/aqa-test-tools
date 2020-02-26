const got = require('got');
const url = require('url');
const { logger } = require('./Utils');

class LogStream {
    constructor(options) {
        const build = options.build || 'lastBuild';
        const urlParsed = url.parse(options.baseUrl + '/job/' + options.job + '/' + build + '/logText/progressiveText');
        this.url = urlParsed.protocol + '//' + urlParsed.host + urlParsed.path;

        this.n = 0;
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
            logger.warn("LogStreamError: ", e);
        }
    }
}

module.exports = LogStream;