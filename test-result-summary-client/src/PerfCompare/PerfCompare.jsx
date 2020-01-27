import React, { Component } from 'react';
import { Form, Input, Button, Radio, Row, Table, Divider, Progress, Alert } from 'antd';
import math from 'mathjs';
import { stringify } from 'qs';
import PerffarmRunJSON from './lib/PerffarmRunJSON';
import ExtractRelevantJenkinsTestResults from './lib/ExtractRelevantJenkinsTestResults';
import { getParams } from '../utils/query';
import './PerfCompare.css';
import { getParserProps, getMetricProps } from '../utils/perf';

const buildTypeExampleURL = {
    Jenkins: "https://customJenkinsServer/view/PerfTests/job/Daily-Liberty-Startup/1/",
    Perffarm: "http://perffarmServer/build_info.php?build_id=212880"
}

export default class PerfCompare extends Component {
    state = {
        inputURL: {
            baselineID: "",
            testID: "",
        },
        selectedRuns: {
            baselineServerURL: "",
            testServerURL: "",
            baselineID: "",
            testID: "",
        },
        benchmarkRuns: {
            benchmarkRunBaseline: [],
            benchmarkRunTest: [],
        },
        allVariantData: [],
        submitStatus: 'none',
        progress: 0,
        progressStatus: '',
        buildType: 'Jenkins',
        displayAlert: {
            status: false,
            message: ""
        }
    };

    async componentDidMount() {
    	let inputURL = {}
        const urlData = getParams(window.location.search);
        for (let url in urlData) {
        	inputURL[url] = urlData[url];
        }
        await this.setState({inputURL: inputURL});
        this.handleParseInputURL();
    }

    handleChange(event) {
        this.setState(
            {
                inputURL: {
                    ...this.state.inputURL,
                    [event.target.name]: event.target.value,
                }
            }
        )
    }

    handleBuildTypeChange(event) {
        this.setState(
            {
                buildType: event.target.value
            }
        )
    }

    handleGetPerffarmRuns = async () => {

        this.setState(
            {
                submitStatus: 'submit',
                progress: 20,
                progressStatus: 'active'
            }
        )
                
        let resBenchmarkRuns = await fetch(`/api/getPerffarmRunCSV?${stringify(this.state.selectedRuns)}`, {
            method: 'get'
        } );

        const resBenchmarkRunsJson = await resBenchmarkRuns.json();

        if(resBenchmarkRunsJson.error){
           this.setState(
                {
                    submitStatus: 'none',
                    displayAlert: {
                        status: true,
                        message: resBenchmarkRunsJson.error
                    }
                }
            )
            return
       	}

        // Check if the benchmark and test data is valid
        let displayErrorMessage = "";
        if (resBenchmarkRunsJson === undefined || (Object.keys(resBenchmarkRunsJson).length === 0 && resBenchmarkRunsJson.constructor === Object) ||
                resBenchmarkRunsJson.baselineCSV === undefined || resBenchmarkRunsJson.testCSV === undefined) {
            displayErrorMessage = "Baseline and Test build not found. "
        }
        if (resBenchmarkRunsJson.baselineCSV.length <= 2) {
            displayErrorMessage = "Baseline build not found. ";
        }
        if (resBenchmarkRunsJson.testCSV.length <= 2) {
            displayErrorMessage += "Test build not found"
        }

        // Data received is not valid
        if (displayErrorMessage !== "") {
            this.setState(
                {
                    inputURL: {
                        baselineID: "",
                        testID: "",
                    },
                    selectedRuns: {
                        baselineID: "",
                        testID: "",
                    },
                    submitStatus: 'none',
                    progress: 0,
                    progressStatus: '',
                    displayAlert: {
                        status: true,
                        message: displayErrorMessage
                    }
                }
            )
            return
        }

        let baselineRunJSON = new PerffarmRunJSON(resBenchmarkRunsJson.baselineCSV);
        let testRunJSON = new PerffarmRunJSON(resBenchmarkRunsJson.testCSV);

        baselineRunJSON.init(() => {
            this.setState(
                {
                    progress: 40,
                    progressStatus: 'active'
                }
            )

            testRunJSON.init(() => {
                this.setState(
                    {
                        benchmarkRuns: {
                            benchmarkRunBaseline: baselineRunJSON,
                            benchmarkRunTest: testRunJSON,
                        },
                        progress: 60
                    }
                )

                this.handleGenerateTable();
            })
        })
    }

