const JenkinsInfo = require('../JenkinsInfo');
const fs = require('fs');

module.exports = async (req, res) => {
    const { url, buildName, buildNum } = req.query;
    if (req.query.buildNum)
        req.query.buildNum = parseInt(req.query.buildNum, 10);
    const jenkinsInfo = new JenkinsInfo();
    try {
        const output = await jenkinsInfo.getBuildOutput(
            url,
            buildName,
            buildNum
        );
        const filename = './output_' + Math.random();
        fs.writeFileSync(filename, output);
        res.send({ result: filename });
    } catch (e) {
        res.send({ result: e.toString() });
    }
};
