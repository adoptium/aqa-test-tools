const { TestResultsDB } = require('../Database');

/**
 * getJobsDetails returns jobs details
 * @route GET /api/getJobsDetails
 * @group Test - Operations about test
 * @param {number} id Optional.
 * @param {string} url Optional. If provided, it has to be used with buildName and buildNum
 * @param {string} buildName Optional. If provided, it has to be used with url and buildNum
 * @param {string} buildNum Optional. If provided, it has to be used with url and buildName
 * @return {object} {job_success_rate}
 */

module.exports = async (req, res) => {
    const testResultsDB = new TestResultsDB();
    const result = await testResultsDB.testResultsBaseAggregation(req.query, 'jobsDetails');
    res.send(result);
};
