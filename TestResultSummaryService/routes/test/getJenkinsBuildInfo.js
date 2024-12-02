const JenkinsInfo = require('../../JenkinsInfo');

module.exports = async (req, res) => {
    let { url, buildName, buildNum } = req.query;
    if (buildNum) buildNum = parseInt(buildNum, 10);
    const jenkinsInfo = new JenkinsInfo();
    try {
        const output = await jenkinsInfo.getBuildInfo(url, buildName, buildNum);
        res.send({ output });
    } catch (e) {
        res.send({ result: e.toString() });
    }
};
