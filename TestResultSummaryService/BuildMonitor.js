const DataManager = require('./DataManager');
const JenkinsInfo = require('./JenkinsInfo');
const ObjectID = require('mongodb').ObjectID;
const Promise = require('bluebird');
const { TestResultsDB, AuditLogsDB } = require('./Database');
const { logger } = require('./Utils');
const {
    deleteBuildsAndChildrenByFields,
} = require('./routes/deleteBuildsAndChildrenByFields');

class BuildMonitor {
    async execute(task) {
        let { buildUrl, type, streaming } = task;
        if (!buildUrl || !type) {
            logger.error(
                'BuildMonitor: Invalid buildUrl and/or type',
                buildUrl,
                type
            );
            return;
        }
        const { buildName, url } = this.getBuildInfo(buildUrl);
        if (!buildName) {
            logger.error('BuildMonitor: Cannot parse buildUrl ', buildUrl);
            return;
        }
        logger.debug('BuildMonitor: url', url, 'buildName', buildName);

        const jenkinsInfo = new JenkinsInfo();
        const allBuilds = await jenkinsInfo.getAllBuilds(url, buildName);
        if (!Array.isArray(allBuilds)) {
            logger.error('allBuilds:', allBuilds);
            logger.error('BuildMonitor: Cannot find the build ', buildUrl);
            return;
        }
        // sort the allBuilds to make sure build number is in
        // descending order
        allBuilds.sort((a, b) => parseInt(b.id) - parseInt(a.id));
        /*
         * Loop through allBuilds or past 10 builds (whichever is
         * less) to avoid OOM error. If there is not a match in db,
         * create the new build. Otherwise, break. Since allBuilds
         * are in descending order, we assume if we find a match,
         * all remaining builds that has a lower build number is in
         * db.
         */
        const limit = Math.min(10, allBuilds.length);
        const testResults = new TestResultsDB();
        for (let i = 0; i < limit; i++) {
            const buildNum = parseInt(allBuilds[i].id, 10);
            const buildsInDB = await testResults
                .getData({ url, buildName, buildNum })
                .toArray();
            if (!buildsInDB || buildsInDB.length === 0) {
                let status = 'NotDone';
                if (streaming === 'Yes') {
                    status = 'Streaming';
                    logger.info(
                        `Set build ${url} ${buildName} ${buildNum} status to Streaming `
                    );
                }
                const buildInfo = await jenkinsInfo.getBuildInfo(
                    url,
                    buildName,
                    buildNum
                );
                const buildParams = jenkinsInfo.getBuildParams(buildInfo);
                let keepForever = false;
                if (buildParams) {
                    buildParams.forEach((param) => {
                        if (
                            param.name === 'overridePublishName' &&
                            param.value !== ''
                        ) {
                            keepForever = true;
                        }
                    });
                }
                const buildData = {
                    url,
                    buildName,
                    buildNum,
                    buildDuration: null,
                    buildResult: allBuilds[i].result
                        ? allBuilds[i].result
                        : null,
                    timestamp: allBuilds[i].timestamp
                        ? allBuilds[i].timestamp
                        : null,
                    type: type === 'FVT' ? 'Test' : type,
                    keepForever,
                    status,
                };
                const _id = await new DataManager().createBuild(buildData);
                await new AuditLogsDB().insertAuditLogs({
                    action: '[createBuild]',
                    _id,
                    url,
                    buildName,
                    buildNum,
                    keepForever,
                    status,
                });
            } else {
                break;
            }
        }
    }

    getBuildInfo(buildUrl) {
        // remove space and last /
        buildUrl = buildUrl.trim().replace(/\/$/, '');

        let url = null;
        let buildName = null;

        //split based on / and buildName should be the last element
        let tokens = buildUrl.split('/');
        if (tokens && tokens.length > 1) {
            buildName = tokens.pop();
        }

        if (buildUrl.includes('/view/')) {
            tokens = buildUrl.split(/\/view\//);
            // set url to domain only
            if (tokens && tokens.length > 1) {
                url = tokens[0];
            }
        } else if (buildUrl.includes('/job/')) {
            url = buildUrl.replace('/job/' + buildName, '');
        }
        return { buildName, url };
    }

    async deleteOldBuilds(task) {
        let { buildUrl, numBuildsToKeep, deleteForever } = task;
        const { buildName, url } = this.getBuildInfo(buildUrl);
        // keep only limited builds in DB and delete old builds
        const testResults = new TestResultsDB();
        let query = { url, buildName };
        if (!deleteForever) {
            query.keepForever = { $ne: true };
        }
        const allBuildsInDB = await testResults
            .getData(query)
            .sort({ buildNum: 1 })
            .toArray();
        if (allBuildsInDB && allBuildsInDB.length > numBuildsToKeep) {
            const endIndex = Math.max(
                0,
                allBuildsInDB.length - numBuildsToKeep
            );
            return Promise.all(
                allBuildsInDB
                    .slice(0, endIndex)
                    .map((build) =>
                        deleteBuildsAndChildrenByFields({ _id: build._id })
                    )
            );
        }
    }

    async deleteOldAuditLogs(numDaysToKeep = 30) {
        let date = new Date();
        date.setDate(date.getDate() - parseInt(numDaysToKeep, 10));
        const auditLogs = new AuditLogsDB();
        await auditLogs.deleteMany({ timestamp: { $lt: new Date(date) } });
    }
}
module.exports = BuildMonitor;
