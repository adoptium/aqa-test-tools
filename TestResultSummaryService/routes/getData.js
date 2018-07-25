const { TestResultsDB, ObjectID } = require( '../Database' );
module.exports = async ( req, res ) => {
    if ( req.query.buildNum ) req.query.buildNum = parseInt( req.query.buildNum, 10 );
    if ( req.query._id ) req.query._id = new ObjectID( req.query._id );
    if ( req.query.parentId ) req.query.parentId = new ObjectID( req.query.parentId );
    const db = new TestResultsDB();
    const result = await db.getData( req.query ).toArray();
    res.send( result );
}