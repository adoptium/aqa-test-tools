const { TestResultsDB, ObjectID } = require('../Database');

/*
* This API takes parentId or combination of (url, buildName and buildNum)
* Optional paramters: buildResult and buildNameRegex
* It finds a parent build that has id = parentId or matches the combination of (url, buildName 
* and buildNum)
* It returns all descent builds of the parent build that matches with buildResult and buildNameRegex
*/

module.exports = async (req, res) => {
  const url = req.query.url;
  const buildName = req.query.buildName;
  let buildNum = req.query.buildNum;
  let parentId = req.query.parentId;
  let buildResult = req.query.buildResult;

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

  let matchData = { "childBuilds.buildResult": buildResult };
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