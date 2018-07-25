const { TestResultsDB, ObjectID } = require( '../Database' );
module.exports = async ( req, res ) => {
    const { buildId, limit } = req.query;
    const db = new TestResultsDB();
    let query = await db.getSpecificData( { "_id": buildId }, { "_id": 0, "buildName": 1, "buildNum": 1, "type": 1 } );
    query[0].buildNum = { $lte: query[0].buildNum };
    const data = await db.aggregate( [
        {
            $match: query[0],
        },
        { $sort: { 'buildNum': -1 } },
        { $limit: parseInt( limit, 10 ) },
        {
            $project: {
                _id: 1,
                parentId: 1,
                buildName: 1,
                buildNum: 1,
                tests: 1
            }
        },
        // { $unwind: "$tests" }
    ] );

    let result = [];
    for ( let element of data ) {
        const parentObj = await db.getSpecificData( { "_id": element.parentId }, { "buildNum": 1, "timestamp": 1 } );
        element.parentNum = parentObj[0].buildNum;
        element.parentTimestamp = parentObj[0].timestamp;
        result.push(element);
    }
    res.send( result );
}