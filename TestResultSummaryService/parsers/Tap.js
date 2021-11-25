const Parser = require('./Parser');
const Utils = require(`./Utils`);
const decompress = require("decompress");
const ObjectID = require( 'mongodb' ).ObjectID;
const path = require('path');
const { TestResultsDB, OutputDB } = require('../Database');

let filePath = null
let outputDb = null;
let testResultDb = null
let timestamp = Date.now()
class Tap extends Parser {
    static canParse(filePath) {
        let path = require('path')
        if (filePath) {
            if (path.extname(filePath) == '.zip') {
                return true;
            } 
            else {
                return false
            }
        } else {
            return false;
        }
    }

    static async parse(zipPath) {   
        const files = await decompress(zipPath,  "dist"); // unzipping
        const zipName = path.basename(zipPath).replace(".zip", "")
        filePath = path.join(__dirname, '../dist/' + zipName) 
        outputDb = new OutputDB();
        testResultDb = new TestResultsDB();
        const tapFiles = this.getTapFileNames(files);
        let buildDuration = [0];
        let buildResult = ["SUCCESS"];
        let testBuilds = []; 
        let finalBuilds = [];
        
        // create root build / return id
        const rootId = await this.getRootId(tapFiles[0]);

        // split tap files to two groups: ones with testlist in the name vs. not
        const [testListFiles, regularFiles] = this.partitionTapFiles(tapFiles);
        
        if (testListFiles) {
            const [artificialParentBuilds, testListBuildData, testlistBuildDuration, testlistbuildResult] = await this.createTestListBuilds(testListFiles, rootId);
            this.updateBuildDurationAndResult(buildDuration, testlistBuildDuration, buildResult, testlistbuildResult)
            finalBuilds.push(artificialParentBuilds);
            testBuilds.push(testListBuildData);
        }
        
        if (regularFiles) {
            const [regularBuildData, regularBuildDuration, regularBuildResult] = await this.getTestBuilds(regularFiles, rootId, rootId);
            this.updateBuildDurationAndResult(buildDuration, regularBuildDuration, buildResult, regularBuildResult)
            testBuilds.push(regularBuildData);
        }
        const insertedTestBuilds = await testResultDb.insertMany(testBuilds.flat())
        finalBuilds.push(insertedTestBuilds.ops)

        this.updateBuild(rootId, {buildDuration: buildDuration[0], buildResult: buildResult[0]})
        finalBuilds.push(await testResultDb.findOne( { _id: rootId }))
        return finalBuilds.flat()
    }

    static async getRootId(file) {
        const rootnameRegex = /^(Test_openjdk(\w+)_(\w+))/i;
        const buildData = {
            url: "www.test.com", //TODO
            buildName: file.match(rootnameRegex)[0], 
            buildNameStr: file.match(rootnameRegex)[0], 
            type: "Build",
            status: "Done",
            timestamp, 
            buildDuration: "", 
            buildResult: "", 
            hasChildren: true,
            parserType: "ParentBuild",
            startBy: "" // TODO
        };

        const rootStatus = await testResultDb.populateDB(buildData)
        return rootStatus.insertedId
    }

    static async createTestListBuilds(testListFiles, rootBuildId) {
        const groupedTestList = this.groupTestList(testListFiles)
        const testList = [];
        const artificialParentBuild = [];
        let topLevelBuildDuration = [0];
        let topLevelBuildResult = ["SUCCESS"];
        
        for (const [key, value] of groupedTestList.entries()){
            const buildData = {
                url: "www.test.com", //TODO
                buildName: key,
                buildNameStr: key,
                rootBuildId,
                parentBuildId: rootBuildId,
                type: "Build",
                status: "Done",
                buildDuration: "", 
                buildResult: "", 
                hasChildren: true,
                parserType: "ParentBuild",
                startBy: "", // TODO
                timestamp, 
            };
            
            const parentStatus = await testResultDb.populateDB(buildData)
            const parentId = parentStatus.insertedId
            const [testBuildInfo, buildDuration, buildResult] = await this.getTestBuilds(value, rootBuildId, parentId)

            // update info based on all tap file results
            this.updateBuildDurationAndResult(topLevelBuildDuration, buildDuration, topLevelBuildResult, buildResult)
            await this.updateBuild(parentId, {buildDuration: topLevelBuildDuration[0], buildResult: topLevelBuildResult[0]})

            testList.push(testBuildInfo);
            artificialParentBuild.push(await testResultDb.findOne( { _id: parentId }));
        }

        return [artificialParentBuild.flat(), testList.flat(), topLevelBuildDuration[0], topLevelBuildResult[0]];
    }

