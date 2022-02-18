const Promise = require('bluebird');
const jenkinsapi = require('jenkins-api');
const { logger, addCredential } = require('./Utils');
const ArgParser = require('./ArgParser');
const LogStream = require('./LogStream');

const options = { request: { timeout: 30000 } };

// Server connection may drop. If timeout, retry.
const retry = (fn) => {
    const promise = Promise.promisify(fn);
    return async function () {
        for (let i = 0; i < 3; i++) {
            try {
                return await promise.apply(null, arguments);
            } catch (e) {
                logger.warn(`Try #${i + 1}: connection issue`, arguments);
                logger.warn(e);
                if (e.toString().includes('unexpected status code: 404')) {
                    return { code: 404 };
                }
            }
        }
    };
};

class JenkinsInfo {
    constructor(options) {
        this.credentails = ArgParser.getConfig();
    }

    async getAllBuilds(url, buildName) {
        logger.debug(
            'JenkinsInfo: getAllBuilds(): [CIServerRequest]',
            url,
            buildName
        );
        const newUrl = addCredential(this.credentails, url);
        const jenkins = jenkinsapi.init(newUrl, options);
        const all_builds = retry(jenkins.all_builds);
        const builds = await all_builds(buildName);
        return builds;
    }

    async getBuildOutput(url, buildName, buildNum) {
        logger.info('JenkinsInfo: getBuildOutput: ', url, buildName, buildNum);
        const logStream = new LogStream({
            baseUrl: url,
            job: buildName,
            build: buildNum,
        });
        const size = await logStream.getSize();
        logger.debug(
            'JenkinsInfo: getBuildOutput() is waiting for 5 secs after getSize()'
        );
        await Promise.delay(5 * 1000);

        // Due to 1G string limit and possible OOM in CI server and/or TRSS, only query the output < 50M
        // Regular output should be 2~3M. In rare cases, we get very large output
        // ToDo: we need to update parser to handle segmented output
        if (size > -1) {
            const limit = Math.floor(50 * 1024 * 1024);
            if (size < limit) {
                return await logStream.next(0);
            } else {
                logger.debug(
                    `JenkinsInfo: getBuildOutput(): Output size ${size} > size limit ${limit}`
                );
                throw `Output size ${size} > size limit ${limit}`;
            }
        } else {
            throw `Cannot get build output size: ${size}`;
        }
    }

    async getBuildInfo(url, buildName, buildNum) {
        logger.debug(
            'JenkinsInfo: getBuildInfo(): [CIServerRequest]',
            url,
            buildName,
            buildNum
        );
        const newUrl = addCredential(this.credentails, url);
        const jenkins = jenkinsapi.init(newUrl, options);
        const build_info = retry(jenkins.build_info);
        const body = await build_info(buildName, buildNum);
        return body;
    }

    async getLastBuildInfo(url, buildName) {
        logger.debug(
            'JenkinsInfo: getLastBuildInfo(): [CIServerRequest]',
            url,
            buildName
        );
        const newUrl = addCredential(this.credentails, url);
        const jenkins = jenkinsapi.init(newUrl, options);
        const last_build_info = retry(jenkins.last_build_info);
        const body = await last_build_info(buildName);
        return body;
    }

    getBuildParams(buildInfo) {
        let params = null;
        if (buildInfo && buildInfo.actions) {
            for (let action of buildInfo.actions) {
                if (action.parameters && action.parameters.length > 0) {
                    params = action.parameters;
                    break;
                }
            }
        }
        return params;
    }
}

module.exports = JenkinsInfo;
