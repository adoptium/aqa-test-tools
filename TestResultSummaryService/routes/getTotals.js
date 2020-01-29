const { TestResultsDB, ObjectID } = require('../Database');

/**
 * getTotals returns test summary
 * @param {number} id Optional.
 * @param {string} url Optional. If provided, it has to be used with buildName and buildNum
 * @param {string} buildName Optional. If provided, it has to be used with url and buildNum
 * @param {string} buildNum Optional. If provided, it has to be used with url and buildName
 * @return {object} {passed, failed, disabled, skipped, executed, total}
 */

module.exports = async (req, res) => {
  const testResultsDB = new TestResultsDB();
  const result = await testResultsDB.getTotals(req.query);
  res.send(result);
}