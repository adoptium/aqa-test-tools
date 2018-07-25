const JenkinsInfo = require( '../JenkinsInfo' );
const Promise = require( 'bluebird' );
module.exports = async ( req, res ) => {
    const { url, buildName } = req.query;
    const jenkinsInfo = new JenkinsInfo();
    const result = await jenkinsInfo.getLastBuildInfo( url, buildName );
    res.send( { result } );
}