const Parser = require('./Parser');
const Utils = require(`./Utils`);

const ObjectID = require('mongodb').ObjectID;
const path = require('path');
const { TestResultsDB, OutputDB } = require('../Database');

const timestamp = Date.now();
class Tap extends Parser {
    static outputDb = null;
    static testResultDb = null;
    static fileData = null;
    static i = 50;

    static canParse(filePath) {
        if (filePath) {
            if (path.extname(filePath) == '.zip') {
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    static async parse(files) {
        // Create DBs
        this.outputDb = new OutputDB();
        this.testResultDb = new TestResultsDB();

        // Get file names and data
        const [tapFiles, tapFileData, rootName] = this.getTapFiles(files);
        this.fileData = tapFileData;

        // Add build duration and result variables
        let buildDuration = [0];
        let buildResult = ['SUCCESS'];

        // initiate test and final build arrays
        let testBuilds = [];
        let finalBuilds = [];

        // create root build / return id
        const rootId = await this.getRootId(rootName);

        // split tap files to two groups: ones with testlist in the name vs. not
        const [testListFiles, regularFiles] = this.partitionTapFiles(tapFiles);

        if (testListFiles) {
            const [
                artificialParentBuilds,
                testListBuildData,
                testlistBuildDuration,
                testlistbuildResult,
            ] = await this.createTestListBuilds(testListFiles, rootId);
            this.updateBuildDurationAndResult(
                buildDuration,
                testlistBuildDuration,
                buildResult,
                testlistbuildResult
            );
            finalBuilds.push(artificialParentBuilds);
            testBuilds.push(testListBuildData);
        }

        if (regularFiles) {
            const [regularBuildData, regularBuildDuration, regularBuildResult] =
                await this.getTestBuilds(regularFiles, rootId, rootId);
            this.updateBuildDurationAndResult(
                buildDuration,
                regularBuildDuration,
                buildResult,
                regularBuildResult
            );
            testBuilds.push(regularBuildData);
        }

        const insertedTestBuilds = await this.testResultDb.insertMany(
            testBuilds.flat()
        );
        finalBuilds.push(insertedTestBuilds.ops);

        this.updateBuild(rootId, {
            buildDuration: buildDuration[0],
            buildResult: buildResult[0],
        });
        finalBuilds.push(await this.testResultDb.findOne({ _id: rootId }));

        return finalBuilds.flat();
    }

    static async getRootId(rootName) {
        const buildData = {
            url: 'www.test.com', //TODO
            buildName: rootName,
            buildNameStr: rootName,
            buildNum: timestamp,
            type: 'Test',
            status: 'Done',
            timestamp,
            buildDuration: '',
            buildResult: '',
            hasChildren: true,
            parserType: 'ParentBuild',
            startBy: '', // TODO
        };

        const rootStatus = await this.testResultDb.populateDB(buildData);
        return rootStatus.insertedId;
    }

    static async createTestListBuilds(testListFiles, rootBuildId) {
        const groupedTestList = this.groupTestList(testListFiles);
        const testList = [];
        const artificialParentBuild = [];
        let topLevelBuildDuration = [0];
        let topLevelBuildResult = ['SUCCESS'];

        for (const [parent, children] of groupedTestList.entries()) {
            const buildData = {
                url: 'www.test.com', //TODO
                buildName: parent,
                buildNameStr: parent,
                rootBuildId,
                parentId: rootBuildId,
                type: 'Build',
                status: 'Done',
                buildDuration: '',
                buildResult: '',
                hasChildren: true,
                parserType: 'ParentBuild',
                startBy: '', // TODO
                timestamp,
            };

            const parentStatus = await this.testResultDb.populateDB(buildData);
            const parentId = parentStatus.insertedId;

            const [testBuildInfo, buildDuration, buildResult] =
                await this.getTestBuilds(children, rootBuildId, parentId);

            // update info based on all tap file results
            this.updateBuildDurationAndResult(
                topLevelBuildDuration,
                buildDuration,
                topLevelBuildResult,
                buildResult
            );
            await this.updateBuild(parentId, {
                buildDuration: topLevelBuildDuration[0],
                buildResult: topLevelBuildResult[0],
            });

            testList.push(testBuildInfo);
            artificialParentBuild.push(
                await this.testResultDb.findOne({ _id: parentId })
            );
        }

        return [
            artificialParentBuild.flat(),
            testList.flat(),
            topLevelBuildDuration[0],
            topLevelBuildResult[0],
        ];
    }

    static async getTestBuilds(tapFiles, rootBuildId, parentId) {
        const testList = [];
        let topLevelBuildDuration = [0];
        let topLevelBuildResult = ['SUCCESS'];

        for (let tapFile of tapFiles) {
            const [testBuildInfo, buildDuration, testSummary, buildResult] =
                await this.getTapFileTests(tapFile);
            this.updateBuildDurationAndResult(
                topLevelBuildDuration,
                buildDuration,
                topLevelBuildResult,
                buildResult
            );

            const buildData = {
                url: 'www.test.com', //TODO
                buildName: tapFile.replace('.tap', ''),
                buildNameStr: tapFile.replace('.tap', ''),
                rootBuildId,
                parentId,
                type: 'Test',
                status: 'Done',
                buildDuration,
                buildResult,
                hasChildren: false,
                javaVersion: '', //TODO
                machine: null,
                parserType: 'Test',
                sdkResource: 'release',
                startBy: '', //TODO
                testSummary,
                tests: testBuildInfo,
                timestamp,
            };
            testList.push(buildData);
        }
        return [testList, topLevelBuildDuration[0], topLevelBuildResult[0]];
    }

    static async getTapFileTests(file) {
        const fileArray = this.fileData.get(file);

        let testSummaryMap = new Map([
            ['total', 0],
            ['executed', 0],
            ['passed', 0],
            ['failed', 0],
            ['disabled', 0],
            ['skipped', 0],
        ]);
        let counter = 0;
        let testBuilds = [];
        let buildDuration = 0;
        let buildData;
        let buildResult = 'SUCCESS';

        while (counter < fileArray.length) {
            if (fileArray[counter].includes('ok')) {
                const tapInfo = this.getTapInfo(fileArray[counter]);
                if (tapInfo != null) {
                    this.updateTestSummary(testSummaryMap, tapInfo);
                    if (tapInfo.status == 'unstable') {
                        buildData = await this.getUnstableBuildInfo(
                            fileArray,
                            counter,
                            tapInfo
                        );
                        buildResult = 'UNSTABLE';
                    } else {
                        buildData = await this.getStableBuildInfo(
                            fileArray,
                            counter,
                            tapInfo
                        );
                    }
                    counter = buildData[0];
                    buildDuration += parseInt(buildData[1].duration);
                    testBuilds.push(buildData[1]);
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
            if (status == 'not ok') {
                return { status: 'unstable', testName };
            } else if (disabled != null) {
                return { status: 'disabled', testName };
            } else if (skipped != null) {
                return { status: 'skipped', testName };
            } else {
                return { status: 'passed', testName };
            }
        }
        return null;
    }

    static async getUnstableBuildInfo(fileArray, counter, tapInfo) {
        const beginningOutputRegex = /[|]$/i;
        let output = null;
        let testOutputId = null;

        while (
            !fileArray[counter].match(beginningOutputRegex) &&
            !fileArray[counter].includes('duration_ms')
        ) {
            counter++;
        }
        // if unstable build have output, get the output id
        if (fileArray[counter].match(beginningOutputRegex)) {
            output = await this.getOutput(fileArray, counter);
            counter = output[0];
            testOutputId = output[1];
        }

        const duration_ms = this.getDurationMs(fileArray[counter]);
        const buildData = {
            _id: new ObjectID(),
            testOutputId,
            testName: tapInfo.testName,
            testResult: tapInfo.status.toUpperCase(),
            testData: null,
            duration: duration_ms,
        };
        return [counter, buildData];
    }

    static async getStableBuildInfo(fileArray, counter, tapInfo) {
        while (!fileArray[counter].includes('duration_ms')) {
            counter++;
        }
        const duration_ms = this.getDurationMs(fileArray[counter]);
        const buildData = {
            _id: new ObjectID(),
            testOutputId: null,
            testName: tapInfo.testName,
            testResult: tapInfo.status.toUpperCase(),
            testData: null,
            duration: duration_ms,
        };
        return [counter, buildData];
    }

    static async updateBuild(id, updatedInfo) {
        return await this.testResultDb.update(
            { _id: new ObjectID(id) },
            { $set: updatedInfo }
        );
    }

    static updateTestSummary(testSummaryMap, tapInfo) {
        testSummaryMap.set('total', testSummaryMap.get('total') + 1);
        if (tapInfo.status == 'unstable') {
            testSummaryMap.set('failed', testSummaryMap.get('failed') + 1);
        } else if (tapInfo.status == 'disabled') {
            testSummaryMap.set('disabled', testSummaryMap.get('disabled') + 1);
        } else if (tapInfo.status == 'skipped') {
            testSummaryMap.set('skipped', testSummaryMap.get('skipped') + 1);
        } else if (tapInfo.status == 'passed') {
            testSummaryMap.set('executed', testSummaryMap.get('executed') + 1);
            testSummaryMap.set('passed', testSummaryMap.get('passed') + 1);
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
        let output = '';
        counter++;
        while (!fileArray[counter].includes('duration_ms')) {
            output += fileArray[counter];
            counter++;
        }

        const outputStatus = await this.outputDb.populateDB({ output });
        const outputId = outputStatus.insertedId;
        return [counter, outputId];
    }

    static getTapFiles(files) {
        let fileNames = [];
        let fileData = new Map();
        let rootName;

        for (var file of files) {
            if (file.isDirectory) {
                rootName = file.entryName.replace('/', '');
            } else if (file.name !== '' && !file.name.startsWith('.')) {
                fileNames.push(file.name);
                fileData.set(
                    file.name,
                    file.getData().toString('utf8').split('\n')
                );
            }
        }

        return [fileNames, fileData, rootName];
    }

    static partitionTapFiles(tapFiles) {
        return [
            tapFiles.filter((a) => a.includes('testList')),
            tapFiles.filter((a) => !a.includes('testList')),
        ];
    }

    static groupTestList(testListFiles) {
        const testListMap = new Map();
        for (var i = 0; i < testListFiles.length; i++) {
            const parentName = this.getTestListParentName(testListFiles[i]);
            let existingParent = testListMap.get(parentName);
            if (!existingParent) {
                testListMap.set(parentName, [testListFiles[i]]);
            } else {
                existingParent.push(testListFiles[i]);
            }
        }
        return testListMap;
    }

    static getTestListParentName(testListFile) {
        const regex = /_testList_[0-9]/i;
        return testListFile.replace(regex, '').replace('.tap', '');
    }

    static updateBuildDurationAndResult(
        topLevelBuildDuration,
        buildDuration,
        topLevelBuildResult,
        buildResult
    ) {
        topLevelBuildDuration[0] += buildDuration;
        if (buildResult != 'SUCCESS') {
            topLevelBuildResult[0] = buildResult;
        }
    }
}

module.exports = Tap;
