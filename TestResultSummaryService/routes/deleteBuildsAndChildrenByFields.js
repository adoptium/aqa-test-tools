const { TestResultsDB, OutputDB } = require( '../Database' );
module.exports = async ( req, res ) => {
    if ( Object.keys( req.query ).length > 0 ) {
        if ( req.query.buildNum ) req.query.buildNum = parseInt( req.query.buildNum, 10 );
        if ( req.query._id ) req.query._id = new ObjectID( req.query._id );

        const result = await new TestResultsDB().getData( req.query ).toArray();
        for ( let i = 0; i < result.length; i++ ) {
            await deleteBuild( result[i] );
        }
        res.json( { result } );
    } else {
        res.json( { error: true } );
    }
}

async function deleteBuild( build ) {
    const testResultsDB = new TestResultsDB();
    const children = await testResultsDB.getData( { parentId: build._id } ).toArray();
    for ( let i = 0; i < children.length; i++ ) {
        await deleteBuild( children[i] );
    }

    const outputDB = new OutputDB();
    if ( build.tests ) {
        for ( let j = 0; j < build.tests.length; j++ ) {
            await outputDB.deleteOne( { _id: build.tests[j].testOutputId } );
        }
    }
    if ( build.buildOutputId ) {
        await outputDB.deleteOne( { _id: build.buildOutputId } );
    }
    await testResultsDB.deleteOne( { _id: build._id } );
}