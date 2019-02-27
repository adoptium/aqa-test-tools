const { TestResultsDB, ObjectID } = require('../Database');

module.exports = async (req, res) => {
  const testResultsDB = new TestResultsDB();
  console.log(req.query);
  const result = await testResultsDB.getTotals(req.query);
  res.send(result);
}