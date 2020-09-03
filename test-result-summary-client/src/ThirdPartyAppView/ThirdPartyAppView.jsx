import React, { Component } from 'react';
import { Table, Tooltip } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { params } from '../utils/query';
import { getColumnSearchProps } from '../utils/TableUtils';

export default class ThirdPartyAppView extends Component {
    constructor(props) {
        super( props );
        this.allJDKVersions = [];
        this.allJDKImpls = [];
        this.state = {
            appTests: [],
            searchText: '',
            searchedColumn: ''
        };
    }

    async componentDidMount() {
        await this.updateData();
    }

    async updateData() {
        const fetchAppTests = await fetch(`/api/getApplicationTests`, {
            method: 'get'
        });
        const appTestsData = await fetchAppTests.json();

        this.allJDKVersions = this.getDistinctValues(appTestsData, "jdkVersion");

        this.allJDKImpls = this.getDistinctValues(appTestsData, "jdkImpl");

        const appTests = appTestsData.map( ({ appName, testName, testId, testResult, timestamp, buildName, buildNum, buildUrl, url, jdkVersion, javaVersionOutput, ...rest}) => ({
            ...rest,
            name: appName + "/" + testName,
            key: buildUrl,
            result: { testResult, testId },
            jdkVersion: { versionNum: jdkVersion, javaVersionOutput },
            build: { buildName, buildNum, buildUrl, url },
            date: new Date(timestamp).toLocaleString()
        }));
        this.setState({ appTests });
    }

    getDistinctValues(array, key) {
        return array.map( element => element[key]).filter((value, index, self) => self.indexOf(value) === index);
    }

    handleSearch = (selectedKeys, confirm, dataIndex) => {
        confirm();
        this.setState({
            searchText: selectedKeys[0],
            searchedColumn: dataIndex,
        });
    };

    handleReset = clearFilters => {
        clearFilters();
        this.setState({ searchText: '' });
    };

    render() {
        const { appTests } = this.state;
        if ( appTests ) {
            const renderBuildUrl = ({ buildName, buildNum, buildUrl, url }) => {
                return <div><a href={buildUrl} target="_blank" rel="noopener noreferrer">{buildName} #{buildNum}</a></div>;
            };

            const renderResult = ({ testResult, testId }) => {
                return <div>
                    {testId ? <Link to={{ pathname: '/output/test', search: params({ id: testId }) }}
                        style={{ color: testResult === "PASSED" ? "#2cbe4e" : (testResult === "FAILED" ? "#f50" : "#DAA520") }}>
                        {testResult}
                    </Link> : testResult}
                </div>;
            };

            const renderJDKVersion = ({ versionNum, javaVersionOutput }) => {
                const title = javaVersionOutput.split ('\n').map( (line, i) => <p key={i}>{ line }</p> );
                return <div>
                    <span>{versionNum}</span>
                    <Tooltip title={title}>
                        <sup>
                            <InfoCircleOutlined />
                        </sup>
                    </Tooltip>
                </div>;
            }

            const columnSearchProps = {
                searchedColumn: this.state.searchedColumn,
                searchText: this.state.searchText,
                handleSearch: this.handleSearch,
                handleReset: this.handleReset
            }

            const columns = [{
                title: 'Name',
                dataIndex: 'name',
                key: 'name',
                sorter: (a, b) => {
                    return a.name.localeCompare(b.name);
                },
                defaultSortOrder: 'ascend',
                ...getColumnSearchProps({ dataIndex: 'name', ...columnSearchProps })
            }, {
                title: 'App Version',
                dataIndex: 'appVersion',
                key: 'appVersion',
                ...getColumnSearchProps({ dataIndex: 'appVersion', ...columnSearchProps })
            }, {
                title: 'OS',
                dataIndex: 'dockerOS',
                key: 'dockerOS',
                ...getColumnSearchProps({ dataIndex: 'dockerOS', ...columnSearchProps })
            }, {
                title: 'JDK Version',
                dataIndex: 'jdkVersion',
                key: 'jdkVersion',
                render: renderJDKVersion,
                sorter: (a, b) => {
                    return a.jdkVersion.versionNum.localeCompare(b.jdkVersion.versionNum);
                },
                filters: this.allJDKVersions.map( element => ({ text: element, value: element }) ),
                onFilter: (value, record) => {
                    const version = record.jdkVersion.versionNum;
                    return version.indexOf(value) === 0;
                },
            }, {
                title: 'JDK Impl',
                dataIndex: 'jdkImpl',
                key: 'jdkImpl',
                filters: this.allJDKImpls.map( element => ({ text: element, value: element }) ),
                onFilter: (value, record) => {
                    const impl = record.jdkImpl;
                    return impl.indexOf(value) === 0;
                },
            }, {
                title: 'JDK Spec',
                dataIndex: 'jdkPlatform',
                key: 'jdkPlatform',
                ...getColumnSearchProps({ dataIndex: 'jdkPlatform', ...columnSearchProps })
            }, {
                title: 'Result',
                dataIndex: 'result',
                key: 'result',
                render: renderResult,
                filters: [{
                    text: 'FAILED',
                    value: 'FAILED',
                }, {
                    text: 'PASSED',
                    value: 'PASSED',
                }, {
                    text: 'DISABLED',
                    value: 'DISABLED',
                }, {
                    text: 'SKIPPED',
                    value: 'SKIPPED',
                }],
                onFilter: (value, record) => {
                    const testResult = record.result.testResult;
                    return testResult.indexOf(value) === 0;
                },
            }, {
                title: 'Build Link',
                dataIndex: 'build',
                key: 'build',
                render: renderBuildUrl
            }, {
                title: 'Date',
                dataIndex: 'date',
                key: 'date',
                sorter: (a, b) => {
                    return a.date.localeCompare(b.date);
                }
            }];

            return <Table
                columns={columns}
                dataSource={appTests}
                title={() => <div><b>Third Party Application View</b></div>}
                pagination={{ defaultPageSize: 20, pageSizeOptions: ['10', '20', '50', '100'], showSizeChanger: true }}
            />;
        } else {
            return null;
        }
    }
}