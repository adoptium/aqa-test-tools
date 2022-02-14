const LogStream = require('../LogStream');

module.exports = async (req, res) => {
    const { url, buildName, buildNum } = req.query;
    try {
        const logStream = new LogStream({
            baseUrl: url,
            job: buildName,
            build: parseInt(buildNum, 10),
        });
        const output = await logStream.next(0);
        res.send({ result: output });
    } catch (e) {
        res.send({ result: e.toString() });
    }
};
