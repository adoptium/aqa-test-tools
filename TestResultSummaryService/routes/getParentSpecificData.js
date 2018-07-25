const { TestResultsDB, ObjectID } = require( '../Database' );
module.exports = async ( req, res ) => {
    const query = req.body.query;
    const specification = req.body.specification;
    const db = new TestResultsDB();
    const parentId = await db.getSpecificData( query, { parentId: 1 } )
    const result = await db.getSpecificData( { _id: parentId[0].parentId }, specification );
    res.send( result );

}