import React, { useState, useEffect } from 'react';
import { Table } from 'antd';
import TestBreadcrumb from './TestBreadcrumb';
import { SearchOutput } from '../Search/';
import { getParams, params } from '../utils/query';
import { fetchData } from '../utils/Utils';
import BuildTable from './BuildTable';
import { useLocation } from 'react-router-dom';

const BuildDetail = () => {
    const [builds, setBuilds] = useState([]);
    const [parent, setParent] = useState([]);

    const location = useLocation();

    useEffect(() => {
        const updateData = async () => {
            const { parentId, buildResult, testSummaryResult, buildNameRegex } =
                getParams(location.search);
            let fetchedBuilds;
            if (testSummaryResult || buildNameRegex || buildResult) {
                fetchedBuilds = await fetchData(
                    `/api/getAllChildBuilds${params({
                        buildResult,
                        testSummaryResult,
                        buildNameRegex,
                        parentId,
                    })}`
                );
            } else {
                fetchedBuilds = await fetchData(
                    `/api/getChildBuilds?parentId=${parentId}`
                );
            }

            const fetchedParent = await fetchData(
                `/api/getData?_id=${parentId} `
            );

            setBuilds(fetchedBuilds);
            setParent(fetchedParent);
        };

        updateData();
        const intervalId = setInterval(() => {
            updateData();
        }, 5 * 60 * 1000);

        return () => {
            clearInterval(intervalId);
        };
    }, [location.search]);

    const { parentId } = getParams(location.search);

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
};

export default BuildDetail;
