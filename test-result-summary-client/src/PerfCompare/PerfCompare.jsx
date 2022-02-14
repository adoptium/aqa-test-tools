import React, { Component } from 'react';
import { Form } from '@ant-design/compatible';
import '@ant-design/compatible/assets/index.css';
import {
    Input,
    Button,
    Radio,
    Row,
    Table,
    Divider,
    Progress,
    Alert,
} from 'antd';
import { round } from 'mathjs';
import { stringify } from 'qs';
import PerffarmRunJSON from './lib/PerffarmRunJSON';
import ExtractRelevantJenkinsTestResults from './lib/ExtractRelevantJenkinsTestResults';
import { getParams } from '../utils/query';
import './PerfCompare.css';
import { fetchData } from '../utils/Utils';

const buildTypeExampleURL = {
    Jenkins:
        'https://customJenkinsServer/view/PerfTests/job/Daily-Liberty-Startup/1/',
    Perffarm: 'http://perffarmServer/build_info.php?build_id=212880',
};

export default class PerfCompare extends Component {
    constructor(props) {
        super(props);
        this.metricsProps = {};
    }

    state = {
        inputURL: {
            baselineID: '',
            testID: '',
        },
        selectedRuns: {
            baselineServerURL: '',
            testServerURL: '',
            baselineID: '',
            testID: '',
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
            message: '',
        },
    };

    async componentDidMount() {
        let inputURL = {};
        const urlData = getParams(window.location.search);
        for (let url in urlData) {
            inputURL[url] = urlData[url];
        }
        await this.setState({ inputURL: inputURL });
        if (this.state.inputURL) {
            await this.handleParseInputURL();
        }
    }

    handleChange(event) {
        this.setState({
            inputURL: {
                ...this.state.inputURL,
                [event.target.name]: event.target.value,
            },
        });
    }

    handleBuildTypeChange(event) {
        this.setState({
            buildType: event.target.value,
        });
    }

    handleGetPerffarmRuns = async () => {
        this.setState({
            submitStatus: 'submit',
            progress: 20,
            progressStatus: 'active',
        });

        const resBenchmarkRunsJson = await fetchData(
            `/api/getPerffarmRunCSV?${stringify(this.state.selectedRuns)}`
        );

        if (resBenchmarkRunsJson.error) {
            this.setState({
                submitStatus: 'none',
                displayAlert: {
                    status: true,
                    message: resBenchmarkRunsJson.error,
                },
            });
            return;
        }

        // Check if the benchmark and test data is valid
        let displayErrorMessage = '';
        if (
            !resBenchmarkRunsJson ||
            !resBenchmarkRunsJson.baselineCSV ||
            !resBenchmarkRunsJson.testCSV
        ) {
            displayErrorMessage = 'Baseline and Test build not found. ';
        }
        if (resBenchmarkRunsJson.baselineCSV.length <= 2) {
            displayErrorMessage = 'Baseline build not found. ';
        }
        if (resBenchmarkRunsJson.testCSV.length <= 2) {
            displayErrorMessage += 'Test build not found';
        }
        // Data received is not valid
        if (displayErrorMessage) {
            this.setState({
                inputURL: {
                    baselineID: '',
                    testID: '',
                },
                selectedRuns: {
                    baselineID: '',
                    testID: '',
                },
                submitStatus: 'none',
                progress: 0,
                progressStatus: '',
                displayAlert: {
                    status: true,
                    message: displayErrorMessage,
                },
            });
            return;
        }

        let baselineRunJSON = new PerffarmRunJSON(
            resBenchmarkRunsJson.baselineCSV
        );
        let testRunJSON = new PerffarmRunJSON(resBenchmarkRunsJson.testCSV);

        baselineRunJSON.init(() => {
            this.setState({
                progress: 40,
                progressStatus: 'active',
            });

            testRunJSON.init(async () => {
                this.setState({
                    benchmarkRuns: {
                        benchmarkRunBaseline: baselineRunJSON,
                        benchmarkRunTest: testRunJSON,
                    },
                    progress: 60,
                });

                await this.handleGenerateTable();
            });
        });
    };

