import React, { Component } from 'react';
import { params } from '../utils/query';
import { Link } from 'react-router-dom';
import { Table, Input } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import { getParams } from '../utils/query';
import { fetchData } from '../utils/Utils';
import Highlighter from 'react-highlight-words';
import renderDuration from './Duration';

import './table.css';

export default class DeepHistory extends Component {
    state = {
        testName: '',
        testData: [],
        build: {},
        filterDropdownVisible: false,
        searchText: '',
        sortedInfo: {
            order: 'descend',
            columnKey: 'parentBuild',
        },
    };

    async componentDidMount() {
        await this.updateData();
    }

    handleChange = ( pagination, filters, sorter ) => {
        this.setState( {
            sortedInfo: sorter,
        } );
    }

    onInputChange = e => {
        this.setState( { searchText: e.target.value } );
    }

    onSearch = e => {
        this.setState( { filterDropdownVisible: false } );
    }

    async updateData() {
        const { testId } = getParams( this.props.location.search );
        const response = await fetchData(`/api/getHistoryPerTest?testId=${testId}&limit=100`);
        const testData = response.map( build => {
            return {
                key: build.parentNum,
                parentBuild: build.parentNum,
                testResult: {
                    testId: build.tests._id,
                    testResult: build.tests.testResult,
                },
                duration: build.tests.duration || null,
                machine: build.machine || null,
                startTime: new Date( build.tests.startTime ).toLocaleString(),
            };
        } );

        this.setState( {
            testName: response[0].tests.testName,
            testData,
            build: {
                _id: response[0]._id,
                buildName: response[0].buildName,
            }
        } );
    }

    render() {
        const { testName, filterDropdownVisible, searchText, sortedInfo, build } = this.state;
        const { testId } = getParams( this.props.location.search );

        let dataSource = this.state.testData;

        const renderTestResult = ( { testId, testResult } ) => {
            return <div>
                <Link to={{ pathname: '/output/test', search: params( { id: testId } ) }}
                    style={{ color: testResult === "PASSED" ? "#2cbe4e" : ( testResult === "FAILED" ? "#f50" : "#DAA520" ) }}>
                    {testResult}
                </Link>
            </div>;
        };

        const renderBuild = ( value ) => {
            return <div>Build #{value}</div>;
        };

        var columns = [{
            title: 'Parent Build',
            dataIndex: 'parentBuild',
            key: 'parentBuild',
            render: renderBuild,
            sorter: ( a, b ) => {
                return a.parentBuild - b.parentBuild;
            },
            sortOrder: sortedInfo.columnKey === 'parentBuild' && sortedInfo.order,
        },
        {
            title: 'Duration',
            dataIndex: 'duration',
            key: 'duration',
            render: renderDuration,
            sorter: ( a, b ) => {
                return a.duration - b.duration;
            },
            sortOrder: sortedInfo.columnKey === 'duration' && sortedInfo.order,
        },
        {
            title: 'Test Result',
            dataIndex: 'testResult',
            key: 'testResult',
            render: renderTestResult,
        },
        {
            title: 'Machine',
            dataIndex: 'machine',
            key: 'machine',
            filterDropdown: (
                <div className="custom-filter-dropdown">
                    <Input
                        ref={ele => this.searchInput = ele}
                        placeholder="Search machine name"
                        value={searchText}
                        onChange={this.onInputChange}
                        onPressEnter={this.onSearch}
                    />
                </div>
            ),
            filterDropdownVisible,
            onFilterDropdownVisibleChange: visible => {
                this.setState( {
                    filterDropdownVisible: visible,
                }, () => this.searchInput.focus() );
            },
        },
        {
            title: 'Start Time',
            dataIndex: 'startTime',
            key: 'startTime',
        },
        ];

        
        if ( searchText ) {
            const reg = new RegExp( searchText, 'gi' );
            dataSource = dataSource.filter( record => !!record.machine.match( reg ) ).map( record => {
                return {
                    ...record,
                    machine: <Highlighter
                        searchWords={searchText.split( ' ' )}
                        autoEscape
                        textToHighlight={record.machine}
                    />
                };
            } );
        }

        return <div>
            <TestBreadcrumb buildId={build._id} testId={testId} testName={testName} />
            <Table
                columns={columns}
                dataSource={dataSource}
                bordered
                title={() => testName}
                pagination={{ pageSize: 50 }}
                onChange={this.handleChange}
            />
        </div>
    }
}