const JenkinsInfo = require('../../JenkinsInfo');

module.exports = async (req, res) => {
    const { url, buildName, buildNum } = req.query;
    if (req.query.buildNum)
        req.query.buildNum = parseInt(req.query.buildNum, 10);
    const jenkinsInfo = new JenkinsInfo();
    try {
        const output = await jenkinsInfo.getBuildInfo(url, buildName, buildNum);
        res.send({ output });
    } catch (e) {
        res.send({ result: e.toString() });
    }
};
