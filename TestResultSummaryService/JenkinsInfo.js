const Promise = require('bluebird');
const jenkinsapi = require('jenkins-api');
const { logger } = require('./Utils');
const ArgParser = require("./ArgParser");

const options = { request: { timeout: 2000 } };

// Server connection may drop. If timeout, retry.
const retry = fn => {
    const promise = Promise.promisify(fn);
    return async function () {
        for (let i = 0; i < 5; i++) {
            try {
                return await promise.apply(null, arguments);
            } catch (e) {
                logger.warn(`Try #${i + 1}: connection issue`, arguments);
                logger.warn(e);
                if (e.toString().includes("unexpected status code: 404")) {
                    return { code: 404 };
                }
            }
        }
    }
}

class JenkinsInfo {

    constructor(options) {
        this.credentails = ArgParser.getConfig();
    }

    async getAllBuilds(url, buildName) {
        const newUrl = this.addCredential(url);
        const jenkins = jenkinsapi.init(newUrl, options);
        const all_builds = retry(jenkins.all_builds);
        const builds = await all_builds(buildName);
        return builds;
    }

    async getBuildOutput(url, buildName, buildNum) {
        const newUrl = this.addCredential(url);
        const jenkins = jenkinsapi.init(newUrl, options);
        const console_output = retry(jenkins.console_output);
        const { body } = await console_output(buildName, buildNum);
        return body;
    }

    async getBuildInfo(url, buildName, buildNum) {
        const newUrl = this.addCredential(url);
        const jenkins = jenkinsapi.init(newUrl, options);
        const build_info = retry(jenkins.build_info);
        const body = await build_info(buildName, buildNum);
        return body;
    }

    async getLastBuildInfo(url, buildName) {
        const newUrl = this.addCredential(url);
        const jenkins = jenkinsapi.init(newUrl, options);
        const last_build_info = retry(jenkins.last_build_info);
        const body = await last_build_info(buildName);
        return body;
    }

    addCredential(url) {
        if (this.credentails) {
            if (this.credentails.hasOwnProperty(url)) {
                const user = encodeURIComponent(this.credentails[url].user);
                const password = encodeURIComponent(this.credentails[url].password);
                const tokens = url.split("://");
                if (tokens.length == 2 && user && password) {
                    url = `${tokens[0]}://${user}:${password}@${tokens[1]}`;
                }
            }
        }
        return url;
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