    async getChildrenRawMetricsData ( buildJson ) {
        const jenkinsRawData = [];
        if ( buildJson.testInfo[0].hasChildren === true ) {
            let parentIdBuild = buildJson.testInfo[0]._id;
            let childListBuild = await fetch( `/api/getChildBuilds?parentId=${parentIdBuild}`, {
                method: 'get'
            } );
            let childListBuildJson = await childListBuild.json();
            for ( let i = 0; i < childListBuildJson.length; i++ ) {
                //get all the raw metrics data from children builds
                if ( childListBuildJson[i].tests && childListBuildJson[i].tests.length > 0 ) {
                    jenkinsRawData.push (childListBuildJson[i].tests[0].testData.metrics);
                }
            }
            return jenkinsRawData;
        }
    }

    handleGetJenkinsRuns = async () => {

        this.setState(
            {
                submitStatus: 'submit',
                progress: 20,
                progressStatus: 'active'
            }
        )

        const baselineBuildTestInfo = await fetch( `/api/getTestInfoByBuildInfo?url=${this.state.selectedRuns.baselineID[0]}&buildName=${this.state.selectedRuns.baselineID[1]}&buildNum=${this.state.selectedRuns.baselineID[2]}`, {
            method: 'get'
        } );

        const testBuildTestInfo = await fetch( `/api/getTestInfoByBuildInfo?url=${this.state.selectedRuns.testID[0]}&buildName=${this.state.selectedRuns.testID[1]}&buildNum=${this.state.selectedRuns.testID[2]}`, {
            method: 'get'
        } );

        let baselineTestResultsJson = await baselineBuildTestInfo.json();
        let testTestResultsJson = await testBuildTestInfo.json();

        // Check if the given builds are valid
        let displayErrorMessage = "";
        let hasData;
        if (baselineTestResultsJson === undefined || (Object.keys(baselineTestResultsJson).length === 0 && baselineTestResultsJson.constructor === Object) || 
        baselineTestResultsJson.testInfo === undefined) {
            displayErrorMessage = "Baseline build not found. ";
        }
        if (testTestResultsJson === undefined || (Object.keys(testTestResultsJson).length === 0 && testTestResultsJson.constructor === Object) ||
        testTestResultsJson.testInfo === undefined) {
            displayErrorMessage += "Test build not found";
        }
        // Check if the aggregate info is valid
        if (displayErrorMessage === "") {
            try {
                hasData = baselineTestResultsJson.testInfo[0].aggregateInfo.length > 0;
            } catch (e) {
                displayErrorMessage += "Baseline build has no data. ";
            }
    
            try {
                hasData = testTestResultsJson.testInfo[0].aggregateInfo.length > 0;
            } catch (e) {
                displayErrorMessage += "Test build has no data. ";
            }
        }

        // Data received is not valid
        if (hasData === true && displayErrorMessage !== "") {
            this.setState(
                {
                    inputURL: {
                        baselineID: "",
                        testID: "",
                    },
                    selectedRuns: {
                        baselineID: "",
                        testID: "",
                    },
                    submitStatus: 'none',
                    progress: 0,
                    progressStatus: '',
                    displayAlert: {
                        status: true,
                        message: displayErrorMessage
                    }
                }
            )
            return
        }

        let baselineRunJSON = new ExtractRelevantJenkinsTestResults(baselineTestResultsJson);
        let testRunJSON = new ExtractRelevantJenkinsTestResults(testTestResultsJson);
        let childrenBuildRawDataBaseline = await this.getChildrenRawMetricsData(baselineTestResultsJson);
        let childrenBuildRawDataTest = await this.getChildrenRawMetricsData(testTestResultsJson);

        baselineRunJSON.init(() => {
            this.setState(
                {
                    progress: 40,
                    progressStatus: 'active'
                }
            )

            testRunJSON.init(() => {
                this.setState(
                    {
                        benchmarkRuns: {
                            benchmarkRunBaseline: baselineRunJSON,
                            benchmarkRunTest: testRunJSON,
                            childrenBuildRawDataBaseline,
                            childrenBuildRawDataTest,
                        },
                        progress: 60
                    }
                )

                this.handleGenerateTable();
            })
        })
    }