    handleGetJenkinsRuns = async () => {
        this.setState({
            submitStatus: 'submit',
            progress: 20,
            progressStatus: 'active',
        });

        const baselineTestResultsJson = await fetchData(
            `/api/getTestInfoByBuildInfo?url=${this.state.selectedRuns.baselineID[0]}&buildName=${this.state.selectedRuns.baselineID[1]}&buildNum=${this.state.selectedRuns.baselineID[2]}`
        );
        const testTestResultsJson = await fetchData(
            `/api/getTestInfoByBuildInfo?url=${this.state.selectedRuns.testID[0]}&buildName=${this.state.selectedRuns.testID[1]}&buildNum=${this.state.selectedRuns.testID[2]}`
        );

        // Check if the given builds are valid
        let displayErrorMessage = '';
        let hasData = false;
        if (!baselineTestResultsJson || !baselineTestResultsJson.testInfo) {
            displayErrorMessage = 'Baseline build not found. ';
        }
        if (!testTestResultsJson || !testTestResultsJson.testInfo) {
            displayErrorMessage += 'Test build not found';
        }
        // Check if the aggregate info is valid
        if (!displayErrorMessage) {
            try {
                hasData =
                    baselineTestResultsJson.testInfo[0].aggregateInfo.length >
                    0;
            } catch (e) {
                displayErrorMessage += 'Baseline build has no data. ';
            }

            try {
                hasData =
                    testTestResultsJson.testInfo[0].aggregateInfo.length > 0;
            } catch (e) {
                displayErrorMessage += 'Test build has no data. ';
            }
        }
        // Data received is not valid
        if (!hasData || displayErrorMessage) {
            this.setState({
                inputURL: {
                    baselineID: '',
                    testID: '',
                },
                selectedRuns: {
                    baselineID: '',
                    testID: '',
                },
                submitStatus: 'none',
                progress: 0,
                progressStatus: '',
                displayAlert: {
                    status: true,
                    message: displayErrorMessage,
                },
            });
            return;
        }

        let baselineRunJSON = new ExtractRelevantJenkinsTestResults(
            baselineTestResultsJson
        );
        let testRunJSON = new ExtractRelevantJenkinsTestResults(
            testTestResultsJson
        );

        baselineRunJSON.init(() => {
            this.setState({
                progress: 40,
                progressStatus: 'active',
            });

            testRunJSON.init(async () => {
                this.setState({
                    benchmarkRuns: {
                        benchmarkRunBaseline: baselineRunJSON,
                        benchmarkRunTest: testRunJSON,
                    },
                    progress: 60,
                });

                await this.handleGenerateTable();
            });
        });
    };

    handleParseInputURL = async () => {
        this.setState({
            displayAlert: {
                status: false,
                message: '',
            },
        });

        let displayErrorMessage = '';

        // Received a Jenkins build URL
        if (this.state.buildType === 'Jenkins') {
            let baselineBuildURL, baselineBuildName, baselineBuildNum;
            let testBuildURL, testBuildName, testBuildNum;

            if (this.state.inputURL.baselineID && this.state.inputURL.testID) {
                const queryForParseBaseLineUrl =
                    '/api/parseJenkinsUrl?jenkinsUrl=' +
                    this.state.inputURL.baselineID +
                    '&compareType=Baseline';
                const parseBaseLineRes = await fetchData(
                    queryForParseBaseLineUrl
                );
                const queryForTestUrl =
                    '/api/parseJenkinsUrl?jenkinsUrl=' +
                    this.state.inputURL.testID +
                    '&compareType=Test';
                const parseTestRes = await fetchData(queryForTestUrl);
                if (
                    parseBaseLineRes &&
                    parseBaseLineRes.output &&
                    parseTestRes &&
                    parseTestRes.output
                ) {
                    const baseLineRes = parseBaseLineRes.output;
                    const testRes = parseTestRes.output;
                    displayErrorMessage += baseLineRes.errorMsg
                        ? baseLineRes.errorMsg
                        : '';
                    displayErrorMessage += testRes.errorMsg
                        ? testRes.errorMsg
                        : '';
                    if (!displayErrorMessage) {
                        baselineBuildURL = baseLineRes.serverUrl;
                        baselineBuildName = baseLineRes.buildName;
                        baselineBuildNum = baseLineRes.buildNum;
                        testBuildURL = testRes.serverUrl;
                        testBuildName = testRes.buildName;
                        testBuildNum = testRes.buildNum;
                    }
                } else {
                    displayErrorMessage +=
                        'Failed to connect with API to parse Jenkins URL!';
                }
            }

            // Data received is not valid
            if (displayErrorMessage) {
                this.setState({
                    displayAlert: {
                        status: true,
                        message: displayErrorMessage,
                    },
                });
                return;
            }

            await this.setState({
                selectedRuns: {
                    baselineID: [
                        baselineBuildURL,
                        baselineBuildName,
                        baselineBuildNum,
                    ],
                    testID: [testBuildURL, testBuildName, testBuildNum],
                },
            });

            await this.handleGetJenkinsRuns();

            // Received a Perffarm Run URL
        } else {
            const [baselineSchemeWithHostWithPort, baselineBuildNum] =
                this.state.inputURL.baselineID.split('build_id=');
            const [testSchemeWithHostWithPort, testBuildNum] =
                this.state.inputURL.testID.split('build_id=');

            // Check if the benchmark and test data is valid
            if (!baselineSchemeWithHostWithPort || !baselineBuildNum) {
                displayErrorMessage += 'Invalid Baseline URL. ';
            }
            if (!testSchemeWithHostWithPort || !testBuildNum) {
                displayErrorMessage += 'Invalid Test URL. ';
            }

            // Data received is not valid
            if (displayErrorMessage) {
                this.setState({
                    displayAlert: {
                        status: true,
                        message: displayErrorMessage,
                    },
                });
                return;
            }

            await this.setState({
                selectedRuns: {
                    baselineServerURL: baselineSchemeWithHostWithPort,
                    testServerURL: testSchemeWithHostWithPort,
                    baselineID: baselineBuildNum,
                    testID: testBuildNum,
                },
            });

            await this.handleGetPerffarmRuns();
        }
    };

