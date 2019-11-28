const JenkinsInfo = require( '../JenkinsInfo' );
const {removeTimestamp} = require( './utils/removeTimestamp' );
const {applyDeepSmithMatch} = require( './utils/applyDeepSmithMatch' );

module.exports = async ( req, res ) => {
    try {
        await compareTestOutput(req, res);
    } catch (error) {
         res.send( { error } );
    }   
} 

async function compareTestOutput ( req, res ) {
    let { url1, buildName1, buildNum1, ...params } = req.query;
    const jenkinsInfo = new JenkinsInfo();

    if (!url1 || !buildName1 || !buildNum1) {
        throw "Input parameters are not completed!";
    }

    const url2 = params.url2 ? params.url2 : url1;
    const buildName2 = params.buildName2 ? params.buildName2 : buildName1;
    const buildNum2 = params.buildNum2 ? params.buildNum2 : buildNum1;

    let consoleOutput1 = "";
    let consoleOutput2 = "";

    // this try-catch is to prevent getBuildOutput from throwing error with empty message
    try {
        consoleOutput1 = await jenkinsInfo.getBuildOutput(url1, buildName1, buildNum1);
        consoleOutput2 = await jenkinsInfo.getBuildOutput(url2, buildName2, buildNum2);
    } catch (error) {
        throw "Failed to obtain Jenkins Outputs!";
    }

    if (!consoleOutput1 || !consoleOutput2) {
        throw "Jenkins Output is empty!";
    }

    if (params.removeTimestampFlag === "true") {
        consoleOutput1 = removeTimestamp(consoleOutput1);
        consoleOutput2 = removeTimestamp(consoleOutput2);
    }

    if (params.applyDeepSmithMatchFlag === "true") {
        consoleOutput1 = applyDeepSmithMatch(consoleOutput1);
        consoleOutput2 = applyDeepSmithMatch(consoleOutput2);
    }

    const result = (consoleOutput1 === consoleOutput2); 
    res.send( { result } );  
}