    handleParseInputURL = async () => {

        this.setState(
            {
                displayAlert: {
                    status: false,
                    message: ""
                }
            }
        )

        let displayErrorMessage = "";

        // Received a Jenkins build URL
        if (this.state.buildType === "Jenkins") {

            let baselineBuildURL, testBuildURL;
            let baselineURLScheme, baselineHostWithPort, baselineBuildName, baselineBuildNum;
            let testURLScheme, testHostWithPort, testBuildName, testBuildNum;
            let baselineBuildURLSplit, testBuildURLSplit;
            if (this.state.inputURL.baselineID && this.state.inputURL.testID) {
                baselineBuildURLSplit = this.state.inputURL.baselineID.split("/");
                testBuildURLSplit = this.state.inputURL.testID.split("/");
            }
            
            // Find the index for the top level "job" path in the Jenkins URLs given.
            // This is to support comparing the following equivalent Jenkins job URLs:
            // https://customJenkinsServer/view/PerfTests/job/Daily-Liberty-DayTrader3/155/
            // https://customJenkinsServer/job/Daily-Liberty-DayTrader3/155/

            let jenkinsTopLevelJobIndexBaseline, jenkinsTopLevelJobIndexTest;
            if (baselineBuildURLSplit && testBuildURLSplit){
                jenkinsTopLevelJobIndexBaseline= baselineBuildURLSplit.indexOf("job");
                jenkinsTopLevelJobIndexTest= testBuildURLSplit.indexOf("job");
            }

            try {
                baselineURLScheme = baselineBuildURLSplit[0];
                baselineHostWithPort = baselineBuildURLSplit[2];
                baselineBuildName = baselineBuildURLSplit[jenkinsTopLevelJobIndexBaseline + 1];
                baselineBuildNum = baselineBuildURLSplit[jenkinsTopLevelJobIndexBaseline + 2];

                // Build the original URL composed of host and port only
                baselineBuildURL = baselineURLScheme + "//" + baselineHostWithPort;

                // Check if the benchmark and test data is valid
                if (baselineBuildNum === undefined || (baselineBuildURL === undefined )) {
                    displayErrorMessage += "Invalid Baseline URL. "
                }
            } catch (baselineBuildURLSplitError) {
                displayErrorMessage += "Invalid Baseline URL. "
            }

            try {
                testURLScheme = testBuildURLSplit[0];
                testHostWithPort = testBuildURLSplit[2];
                testBuildName = testBuildURLSplit[jenkinsTopLevelJobIndexTest + 1];
                testBuildNum = testBuildURLSplit[jenkinsTopLevelJobIndexTest + 2];

                testBuildURL = testURLScheme + "//" + testHostWithPort;

                if (testBuildNum === undefined || (testBuildURL === undefined )) {
                    displayErrorMessage += "Invalid Test URL. "
                }
            } catch (testBuildURLSplit) {
                displayErrorMessage += "Invalid Test URL. "
            }

            // Data received is not valid
            if (displayErrorMessage !== "") {
                this.setState(
                    {
                        displayAlert: {
                            status: true,
                            message: displayErrorMessage
                        }
                    }
                )
                return
            }

            await this.setState(
                {
                    selectedRuns: {
                        baselineID: [baselineBuildURL, baselineBuildName, baselineBuildNum],
                        testID: [testBuildURL, testBuildName, testBuildNum],
                    }
                }
            )

            this.handleGetJenkinsRuns();
        
        // Received a Perffarm Run URL
        } else {

            const [baselineSchemeWithHostWithPort, baselineBuildNum] = this.state.inputURL.baselineID.split("build_id=");
            const [testSchemeWithHostWithPort, testBuildNum] = this.state.inputURL.testID.split("build_id=");

            // Check if the benchmark and test data is valid
            if (baselineSchemeWithHostWithPort === undefined || baselineBuildNum === undefined) {
                displayErrorMessage += "Invalid Baseline URL. "
            }
            if (testSchemeWithHostWithPort === undefined || testBuildNum === undefined) {
                displayErrorMessage += "Invalid Test URL. "
            }

            // Data received is not valid
            if (displayErrorMessage !== "") {
                this.setState(
                    {
                        displayAlert: {
                            status: true,
                            message: displayErrorMessage
                        }
                    }
                )
                return
            }

            await this.setState(
                {
                    selectedRuns: {
                        baselineServerURL: baselineSchemeWithHostWithPort,
                        testServerURL: testSchemeWithHostWithPort,
                        baselineID: baselineBuildNum,
                        testID: testBuildNum,
                    }
                }
            )

            this.handleGetPerffarmRuns();
        }
    }

