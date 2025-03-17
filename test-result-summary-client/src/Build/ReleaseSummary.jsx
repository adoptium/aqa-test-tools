import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useLocation } from 'react-router-dom';
import { Tooltip, Card, Button } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import TestBreadcrumb from './TestBreadcrumb';
import { fetchData } from '../utils/Utils';
import { getParams, params } from '../utils/query';
import { CopyToClipboard } from 'react-copy-to-clipboard';

const ReleaseSummary = () => {
    const [body, setBody] = useState('Generating Release Summary Report...');
    const location = useLocation();
    const { parentId, buildName } = getParams(location.search);

    useEffect(() => {
        const updateData = async () => {
            const { parentId, childBuildsResult } = getParams(location.search);
            const originUrl = window.location.origin;

            const build = await fetchData(`/api/getParents?id=${parentId}`);

            let report = '';
            const nl = `\n`;
            if (build && build[0]) {
                const { buildName, buildUrl, timestamp, startBy } = build[0];
                let buildsResultOutput = '';
                if (childBuildsResult === 'PROGRESSING') {
                    buildsResultOutput = `**Warning:** The release summary report is not yet complete. Currently, it only contains partial results. ${nl}${nl}`;
                }
                report =
                    `#### Release Summary Report for ${buildName} ${nl}` +
                    buildsResultOutput +
                    `**Report generated at:** ${new Date().toUTCString()} ${nl} ${nl}` +
                    `TRSS [Build](${originUrl}/buildDetail?parentId=${parentId}&testSummaryResult=failed&buildNameRegex=%5ETest) ` +
                    `and TRSS [Grid View](${originUrl}/resultSummary?parentId=${parentId}) ${nl}` +
                    `Jenkins Build URL ${buildUrl} ${nl}Started by ${startBy} at ${new Date(
                        timestamp
                    ).toLocaleString()} ${nl}`;

                report += `${nl} --- ${nl}`;

                const buildResult = '!SUCCESS';
                const failedBuildsRes = fetchData(
                    `/api/getAllChildBuilds${params({
                        buildResult,
                        parentId,
                        buildNameRegex: '^((?!(_rerun)).)*$',
                    })}`
                );
                const rerunBuildsRes = fetchData(
                    `/api/getAllChildBuilds${params({
                        parentId,
                        buildNameRegex: '(Test|Perf)_openjdk.*_rerun',
                    })}`
                );

                const [failedBuilds, rerunBuilds] = await Promise.all([
                    failedBuildsRes,
                    rerunBuildsRes,
                ]);

                let failedBuildSummary = {};
                let failedTestSummary = {};
                // concat failedBuilds and rerunBuilds into allBuilds
                let allBuilds = [...failedBuilds, ...rerunBuilds];
                await Promise.all(
                    allBuilds.map(
                        async ({
                            _id,
                            buildName,
                            buildUrl,
                            buildResult,
                            javaVersion,
                            tests = [],
                            rerunLink,
                            rerunFailedLink,
                        }) => {
                            const buildInfo = `${nl}[**${buildName}**](${buildUrl})`;
                            let buildResultStr = ` ❌ ${buildResult} ❌${nl}`;
                            if (buildResult === 'SUCCESS') {
                                buildResultStr = ` ✅ ${buildResult} ✅${nl}`;
                            } else if (buildResult === 'UNSTABLE') {
                                buildResultStr = ` ⚠️ ${buildResult} ⚠️${nl}`;
                            }

                            if (
                                buildName.startsWith('Test_openjdk') ||
                                buildName.startsWith('Perf_openjdk')
                            ) {
                                let rerunLinkInfo = '';
                                if (rerunFailedLink) {
                                    rerunLinkInfo = `Rerun [failed](${rerunFailedLink})${nl}`;
                                } else if (rerunLink) {
                                    rerunLinkInfo = `Rerun [all](${rerunLink})${nl}`;
                                }
                                failedTestSummary[buildName] = buildInfo;
                                failedTestSummary[buildName] += buildResultStr;
                                if (!buildName.includes('_testList')) {
                                    failedTestSummary[buildName] +=
                                        rerunLinkInfo;
                                    if (javaVersion) {
                                        const javaVersionBlock = `\`\`\`${nl}${javaVersion}${nl}\`\`\``;
                                        failedTestSummary[
                                            buildName
                                        ] += `<details><summary>java -version</summary>${nl}${nl}${javaVersionBlock}${nl}</details>${nl}${nl}`;
                                    }
                                }

                                const buildId = _id;
                                await Promise.all(
                                    tests.map(
                                        async ({
                                            _id,
                                            testName,
                                            testResult,
                                        }) => {
                                            const testId = _id;
                                            if (testResult === 'FAILED') {
                                                if (
                                                    !buildName.includes(
                                                        '_rerun'
                                                    )
                                                ) {
                                                    const history =
                                                        await fetchData(
                                                            `/api/getHistoryPerTest?testId=${testId}&limit=100`
                                                        );
                                                    let totalPasses = 0;
                                                    for (let testRun of history) {
                                                        if (
                                                            testRun.tests
                                                                .testResult ===
                                                            'PASSED'
                                                        ) {
                                                            totalPasses += 1;
                                                        }
                                                    }
                                                    //For failed tests, add links to the deep history and possible issues list
                                                    failedTestSummary[
                                                        buildName
                                                    ] +=
                                                        `[${testName}](${originUrl}/output/test?id=${testId}) => [deep history ${totalPasses}/${history.length} passed](${originUrl}/deepHistory?testId=${testId}) | ` +
                                                        `[possible issues](${originUrl}/possibleIssues${params(
                                                            {
                                                                buildId,
                                                                buildName,
                                                                testId,
                                                                testName,
                                                            }
                                                        )})${nl}`;
                                                }
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
                        .forEach((buildName) => {
                            report += failedBuildSummary[buildName];
                        });

                    report += `${nl} --- ${nl}`;
                    Object.keys(failedTestSummary)
                        .sort()
                        .forEach((buildName) => {
                            report += failedTestSummary[buildName];
                        });
                } else {
                    report += 'Congratulation! There is no failure!';
                }
            } else {
                report = `Cannot find the build information (${parentId}) in Database!`;
            }

            setBody(report);
        };

        updateData();
    }, [parentId]);

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
                        <CopyToClipboard text={body}>
                                <Button size="large">
                                    <CopyOutlined />
                                    Copy
                                </Button>
                        </CopyToClipboard>
                    </Tooltip>
                }
            >
                <pre className="card-body" id="markdown-text">
                    {body}
                </pre>
            </Card>
        </div>
    );
};

export default ReleaseSummary;
