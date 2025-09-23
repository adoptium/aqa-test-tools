import React, { useState, useEffect } from 'react';
import { Table, Button } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import { fetchData } from '../utils/Utils';
import { SmileOutlined, FrownOutlined } from '@ant-design/icons';
import { notification } from 'antd';
import './table.css';

const PossibleIssues = ({
    buildId,
    testId,
    testName,
    buildName,
    showCrumbs,
}) => {
    const [dataSource, setDataSource] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchIssues();
    }, []);

    const storeIssueFeedback = async (
        repoName,
        buildName,
        issueName,
        issueNumber,
        issueCreator,
        testName,
        testId,
        accuracy
    ) => {
        try {
            const postData = {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    repoName,
                    buildName,
                    issueName,
                    issueNumber,
                    issueCreator,
                    accuracy,
                    testName,
                    testId,
                }),
            };

            const response = await fetch(`/api/postIssueFeedback`, postData);

            if (response.status === 200) {
                notification.success({
                    message: 'Feedback collected',
                });
            } else {
                throw new Error('Write error');
            }
        } catch (error) {
            notification.error({
                message: 'Unable to collect feedback',
            });
        }
    };

    const fetchIssues = async () => {
        // fetch test output content
        const info = await fetchData(`/api/getTestById?id=${testId} `, {
            method: 'get',
        });

        const result = await fetchData(
            `/api/getOutputById?id=${info.testOutputId}`,
            {
                method: 'get',
            }
        );

        const testOutput = result.output;

        // fetch related issues with Github API
        let additionalRepo = '';
        let additionalResponse = [];
        if (buildName.includes('j9') || buildName.includes('ibm')) {
            additionalRepo = '+repo:eclipse-openj9/openj9';

            additionalResponse = await fetchData(
                `/api/getInternalGitIssues?text=${testName}`
            );
        } else if (buildName.includes('hs')) {
            additionalRepo =
                '+repo:adoptium/infrastructure+repo:adoptium/aqa-build';
        }
        const response = await fetch(
            `https://api.github.com/search/issues?q=${testName}+repo:adoptium/aqa-tests` +
                `+repo:adoptium/aqa-systemtest+repo:adoptium/TKG${additionalRepo}`,
            {
                method: 'get',
            }
        );

        let relatedIssues = [];
        if (response.ok) {
            relatedIssues = await response.json();
            relatedIssues = relatedIssues.items;
        }
        if (additionalResponse) {
            relatedIssues = [...relatedIssues, ...additionalResponse];
        }
        if (relatedIssues && relatedIssues.length > 0) {
            let dataSource = {};
            const today = new Date();
            const closedIssueMinDate = new Date().setMonth(
                today.getMonth() - 6
            );

            const openIssueMinDate = new Date().setMonth(today.getMonth() - 24);
            relatedIssues.forEach((issue) => {
                const createdAt = new Date(issue.created_at);
                const closedAt = issue.closed_at
                    ? new Date(issue.closed_at)
                    : '';
                // For matched closed issues, only display if the issue was closed in the last 6 months
                // For matched open issues, only display if the issue has been opened within 24 months
                if (issue.state === 'closed') {
                    if (closedAt && createdAt < closedIssueMinDate) {
                        return;
                    }
                } else {
                    if (createdAt < openIssueMinDate) {
                        return;
                    }
                }
                const createdAtStr = createdAt.toLocaleString();
                const closedAtStr = closedAt.toLocaleString();
                const repoName = issue.repository_url;
                const issueTitle = (
                    <a
                        href={issue.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {issue.number}: {issue.title}
                    </a>
                );
                const issueCreator = (
                    <a
                        href={issue.user.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {issue.user.login}
                    </a>
                );
                const issueState = issue.state;
                const issueFullName = issue.title;
                const issueNumber = issue.number;
                const creatorName = issue.user.login;
                const userFeedback = (
                    <>
                        <Button
                            onClick={async () =>
                                await storeIssueFeedback(
                                    repoName,
                                    buildName,
                                    issueFullName,
                                    issueNumber,
                                    creatorName,
                                    testName,
                                    testId,
                                    1
                                )
                            }
                        >
                            <SmileOutlined
                                style={{ fontSize: '25px', color: 'green' }}
                            />
                        </Button>
                        &nbsp;
                        <Button
                            onClick={async () =>
                                await storeIssueFeedback(
                                    repoName,
                                    buildName,
                                    issueFullName,
                                    issueNumber,
                                    creatorName,
                                    testName,
                                    testId,
                                    0
                                )
                            }
                        >
                            <FrownOutlined
                                style={{ fontSize: '25px', color: 'red' }}
                            />
                        </Button>
                    </>
                );

                dataSource[repoName] = dataSource[repoName] || [];
                dataSource[repoName].push({
                    key: dataSource[repoName].length,
                    issueTitle,
                    issueCreator,
                    createdAt,
                    createdAtStr,
                    closedAt,
                    closedAtStr,
                    issueState,
                    userFeedback,
                });
            });

            setLoading(false);
            setDataSource(dataSource);
        } else {
            setError(response.status + ' ' + response.statusText);
        }
    };

    if (error) {
        return <div>Error: {error}</div>;
    } else {
        const columns = [
            {
                title: 'Possible Issues',
                dataIndex: 'issueTitle',
                key: 'issueTitle',
            },
            {
                title: 'Issue Creator',
                dataIndex: 'issueCreator',
                key: 'issueCreator',
            },
            {
                title: 'Created At',
                dataIndex: 'createdAtStr',
                key: 'createdAtStr',
                sorter: (a, b) => {
                    return a.createdAt - b.createdAt;
                },
            },
            {
                title: 'Closed At',
                dataIndex: 'closedAtStr',
                key: 'closedAtStr',
            },
            {
                title: 'State',
                dataIndex: 'issueState',
                key: 'issueState',
                defaultSortOrder: 'ascend',
                sorter: (a, b) => {
                    if (a.issueState === b.issueState)
                        return b.createdAt - a.createdAt;
                    else if (a.issueState === 'open') return -1;
                    else return 1;
                },
            },
        ];

        return (
            <div>
                {showCrumbs && (
                    <TestBreadcrumb
                        buildId={buildId}
                        testId={testId}
                        testName={testName}
                    />
                )}
                {!loading &&
                    (Object.keys(dataSource).length > 0 ? (
                        Object.keys(dataSource).map((repoName, index) => (
                            <Table
                                key={index}
                                columns={columns}
                                dataSource={dataSource[repoName]}
                                bordered
                                title={() =>
                                    `Search ${testName} in ${repoName}`
                                }
                                pagination={{ pageSize: 5 }}
                            />
                        ))
                    ) : (
                        <span>No Possible Issues Found via Git Search</span>
                    ))}
            </div>
        );
    }
};

export default PossibleIssues;