    handleGenerateTable = async () => {
        this.setState({
            progress: 80,
            progressStatus: 'active',
        });
        let curAllVariantData = [];

        // Only compare variants that are in the baseline run
        for (
            let i = 0;
            i <
            this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants.length;
            i++
        ) {
            // Must match the benchmark and variant names
            let parsedVariantsBaseline =
                this.state.benchmarkRuns.benchmarkRunBaseline.parsedVariants[i];
            let curMatchingTestVariantIndex =
                this.state.benchmarkRuns.benchmarkRunTest.parsedVariants
                    .map(
                        (x) =>
                            x.benchmarkName +
                            '!@#$%DELIMIT%$#@!' +
                            x.benchmarkVariant
                    )
                    .indexOf(
                        parsedVariantsBaseline.benchmarkName +
                            '!@#$%DELIMIT%$#@!' +
                            parsedVariantsBaseline.benchmarkVariant
                    );
            let parsedVariantsTest =
                this.state.benchmarkRuns.benchmarkRunTest.parsedVariants[
                    curMatchingTestVariantIndex
                ];
            // Benchmark variant was not found in Test run, skip it
            if (curMatchingTestVariantIndex === -1) {
                continue;
            }

            let curVariantData = {};
            curVariantData['benchmark'] = parsedVariantsBaseline.benchmarkName;
            curVariantData['variant'] = parsedVariantsBaseline.benchmarkVariant;
            curVariantData['baselineJdkDate'] = parsedVariantsBaseline.jdkDate;
            curVariantData['testJdkDate'] = parsedVariantsTest.jdkDate;
            curVariantData['summary'] = '';
            curVariantData['baselineMachine'] = parsedVariantsBaseline.machine;
            curVariantData['testMachine'] = parsedVariantsTest.machine;

            let curMetricTable = [];

            for (let j = 0; j < parsedVariantsBaseline.metrics.length; j++) {
                let curRawValues, curColor;
                // Must match the baseline metric name
                let curMatchingTestMetricIndex = parsedVariantsTest.metrics
                    .map((x) => x.name)
                    .indexOf(parsedVariantsBaseline.metrics[j].name);

                // Metric was not found in Test run, skip it
                if (curMatchingTestMetricIndex === -1) {
                    continue;
                }

                // get the raw values for master nodes.
                const curMetricName = parsedVariantsBaseline.metrics[j].name;
                // getting the raw value for j metric of the x child
                if (this.state.buildType === 'Jenkins') {
                    // raw values displaying: master jobs diplay all their children raw values, and child jobs diplay their own raw values.
                    curRawValues = {
                        baseline: {
                            Overview:
                                parsedVariantsBaseline.metrics[j].statValues,
                            'Raw Data':
                                parsedVariantsBaseline.metrics[j].rawValues,
                        },
                        test: {
                            Overview:
                                parsedVariantsTest.metrics[
                                    curMatchingTestMetricIndex
                                ].statValues,
                            'Raw Data':
                                parsedVariantsTest.metrics[
                                    curMatchingTestMetricIndex
                                ].rawValues,
                        },
                    };
                } else {
                    // perffarm builds
                    let runBaseline =
                        this.state.benchmarkRuns.benchmarkRunBaseline;
                    let runTest = this.state.benchmarkRuns.benchmarkRunTest;
                    curRawValues = {
                        baseline:
                            runBaseline.parsedVariants[i].metrics[j].value,
                        test: runTest.parsedVariants[
                            curMatchingTestVariantIndex
                        ].metrics[curMatchingTestMetricIndex].value,
                    };
                }

                const curBaselineScore =
                    parsedVariantsBaseline.metrics[j].statValues.mean;
                const curBaselineCI =
                    parsedVariantsBaseline.metrics[j].statValues.CI;
                const curTestScore =
                    parsedVariantsTest.metrics[j].statValues.mean;
                const curTestCI = parsedVariantsTest.metrics[j].statValues.CI;

                // To get the metric's higherbetter/units
                // first check if Metric does exist in metricsProps, if not get Metric info from server
                const benchmark = curVariantData['benchmark'];
                let metricProps;
                if (!this.metricsProps[benchmark]) {
                    const metricPropsJSON = await fetchData(
                        `/api/getBenchmarkMetricProps?benchmarkName=${benchmark}`
                    );
                    if (metricPropsJSON) {
                        this.metricsProps[benchmark] = metricPropsJSON;
                        metricProps = metricPropsJSON[curMetricName];
                    }
                } else {
                    metricProps = this.metricsProps[benchmark][curMetricName];
                }
                // get metric Properties (regex & higherbetter & units) using current benchmark information
                const curMetricUnits =
                    metricProps && metricProps.units ? metricProps.units : '';
                // Check if a higher value for this metric means a better score
                const curHigherBetter =
                    !metricProps || metricProps.higherbetter !== false;

                // Reverse division if metric is not higher = better. This makes all differences above 100% an improvement.
                // If a metric's higherbetter value is not found, defaults to higher = better.
                const curDiff = curHigherBetter
                    ? curTestScore / curBaselineScore
                    : curBaselineScore / curTestScore;
                // Row colours based on improvement or regression
                if (curDiff > 1) {
                    curColor = 'improvement';
                } else if (curDiff < 1) {
                    curColor = 'regression';
                } else {
                    curColor = 'nochange';
                }

                curMetricTable.push({
                    key: i + 'x' + j,
                    metric: `${curMetricName} (${curMetricUnits})`,
                    baselineScore: curBaselineScore,
                    baselineCI: curBaselineCI,
                    testScore: curTestScore,
                    testCI: curTestCI,
                    rawValues: curRawValues,
                    diff: curDiff,
                    color: curColor,
                });
            }
            curVariantData['metricTable'] = curMetricTable;
            curAllVariantData.push(curVariantData);
        }

        this.setState({
            allVariantData: curAllVariantData,
            submitStatus: 'done',
            progress: 100,
            progressStatus: 'success',
        });
    };

