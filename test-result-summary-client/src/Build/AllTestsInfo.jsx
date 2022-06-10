import React, { Component } from 'react';
import TestBreadcrumb from './TestBreadcrumb';
import { SearchOutput } from '../Search/';
import { getParams } from '../utils/query';
import { fetchData } from '../utils/Utils';
import TestTable from './TestTable';
import AlertMsg from './AlertMsg';
import './table.css';

export default class Build extends Component {
    state = {
        parents: [],
        testData: [],
        error: '',
    };

    async componentDidMount() {
        await this.updateData();
    }

    async updateData() {
        const { buildId, limit, hasChildren } = getParams(
            this.props.location.search
        );
        const hasChildrenBool = hasChildren === 'true';
        let limitParam = '';
        if (limit) {
            limitParam = `&limit=${limit}`;
        }

        // list of build ids to get test results from
        let buildIds = [];

        // aggregated test results and parent
        let testData = [];
        let parents = [];
        let errorMsg = '';

        // if it is a parallel build.
        if (hasChildrenBool) {
            const childrenBuilds = await fetchData(
                `/api/getChildBuilds?parentId=${buildId}`
            );
            buildIds = childrenBuilds.map(
                (childrenBuilds) => childrenBuilds._id
            );
        } else {
            buildIds.push(buildId);
        }

        await Promise.all(
            buildIds.map(async (buildId) => {
                const { testResult, parent, error } = await this.getTestResult(
                    buildId,
                    limitParam
                );
                testData = testData.concat(testResult);
                if (parent.length > parents.length || parents.length === 0) {
                    parents = parent;
                }
                if (error) {
                    errorMsg = (
                        <div>
                            {errorMsg}
                            <br />
                            {error}
                        </div>
                    );
                }
            })
        );

        testData.sort((a, b) => {
            let rt = a[0].testResult.localeCompare(b[0].testResult);
            if (rt === 0) {
                return a.key.localeCompare(b.key);
            }
            return rt;
        });

        this.setState({
            parents,
            testData,
            errorMsg,
        });
    }

    async getTestResult(buildId, limitParam) {
        const builds = await fetchData(
            `/api/getAllTestsWithHistory?buildId=${buildId}${limitParam}`
        );

        const buildData = await fetchData(`/api/getData?_id=${buildId} `);
        const error = buildData[0].error
            ? `${buildData[0].buildUrl}: ${buildData[0].error}`
            : '';
        let testResult = [];
        if (builds[0].tests !== undefined) {
            testResult = builds[0].tests.map((test) => {
                const ret = {
                    key: test._id,
                    sortName: test.testName,
                    testName: test.testName,
                    duration: test.duration,
                    machine: builds[0].machine,
                    sortMachine: builds[0].machine,
                    buildName: buildData[0].buildName,
                    buildId: buildData[0]._id,
                    buildUrl: buildData[0].buildUrl,
                };
                ret.action = {
                    testId: test._id,
                    testName: test.testName,
                };
                builds.forEach(({ tests, parentNum }, i) => {
                    if (!tests) {
                        return (ret[i] = {
                            testResult: 'N/A',
                        });
                    }
                    const found = tests.find((t) => t._id === test._id);
                    if (found) {
                        const { testResult, _id } = found;
                        ret[i] = {
                            testResult,
                            testId: _id,
                        };
                    } else {
                        ret[i] = {
                            testResult: 'N/A',
                        };
                    }
                });
                return ret;
            });
        }

        const parent = builds.map((element) => {
            return {
                buildNum: element.parentNum,
                timestamp: element.parentTimestamp,
            };
        });
        return { testResult, parent, error };
    }

    render() {
        const { testData, parents, errorMsg } = this.state;
        const { buildId } = getParams(this.props.location.search);

        return (
            <div>
                <TestBreadcrumb buildId={buildId} />
                <AlertMsg error={errorMsg} />
                <SearchOutput buildId={buildId} />
                <TestTable
                    title={'Tests'}
                    testData={testData}
                    parents={parents}
                />
            </div>
        );
    }
}
