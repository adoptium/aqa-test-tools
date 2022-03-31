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
    };

    async componentDidMount() {
        await this.updateData();
    }

    async updateData() {
        const { parentId } = getParams(this.props.location.search);
        const originUrl = window.location.origin;

        const build = await fetchData(`/api/getParents?id=${parentId}`);
        let report = '';
        if (build && build[0]) {
            const { buildName, buildUrl, timestamp, startBy } = build[0];
            report =
                `#### Release Summary Report for ${buildName} \n` +
                `**Report generated at:** ${new Date().toUTCString()} \n \n` +
                `TRSS [Build](${originUrl}/buildDetail?parentId=${parentId}&testSummaryResult=failed&buildNameRegex=%5ETest) ` +
                `and TRSS [Grid View](${originUrl}/resultSummary?parentId=${parentId}) \n` +
                `Jenkins Build URL ${buildUrl} \nStarted by ${startBy} at ${new Date(
                    timestamp
                ).toLocaleString()} \n`;

            report += '\n --- \n';

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
                        const buildInfo = `\n[**${buildName}**](${buildUrl})`;
                        const buildResultStr =
                            buildResult === 'UNSTABLE'
                                ? ` ⚠️ ${buildResult} ⚠️\n`
                                : ` ❌ ${buildResult} ❌\n`;
                        if (buildName.startsWith('Test_openjdk')) {
                            failedTestSummary[buildName] = buildInfo;
                            failedTestSummary[buildName] += buildResultStr;
                            if (!buildName.includes('_testList')) {
                                const javaVersionBlock = `\`\`\`\n${javaVersion}\n\`\`\``;
                                const javaVersionDropdown = `<details><summary>java -version output</summary>\n\n${javaVersionBlock}\n</details>\n\n`;
                                failedTestSummary[buildName] +=
                                    javaVersionDropdown;
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
                                                ? ` | [rerun](${rerunLink}) \n`
                                                : `\n`;
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
                                                )})` +
                                                rerunChildLink;
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
                report += '\n --- \n';
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
