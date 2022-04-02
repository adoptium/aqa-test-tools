import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import { getParams, params } from '../utils/query';
import { Tooltip, Card, Alert } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import TestBreadcrumb from './TestBreadcrumb';
import { fetchData } from '../utils/Utils';

export default class ReleaseSummary extends Component {
    state = {
        body: 'Generating Release Summary Report...',
        failedTests: [],
    };

    async componentDidMount() {
        await this.updateData();
    }

    async updateData() {
        const { parentId } = getParams(this.props.location.search);
        const originUrl = window.location.origin;

        const build = await fetchData(`/api/getParents?id=${parentId}`);

        let report = '';
        const nl = `\n`;
        if (build && build[0]) {
            const { buildName, buildUrl, timestamp, startBy } = build[0];
            report =
                `#### Release Summary Report for ${buildName} ${nl}` +
                `**Report generated at:** ${new Date().toUTCString()} ${nl} ${nl}` +
                `TRSS [Build](${originUrl}/buildDetail?parentId=${parentId}&testSummaryResult=failed&buildNameRegex=%5ETest) ` +
                `and TRSS [Grid View](${originUrl}/resultSummary?parentId=${parentId}) ${nl}` +
                `Jenkins Build URL ${buildUrl} ${nl}Started by ${startBy} at ${new Date(
                    timestamp
                ).toLocaleString()} ${nl}`;

            report += `${nl} --- ${nl}`;

            const buildResult = '!SUCCESS';
            const failedBuilds = await fetchData(
                `/api/getAllChildBuilds${params({ buildResult, parentId })}`
            );
            let failedBuildSummary = {};
            let failedTestSummary = {};
            await Promise.all(
                failedBuilds.map(
                    async ({
                        _id,
                        buildName,
                        buildUrl,
                        buildResult,
                        javaVersion,
                        tests = [],
                        rerunLink,
                    }) => {
                        const buildInfo = `${nl}[**${buildName}**](${buildUrl})`;
                        const buildResultStr =
                            buildResult === 'UNSTABLE'
                                ? ` ⚠️ ${buildResult} ⚠️${nl}`
                                : ` ❌ ${buildResult} ❌${nl}`;

                        if (buildName.startsWith('Test_openjdk')) {
                            tests.forEach((test) => {
                                if (test.testResult === 'FAILED') {
                                    if (
                                        !this.state.failedTests.includes(
                                            test.testName
                                        )
                                    ) {
                                        this.state.failedTests.push(
                                            test.testName
                                        );
                                    }
                                }
                            });
                            const rerunFailedLink = rerunLink
                                ? rerunLink.replace(
                                      /(\WTARGET=)([^&]*)/gi,
                                      '$1' + this.state.failedTests
                                  )
                                : ``;

                            failedTestSummary[buildName] = buildInfo;
                            failedTestSummary[buildName] += buildResultStr;

                            if (!buildName.includes('_testList')) {
                                const rerunLinkInfo = rerunLink
                                    ? `Rerun [all](${rerunLink}) | [failed](${rerunFailedLink}) tests`
                                    : ``;
                                const javaVersionBlock = `\`\`\`${nl}${javaVersion}${nl}\`\`\``;
                                const javaVersionDropdown = `<details><summary>java -version output</summary>${nl}${nl}${javaVersionBlock}${nl}</details>${nl}${nl}`;
                                failedTestSummary[buildName] +=
                                    rerunLinkInfo + javaVersionDropdown;
                            }
                            const buildId = _id;
                            await Promise.all(
                                tests.map(
                                    async ({ _id, testName, testResult }) => {
                                        if (testResult === 'FAILED') {
                                            if (rerunLink) {
                                                rerunLink = rerunLink.replace(
                                                    /(\WTARGET=)([^&]*)/gi,
                                                    '$1' + testName
                                                );
                                            }
                                            const rerunChildLink = rerunLink
                                                ? ` | [rerun](${rerunLink}) ${nl}`
                                                : `${nl}`;
                                            const testId = _id;
                                            const history = await fetchData(
                                                `/api/getHistoryPerTest?testId=${testId}&limit=100`
                                            );
                                            let totalPasses = 0;
                                            for (let testRun of history) {
                                                if (
                                                    testRun.tests.testResult ===
                                                    'PASSED'
                                                ) {
                                                    totalPasses += 1;
                                                }
                                            }
                                            //For failed tests, add links to the deep history and possible issues list
                                            failedTestSummary[buildName] +=
                                                `[${testName}](${originUrl}/output/test?id=${testId}) => [deep history ${totalPasses}/${history.length} passed](${originUrl}/deepHistory?testId=${testId}) | ` +
                                                `[possible issues](${originUrl}/possibleIssues${params(
                                                    {
                                                        buildId,
                                                        buildName,
                                                        testId,
                                                        testName,
                                                    }
                                                )}) ${nl}`;
                                        }
                                    }
                                )
                            );
                        } else {
                            failedBuildSummary[buildName] = buildInfo;
                            failedBuildSummary[buildName] += buildResultStr;
                        }
                    }
                )
            );

            if (failedBuildSummary || failedTestSummary) {
                Object.keys(failedBuildSummary)
                    .sort()
                    .map((buildName) => {
                        report += failedBuildSummary[buildName];
                    });
                report += `${nl} --- ${nl}`;
                Object.keys(failedTestSummary)
                    .sort()
                    .map((buildName) => {
                        report += failedTestSummary[buildName];
                    });
            } else {
                report += 'Congratulation! There is no failure!';
            }
        } else {
            report = `Cannot find the build information (${parentId})in Database!`;
        }

        this.setState({
            body: report,
        });
    }

    copyCodeToClipboard() {
        const markdownText = document.getElementById('markdown-text');
        let range, selection;

        if (document.body.createTextRange) {
            range = document.body.createTextRange();
            range.moveToElementText(markdownText);
            range.select();
        } else if (window.getSelection) {
            selection = window.getSelection();
            range = document.createRange();
            range.selectNodeContents(markdownText);
            selection.removeAllRanges();
            selection.addRange(range);
        }

        let alert;
        if (document.execCommand('Copy')) {
            alert = (
                <Alert
                    message="Successfully copied to clipboard"
                    type="success"
                    showIcon
                />
            );
        } else {
            alert = (
                <Alert
                    message="Failed to copy to clipboard"
                    type="error"
                    showIcon
                />
            );
        }
        ReactDOM.render(alert, document.getElementById('copy-status'));
    }

    render() {
        const { body } = this.state;
        const { parentId, buildName } = getParams(this.props.location.search);
        const title = 'Release Summary Report for ' + buildName;
        return (
            <div>
                <TestBreadcrumb buildId={parentId} />
                <div id="copy-status"></div>
                <Card
                    title={title}
                    bordered={true}
                    style={{ width: '100%' }}
                    extra={
                        <Tooltip
                            title="Copy markdown report to clipboard"
                            placement="topRight"
                        >
                            <CopyOutlined
                                id="copy-button"
                                style={{ fontSize: '200%' }}
                                onClick={() => this.copyCodeToClipboard()}
                            />
                        </Tooltip>
                    }
                >
                    <pre className="card-body" id="markdown-text">
                        {body}
                    </pre>
                </Card>
            </div>
        );
    }
}
