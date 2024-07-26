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
    }, [location.search]);

    const updateData = async () => {
        const { buildId, limit, hasChildren, excludeRange } = getParams(location.search);
        let hasChildrenBool = hasChildren === 'true';
        const limitParam = limit ? `&limit=${limit}` : '';
        const [excludeMin, excludeMax] = excludeRange ? excludeRange.split('-').map(Number) : [null, null];

        let buildIds = [];
        let fetchedTestData = [];
        let fetchedParents = [];
        let errorMsg = '';

        if (!hasChildrenBool) {
            const buildData = await fetchData(`/api/getData?_id=${buildId}`);
            if (buildData && buildData[0].tests !== undefined) {
                hasChildrenBool = true;
            }
            buildIds.push(buildId);
        }

        if (hasChildrenBool) {
            const childrenBuilds = await fetchData(`/api/getChildBuilds?parentId=${buildId}`);
            buildIds.push(
                ...childrenBuilds
                    .map((child) => child._id)
                    .filter((id) => !excludeMin || !excludeMax || (id < excludeMin || id > excludeMax))
            );
        }

        // Only include the first build
        buildIds = [buildIds[0]];

        await Promise.all(
            buildIds.map(async (id) => {
                const { testResult, parent, error } = await getTestResult(id, limitParam);
                fetchedTestData = [...fetchedTestData, ...testResult];
                if (parent.length > fetchedParents.length || fetchedParents.length === 0) {
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
            const resultComparison = a[0].testResult.localeCompare(b[0].testResult);
            return resultComparison === 0 ? a.key.localeCompare(b.key) : resultComparison;
        });

        setParents(fetchedParents);
        setTestData(fetchedTestData);
        setError(errorMsg);
    };

    const getTestResult = async (buildId, limitParam) => {
        const [builds, buildData] = await Promise.all([
            fetchData(`/api/getAllTestsWithHistory?buildId=${buildId}${limitParam}`),
            fetchData(`/api/getData?_id=${buildId}`)
        ]);
        const error = buildData[0].error ? `${buildData[0].buildUrl}: ${buildData[0].error}` : '';

        const testResult = builds[0].tests?.map((test) => {
            const testResultData = {
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
                action: {
                    testId: test._id,
                    testName: test.testName,
                }
            };

            builds.forEach(({ tests }, i) => {
                const foundTest = tests?.find((t) => t._id === test._id);
                testResultData[i] = foundTest ? { testResult: foundTest.testResult, testId: foundTest._id } : { testResult: 'N/A' };
            });

            return testResultData;
        }) || [];

        const parent = builds.map(({ parentNum, parentTimestamp }) => ({
            buildNum: parentNum,
            timestamp: parentTimestamp,
        }));

        return { testResult, parent, error };
    };

    const { buildId } = getParams(location.search);

    return (
        <div>
            <TestBreadcrumb buildId={buildId} />
            <AlertMsg error={error} />
            <SearchOutput buildId={buildId} />
            <TestTable title="Tests" testData={testData} parents={parents} />
        </div>
    );
};

export default Build;
