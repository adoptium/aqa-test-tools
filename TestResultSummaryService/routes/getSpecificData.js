const { TestResultsDB, ObjectID } = require( '../Database' );
module.exports = async ( req, res ) => {
    const query = req.body.query;
    const specification = req.body.specification;
    const db = new TestResultsDB();
    const result = await db.getSpecificData( query, specification );
    res.send( result );
} 