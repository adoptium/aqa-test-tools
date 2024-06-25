import React, { useEffect, useState } from 'react';
import { params, getParams } from '../utils/query';
import { Link, useLocation } from 'react-router-dom';
import { Table, Input, Tooltip } from 'antd';
import { ProfileOutlined } from '@ant-design/icons';
import TestBreadcrumb from './TestBreadcrumb';
import { fetchData } from '../utils/Utils';
import Highlighter from 'react-highlight-words';
import renderDuration from './Duration';

import './table.css';

const DeepHistory = () => {
    const [testName, setTestName] = useState('');
    const [testData, setTestData] = useState([]);
    const [build, setBuild] = useState({});
    const [filterDropdownVisible, setFilterDropdownVisible] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [sortedInfo, setSortedInfo] = useState({
        order: 'descend',
        columnKey: 'startTime',
    });

    const location = useLocation();

    useEffect(() => {
        async function updateData() {
            const { testId } = getParams(location.search);
            const response = await fetchData(
                `/api/getHistoryPerTest?testId=${testId}&limit=100`
            );
            const testData = response.map((build) => {
                return {
                    key: build.parentNum,
                    parentBuild: build.parentNum,
                    testResult: {
                        testId: build.tests._id,
                        testResult: build.tests.testResult,
                    },
                    buildUrl: build.buildUrl,
                    duration: build.tests.duration || null,
                    machine: build.machine || null,
                    startTime: new Date(build.tests.startTime).toLocaleString(),
                };
            });

            setTestName(response[0].tests.testName);
            setTestData(testData);
            setBuild({
                _id: response[0]._id,
                buildName: response[0].buildName,
            });
        }

        updateData();
    }, [location]);

    const handleChange = (pagination, filters, sorter) => {
        setSortedInfo(sorter);
    };

    const onInputChange = (e) => {
        setSearchText(e.target.value);
    };

    const onSearch = (e) => {
        setFilterDropdownVisible(false);
    };

    const { testId } = getParams(location.search);
    let dataSource = testData;

    const renderTestResult = ({ testId, testResult }) => {
        return (
            <div>
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
            </div>
        );
    };

    const renderBuild = (value) => {
        return <div>Build #{value}</div>;
    };

    const renderAction = (value, row) => {
        const { buildUrl } = row;

        return (
            <span>
                <a
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`${buildUrl}/testReport`}
                >
                    <Tooltip title="Junit Test Report">
                        {' '}
                        <ProfileOutlined />{' '}
                    </Tooltip>{' '}
                </a>
            </span>
        );
    };

    const columns = [
        {
            title: 'Parent Build',
            dataIndex: 'parentBuild',
            key: 'parentBuild',
            render: renderBuild,
            sorter: (a, b) => {
                return a.parentBuild - b.parentBuild;
            },
            sortOrder:
                sortedInfo.columnKey === 'parentBuild' && sortedInfo.order,
        },
        {
            title: 'Test Result',
            dataIndex: 'testResult',
            key: 'testResult',
            render: renderTestResult,
        },
        {
            title: 'Duration',
            dataIndex: 'duration',
            key: 'duration',
            render: renderDuration,
            sorter: (a, b) => {
                return a.duration - b.duration;
            },
            sortOrder: sortedInfo.columnKey === 'duration' && sortedInfo.order,
        },
        {
            title: 'Machine',
            dataIndex: 'machine',
            key: 'machine',
            filterDropdown: (
                <div className="custom-filter-dropdown">
                    <Input
                        ref={(ele) => (this.searchInput = ele)}
                        placeholder="Search machine name"
                        value={searchText}
                        onChange={onInputChange}
                        onPressEnter={onSearch}
                    />
                </div>
            ),
            filterDropdownVisible,
            onFilterDropdownOpenChange: (visible) => {
                setFilterDropdownVisible(visible);
            },
        },
        {
            title: 'Start Time',
            dataIndex: 'startTime',
            key: 'startTime',
            sorter: (a, b) => {
                return a.startTime.localeCompare(b.startTime);
            },
            sortOrder: sortedInfo.columnKey === 'startTime' && sortedInfo.order,
        },
        {
            title: 'Action',
            dataIndex: 'action',
            key: 'action',
            render: renderAction,
        },
    ];

    if (searchText) {
        const reg = new RegExp(searchText, 'gi');
        dataSource = dataSource
            .filter((record) => !!record.machine.match(reg))
            .map((record) => {
                return {
                    ...record,
                    machine: (
                        <Highlighter
                            searchWords={searchText.split(' ')}
                            autoEscape
                            textToHighlight={record.machine}
                        />
                    ),
                };
            });
    }

    return (
        <div>
            <TestBreadcrumb
                buildId={build._id}
                testId={testId}
                testName={testName}
            />
            <Table
                columns={columns}
                dataSource={dataSource}
                bordered
                title={() => testName}
                pagination={{ pageSize: 50 }}
                onChange={handleChange}
                defaultSortOrder="descend"
                defaultSortField="startTime"
            />
        </div>
    );
};

export default DeepHistory;
