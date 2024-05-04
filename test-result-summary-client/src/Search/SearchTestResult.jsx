import React, { Component } from 'react';
import TestTable from '../Build/TestTable';

export default class SearchTestResult extends Component {
    render() {
        const { searchText = '', tests } = this.props;
        const testData = tests.map((element) => ({
            ...element,
            key: element._id,
            sortName: element.testName,
            action: { testId: element._id, testName: element.testName },
            result: { testResult: element.testResult, testId: element._id },
            build: { buildName: element.buildName },
        }));

        testData.sort((a, b) => {
            let rt = a.result.testResult.localeCompare(b.result.testResult);
            if (rt === 0) {
                return a.sortName.localeCompare(b.sortName);
            }
            return rt;
        });

        const message = searchText ? ' "' + searchText + '"' : '';
        return (
            <TestTable
                title={'Found ' + testData.length + message + ' in test output'}
                testData={testData}
            />
        );
    }
}
