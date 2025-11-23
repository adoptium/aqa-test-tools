import React, { useState, useEffect } from 'react';
import { Table, Button, notification } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import { fetchData } from '../utils/Utils';
import { SmileOutlined, FrownOutlined } from '@ant-design/icons';
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
            const response = await fetch(`/api/postIssueFeedback`, {
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
            });

            if (response.status === 200) {
                notification.success({ message: 'Feedback collected' });
            } else {
                throw new Error('Write error');
            }
        } catch {
            notification.error({ message: 'Unable to collect feedback' });
        }
    };

    const fetchIssues = async () => {
        // load test object
        const info = await fetchData(`/api/getTestById?id=${testId}`, {
            method: 'get',
        });

        // Call unified backend multi-host search
        let relatedIssues = [];
        try {
            relatedIssues = await fetchData(
                `/api/getInternalGitIssues?text=${encodeURIComponent(testName)}`
            );
        } catch (e) {
            // ignore internal lookup errors
        }

        if (!relatedIssues || relatedIssues.length === 0) {
            setLoading(false);
            setDataSource({});
            return;
        }

        // Filter + Structure
        let issuesByRepo = {};
        const today = new Date();
        const closedIssueMinDate = new Date().setMonth(today.getMonth() - 6);
        const openIssueMinDate = new Date().setMonth(today.getMonth() - 24);

        relatedIssues.forEach((issue) => {
            const createdAt = new Date(issue.created_at);
            const closedAt = issue.closed_at ? new Date(issue.closed_at) : null;

            // time filtering logic
            if (issue.state === 'closed') {
                if (closedAt && createdAt < closedIssueMinDate) return;
            } else if (createdAt < openIssueMinDate) {
                return;
            }

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

            const userFeedback = (
                <>
                    <Button
                        onClick={() =>
                            storeIssueFeedback(
                                repoName,
                                buildName,
                                issue.title,
                                issue.number,
                                issue.user.login,
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
                        onClick={() =>
                            storeIssueFeedback(
                                repoName,
                                buildName,
                                issue.title,
                                issue.number,
                                issue.user.login,
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

            issuesByRepo[repoName] = issuesByRepo[repoName] || [];
            issuesByRepo[repoName].push({
                key: issuesByRepo[repoName].length,
                issueTitle,
                issueCreator,
                createdAt,
                createdAtStr: createdAt.toLocaleString(),
                closedAt,
                closedAtStr: closedAt ? closedAt.toLocaleString() : '',
                issueState: issue.state,
                userFeedback,
            });
        });

        setLoading(false);
        setDataSource(issuesByRepo);
    };

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
            sorter: (a, b) => a.createdAt - b.createdAt,
        },
        { title: 'Closed At', dataIndex: 'closedAtStr', key: 'closedAtStr' },
        {
            title: 'State',
            dataIndex: 'issueState',
            key: 'issueState',
            defaultSortOrder: 'ascend',
            sorter: (a, b) => {
                if (a.issueState === b.issueState)
                    return b.createdAt - a.createdAt;
                return a.issueState === 'open' ? -1 : 1;
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
                            title={() => `Search ${testName} in ${repoName}`}
                            pagination={{ pageSize: 5 }}
                        />
                    ))
                ) : (
                    <span>No Possible Issues Found via Git Search</span>
                ))}
        </div>
    );
};

export default PossibleIssues;
