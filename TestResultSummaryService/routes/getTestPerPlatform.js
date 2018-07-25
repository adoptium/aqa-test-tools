const { TestResultsDB } = require( '../Database' );
/*
 * This API returns all testBuilds that have a testA and share a same 
 * grandparent (topParentBuild)
 * 
 *                   topParentBuild
 *          /                                   \
 * buildTestParentBuild (linux x86_64)    buildTestParentBuild (AIX) ...
 *          /              \                /                \
 * build(compilation)   testBuild1       build(compilation)   testBuild2
 * 
 */
module.exports = async ( req, res ) => {
    const { testId } = req.query;
    const db = new TestResultsDB();
    const testBuild = await db.getTestById( testId );
    const data = [];
    if ( testBuild && testBuild.length > 0 && testBuild[0].parentId ) {
        const buildTestParent = await db.getData( { _id: testBuild[0].parentId } ).toArray();
        if ( buildTestParent.length > 0 && buildTestParent[0].parentId ) {
            const testParentBuildsWithSameParent = await db.getData( { parentId: buildTestParent[0].parentId } ).toArray();
            for ( let build of testParentBuildsWithSameParent ) {
                const result = await db.aggregate( [
                    {
                        $match: {
                            parentId: build._id
                        }
                    },
                    {
                        $project: {
                            _id: 1,
                            buildName: 1,
                            buildNum: 1,
                            tests: 1
                        }
                    },
                    { $unwind: "$tests" },
                    {
                        $match: {
                            "tests.testName": testBuild[0].tests.testName
                        }
                    }
                ] );
                if ( result && result.length > 0 ) {
                    data.push( result[0] );
                }
            }
        }
    }
    res.send( data );
}