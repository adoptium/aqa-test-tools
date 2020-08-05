import React, { Component } from 'react';
import { params } from '../utils/query';
import { Button, Tooltip, Card } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import { GithubOutlined } from '@ant-design/icons';
import { getParams } from '../utils/query';
import renderDuration from './Duration';
import { getGitDiffLinks } from '../utils/Utils';

import './table.css';

import moment from 'moment';
const DAY_FORMAT = 'MMM DD YYYY, hh:mm a';

export default class GitNewissue extends Component {
    state = {
        body: '',
        title: '',
    };

    async componentDidMount() {
        await this.updateData();
    }

    async updateData() {
        const { testId, testName, duration, buildId, buildName,
            buildUrl, machine, buildTimeStamp, javaVersion, testResult, rerunLink } = getParams(this.props.location.search);

        let firstSeenFailure = null;
        let failCount = 0;
        let failMachineUrlBody = '', gitDiffLinksBody = '';

        if (testResult === 'FAILED') {
            let successBeforeFailure, gitDiffLinks = null;
            let machinesMap = {};

            // get all history tests with strictly earlier timestamp
            const fetchPreviousTests = await fetch(`/api/getHistoryPerTest?testId=${testId}&beforeTimestamp=${buildTimeStamp}&limit=100`, {
                method: 'get'
            });
            const response = await fetchPreviousTests.json();

            // add the current test result
            machinesMap[machine] = 1;
            failCount++;

            for (let i = 0; i < response.length; i++) {
                const previousResult = response[i].tests.testResult;
                const previousMachine = response[i].machine;
                if (previousResult === 'PASSED') {
                    successBeforeFailure = response[i];
                    break;
                } else {
                    firstSeenFailure = response[i];
                    machinesMap[previousMachine] = machinesMap[previousMachine] ? machinesMap[previousMachine] + 1 : 1;
                    failCount++;
                }
            }

            if (successBeforeFailure) {
                if (firstSeenFailure) {
                    gitDiffLinks = getGitDiffLinks(successBeforeFailure.javaVersion, firstSeenFailure.javaVersion, buildName);
                } else {
                    gitDiffLinks = getGitDiffLinks(successBeforeFailure.javaVersion, javaVersion, buildName);
                }
                gitDiffLinks.forEach(link => {
                    gitDiffLinksBody += `${link}\n`;
                });
            }

            Object.entries(machinesMap).forEach(([key, value]) => {
                failMachineUrlBody += `The test failed on machine ${key} ${value} times \n`;
            });
        }

        const buildStartTime = moment(parseInt(buildTimeStamp)).format(DAY_FORMAT);
        const title = `${testName} ${testResult} in ${buildName}`;
        const nl = "\n";
        const body = `**Test Info**${nl}`
            + `Test Name: ${testName}${nl}`
            + `Test Duration: ${renderDuration(duration)}${nl}`
            + `Machine: ${machine}${nl}`
            + `TRSS link for the test output: https://trss.adoptopenjdk.net/output/test${params({ id: testId })}${nl}`
            + `${nl}${nl}`
            + `**Build Info**${nl}`
            + `Build Name: ${buildName}${nl}`
            + `Jenkins Build start time: ${buildStartTime}${nl}`
            + `Jenkins Build URL: ${buildUrl}${nl}`
            + `TRSS link for the build: https://trss.adoptopenjdk.net/allTestsInfo${params({ buildId: buildId })}${nl}`
            + `${nl}${nl}`
            + `**Java Version**${nl}`
            + `${javaVersion}${nl}`
            + ((!firstSeenFailure) ? `` : (
                `${nl}${nl}`
                + `**This test has been failed ${failCount} times since ${moment(firstSeenFailure.timestamp).format(DAY_FORMAT)}**${nl}`
                + `**Java Version when the issue first seen**${nl}`
                + `${firstSeenFailure.javaVersion}${nl}`
                + `Jenkins Build URL: ${firstSeenFailure.buildUrl}${nl}${nl}`
                + failMachineUrlBody
            ))
            + (gitDiffLinksBody ? `${nl}**Git Diff of first seen failure and last success**${nl}` + gitDiffLinksBody : ``)
            + (rerunLink ? `${nl}[Rerun in Grinder](${rerunLink})` : ``);

        this.setState({
            body,
            title,
        });

    }

    render() {
        const { body, title } = this.state;
        const { testId, testName, buildId } = getParams(this.props.location.search);

        const urlParams = params({ title, body });
        return (
            <div>
                <TestBreadcrumb buildId={buildId} testId={testId} testName={testName} />
                <Card title={title} bordered={true} style={{ width: '100%' }} extra={
                    <Tooltip title="Create new issue at https://github.com/AdoptOpenJDK/openjdk-tests">
                        <a href={`https://github.com/AdoptOpenJDK/openjdk-tests/issues/new${urlParams}`} target="_blank" rel="noopener noreferrer">
                            <Button size="large">
                                <GithubOutlined />Create New Git Issue
                            </Button>
                        </a>
                    </Tooltip>
                }>
                    <pre className="card-body">{body}</pre>
                </Card>
            </div>
        );
    }
}