import React, { Component } from 'react';
import { Form, Input, Button, Radio, Row, Table, Divider, Progress, Alert } from 'antd';
import math from 'mathjs';
import { stringify } from 'qs';
import PerffarmRunJSON from './lib/PerffarmRunJSON';
import JenkinsRunJSON from './lib/JenkinsRunJSON';
import benchmarkVariantsInfo from './lib/benchmarkVariantsInfo';
import './PerfCompare.css';

const perfCompareColumns = [{
        title: 'Metric (units)',
        dataIndex: 'metric',
        }, {
        title: 'Baseline Score',
        dataIndex: 'baselineScore',
        }, {
        title: 'Baseline CI',
        dataIndex: 'baselineCI',
        }, {
        title: 'Test Score',
        dataIndex: 'testScore',
        }, {
        title: 'Test CI',
        dataIndex: 'testCI',
        }, {
        title: 'Diff',
        dataIndex: 'diff',
    }];

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

    componentDidMount() {

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

    async getChildrenList ( resBenchmarkBuildJson ) {
        const childListBuildJsonMetrics = [];
        if ( resBenchmarkBuildJson.testInfo[0].hasChildren === true ) {
            let parentIdBuild = resBenchmarkBuildJson.testInfo[0]._id;
            let childListBuild = await fetch( `/api/getChildBuilds?parentId=${parentIdBuild}`, {
                method: 'get'
            } );
            let childListBuildJson = await childListBuild.json();
            for ( let i = 0; i < childListBuildJson.length; i++ ) {
                if ( childListBuildJson[i].tests && childListBuildJson[i].tests.length > 0 ) {
                    childListBuildJsonMetrics.push (childListBuildJson[i].tests[0].testData.metrics);
                }
            }
            this.setState({childList: childListBuildJsonMetrics});
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

        let resBenchmarkBaselineJson = await baselineBuildTestInfo.json();
        let resBenchmarkTestJson = await testBuildTestInfo.json();

        // Check if the benchmark and test data is valid
        let displayErrorMessage = "";
        if (resBenchmarkBaselineJson === undefined || (Object.keys(resBenchmarkBaselineJson).length === 0 && resBenchmarkBaselineJson.constructor === Object) || 
                resBenchmarkBaselineJson.testInfo === undefined) {
            displayErrorMessage = "Baseline build not found. ";
        }
        if (resBenchmarkTestJson === undefined || (Object.keys(resBenchmarkTestJson).length === 0 && resBenchmarkTestJson.constructor === Object) ||
                resBenchmarkTestJson.testInfo === undefined) {
            displayErrorMessage += "Test build not found"
        }
        // Check if the aggregate info is valid
        if (!resBenchmarkBaselineJson.testInfo || !resBenchmarkBaselineJson.testInfo[0].aggregateInfo || resBenchmarkBaselineJson.testInfo[0].aggregateInfo.length < 1 || resBenchmarkBaselineJson.testInfo[0].aggregateInfo[0].metrics.length === 0) {
            displayErrorMessage += "Baseline build has no data. "
        }
        if (!resBenchmarkTestJson.testInfo || !resBenchmarkTestJson.testInfo[0].aggregateInfo || resBenchmarkTestJson.testInfo[0].aggregateInfo.length < 1 || resBenchmarkTestJson.testInfo[0].aggregateInfo[0].metrics.length === 0) {
            displayErrorMessage += "Test build has no data. "
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

        let baselineRunJSON = new JenkinsRunJSON(resBenchmarkBaselineJson);
        let testRunJSON = new JenkinsRunJSON(resBenchmarkTestJson);
        await this.getChildrenList(resBenchmarkBaselineJson);
        let childListBaselineJsonMetrics = this.state.childList;
        await this.getChildrenList(resBenchmarkTestJson);
        let childListTestJsonMetrics = this.state.childList;

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
                            childBuildsListBaseline : childListBaselineJsonMetrics,
                            childBuildsListTest: childListTestJsonMetrics,
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

            const baselineBuildURLSplit = this.state.inputURL.baselineID.split("/");
            const testBuildURLSplit = this.state.inputURL.testID.split("/");
            
            // Find the index for the top level "job" path in the Jenkins URLs given.
            // This is to support comparing the following equivalent Jenkins job URLs:
            // https://customJenkinsServer/view/PerfTests/job/Daily-Liberty-DayTrader3/155/
            // https://customJenkinsServer/job/Daily-Liberty-DayTrader3/155/

            const jenkinsTopLevelJobIndexBaseline= baselineBuildURLSplit.indexOf("job");
            const jenkinsTopLevelJobIndexTest= testBuildURLSplit.indexOf("job");

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
            curMatchingTestVariantIndex = this.state.benchmarkRuns.benchmarkRunTest.parsedVariants.map(x =>
                x.benchmark + "!@#$%DELIMIT%$#@!" + x.variant).indexOf(this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i].benchmark +
                "!@#$%DELIMIT%$#@!" + this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i].variant);
            
            // Benchmark variant was not found in Test run, skip it
            if (curMatchingTestVariantIndex === -1) {
                continue;
            }

            curVariantData = {};
            curVariantData["benchmark"] = this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i].benchmark;
            curVariantData["variant"] = this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i].variant;
            curVariantData["baselineProduct"] = this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i].product;
            curVariantData["testProduct"] = this.state.benchmarkRuns.benchmarkRunTest.parsedVariants[curMatchingTestVariantIndex].product;
            curVariantData["summary"] = "";

            curMetricTable = [];
            for (let j = 0; j < this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i].metrics.length; j++) {
                
                // Must match the baseline metric name
                curMatchingTestMetricIndex = this.state.benchmarkRuns.benchmarkRunTest.parsedVariants[curMatchingTestVariantIndex].metrics.map(x =>
                    x.name).indexOf(this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i].metrics[j].name);

                // Metric was not found in Test run, skip it
                if (curMatchingTestMetricIndex === -1) {
                    continue;
                }

                // get the raw values for master nodes.
                curMetricName = this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i].metrics[j].name;
                let childBuildBaselineData = {};
                let childBuildTestData = {};
                if ( this.state.benchmarkRuns.childBuildsListBaseline && this.state.benchmarkRuns.childBuildsListBaseline.length > 0){
                    for ( let x = 0; x < this.state.benchmarkRuns.childBuildsListBaseline.length; x++ ) {
                        childBuildBaselineData["ite " + (x + 1) ] = this.state.benchmarkRuns.childBuildsListBaseline[x][j].value;
                    }
                }
                if (this.state.benchmarkRuns.childBuildsListTest && this.state.benchmarkRuns.childBuildsListTest.length > 0){
                    for ( let y = 0; y < this.state.benchmarkRuns.childBuildsListTest.length; y++ ) {
                        childBuildTestData["ite " + (y + 1) ] = this.state.benchmarkRuns.childBuildsListTest[y][j].value;
                    }
                }

                // raw values displaying: master jobs diplay all their children raw values, and child jobs diplay their own raw values.
                curRawValues = {
                    "baseline": {
                        "overview": this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i].metrics[j].value,
                        "iteData": (this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i].testsData === undefined) ? childBuildBaselineData : this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i].testsData[j].value
                     },
                    "test": {
                        "overview": this.state.benchmarkRuns.benchmarkRunTest.parsedVariants[curMatchingTestVariantIndex].metrics[curMatchingTestMetricIndex].value,
                        "iteData": (this.state.benchmarkRuns.benchmarkRunTest.parsedVariants[i].testsData === undefined) ? childBuildTestData : this.state.benchmarkRuns.benchmarkRunTest.parsedVariants[i].testsData[j].value
                     }
                };

                try {
                    curBaselineScore = math.round((this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i].metrics[j].value.mean), 3);
                } catch (roundBaselineScoreError) {
                    curBaselineScore = "error";
                }

                try {
                    curTestScore = math.round((this.state.benchmarkRuns.benchmarkRunTest.parsedVariants[curMatchingTestVariantIndex].metrics[curMatchingTestMetricIndex].value.mean), 3);
                } catch (roundTestScoreError) {
                    curTestScore = "error";
                }

                try {
                    curBaselineCI = math.round((this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i].metrics[j].value.CI), 3);
                    curBaselineCI += "%";
                } catch(e) {
                    curBaselineCI = "Not found";
                }

                try {
                    curTestCI = math.round((this.state.benchmarkRuns.benchmarkRunTest.parsedVariants[curMatchingTestVariantIndex].metrics[curMatchingTestMetricIndex].value.CI), 3);
                    curTestCI += "%";
                } catch(e) {
                    curTestCI = "Not found";
                }

                // Get the metric's units
                try {
                    curMetricUnits = benchmarkVariantsInfo[curVariantData["benchmark"]][curVariantData["variant"]][curMetricName]["units"];
                } catch (metricNotFoundError) {
                    curMetricUnits = "";
                    // TODO: TOGGLE CONTINUE TO DISPLAY METRICS WHICH WE DON'T TRACK
                    continue;
                }

                // Check if a higher value for this metric means a better score
                try {
                    if (benchmarkVariantsInfo[curVariantData["benchmark"]][curVariantData["variant"]][curMetricName]["higherbetter"] === "t") {
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
                        curDiff = math.round((((curTestScore / curBaselineScore)) * 100), 3);
                    } else {
                        curDiff = math.round((((curBaselineScore / curTestScore)) * 100), 3);
                    }

                    // Row colours based on improvement or regression
                    if (curHigherBetter === undefined) {
                        curColor = 'caution';
                    } else if (curDiff > 100) {
                        curColor = 'improvement';
                    } else if (curDiff < 100) {
                        curColor = 'regression';
                    } else {
                        curColor = 'nochange';
                    }

                    curDiff += "%";
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

                    Baseline Product: {x.baselineProduct}
                    <Divider type="vertical" />
                    Test Product: {x.testProduct}<br />
                    
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