    render() {
        if (this.state.submitStatus === 'done') {
            const formatNumbers = (value) => {
                if (typeof value == 'number') {
                    return <div>{round(value, 3)}</div>;
                } else {
                    return <div>error</div>;
                }
            };
            const formatNumbersWithPercentage = (value) => {
                if (typeof value == 'number') {
                    return <div>{round(value * 100, 3)}%</div>;
                } else {
                    return <div>error</div>;
                }
            };
            const perfCompareColumns = [
                {
                    title: 'Metric (units)',
                    dataIndex: 'metric',
                },
                {
                    title: 'Baseline Score',
                    dataIndex: 'baselineScore',
                    render: formatNumbers,
                },
                {
                    title: 'Baseline CI',
                    dataIndex: 'baselineCI',
                    render: formatNumbersWithPercentage,
                },
                {
                    title: 'Test Score',
                    dataIndex: 'testScore',
                    render: formatNumbers,
                },
                {
                    title: 'Test CI',
                    dataIndex: 'testCI',
                    render: formatNumbersWithPercentage,
                },
                {
                    title: 'Diff',
                    dataIndex: 'diff',
                    render: formatNumbersWithPercentage,
                },
            ];

            let baselineRunID, testRunID;
            if (
                Array.isArray(this.state.selectedRuns.baselineID) &&
                Array.isArray(this.state.selectedRuns.testID) &&
                this.state.selectedRuns.baselineID.length === 3 &&
                this.state.selectedRuns.testID.length === 3
            ) {
                baselineRunID =
                    this.state.selectedRuns.baselineID[1] +
                    ' ' +
                    this.state.selectedRuns.baselineID[2];
                testRunID =
                    this.state.selectedRuns.testID[1] +
                    ' ' +
                    this.state.selectedRuns.testID[2];
            } else {
                baselineRunID = this.state.selectedRuns.baselineID;
                testRunID = this.state.selectedRuns.testID;
            }

            let generatedTables = this.state.allVariantData.map((x, i) => (
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
                    Test Machine: {x.testMachine}
                    <br />
                    <Table
                        bordered
                        columns={perfCompareColumns}
                        rowClassName={(record) => record.color.replace('#', '')}
                        expandedRowRender={(record) => (
                            <div>
                                <p>Raw Score Values</p>
                                <p>
                                    Baseline:{' '}
                                    {JSON.stringify(
                                        record.rawValues['baseline']
                                    )}
                                </p>
                                <p>
                                    Test:{' '}
                                    {JSON.stringify(record.rawValues['test'])}
                                </p>
                            </div>
                        )}
                        dataSource={x.metricTable}
                        pagination={false}
                    />
                    {x.summary}
                    <Divider />
                </div>
            ));

            return (
                <div>
                    <Progress
                        percent={this.state.progress}
                        status={this.state.progressStatus}
                    />
                    <Row type="flex" justify="space-around" align="middle">
                        <h1>Performance Comparison Generated</h1>
                    </Row>
                    <Row type="flex" justify="space-around" align="middle">
                        <h2>
                            Baseline Run: {baselineRunID} &nbsp; &nbsp; VS
                            &nbsp; &nbsp; Test Run: {testRunID}
                        </h2>
                    </Row>
                    <Row type="flex" justify="space-around" align="middle">
                        <h2>
                            Improvement: &nbsp;
                            <svg width="20" height="20">
                                <rect
                                    width="20"
                                    height="20"
                                    style={{ fill: '#ddffdd' }}
                                />
                            </svg>
                            &nbsp; &nbsp; Regression: &nbsp;
                            <svg width="20" height="20">
                                <rect
                                    width="20"
                                    height="20"
                                    style={{ fill: '#ffdddd' }}
                                />
                            </svg>
                        </h2>
                    </Row>
                    <Divider /> <br />
                    {generatedTables}
                </div>
            );
        } else if (this.state.submitStatus === 'submit') {
            return (
                <div>
                    <Progress
                        percent={this.state.progress}
                        status={this.state.progressStatus}
                    />
                    <Row type="flex" justify="space-around" align="middle">
                        <h1>Generating Performance Comparison</h1>
                    </Row>
                </div>
            );
        } else {
            let displayError = null;
            if (this.state.displayAlert.status) {
                displayError = (
                    <div>
                        <Alert
                            message={this.state.displayAlert.message}
                            type="error"
                        />
                        <Divider />
                    </div>
                );
            }

            return (
                <div>
                    {displayError}
                    <Radio.Group
                        value={this.state.buildType}
                        onChange={this.handleBuildTypeChange.bind(this)}
                    >
                        <Radio.Button value="Jenkins">
                            Jenkins Build
                        </Radio.Button>
                        <Radio.Button value="Perffarm">
                            Perffarm Run
                        </Radio.Button>
                    </Radio.Group>
                    <br />
                    <br />
                    <Form.Item label="Baseline Run ID">
                        <Input
                            placeholder={
                                this.state.buildType +
                                ' URL. Ex: ' +
                                buildTypeExampleURL[this.state.buildType]
                            }
                            name="baselineID"
                            value={this.state.inputURL.baselineID}
                            onChange={this.handleChange.bind(this)}
                        />
                    </Form.Item>

                    <Form.Item label="Test Run ID">
                        <Input
                            placeholder={
                                this.state.buildType +
                                ' URL. Ex: ' +
                                buildTypeExampleURL[this.state.buildType]
                            }
                            name="testID"
                            value={this.state.inputURL.testID}
                            onChange={this.handleChange.bind(this)}
                        />
                    </Form.Item>

                    <Button type="primary" onClick={this.handleParseInputURL}>
                        Submit
                    </Button>
                </div>
            );
        }
    }
}
