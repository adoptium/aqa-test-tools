const Parser = require('./Parser');
const Utils = require(`./Utils`);
const decompress = require("decompress");
const path = require('path');
const { TestResultsDB, OutputDB } = require('../Database');
const { Console } = require('console');

let filePath = null
let outputDb = null
let testResultDb = null

class Tap extends Parser {
    static canParse(filePath) {
        var path = require('path')
        if (filePath) {
            if (path.extname(filePath) == '.zip') {
                return true;
            } 
        } else {
            return false;
        }
    }

    static async parse(zipPath) {
        const files = await decompress(zipPath,  "dist");
        const zipName = path.basename(zipPath).replace(".zip", "")
        filePath = path.join(__dirname, '../dist/' + zipName)
        outputDb = new OutputDB();
        
        console.log("WHAT")
        this.readTapFile("Test_openjdk17_j9_special.system_x86-64_linux_Release.tap");
        // const tapFiles = this.getTapFileNames(files);
        // const buildInfo = Utils.getInfoFromBuildName(tapFiles[0]);

        // const rootBuild = await this.createRootBuild(buildInfo);
        
        // testResultDb = new TestResultsDB();
        // const rootStatus = await testResultDb.populateDB(rootBuild)
        // const rootId = rootStatus.insertedId
        
        // var testListFiles = tapFiles.filter(a => a.includes("testList"));
        // if (testListFiles) {
        //     testListFiles = await this.createTestListBuilds(testListFiles, buildInfo, rootId);
        // }
    }

    static async createRootBuild(buildInfo) {
        const buildData = {
            url: "www.test.com", //WILL DO
            buildName: "Pipeline_Test_JDK".concat(buildInfo.jdkVersion), //WILL DO
            buildNameStr: "Pipeline_Test_JDK".concat(buildInfo.jdkVersion), //WILL DO
            type: "Build",
            status: "Done",
            timestamp: "uh", // INSERT TIME STAQMP
            buildDuration: "", // TODO
            buildResult: "", // FROM THE CHILDREN
            hasChildren: true,
            parserType: "ParentBuild",
            startBy: "" // TODO
        };
        return buildData
    }

    static async createTestListBuilds(testListFiles, buildInfo, rootBuildId) {
        const groupedTestList = this.groupTestList(testListFiles)
        const testList = [];
        for (const [key, value] of groupedTestList.entries()){
            const buildData = {
                url: "www.test.com", //WILL DO  
                buildName: key,
                buildNameStr: key,
                rootBuildId,
                parentBuildId: rootBuildId,
                type: "Build",
                status: "Done",
                buildDuration: "", //TODO
                buildResult: "", // BASED ON TEST
                hasChildren: true,
                parserType: "ParentBuild",
                startBy: "", // TODO
                timestamp: "uh", //BASED ON INSERTION
            };
            const parentStatus = await testResultDb.populateDB(buildData)
            const parentId = parentStatus.insertedId
            Array.prototype.push.apply(testList, await this.createTapFile(value, buildInfo, rootBuildId, parentId));
        }
        return testList;
    }

    static async createTapFile(tapFiles, buildInfo, rootBuildId, parentId) {
        console.log("WTF")
        const testList = [];
        for (var i = 0; i < tapFiles.length; i++) {
            const [testBuildInfo, buildDuration, testSummary] = await this.readTapFile(tapFiles[i]); 
            const testStatus = await testResultDb.insertMany(testBuildInfo);  
            const tests = testStatus.ops;
            const buildData = {
                url: "www.test.com", // INSERTED URL
                buildName: tapFiles[i].replace(".tap", ""),
                buildNameStr: tapFiles[i].replace(".tap", ""),
                rootBuildId,
                parentBuildId: parentId,
                type: "Test",
                status: "Done",
                buildDuration, //TODO
                buildResult: "", //BASED ON TEST RESULT
                hasChildren: false,
                javaVersion: "", //TODO
                machine: null,
                parserType: "Test",
                sdkResource: "release",
                startBy: "", //TODO
                testSummary,
                tests,
                timestamp: "uh", //INSERTED 
            };
            testList.push(buildData);
        }
        console.log(testList);
        return testList
    }

    static getStrippedTestListName(testListFile) {
        const regex = /testList_[0-9]_/i;
        return (testListFile.replace(regex, '')).replace(".tap", "")
    }

    static groupTestList(testListFile) {
        const testListMap = new Map();
        for (var i = 0; i < testListFile.length; i++) {
            const parentName = this.getStrippedTestListName(testListFile[i])
            var existingParent = testListMap.get(parentName);
            if (!existingParent) {
                testListMap.set(parentName, [testListFile[i]]);
            }
            else {
                existingParent.push(testListFile[i]);
            }
        }
        return testListMap
    }