    handleGenerateTable = async () => {
        this.setState(
            {
                progress: 80,
                progressStatus: 'active'
            }
        )
        let curAllVariantData = [];
        let curVariantData, curMetricTable, curMatchingTestVariantIndex, curMatchingTestMetricIndex;
        let curMetricName, curBaselineScore, curTestScore, curRawValues, curDiff, curBaselineCI, curTestCI, curColor, curMetricUnits, curHigherBetter;

        // Only compare variants that are in the baseline run
        for (let i = 0; i < this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants.length; i++) {
            // Must match the benchmark and variant names
            let parsedVariantsBaseline = this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i];
            curMatchingTestVariantIndex = this.state.benchmarkRuns.benchmarkRunTest.parsedVariants.map(x =>
                x.benchmark + "!@#$%DELIMIT%$#@!" + x.variant).indexOf(parsedVariantsBaseline.benchmark +
                "!@#$%DELIMIT%$#@!" + parsedVariantsBaseline.variant);
            let parsedVariantsTest = this.state.benchmarkRuns.benchmarkRunTest.parsedVariants[curMatchingTestVariantIndex];
            // Benchmark variant was not found in Test run, skip it
            if (curMatchingTestVariantIndex === -1) {
                continue;
            }

            curVariantData = {};
            curVariantData["benchmark"] = parsedVariantsBaseline.benchmark;
            curVariantData["variant"] = parsedVariantsBaseline.variant;
            curVariantData["baselineJdkDate"] = parsedVariantsBaseline.jdkDate;
            curVariantData["testJdkDate"] = parsedVariantsTest.jdkDate;
            curVariantData["summary"] = "";
            curVariantData["baselineMachine"] = parsedVariantsBaseline.machine;
            curVariantData["testMachine"] = parsedVariantsTest.machine;

            curMetricTable = [];

            for (let j = 0; j < parsedVariantsBaseline.metrics.length; j++) {
                
                // Must match the baseline metric name
                curMatchingTestMetricIndex = parsedVariantsTest.metrics.map(x =>
                    x.name).indexOf(parsedVariantsBaseline.metrics[j].name);

                // Metric was not found in Test run, skip it
                if (curMatchingTestMetricIndex === -1) {
                    continue;
                }

                // get the raw values for master nodes.
                curMetricName = parsedVariantsBaseline.metrics[j].name;
                let childBuildBaselineData = {};
                let childBuildTestData = {};
                // getting the raw value for j metric of the x child
                if ( this.state.benchmarkRuns.childrenBuildRawDataBaseline && this.state.benchmarkRuns.childrenBuildRawDataBaseline.length > 0){
                    for ( let x = 0; x < this.state.benchmarkRuns.childrenBuildRawDataBaseline.length; x++ ) {
                        childBuildBaselineData["child " + (x + 1) ] = this.state.benchmarkRuns.childrenBuildRawDataBaseline[x][j].value;
                    }
                }
                if (this.state.benchmarkRuns.childrenBuildRawDataTest && this.state.benchmarkRuns.childrenBuildRawDataTest.length > 0){
                    for ( let y = 0; y < this.state.benchmarkRuns.childrenBuildRawDataTest.length; y++ ) {
                        childBuildTestData["child " + (y + 1) ] = this.state.benchmarkRuns.childrenBuildRawDataTest[y][j].value;
                    }
                }
   
                if ( this.state.buildType === "Jenkins") {
                    // raw values displaying: master jobs diplay all their children raw values, and child jobs diplay their own raw values.
                    curRawValues = {
                        "baseline": {
                            "Overview": parsedVariantsBaseline.metrics[j].value,
                            "Raw Data": (parsedVariantsBaseline.testsData === undefined) ? childBuildBaselineData : this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i].testsData[j].value
                         },
                        "test": {
                            "Overview": parsedVariantsTest.metrics[curMatchingTestMetricIndex].value,
                            "Raw Data": (parsedVariantsTest.testsData === undefined) ? childBuildTestData : parsedVariantsTest.testsData[j].value
                         }
                    };
                } else {
                    // perffarm builds
                    let runBaseline = this.state.benchmarkRuns.benchmarkRunBaseline;
                    let runTest = this.state.benchmarkRuns.benchmarkRunTest
                    curRawValues = {
                        "baseline": runBaseline.parsedVariants[i].metrics[j].value,
                        "test": runTest.parsedVariants[curMatchingTestVariantIndex].metrics[curMatchingTestMetricIndex].value
                    };
                }

                curBaselineScore = parsedVariantsBaseline.metrics[j].value.mean;
                curBaselineCI = parsedVariantsBaseline.metrics[j].value.CI;
                curTestScore = parsedVariantsTest.metrics[j].value.mean;
                curTestCI = parsedVariantsTest.metrics[j].value.CI;

                // Get the metric's units
                // get BenchmarkRouter & Metric files from server
                let parserProps = await getParserProps();
                // get metric Properties (regex & higherbetter & units) using current benchmark information
                let metricProps = getMetricProps(parserProps, curVariantData["benchmark"], curVariantData["variant"], curMetricName);
                try {
                    curMetricUnits = metricProps["units"];
                } catch (metricNotFoundError) {
                    curMetricUnits = "";    
                    // TODO: TOGGLE CONTINUE TO DISPLAY METRICS WHICH WE DON'T TRACK
                    continue;
                }
 
                // Check if a higher value for this metric means a better score 
                try {
                    if (metricProps["higherbetter"]) {
                        curHigherBetter = true;
                    } else {
                        curHigherBetter = false;
                    }
                } catch (higherBetterNotFoundError) {

                    curHigherBetter = undefined;
                }

                // Reverse division if metric is not higher = better. This makes all differences above 100% an improvement.
                // If a metric's higherbetter value is not found, defaults to higher = better.
                try {
                    if (curHigherBetter || curHigherBetter === undefined) {
                        curDiff = curTestScore / curBaselineScore;
                    } else {
                        curDiff = curBaselineScore / curTestScore;
                    }

                    // Row colours based on improvement or regression
                    if (curHigherBetter === undefined) {
                        curColor = 'caution';
                    } else if (curDiff > 1) {
                        curColor = 'improvement';
                    } else if (curDiff < 1) {
                        curColor = 'regression';
                    } else {
                        curColor = 'nochange';
                    }
                } catch (roundDiffError) {
                    curDiff = "error";
                    curColor = 'caution';
                }

                curMetricTable.push({
                    key: i+"x"+j,
                    metric: `${curMetricName} (${curMetricUnits})`,
                    baselineScore: curBaselineScore,
                    baselineCI: curBaselineCI,
                    testScore: curTestScore,
                    testCI: curTestCI,
                    rawValues: curRawValues,
                    diff: curDiff,
                    color: curColor,
                })
            }
            curVariantData["metricTable"] = curMetricTable;
            curAllVariantData.push(curVariantData);
        }

        this.setState(
            {
                allVariantData: curAllVariantData,
                submitStatus: 'done',
                progress: 100,
                progressStatus: 'success'
            }
        )
    }

    render() {
        if (this.state.submitStatus === "done") {
            const formatNumbers = (value) => {
                if (typeof value == 'number') {
                    return <div>{math.round(value,3)}</div>;
                }
                else {
                    return <div>error</div>;
                }
            }
            const formatNumbersWithPercentage = (value) => {
                if (typeof value == 'number') {
                    return <div>{math.round(value*100,3)}%</div>;
                }
                else {
                    return <div>error</div>;
                }
            }
            const perfCompareColumns = [{
                title: 'Metric (units)',
                dataIndex: 'metric',
                }, {
                title: 'Baseline Score',
                dataIndex: 'baselineScore',
                render: formatNumbers,
                }, {
                title: 'Baseline CI',
                dataIndex: 'baselineCI',
                render: formatNumbersWithPercentage,
                }, {
                title: 'Test Score',
                dataIndex: 'testScore',
                render: formatNumbers,
                }, {
                title: 'Test CI',
                dataIndex: 'testCI',
                render: formatNumbersWithPercentage,
                }, {
                title: 'Diff',
                dataIndex: 'diff',
                render: formatNumbersWithPercentage,
            }];

            let baselineRunID, testRunID;
            if ((Array.isArray(this.state.selectedRuns.baselineID) && Array.isArray(this.state.selectedRuns.testID)) &&
                    (this.state.selectedRuns.baselineID.length === 3 && this.state.selectedRuns.testID.length === 3)) {
                baselineRunID = this.state.selectedRuns.baselineID[1] + " " + this.state.selectedRuns.baselineID[2];
                testRunID = this.state.selectedRuns.testID[1] + " " + this.state.selectedRuns.testID[2];
            } else {
                baselineRunID = this.state.selectedRuns.baselineID;
                testRunID = this.state.selectedRuns.testID;
            }

            let generatedTables = this.state.allVariantData.map( (x,i) => 
                <div key={i}>
                    <h3>
                        Benchmark: {x.benchmark}
                        <Divider type="vertical" />
                        Variant: {x.variant}
                    </h3>

                    Baseline JDK Date: {x.baselineJdkDate} 
                    <Divider type="vertical" />
                    Baseline Machine: {x.baselineMachine}
                    <Divider type="vertical" />
                    Test JDK Date: {x.testJdkDate}
                    <Divider type="vertical" />
                    Test Machine: {x.testMachine}<br />
                    
                    <Table
                        bordered
                        columns={perfCompareColumns}
                        rowClassName={(record) => record.color.replace('#', '')}
                        expandedRowRender={(record) => (
                            <div>
                                <p>Raw Score Values</p>
                                <p>Baseline: {JSON.stringify(record.rawValues["baseline"])}</p>
                                <p>Test: {JSON.stringify(record.rawValues["test"])}</p>
                            </div>
                        )}
                        dataSource={x.metricTable}
                        pagination={false}
                    />

                    {x.summary}
                    <Divider />
                </div>
            )

            return (
                <div>
                    <Progress percent={this.state.progress} status={this.state.progressStatus} />
                    <Row type="flex" justify="space-around" align="middle">
                        <h1>Performance Comparison Generated</h1>
                    </Row>
                    <Row type="flex" justify="space-around" align="middle">
                        <h2>Baseline Run: {baselineRunID} &nbsp; &nbsp; VS &nbsp; &nbsp; Test Run: {testRunID}</h2>
                    </Row>
                    <Row type="flex" justify="space-around" align="middle">
                        <h2>
                            Improvement: &nbsp;
                            <svg width="20" height="20">
                                <rect width="20" height="20" style={{fill: '#ddffdd'}} />
                            </svg>
                            &nbsp; &nbsp;
                            Regression: &nbsp;
                            <svg width="20" height="20">
                                <rect width="20" height="20" style={{fill: '#ffdddd'}} />
                            </svg>
                        </h2>
                    </Row>

                    <Divider /> <br />
                    {generatedTables}
                </div>
            )

        } else if (this.state.submitStatus === "submit") {
            return (
                    <div>
                        <Progress percent={this.state.progress} status={this.state.progressStatus} />
                        <Row type="flex" justify="space-around" align="middle">
                            <h1>Generating Performance Comparison</h1>
                        </Row>
                    </div>
                )
        } else {

            let displayError = null;
            if (this.state.displayAlert.status) {
                displayError = <div><Alert message={this.state.displayAlert.message} type="error" /><Divider /></div>;
            }

            return <div>
                {displayError}
                <Radio.Group value={this.state.buildType} onChange={this.handleBuildTypeChange.bind(this)}>
                    <Radio.Button value="Jenkins">Jenkins Build</Radio.Button>
                    <Radio.Button value="Perffarm">Perffarm Run</Radio.Button>
                </Radio.Group>
                <br />
                <br />
                <Form.Item label="Baseline Run ID" >
                    <Input placeholder={this.state.buildType + " URL. Ex: " + buildTypeExampleURL[this.state.buildType]} name="baselineID" value={this.state.inputURL.baselineID} onChange={this.handleChange.bind(this)} />
                </Form.Item>

                <Form.Item label="Test Run ID" >
                    <Input placeholder={this.state.buildType + " URL. Ex: " + buildTypeExampleURL[this.state.buildType]} name="testID" value={this.state.inputURL.testID} onChange={this.handleChange.bind(this)} />
                </Form.Item>

                <Button type="primary" onClick={this.handleParseInputURL}>
                    Submit
                </Button>

            </div>
        }
        
    }
}