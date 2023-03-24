const JenkinsApiQuery = require('../JenkinsApiQuery');

/**
 * getBuildStages query Jenkins via REST API
 *
 * @route GET /api/getBuildStages
 * @param {string} url Required. Jenkins server url (it is used to identify the build).
 * @param {string} buildName Required.
 * @param {string} buildNum Required.
 */

module.exports = async (req, res) => {
    const { url, buildName, buildNum } = req.query;
    try {
        const jenkinsApiQuery = new JenkinsApiQuery({
            baseUrl: url,
            job: buildName,
            build: parseInt(buildNum, 10),
        });
        const output = await jenkinsApiQuery.getBuildStages();
        res.send(output);
    } catch (e) {
        res.send({ result: e.toString() });
    }
};
