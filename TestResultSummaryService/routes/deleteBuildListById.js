const { BuildListDB, ObjectID } = require( '../Database' );
module.exports = async ( req, res ) => {
    if ( Object.keys( req.query ).length > 0 ) {
        const { _id } = req.query;
        const result = await new BuildListDB().deleteOne( { _id: new ObjectID( _id ) } );
        res.json( { result } );
    }
    res.json( { error: true } );
}