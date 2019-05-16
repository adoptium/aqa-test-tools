const { TestResultsDB, ObjectID } = require('../Database');

/*
* This API takes parentId or combination of (url, buildName and buildNum)
* Optional paramters: buildResult, testSummaryResult and buildNameRegex
* It finds a parent build that has id = parentId or matches the combination of (url, buildName 
* and buildNum)
* It returns all descent builds of the parent build that matches with buildResult, testSummaryResult and buildNameRegex
*/

module.exports = async (req, res) => {
  const url = req.query.url;
  const buildName = req.query.buildName;
  let buildNum = req.query.buildNum;
  let parentId = req.query.parentId;
  let buildResult = req.query.buildResult;
  let testSummaryResult = req.query.testSummaryResult;

  let info = {};
  if (parentId) {
    parentId = new ObjectID(parentId);
    info = { _id: parentId };
  } else if (url && buildName && buildNum) {
    if (buildNum && parseInt(buildNum, 10)) {
      buildNum = parseInt(buildNum, 10);
    } else {
      return { error: `invalid buildNum: ${buildNum}` };
    }
  } else {
    return { error: `Please provide parentId ${parentId} or combination of (url ${url}, buildName ${buildName} and buildNum ${buildNum})` };
  }
  if (buildResult && buildResult.startsWith("!")) {
    buildResult = { $ne: buildResult.substring(1) };
  }

  let matchData = {}
  if (buildResult) {
    matchData["childBuilds.buildResult"] = buildResult;
  }
  if (testSummaryResult) {
    matchData[`childBuilds.testSummary.${testSummaryResult}`] = { $exists: true, $ne: null, $ne: 0 };
  }
  if (req.query.buildNameRegex) {
    matchData["childBuilds.buildName"] = { $regex: req.query.buildNameRegex };
  }
  const testResultsDB = new TestResultsDB();
  const result = await testResultsDB.aggregate([
    { $match: info },
    {
      $graphLookup: {
        from: "testResults",
        startWith: "$_id",
        connectFromField: "_id",
        connectToField: "parentId",
        as: "childBuilds",
      }
    },
    {
      $project: {
        childBuilds: "$childBuilds"
      }
    },
    { $unwind: "$childBuilds" },
    {
      $match: matchData
    },
    { $replaceRoot: { newRoot: "$childBuilds" } }
  ]);

  res.send(result);
}