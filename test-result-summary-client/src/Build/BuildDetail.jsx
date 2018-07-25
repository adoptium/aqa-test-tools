import React, { Component } from 'react';
import { LocaleProvider, Table } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import { SearchOutput } from '../Search/';
import enUS from 'antd/lib/locale-provider/en_US';
import { Link } from 'react-router-dom';
import { getParams, params } from '../utils/query';
import BuildTable from "./BuildTable";

export default class BuildDetail extends Component {
    state = {
        builds: [],
        parent: [],
    };

    async componentDidMount() {
        await this.updateData();
        this.intervalId = setInterval(() => {
            this.updateData();
        }, 30 * 1000 );
    }

    async componentDidUpdate( prevProps ) {
        if ( prevProps.location.search !== this.props.location.search ) {
            await this.updateData();
        }
    }

    componentWillUnmount() {
        clearInterval( this.intervalId );
    }

    async updateData() {
        const { parentId } = getParams( this.props.location.search );
        const fetchBuild = await fetch( `/api/getChildBuilds?parentId=${parentId}`, {
            method: 'get'
        } );
        const builds = await fetchBuild.json();
        const fetchParentBuild = await fetch( `/api/getData?_id=${parentId} `, {
            method: 'get'
        } );
        const parent = await fetchParentBuild.json();

        this.setState( { builds, parent } );
    }

    render() {
        const { builds, parent } = this.state;
        const { parentId } = getParams( this.props.location.search );

        const childBuildsDataSource = [];
        for ( let i = 0; i < builds.length; i++ ) {
            childBuildsDataSource.push( {
                key: i,
                buildData: {
                    _id: builds[i]._id,
                    buildName: builds[i].buildNameStr ? builds[i].buildNameStr : builds[i].buildName,
                    buildNum: builds[i].buildNum,
                    buildResult: builds[i].buildResult,
                    buildUrl: builds[i].buildUrl,
                    type: builds[i].type,
                    hasChildren: builds[i].hasChildren,
                },
                jenkinsBuild: { buildName: builds[i].buildName, buildNum: builds[i].buildNum, buildUrl: builds[i].buildUrl, url: builds[i].url },
                result: { _id: builds[i]._id, buildResult: builds[i].buildResult },
                resultDetail: builds[i].testSummary,
                date: builds[i].timestamp ? new Date( builds[i].timestamp ).toLocaleString() : null
            } );
        }

        const parentBuildColumns = [{
            title: 'Build Info',
            dataIndex: 'buildInfo',
            key: 'buildInfo',
            render: text => <a href="#">{text}</a>,
        }, {
            title: 'SHA',
            dataIndex: 'sha',
            key: 'sha',
            render: text => <a href="#">{text}</a>,
        }];
        const parentBuildsDataSource = [];
        let buildName = '';
        let bcLink = null;
        if ( parent && parent[0] ) {
            let i = 0;
            for ( let key in parent[0].buildData ) {
                parentBuildsDataSource.push( {
                    key: i++,
                    buildInfo: key,
                    sha: parent[0].buildData[key]
                } );
            }
            buildName = parent[0].buildName;
            bcLink = ( <Link to={{ pathname: '/buildDetail', search: params( { parentId: parentId } ) }}>{parent[0].buildName}_#{parent[0].buildNum}</Link> );
        }

        return <LocaleProvider locale={enUS}>
            <div>
                <TestBreadcrumb buildId={parentId} />
                <SearchOutput buildId={parentId} />
                <Table
                    columns={parentBuildColumns}
                    dataSource={parentBuildsDataSource}
                    bordered
                    title={() => buildName}
                    pagination={false}
                />
                <br />
                <BuildTable title={"Children builds"} buildData={childBuildsDataSource} />
            </div>
        </LocaleProvider>

    }
}
