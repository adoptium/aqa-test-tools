const got = require('got');
const url = require('url');
const { logger, addCredential } = require('./Utils');
const ArgParser = require('./ArgParser');

class JenkinsApiQuery {
    constructor(options) {
        this.credentails = ArgParser.getConfig();
        const build = options.build || 'lastBuild';
        this.url =
            addCredential(this.credentails, options.baseUrl) +
            '/job/' +
            options.job +
            '/' +
            build +
            '/';
    }

    async getBuildStages() {
        const wfapi = this.url + 'wfapi/describe';
        logger.debug(
            `JenkinsApiQuery: getStages(): [CIServerRequest] url: ${wfapi}`
        );
        const response = await got.get(wfapi, {
            followRedirect: true,
            timeout: 1 * 60 * 1000,
        });
        if (response.body.length === 0) {
            return '';
        } else {
            return response.body;
        }
    }
}

module.exports = JenkinsApiQuery;
