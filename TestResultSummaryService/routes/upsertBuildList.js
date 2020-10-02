const { BuildListDB, ObjectID } = require( '../Database' );
module.exports = async ( req, res ) => {
    const { data } = req.body;
    if ( data ) {
        const db = new BuildListDB();
        const options = { upsert: true };
        await Promise.all( data.sort().map( async ( { key, _id, ...build } ) => {
            const criteria = { _id: new ObjectID( _id ) };
            const update = { $set: build };
            await db.update( criteria, update, options );
        } ) );
        res.send( { error: false } );
    } else {
        res.json( { error: true } );
    }
}