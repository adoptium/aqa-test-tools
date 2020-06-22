const { TestResultsDB, ObjectID } = require( '../Database' );
module.exports = async ( req, res ) => {
    const { testId, limit, beforeTimestamp } = req.query;
    const db = new TestResultsDB();
    const data = await db.getTestById( testId );
    let query = {};
    query.buildName = data[0].buildName;
    query.type = data[0].type;
    if (beforeTimestamp) { query.timestamp = { $lt: parseInt(beforeTimestamp) } }
    const history = await db.aggregate( [
        {
            $match: query
        },
        { $limit: parseInt( limit, 10 ) },
        { $unwind: "$tests" },
        {
            $match: {
                "tests.testName": data[0].tests.testName
            }
        },
        {
            $project: {
                parentId: 1,
                buildName: 1,
                buildNum: 1,
                machine: 1,
                buildUrl: 1,
                tests: 1,
                timestamp: 1,
                javaVersion: 1,
            }
        },
        { $sort: { 'buildNum': -1 } },
    ] );

    let result = [];
    for ( let element of history ) {
        const parentObj = await db.getSpecificData( { "_id": element.parentId }, { "buildNum": 1 } );
        element.parentNum = parentObj[0].buildNum;
        result.push(element);
    }

    res.send( result );
}