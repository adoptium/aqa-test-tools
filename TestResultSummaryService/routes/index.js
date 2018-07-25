const app = require( 'express' ).Router();
const wrap = fn => ( req, res ) => fn( req, res ).catch( console.error.bind( console ) );

app.get( '/compareTests', wrap( require( "./compareTests" ) ) );
app.get( '/deleteBuildListById', wrap( require( "./deleteBuildListById" ) ) );
app.get( '/deleteBuildsAndChildrenByFields', wrap( require( "./deleteBuildsAndChildrenByFields" ) ) );
app.get( '/deleteCollection', wrap( require( "./deleteCollection" ) ) );
app.get( '/getAllTestsWithHistory', wrap( require( "./getAllTestsWithHistory" ) ) );
app.get( '/getBuildHistory', wrap( require( "./getBuildHistory" ) ) );
app.get( '/getBuildList', wrap( require( "./getBuildList" ) ) );
app.get( '/getChildBuilds', wrap( require( "./getChildBuilds" ) ) );
app.get( '/getData', wrap( require( "./getData" ) ) );
app.get( '/getHistoryPerTest', wrap( require( "./getHistoryPerTest" ) ) );
app.get( '/getLastBuildInfo', wrap( require( "./getLastBuildInfo" ) ) );
app.get( '/getOutputById', wrap( require( "./getOutputById" ) ) );
app.get( '/getOutputByTestInfo', wrap( require( "./getOutputByTestInfo" ) ) );
app.get( '/getTestInfoByBuildInfo', wrap( require( "./getTestInfoByBuildInfo" ) ) );
app.get( '/getParents', wrap( require( "./getParents" ) ) );
app.get( '/getPerffarmRunCSV', wrap( require( "./getPerffarmRunCSV" ) ) );
app.get( '/getTestById', wrap( require( "./getTestById" ) ) );
app.get( '/getTestBySearch', wrap( require( "./getTestBySearch" ) ) );
app.get( '/getTestPerPlatform', wrap( require( "./getTestPerPlatform" ) ) );
app.get( '/getTopLevelBuildNames', wrap( require( "./getTopLevelBuildNames" ) ) );
app.get( '/getTopLevelFlatBuildNames', wrap( require( "./getTopLevelFlatBuildNames" ) ) );
app.get( '/populateDB', wrap( require( "./populateDB" ) ) );


app.post( '/getParentSpecificData', wrap( require( "./getParentSpecificData" ) ) );
app.post( '/getSpecificData', wrap( require( "./getSpecificData" ) ) );
app.post( '/upsertBuildList', wrap( require( "./upsertBuildList" ) ) );

module.exports = app;