function applyDeepSmithMatch (inputText) {
    if (!inputText) {
        throw "No input for applying DeepSmith match!";
    }
    // remove beginning and bottom build info
    const startWords = "Running Java Driver:";
    const endWords = "deepSmith_0_";
    inputText = inputText.substring(inputText.indexOf(startWords), inputText.lastIndexOf(endWords));
    if (!inputText) {
        throw "Input content not suitable for applying DeepSmith match!";
    }
    let curOutput = "";
    // split tests and store in lists
    const testStartWords = "Current TEST_NAME ";
    let testsAll = inputText.split(testStartWords);

    // process each test and attach to curOutput
    for (let index = 0; index < testsAll.length; index++) {
        // split test into four fields (name, content, exception, output)
        const testKey = "Current TEST_"
        const testPartsTotal = 4;
        let testParts = testsAll[index].split(testKey);
        if(testParts.length !== testPartsTotal) {
            // For abnormal situation when parts not enough, attach all to compare later
            curOutput += testStartWords + testsAll[index];
        } else {
            // Part 0 test name
            curOutput += testStartWords + testParts[0];
            // Part 1 test content
            curOutput += testKey + testParts[1];
            let ignoreResultFlag = false;
            let ignoreResultWord = "";
            const ignoreResultWordsList = ["hashCode", "Random", "random", "nanoTime", "getRuntime"];
            for(let ignoreWord of ignoreResultWordsList) {
                if(testParts[1].indexOf(ignoreWord) > -1 ) {
                    ignoreResultFlag = true;
                    ignoreResultWord = ignoreWord;
                    break;
                }
            }
            // Part 2 exception: find Exception name only
            let exceptionName = testParts[2].match(/\w*Exception[:\s]/g);
            if ( exceptionName === null) {
                curOutput += testKey + "EXCEPTION is None \n";
            } else {
                let printExceptionName = exceptionName[0].substring(0, exceptionName[0].length - 1);
                curOutput += testKey + "EXCEPTION is: " + printExceptionName + "\n";
            }
            // Part 3 output
            if(ignoreResultFlag) {
                curOutput += testKey + "OUTPUT is " + ignoreResultWord + "_value \n\n";                                
            } else {
                // remove @XXXX format, e.g. object@3b995
                testParts[3] = testParts[3].replace(/@\w+/g, "@");
                curOutput += testKey + testParts[3];
            }
        }                        
    }
    
    return curOutput;
}

module.exports.applyDeepSmithMatch = applyDeepSmithMatch;
