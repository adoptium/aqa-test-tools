export const parseJenkinsUrl = (jenkinsUrl, compareType="") => {
    let parsedRes = { errorMsg: "",serverUrl: "", buildName: "", buildNum: ""};
    if (!jenkinsUrl) {
        parsedRes.errorMsg = "Please provide " + compareType + " Build URL."
        return parsedRes;
    }
    let parsedParams = jenkinsUrl.split("/");

    // Find the index for the top level "job" path in the Jenkins URLs given.
    // This is to support comparing the following equivalent Jenkins job URLs:
    // https://customJenkinsServer/view/PerfTests/job/Daily-Liberty-DayTrader3/155/
    // https://customJenkinsServer/job/Daily-Liberty-DayTrader3/155/
    try {
        parsedRes.serverUrl = parsedParams[0] + "//" + parsedParams[2];
        let regNum = /^\d+$/;
        parsedRes.buildNum = parsedParams.pop();
        // handle possible trailing "/" in url
        if(!regNum.test(parsedRes.buildNum)) {
            parsedRes.buildNum = parsedParams.pop();
            if(!regNum.test(parsedRes.buildNum)) {
                throw new Error("Cannot find build number.");
            }
        }
        parsedRes.buildName = parsedParams.pop();
    } catch(error) {
        parsedRes.errorMsg = "Invalid " + compareType + " Build URL!\n" + error.message 
                            + "\nPlease check your URL: "+ jenkinsUrl;
    }
    return parsedRes;
};
