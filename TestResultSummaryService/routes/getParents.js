const { TestResultsDB, ObjectID } = require( '../Database' );

module.exports = async ( req, res ) => {
    const db = new TestResultsDB();
    const result = [];

    let _id = new ObjectID( req.query.id );
    while ( _id ) {
        const build = await db.findOne( { _id }, { parentId: 1, buildName: 1, buildNum: 1, hasChildren: 1, type: 1 } );
        if ( !build )
            break;
        result.push( build );
        _id = build.parentId;
    }
    res.send( result.reverse() );
}