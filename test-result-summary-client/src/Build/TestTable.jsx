import React, { Component } from 'react';
import TextFilter from '../utils/TextFilter';
import {
    ClusterOutlined,
    GithubOutlined,
    HistoryOutlined,
    QuestionCircleOutlined,
    LinkOutlined,
    SyncOutlined,
} from '@ant-design/icons';
import { Table, Tooltip, Divider } from 'antd';
import { params } from '../utils/query';
import { Link } from 'react-router-dom';
import renderDuration from './Duration';

const testResultSortingArray = [
    'FAILED',
    'PASSED',
    'DISABLED',
    'SKIPPED',
    'N/A',
];

export default class TestTable extends Component {
    state = {
        filteredData: [],
    };

    async componentDidUpdate(prevProps) {
        if (prevProps.testData !== this.props.testData) {
            this.setState({
                filteredData: this.props.testData,
            });
        }
    }

    handleFilterChange = (filteredData) => {
        this.setState({ filteredData });
    };

    render() {
        const { title, parents } = this.props;
        let { testData } = this.props;
        const { filteredData } = this.state;
        const renderResult = (value) => {
            if (value) {
                const { testId, testResult } = value;
                return (
                    <div>
                        {testId ? (
                            <Link
                                to={{
                                    pathname: '/output/test',
                                    search: params({ id: testId }),
                                }}
                                style={{
                                    color:
                                        testResult === 'PASSED'
                                            ? '#2cbe4e'
                                            : testResult === 'FAILED'
                                            ? '#f50'
                                            : '#DAA520',
                                }}
                            >
                                {testResult}
                            </Link>
                        ) : (
                            testResult
                        )}
                    </div>
                );
            } else {
                return <div>N/A</div>;
            }
        };

        if (parents) {
            testData = testData.sort(function (a, b) {
                return (
                    testResultSortingArray.indexOf(a[0].testResult) -
                    testResultSortingArray.indexOf(b[0].testResult)
                );
            });
        }

        const renderAction = (value, row) => {
            const { testId } = value;
            const { buildId, buildUrl, rerunUrl } = row;
            const testName = testData.testName;
            let rerunLink = row.rerunUrl;

            if (rerunLink) {
                rerunLink = rerunLink.replace(
                    /(\WTARGET=)([^&]*)/gi,
                    '$1' + testName
                );
            }

            return (
                <span>
                    <Link
                        to={{
                            pathname: '/testPerPlatform',
                            search: params({ testId }),
                        }}
                    >
                        <Tooltip title="All Platforms">
                            <ClusterOutlined />
                        </Tooltip>
                    </Link>
                    <Divider type="vertical" />
                    <Link
                        to={{
                            pathname: '/deepHistory',
                            search: params({ testId }),
                        }}
                    >
                        <Tooltip title="Deep History">
                            <HistoryOutlined />
                        </Tooltip>
                    </Link>
                    {possibleIssues(row, value)}
                    <Divider type="vertical" />
                    <Link
                        to={{
                            pathname: '/gitNewIssue',
                            search: params({ testId, buildId }),
                        }}
                    >
                        <Tooltip title="Create new issue at https://github.com/adoptium/aqa-tests">
                            {' '}
                            <GithubOutlined />
                        </Tooltip>
                    </Link>
                    <Divider type="vertical" />
                    <a
                        target="_blank"
                        href={buildUrl}
                        rel="noopener noreferrer"
                    >
                        <Tooltip title="Jenkins Link">
                            {' '}
                            <LinkOutlined />{' '}
                        </Tooltip>{' '}
                    </a>
                    <Divider type="vertical" />
                    <a
                        target="_blank"
                        href={rerunLink}
                        rel="noopener noreferrer"
                    >
                        <Tooltip title="Rerun Grinder">
                            {' '}
                            <SyncOutlined />{' '}
                        </Tooltip>{' '}
                    </a>
                </span>
            );
        };

        const possibleIssues = (row, value) => {
            const { testId, testName } = value;
            const buildId = row.buildId;

            if (row.buildName) {
                const buildName = row.buildName;
                return (
                    <span>
                        <Divider type="vertical" />
                        <Link
                            to={{
                                pathname: '/possibleIssues',
                                search: params({
                                    buildId,
                                    buildName,
                                    testId,
                                    testName,
                                }),
                            }}
                        >
                            <Tooltip title="Possible Issues">
                                <QuestionCircleOutlined />
                            </Tooltip>
                        </Link>
                    </span>
                );
            }
        };

        let columns = [
            {
                title: 'Test Name',
                dataIndex: 'testName',
                key: 'testName',
                sorter: (a, b) => {
                    return a.sortName.localeCompare(b.sortName);
                },
                filterDropdown: (
                    <TextFilter
                        dataIndex={'testName'}
                        dataSource={testData}
                        handleFilterChange={this.handleFilterChange}
                    />
                ),
            },
            {
                title: 'Action',
                dataIndex: 'action',
                key: 'action',
                render: renderAction,
            },
            {
                title: 'Duration',
                dataIndex: 'duration',
                key: 'duration',
                width: 100,
                render: renderDuration,
                sorter: (a, b) => {
                    return a.duration - b.duration;
                },
            },
            {
                title: 'Machine',
                dataIndex: 'machine',
                key: 'machine',
                sorter: (a, b) => {
                    return a.sortMachine.localeCompare(b.sortMachine);
                },
                filterDropdown: (
                    <TextFilter
                        dataIndex={'machine'}
                        dataSource={testData}
                        handleFilterChange={this.handleFilterChange}
                    />
                ),
            },
        ];
        if (parents) {
            columns.push(
                ...parents.map((parent, i) => {
                    return {
                        title: (
                            <div>
                                Build # {parent.buildNum}
                                <br />
                                {new Date(parent.timestamp).toLocaleString()}
                            </div>
                        ),
                        dataIndex: i.toString(),
                        key: i.toString(),
                        render: renderResult,
                        width: 120,
                        filters: [
                            {
                                text: 'FAILED',
                                value: 'FAILED',
                            },
                            {
                                text: 'PASSED',
                                value: 'PASSED',
                            },
                            {
                                text: 'DISABLED',
                                value: 'DISABLED',
                            },
                            {
                                text: 'SKIPPED',
                                value: 'SKIPPED',
                            },
                        ],
                        onFilter: (value, record) => {
                            const testResult = record[i.toString()].testResult;
                            return testResult.indexOf(value) === 0;
                        },
                    };
                })
            );
        } else {
            columns.push({
                title: 'Result',
                dataIndex: 'result',
                key: 'result',
                render: renderResult,
                filters: [
                    {
                        text: 'FAILED',
                        value: 'FAILED',
                    },
                    {
                        text: 'PASSED',
                        value: 'PASSED',
                    },
                    {
                        text: 'DISABLED',
                        value: 'DISABLED',
                    },
                    {
                        text: 'SKIPPED',
                        value: 'SKIPPED',
                    },
                ],
                onFilter: (value, record) => {
                    const res = record.result;
                    return res.testResult.indexOf(value) === 0;
                },
            });
            columns.push({
                title: 'Build',
                dataIndex: 'build',
                key: 'build',
                render: ({ buildName }) => buildName,
                sorter: (a, b) => {
                    return a.build.buildName.localeCompare(b.build.buildName);
                },
            });
        }

        return (
            <div>
                <Table
                    columns={columns}
                    dataSource={filteredData}
                    bordered
                    title={() => title}
                    pagination={{
                        defaultPageSize: 50,
                        pageSizeOptions: ['10', '20', '50', '100'],
                        showSizeChanger: true,
                    }}
                />
            </div>
        );
    }
}
