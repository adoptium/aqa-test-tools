const { TestResultsDB } = require('../Database');
/*
 * This API returns all testBuilds that have a testA and share a same
 * Build Root
 */
module.exports = async (req, res) => {
    const { testId } = req.query;
    const db = new TestResultsDB();
    const testBuild = await db.getTestById(testId);
    if (testBuild && testBuild.length > 0 && testBuild[0].rootBuildId) {
        const data = await db.aggregate([
            {
                $match: {
                    rootBuildId: testBuild[0].rootBuildId,
                    buildName: {
                        $regex: '^Test_.*',
                    },
                },
            },
            {
                $project: {
                    _id: 1,
                    buildName: 1,
                    buildNum: 1,
                    tests: 1,
                },
            },
            {
                $unwind: '$tests',
            },
            {
                $match: {
                    'tests.testName': testBuild[0].tests.testName,
                },
            },
        ]);
        res.send(data);
    } else {
        res.send([]);
    }
};
