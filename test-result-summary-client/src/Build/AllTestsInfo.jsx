import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import TestBreadcrumb from './TestBreadcrumb';
import { SearchOutput } from '../Search/';
import { getParams } from '../utils/query';
import { fetchData } from '../utils/Utils';
import TestTable from './TestTable';
import AlertMsg from './AlertMsg';
import './table.css';

const Build = () => {
    const location = useLocation();
    const [parents, setParents] = useState([]);
    const [testData, setTestData] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        updateData();
    }, []);

    const updateData = async () => {
        const { buildId, limit, hasChildren } = getParams(location.search);
        let hasChildrenBool = hasChildren === 'true';
        let limitParam = '';
        if (limit) {
            limitParam = `&limit=${limit}`;
        }

        // list of build ids to get test results from
        let buildIds = [];

        // aggregated test results and parent
        let fetchedTestData = [];
        let fetchedParents = [];
        let errorMsg = '';

        // if it is a parallel build.
        if (!hasChildrenBool) {
            const buildData = await fetchData(`/api/getData?_id=${buildId} `);
            if (buildData && buildData[0].tests !== undefined) {
                hasChildrenBool = true;
            }
            buildIds.push(buildId);
        }
        if (hasChildrenBool) {
            const childrenBuilds = await fetchData(
                `/api/getChildBuilds?parentId=${buildId}`
            );
            buildIds.push(
                ...childrenBuilds.map((childrenBuilds) => childrenBuilds._id)
            );
        }

        await Promise.all(
            buildIds.map(async (buildId) => {
                const { testResult, parent, error } = await getTestResult(
                    buildId,
                    limitParam
                );
                fetchedTestData = fetchedTestData.concat(testResult);
                if (
                    parent.length > fetchedParents.length ||
                    fetchedParents.length === 0
                ) {
                    fetchedParents = parent;
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

        fetchedTestData.sort((a, b) => {
            let rt = a[0].testResult.localeCompare(b[0].testResult);
            if (rt === 0) {
                return a.key.localeCompare(b.key);
            }
            return rt;
        });

        setParents(fetchedParents);
        setTestData(fetchedTestData);
        setError(errorMsg);
    };

    const getTestResult = async (buildId, limitParam) => {
        const buildsRes = fetchData(
            `/api/getAllTestsWithHistory?buildId=${buildId}${limitParam}`
        );

        const buildDataRes = fetchData(`/api/getData?_id=${buildId} `);
        const [builds, buildData] = await Promise.all([
            buildsRes,
            buildDataRes,
        ]);
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
                    rerunUrl: buildData[0].rerunLink,
                    timestamp: buildData[0].timestamp,
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
    };

    const { buildId } = getParams(location.search);

    return (
        <div>
            <TestBreadcrumb buildId={buildId} />
            <AlertMsg error={error} />
            <SearchOutput buildId={buildId} />
            <TestTable title={'Tests'} testData={testData} parents={parents} />
        </div>
    );
};

export default Build;
