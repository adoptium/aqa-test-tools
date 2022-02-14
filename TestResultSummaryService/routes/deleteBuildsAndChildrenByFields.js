const { TestResultsDB, OutputDB } = require('../Database');
const ObjectID = require('mongodb').ObjectID;
const { logger } = require('../Utils');

async function deleteBuilds(req, res) {
    result = await deleteBuildsAndChildrenByFields(req.query);
    if (result) {
        res.json({ result });
    } else {
        res.json({ error: true });
    }
}

async function deleteBuildsAndChildrenByFields(query) {
    if (Object.keys(query).length > 0) {
        if (query.buildNum) query.buildNum = parseInt(query.buildNum, 10);
        if (query._id) query._id = new ObjectID(query._id);
        const result = await new TestResultsDB().getData(query).toArray();

        for (let i = 0; i < result.length; i++) {
            logger.debug(
                'deleteBuildsAndChildrenByFields: ',
                result[i].buildUrl
            );
            await deleteBuild(result[i]);
        }
        return result;
    }
    return null;
}

async function deleteBuild(build) {
    const testResultsDB = new TestResultsDB();
    const children = await testResultsDB
        .getData({ parentId: build._id })
        .toArray();
    for (let i = 0; i < children.length; i++) {
        await deleteBuild(children[i]);
    }

    const outputDB = new OutputDB();
    if (build.tests) {
        for (let j = 0; j < build.tests.length; j++) {
            await outputDB.deleteOne({ _id: build.tests[j].testOutputId });
        }
    }
    if (build.buildOutputId) {
        await outputDB.deleteOne({ _id: build.buildOutputId });
    }
    await testResultsDB.deleteOne({ _id: build._id });
}

module.exports = {
    default: deleteBuilds,
    deleteBuildsAndChildrenByFields,
};
