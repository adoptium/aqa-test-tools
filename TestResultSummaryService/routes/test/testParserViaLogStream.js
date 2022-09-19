const LogStream = require('../../LogStream');
const DataManager = require('../../DataManager');
module.exports = async (req, res) => {
    const { url, buildName, buildNum } = req.query;
    try {
        const logStream = new LogStream({
            baseUrl: url,
            job: buildName,
            build: parseInt(buildNum, 10),
        });
        const output = await logStream.next(0);
        const data = await new DataManager().parseOutput(buildName, output);
        res.send({ result: output, data });
    } catch (e) {
        res.send({ result: e.toString() });
    }
};