    static async getTestBuilds(tapFiles, rootBuildId, parentId) {
        const testList = [];
        let topLevelBuildDuration = [0];
        let topLevelBuildResult = ["SUCCESS"];

        for (let i = 0; i < tapFiles.length; i++) {
            const [testBuildInfo, buildDuration, testSummary, buildResult] = await this.getTapFileTests(tapFiles[i]); 
            this.updateBuildDurationAndResult(topLevelBuildDuration, buildDuration, topLevelBuildResult, buildResult)

            const testStatus = await testResultDb.insertMany(testBuildInfo);  
            const tests = testStatus.ops;
            const buildData = {
                url: "www.test.com", //TODO
                buildName: tapFiles[i].replace(".tap", ""),
                buildNameStr: tapFiles[i].replace(".tap", ""),
                rootBuildId,
                parentBuildId: parentId,
                type: "Test",
                status: "Done",
                buildDuration, 
                buildResult, 
                hasChildren: false,
                javaVersion: "", //TODO
                machine: null,
                parserType: "Test",
                sdkResource: "release",
                startBy: "", //TODO
                testSummary,
                tests,
                timestamp, 
            };
            testList.push(buildData);
        }
        return [testList, topLevelBuildDuration[0], topLevelBuildResult[0]]
    }


    static async getTapFileTests(file) {
        let fs = require('fs');
        let fileArray = fs.readFileSync(filePath.concat('/' + file), "utf8").split("\n");
        let testSummaryMap = new Map([["total", 0], ["executed", 0], ["passed", 0], ["failed", 0], ["disabled", 0], ["skipped", 0]])
        let counter = 0;
        let testBuilds = [];
        let buildDuration = 0;
        let buildData;
        let buildResult = "SUCCESS";
        
        while (counter < fileArray.length) {
            if (fileArray[counter].includes("ok")) {
                const tapInfo = this.getTapInfo(fileArray[counter])
                if (tapInfo != null) {
                    this.updateTestSummary(testSummaryMap, tapInfo);
                    if (tapInfo.status == "unstable") {
                        buildData = await this.getUnstableBuildInfo(fileArray, counter, tapInfo)
                        buildResult = "UNSTABLE"
                    } 
                    else {
                        buildData = await this.getStableBuildInfo(fileArray, counter, tapInfo)
                    }
                    counter = buildData[0]
                    buildDuration += parseInt(buildData[1].duration)
                    testBuilds.push(buildData[1])
                }
            }
            counter++;
        }
        return [testBuilds, buildDuration, testSummaryMap, buildResult];
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

    static async getUnstableBuildInfo(fileArray, counter, tapInfo) {
        const beginningOutputRegex = /[|]$/i
        let output = null
        let testOutputId = null

        while (!fileArray[counter].match(beginningOutputRegex) && !fileArray[counter].includes("duration_ms")) {
            counter++;
        }
        // if unstable build have output, get the output id
        if (fileArray[counter].match(beginningOutputRegex)) {
            output = await this.getOutput(fileArray, counter);
            counter = output[0];
            testOutputId = output[1]
        }

        const duration_ms = this.getDurationMs(fileArray[counter]);
        const buildData = {
            testOutputId,
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

    static async updateBuild(id, updatedInfo) {
        return await testResultDb.update( {_id:  new ObjectID( id )}, { $set: updatedInfo })
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
        let output = "";
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
    
    static partitionTapFiles(tapFiles) {
        return [tapFiles.filter(a => a.includes("testList")), tapFiles.filter(a => !a.includes("testList"))];
    }

    static groupTestList(testListFile) {
        const testListMap = new Map();
        for (var i = 0; i < testListFile.length; i++) {
            const parentName = this.getStrippedTestListName(testListFile[i])
            let existingParent = testListMap.get(parentName);
            if (!existingParent) {
                testListMap.set(parentName, [testListFile[i]]);
            }
            else {
                existingParent.push(testListFile[i]);
            }
        }
        return testListMap
    }

    static getStrippedTestListName(testListFile) {
        const regex = /testList_[0-9]_/i;
        return (testListFile.replace(regex, '')).replace(".tap", "")
    }

    static updateBuildDurationAndResult(topLevelBuildDuration, buildDuration, topLevelBuildResult, buildResult) {
        topLevelBuildDuration[0] += buildDuration;
        if (buildResult != "SUCCESS") {
            topLevelBuildResult[0] = buildResult;
        }
    }

}

module.exports = Tap;