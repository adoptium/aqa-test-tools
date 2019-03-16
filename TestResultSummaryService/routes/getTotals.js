const { TestResultsDB, ObjectID } = require('../Database');

module.exports = async (req, res) => {
  const testResultsDB = new TestResultsDB();
  const result = await testResultsDB.getTotals(req.query);
  res.send(result);
}