import React, { Component } from 'react';
import { params } from '../utils/query';
import { Link } from 'react-router-dom';
import { LocaleProvider, Table, Input } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import enUS from 'antd/lib/locale-provider/en_US';
import { getParams } from '../utils/query';
import Highlighter from 'react-highlight-words';
import renderDuration from './Duration';

import './table.css';

export default class TestPerPlatform extends Component {
    state = {
        buildNums: [],
        testData: [],
        filterDropdownVisible: false,
        searchText: '',
        sortedInfo: {
            order: 'ascend',
            columnKey: 'buildName',
        },
    };

    onInputChange = e => {
        this.setState( { searchText: e.target.value } );
    }

    async componentDidMount() {
        await this.updateData();
    }

    handleChange = ( pagination, filters, sorter ) => {
        this.setState( {
            sortedInfo: sorter,
            filteredInfo: filters,
        } );
    }

    async updateData() {
        const { testId } = getParams( this.props.location.search );
        const fetchBuild = await fetch( `/api/getTestPerPlatform?testId=${testId} `, {
            method: 'get'
        } );
        const builds = await fetchBuild.json();

        let testName = null;
        let buildId = null;
        const testData = builds.map( build => {
            const ret = {
                key: build.buildName,
                buildName: build.buildName,
                testResult: { testResult: build.tests.testResult, testId: build.tests._id },
                duration: build.tests.duration
            };
            testName = build.tests.testName;
            if ( testId === build.tests._id ) {
                buildId = build._id;
            }
            return ret;
        } );

        this.setState( {
            testData,
            testName,
            buildId
        } );
    }

    render() {
        const { filterDropdownVisible, testName, searchText, sortedInfo, buildId } = this.state;
        const { testId } = getParams( this.props.location.search );
        let dataSource = this.state.testData;

        const renderBuild = ( value, row, index ) => {
            return <div>
                <Link to={{ pathname: '/output/test', search: params( { id: value.testId } ) }}
                    style={{ color: value.testResult === "PASSED" ? "#2cbe4e" : ( value.testResult === "FAILED" ? "#f50" : "#DAA520" ) }}>
                    {value.testResult}
                </Link>
            </div>;
        };

        var columns = [{
            title: 'Platform',
            dataIndex: 'buildName',
            key: 'buildName',
            sorter: ( a, b ) => {
                return a.key.localeCompare( b.key );
            },
            sortOrder: sortedInfo.columnKey === 'buildName' && sortedInfo.order,
            filterDropdown: (
                <div className="custom-filter-dropdown">
                    <Input
                        ref={ele => this.searchInput = ele}
                        placeholder="Search test name"
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
            title: "Test Result",
            dataIndex: 'testResult',
            key: 'testResult',
            render: renderBuild,
            filters: [{
                text: 'FAILED',
                value: 'FAILED',
            }, {
                text: 'PASSED',
                value: 'PASSED',
            }, {
                text: 'SKIPPED',
                value: 'SKIPPED',
            }],
            onFilter: ( value, record ) => {
                const res = record.testResult;
                return res.testResult.indexOf( value ) === 0;
            },
        }];

        if ( searchText ) {
            const reg = new RegExp( searchText, 'gi' );
            dataSource = dataSource.filter( record => !!record.testName.match( reg ) ).map( record => {
                return {
                    ...record,
                    testName: <Highlighter
                        searchWords={searchText.split( ' ' )}
                        autoEscape
                        textToHighlight={record.testName}
                    />
                };
            } );
        }

        return <LocaleProvider locale={enUS}>
            <div>
                <TestBreadcrumb buildId={buildId} testId={testId} testName={testName} />
                <Table
                    columns={columns}
                    dataSource={dataSource}
                    bordered
                    title={() => this.state.testName}
                    pagination={{ pageSize: 50 }}
                    onChange={this.handleChange}
                />
            </div>
        </LocaleProvider>
    }
}