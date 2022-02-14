const DataManager = require('../DataManager');
const { logger } = require('../Utils');

module.exports = async (req, res) => {
    const { url, buildName, buildNum, type, status = 'NotDone' } = req.query;
    logger.debug('populateDB', req.query);
    await new DataManager().createBuild({
        url,
        buildName,
        buildNum: parseInt(buildNum, 10),
        buildDuration: null,
        buildResult: null,
        type,
        status,
    });

    res.json({});
};
