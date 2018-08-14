const { TestResultsDB, ObjectID } = require( '../Database' );

module.exports = async ( req, res ) => {
    let { type } = req.query;
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
        { 
        	$sort : { _id : 1 } 
        }
    ] );
    res.send( result );
}