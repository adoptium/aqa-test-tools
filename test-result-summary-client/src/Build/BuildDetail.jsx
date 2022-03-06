import React, { Component } from 'react';
import { Button, Table } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import { SearchOutput } from '../Search/';
import { getParams, params } from '../utils/query';
import { fetchData } from '../utils/Utils';
import BuildTable from './BuildTable';
import { Link } from 'react-router-dom';

export default class BuildDetail extends Component {
    state = {
        builds: [],
        parent: [],
    };

    async componentDidMount() {
        await this.updateData();
        this.intervalId = setInterval(() => {
            this.updateData();
        }, 5 * 60 * 1000);
    }

    async componentDidUpdate(prevProps) {
        if (prevProps.location.search !== this.props.location.search) {
            await this.updateData();
        }
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
    }

    async updateData() {
        const { parentId, buildResult, testSummaryResult, buildNameRegex } =
            getParams(this.props.location.search);
        let builds;
        if (testSummaryResult || buildNameRegex || buildResult) {
            builds = await fetchData(
                `/api/getAllChildBuilds${params({
                    buildResult,
                    testSummaryResult,
                    buildNameRegex,
                    parentId,
                })}`
            );
        } else {
            builds = await fetchData(
                `/api/getChildBuilds?parentId=${parentId}`
            );
        }

        const parent = await fetchData(`/api/getData?_id=${parentId} `);

        this.setState({ builds, parent });
    }

    render() {
        const { builds, parent } = this.state;
        const { parentId } = getParams(this.props.location.search);

        const childBuildsDataSource = [];
        for (let i = 0; i < builds.length; i++) {
            childBuildsDataSource.push({
                key: i,
                buildData: {
                    _id: builds[i]._id,
                    buildName: builds[i].buildNameStr
                        ? builds[i].buildNameStr
                        : builds[i].buildName,
                    buildNum: builds[i].buildNum,
                    buildResult: builds[i].buildResult,
                    buildUrl: builds[i].buildUrl,
                    type: builds[i].type,
                    hasChildren: builds[i].hasChildren,
                },
                jenkinsBuild: {
                    buildName: builds[i].buildName,
                    buildNum: builds[i].buildNum,
                    buildUrl: builds[i].buildUrl,
                    url: builds[i].url,
                },
                result: {
                    _id: builds[i]._id,
                    buildResult: builds[i].buildResult,
                },
                resultDetail: builds[i].testSummary,
                date: builds[i].timestamp
                    ? new Date(builds[i].timestamp).toLocaleString()
                    : null,
                comments: builds[i].comments,
            });
        }

        const parentBuildColumns = [
            {
                title: 'Build Info',
                dataIndex: 'buildInfo',
                key: 'buildInfo',
            },
            {
                title: 'SHA',
                dataIndex: 'sha',
                key: 'sha',
            },
        ];
        const parentBuildsDataSource = [];
        let buildName = '';
        if (parent && parent[0]) {
            let i = 0;
            for (let key in parent[0].buildData) {
                parentBuildsDataSource.push({
                    key: i++,
                    buildInfo: key,
                    sha: parent[0].buildData[key],
                });
            }
            buildName = parent[0].buildName;
        }

        return (
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
                <BuildTable
                    title={'Children builds'}
                    buildData={childBuildsDataSource}
                />
            </div>
        );
    }
}
