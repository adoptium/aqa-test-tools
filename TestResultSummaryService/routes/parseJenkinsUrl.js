module.exports = async ( req, res ) => {
    const { jenkinsUrl, compareType } = req.query;
    const compareTypeStr = compareType ? compareType : "";
    let parseUrlRes = { errorMsg: "", serverUrl: "", buildName: "", buildNum: ""};
    if (!jenkinsUrl) {
        parseUrlRes.errorMsg = "Please provide " + compareTypeStr + " Build URL."
        res.send( { output: parseUrlRes } );
    } else {
        let parsedParams = jenkinsUrl.split("/");

        // Find the index for the top level "job" path in the Jenkins URLs given.
        // This is to support comparing the following equivalent Jenkins job URLs:
        // https://customJenkinsServer/view/PerfTests/job/Daily-Liberty-DayTrader3/155/
        // https://customJenkinsServer/job/Daily-Liberty-DayTrader3/155/
        try {
            parseUrlRes.serverUrl = parsedParams[0] + "//" + parsedParams[2];
            let regNum = /^\d+$/;
            parseUrlRes.buildNum = parsedParams.pop();
            // handle possible trailing "/" in url
            if(!regNum.test(parseUrlRes.buildNum)) {
                parseUrlRes.buildNum = parsedParams.pop();
                if(!regNum.test(parseUrlRes.buildNum)) {
                    throw new Error("Cannot find build number.");
                }
            }
            parseUrlRes.buildName = parsedParams.pop();
        } catch(error) {
            parseUrlRes.errorMsg = "Invalid " + compareTypeStr + " Build URL!\n" + error.message 
                            + "\nPlease check your URL: "+ jenkinsUrl;
        }
        res.send( { output: parseUrlRes } );
    }
}
