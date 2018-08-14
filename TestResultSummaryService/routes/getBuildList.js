const { BuildListDB, ObjectID } = require( '../Database' );
module.exports = async ( req, res ) => {
    if ( req.query._id ) req.query._id = new ObjectID( req.query._id );
    const db = new BuildListDB();
    const result = await db.getData( req.query ).sort( { buildUrl: 1 } ).toArray();
    res.send( result );
}