    static async readTapFile(file) {
        var fs = require('fs');
        var fileArray = fs.readFileSync(filePath.concat('/'+file), "utf8").split("\n");
        var testSummaryMap = new Map([["total", 0], ["executed", 0], ["passed", 0], ["failed", 0], ["disabled", 0], ["skipped", 0]])
        var counter = 0;
        var testListBuilds = [];
        var buildDuration = 0;
        var buildData;

        while (counter < fileArray.length) {
            if (fileArray[counter].includes("ok")) {
                const tapInfo = this.getTapInfo(fileArray[counter])
                if (tapInfo != null) {
                    this.updateTestSummary(testSummaryMap, tapInfo);
                    if (tapInfo.status == "unstable") {
                        buildData = await this.getUnstableBuildInfo(fileArray, counter, tapInfo)
                    } 
                    else {
                        buildData = await this.getStableBuildInfo(fileArray, counter, tapInfo)
                    }
                    counter = buildData[0]
                    buildDuration += parseInt(buildData[1].duration)
                    testListBuilds.push(buildData[1])
                }
            }
            counter++;
        }
        return [testListBuilds, buildDuration, testSummaryMap];
    }

    static async getUnstableBuildInfo(fileArray, counter, tapInfo) {
        const beginningOutputRegex = /[|]$/i
        var output = null
        while (!fileArray[counter].match(beginningOutputRegex) && !fileArray[counter].includes("duration_ms")) {
            counter++;
        }
        if (fileArray[counter].match(beginningOutputRegex)) {
            output = await this.getOutput(fileArray, counter);
            counter = output[0];
        }
        const duration_ms = this.getDurationMs(fileArray[counter]);
        const buildData = {
            testOutputId: output[1] ?? null,
            testName: tapInfo.testName,
            testResult: tapInfo.status.toUpperCase(),
            testData: null,
            duration: duration_ms
        };
        return [counter, buildData];
    }

    static async getStableBuildInfo(fileArray, counter, tapInfo) {
        while (!fileArray[counter].includes("duration_ms")) {
            counter++;
        }
        const duration_ms = this.getDurationMs(fileArray[counter]);
        const buildData = {
            testOutputId: null,
            testName: tapInfo.testName,
            testResult: tapInfo.status.toUpperCase(),
            testData: null,
            duration: duration_ms
        };
        return [counter, buildData];
    }

    static updateTestSummary(testSummaryMap, tapInfo) {
        testSummaryMap.set("total", testSummaryMap.get("total") + 1)
        if (tapInfo.status == "unstable") {
            testSummaryMap.set("failed", testSummaryMap.get("failed") + 1);
        }
        else if (tapInfo.status == "disabled") {
            testSummaryMap.set("disabled", testSummaryMap.get("disabled") + 1);
        }
        else if (tapInfo.status == "skipped") {
            testSummaryMap.set("skipped", testSummaryMap.get("skipped") + 1);
        }
        else if (tapInfo.status == "ok") {
            testSummaryMap.set("executed", testSummaryMap.get("executed") + 1);
            testSummaryMap.set("passed", testSummaryMap.get("passed") + 1);
        }
    }

    static getTapInfo(fileline) {
        const regex = /(\w+ ?\w+) [0-9]+ - (\w+) ?#? ?(\w+)? ?(\(\w+\))?/i;
        const tokens = fileline.match(regex);
        if (Array.isArray(tokens) && tokens.length > 4) {
            const [_, status, testName, skipped, disabled] = tokens;
            if (status == "not ok") {
                return {status:"unstable", testName}
            }
            else if (disabled != null) {
                return {status: "disabled", testName}
            }
            else if (skipped != null) {
                return {status: "skipped", testName}
            }
            else {
                return {status: "passed", testName}
            }
        }
        return null
    }

    static getDurationMs(fileline) {
        const regex = /\w+: ([0-9]+)/i;
        const tokens = fileline.match(regex);
        if (Array.isArray(tokens)) {
            const [_, duration_ms] = tokens;
            return duration_ms;
        }
        return null;
    }

    static async getOutput(fileArray, counter) {
        var output = "";
        counter++;
        while (!fileArray[counter].includes("duration_ms")) {
            output += fileArray[counter];
            counter++;
        }

        const outputStatus = await outputDb.populateDB({output})
        const outputId = outputStatus.insertedId
        return [counter, outputId];
    }

    static getTapFileNames(files) {
        const cleanFiles = [];
        for (var i = 0; i < files.length; i++) {
            const zipName = files[0].path
            if (files[i].path.startsWith(zipName)) {
                const strippedTapName = files[i].path.split('/')[1];
                if (strippedTapName != '') {
                    cleanFiles.push(strippedTapName);
                }
            }
        }
        return cleanFiles;
    }

}

module.exports = Tap;