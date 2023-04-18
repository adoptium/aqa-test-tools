import React, { useState, useEffect } from 'react';
import { params, getParams } from '../utils/query';
import { fetchData } from '../utils/Utils';
import { Link, useLocation } from 'react-router-dom';
import { Table, Input } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import Highlighter from 'react-highlight-words';
import renderDuration from './Duration';

import './table.css';

const TestPerPlatform = () => {
    const location = useLocation();
    const [testData, setTestData] = useState([]);
    const [testName, setTestName] = useState('');
    const [buildId, setBuildId] = useState('');
    const [testId, setTestId] = useState(getParams(location.search).testId);
    const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [sortedInfo, setSortedInfo] = useState({
        order: 'ascend',
        columnKey: 'buildName',
    });

    const onInputChange = (e) => {
        setSearchText(e.target.value);
    };

    useEffect(() => {
        async function updateData() {
            const builds = await fetchData(
                `/api/getTestPerPlatform?testId=${testId}`
            );
            const newTestData = builds.map((build) => {
                const ret = {
                    key: build.buildName,
                    buildName: build.buildName,
                    testResult: {
                        testResult: build.tests.testResult,
                        testId: build.tests._id,
                    },
                    duration: build.tests.duration,
                };
                setTestName(build.tests.testName);
                if (testId === build.tests._id) {
                    setBuildId(build._id);
                }
                return ret;
            });

            setTestData(newTestData);
        }
        updateData();
    }, [location.search]);

    const handleChange = (pagination, filters, sorter) => {
        setSortedInfo(sorter);
    };

    const renderBuild = (value, row, index) => {
        return (
            <div>
                <Link
                    to={{
                        pathname: '/output/test',
                        search: params({ id: value.testId }),
                    }}
                    style={{
                        color:
                            value.testResult === 'PASSED'
                                ? '#2cbe4e'
                                : value.testResult === 'FAILED'
                                ? '#f50'
                                : '#DAA520',
                    }}
                >
                    {value.testResult}
                </Link>
            </div>
        );
    };

    const columns = [
        {
            title: 'Platform',
            dataIndex: 'buildName',
            key: 'buildName',
            sorter: (a, b) => {
                return a.key.localeCompare(b.key);
            },
            sortOrder: sortedInfo.columnKey === 'buildName' && sortedInfo.order,
            filterDropdown: (
                <div className="custom-filter-dropdown">
                    <Input
                        ref={(ele) => (searchInput = ele)}
                        placeholder="Search test name"
                        value={searchText}
                        onChange={onInputChange}
                        // onPressEnter={onSearch}
                    />
                </div>
            ),
            filterDropdownOpen,
            onFilterDropdownOpenChange: (visible) => {
                setFilterDropdownOpen(visible), () => searchInput.focus();
            },
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
            title: 'Test Result',
            dataIndex: 'testResult',
            key: 'testResult',
            render: renderBuild,
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
                const res = record.testResult;
                return res.testResult.indexOf(value) === 0;
            },
        },
    ];

    let dataSource = testData;

    if (searchText) {
        const reg = new RegExp(searchText, 'gi');
        dataSource = dataSource
            .filter((record) => !!record.testName.match(reg))
            .map((record) => {
                return {
                    ...record,
                    testName: (
                        <Highlighter
                            searchWords={searchText.split(' ')}
                            autoEscape
                            textToHighlight={record.testName}
                        />
                    ),
                };
            });
    }

    return (
        <div>
            <TestBreadcrumb
                buildId={buildId}
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
            />
        </div>
    );
};

export default TestPerPlatform;
