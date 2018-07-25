const { TestResultsDB, ObjectID } = require( '../Database' );
// ToDo: this is a temporary api. It should be removed once pipeline of
// pipelines is set up in Perf/JCK, similar to FvTest
module.exports = async ( req, res ) => {
    let { limit, type } = req.query;
    if ( limit === undefined ) {
        limit = 5;
    } else {
        limit = parseInt( limit, 10 );
    }
    const db = new TestResultsDB();
    const result = await db.aggregate( [
        {
            $match: {
                type: type
            }
        },
        {
            $group: {
                _id: { buildName: '$buildName' },
            }
        },
        { $limit: limit }
    ] );
    res.send( result );
}