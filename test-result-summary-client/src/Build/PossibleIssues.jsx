import React, { useState, useEffect } from 'react';
import { Table, Button } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import { getParams } from '../utils/query';
import { fetchData } from '../utils/Utils';
import { SmileOutlined, FrownOutlined } from '@ant-design/icons';
import { useLocation } from 'react-router-dom';
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
        const generalTestName = testName.replace(/_\d+$/, '');

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
        if (buildName.includes('j9') || buildName.includes('ibm')) {
            additionalRepo = '+repo:eclipse-openj9/openj9';
        } else if (buildName.includes('hs')) {
            additionalRepo =
                '+repo:adoptium/infrastructure+repo:adoptium/aqa-build';
        }
        const response = await fetch(
            `https://api.github.com/search/issues?q=${generalTestName}+repo:adoptium/aqa-tests` +
                `+repo:adoptium/aqa-systemtest+repo:adoptium/TKG${additionalRepo}`,
            {
                method: 'get',
            }
        );
        var oldDate = new Date();
        oldDate.setMonth(oldDate.getMonth() - 6);
        if (response.ok) {
            const relatedIssues = await response.json();
            let dataSource = {};
            const repoUrlAPIPrefix = 'https://api.github.com/repos/';
            for (let index = 0; index < relatedIssues.items.length; index++) {
                const createdAt = new Date(
                    relatedIssues.items[index].created_at
                );
                const is_opne = relatedIssues.items[index].state;
                if (createdAt < oldDate && is_opne === 'closed') {
                    continue;
                }
                const createdAtStr = createdAt.toLocaleString();
                const repoName = relatedIssues.items[
                    index
                ].repository_url.replace(repoUrlAPIPrefix, '');
                const issue = (
                    <a
                        href={relatedIssues.items[index].html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {relatedIssues.items[index].title}
                    </a>
                );
                const issueCreator = (
                    <a
                        href={relatedIssues.items[index].user.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {relatedIssues.items[index].user.login}
                    </a>
                );
                const issueState = relatedIssues.items[index].state;
                const issueFullName = relatedIssues.items[index].title;
                const issueNumber = relatedIssues.items[index].number;
                const creatorName = relatedIssues.items[index].user.login;
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
                    issue,
                    issueCreator,
                    createdAt,
                    createdAtStr,
                    issueState,
                    userFeedback,
                });
            }
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
                dataIndex: 'issue',
                key: 'issue',
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
                                title={() => repoName}
                            />
                        ))
                    ) : (
                        <span>No Possible Issues Found</span>
                    ))}
            </div>
        );
    }
};

export default PossibleIssues;
