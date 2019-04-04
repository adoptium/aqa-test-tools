import React, { Component } from 'react';
import { Table } from 'antd';
import { params } from '../utils/query';
import { Link } from 'react-router-dom';

export default class TestTable extends Component {
    state = {
            filteredData: [],
        };

    async componentDidUpdate( prevProps ) {
        if ( prevProps.testData !== this.props.testData ) {
            this.setState( {
                filteredData: this.props.testData,
            } );
        }
    }

    handleFilterChange = ( filteredData ) => {
        this.setState( { filteredData } );
    }

    render() {
        const { buildData, title } = this.props;

        const renderJenkinsBuild = ( { buildName, buildNum, buildUrl, url } ) => {
            // Temporarily support BlueOcean link under folders
            let blueOcean;
            if (`${url}`.includes("/jobs") || `${url}`.includes("/build-scripts")) {
                let urls = url.split("/job/");
                let basicUrl = urls.shift();
                urls.push(buildName);
                let newUrl = urls.join("%2F");
                blueOcean = `${basicUrl}/blue/organizations/jenkins/${newUrl}/detail/${buildName}/${buildNum}`;
            } else {
                blueOcean = `${url}/blue/organizations/jenkins/${buildName}/detail/${buildName}/${buildNum}`;
            }
            return <div><a href={buildUrl} target="_blank" rel="noopener noreferrer">{buildName} #{buildNum}</a><br /><a href={blueOcean} target="_blank" rel="noopener noreferrer">Blue Ocean</a></div>;
        };

        const renderBuildName = ( value, row, index ) => {
            const resultColor = value.buildResult === "SUCCESS" ? "#2cbe4e" : ( value.buildResult === "FAILURE" ? "#f50" : "#DAA520" );
            if ( value.type === "Build" ) {
                if ( value.hasChildren ) {
                    return <Link to={{ pathname: '/buildDetail', search: params( { parentId: value._id } ) }}
                        style={{ color: resultColor }}> {value.buildName} </Link>;
                } else {
                    return <Link to={{ pathname: '/output/build', search: params( { id: value._id } ) }}
                        style={{ color: resultColor }}> {value.buildName} </Link>;
                }
            }
            let limit = 5;
            if ( value.type === "Perf") {
                limit = 1;
            }
            return <Link to={{ pathname: '/allTestsInfo', search: params( { buildId: value._id, limit: limit } ) }}
                style={{ color: resultColor }}> {value.buildName} </Link>;
        };

        const renderResult = ( { _id, buildResult } ) => {
            return <Link to={{ pathname: '/output/build', search: params( { id: _id } ) }} style={{ color: buildResult === "SUCCESS" ? "#2cbe4e" : ( buildResult === "FAILURE" ? "#f50" : "#DAA520" ) }}>{buildResult}</Link>;
        }

        const renderResultDetail = ( testSummary ) => {
            let resultDetail = "n/a";
            if ( testSummary ) {
                resultDetail = `Failed: ${testSummary.failed} / Passed: ${testSummary.passed} / Executed: ${testSummary.executed} / Skipped: ${testSummary.skipped} / Total: ${testSummary.total}`;
            }
            return resultDetail;
        }
        
        const childBuildsColumns = [{
            title: 'Build Name',
            dataIndex: 'buildData',
            key: 'buildData',
            render: renderBuildName,
            sorter: ( a, b ) => {
                return a.buildData.buildName.localeCompare( b.buildData.buildName );
            }
        }, {
            title: 'Result',
            dataIndex: 'result',
            key: 'result',
            render: renderResult,
            width: 100,
            filters: [{
                text: 'FAILURE',
                value: 'FAILURE',
            }, {
                text: 'SUCCESS',
                value: 'SUCCESS',
            }, {
                text: 'UNSTABLE',
                value: 'UNSTABLE',
            }, {
                text: 'ABORTED',
                value: 'ABORTED',
            }],
            onFilter: ( value, record ) => {
                const res = record.result;
                return res.buildResult.indexOf( value ) === 0;
            },
        }, {
            title: 'Result Detail',
            dataIndex: 'resultDetail',
            key: 'resultDetail',
            render: renderResultDetail,
        }, {
            title: 'Jenkins',
            dataIndex: 'jenkinsBuild',
            key: 'jenkinsBuild',
            render: renderJenkinsBuild,
            sorter: ( a, b ) => {
                const nameA = a.jenkinsBuild.buildName + a.jenkinsBuild.buildNum;
                const nameB = b.jenkinsBuild.buildName + b.jenkinsBuild.buildNum;
                return nameA.localeCompare( nameB );
            }
        }, {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
            sorter: ( a, b ) => {
                return a.date.localeCompare( b.date );
            }
        },];

        return <Table
                    columns={childBuildsColumns}
                    title={() => title}
                    dataSource={buildData}
                    pagination={{ pageSize: 20 }}
                    bordered
                />
    }
}