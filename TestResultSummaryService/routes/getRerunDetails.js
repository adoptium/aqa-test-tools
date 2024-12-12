const { TestResultsDB } = require('../Database');

/**
 * getRerunDetails returns rerun summary
 * @route GET /api/getRerunDetails
 * @group Test - Operations about test
 * @param {number} id Optional.
 * @param {string} url Optional. If provided, it has to be used with buildName and buildNum
 * @param {string} buildName Optional. If provided, it has to be used with url and buildNum
 * @param {string} buildNum Optional. If provided, it has to be used with url and buildName
 * @return {object} {manual_rerun_needed}
 */

module.exports = async (req, res) => {
    const testResultsDB = new TestResultsDB();
    const result = await testResultsDB.getRerunDetails(req.query);
    res.send(result);
};
