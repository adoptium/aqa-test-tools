const { TestResultsDB, ObjectID } = require( '../Database' );
module.exports = async ( req, res ) => {
    let { buildId, limit } = req.query;
    if (!limit) limit = 5;
    const db = new TestResultsDB();
    let query = await db.getSpecificData( { "_id": buildId }, { "_id": 0, "buildName": 1, "type": 1, "timestamp": 1 } );
    query[0].timestamp = { $lte: query[0].timestamp };
    const data = await db.aggregate( [
        {
            $match: query[0],
        },
        { $sort: { 'timestamp': -1 } },
        { $limit: parseInt( limit, 10 ) },
        {
            $project: {
                _id: 1,
                parentId: 1,
                buildName: 1,
                buildNum: 1,
                tests: 1,
                machine: 1
            }
        },
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