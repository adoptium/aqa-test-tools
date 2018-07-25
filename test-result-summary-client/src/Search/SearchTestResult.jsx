import React, { Component } from 'react';
import TestTable from '../Build/TestTable';

export default class SearchResult extends Component {
    state = {
        testData: [],
    };

    async componentDidUpdate ( prevProps ) {
        if ( prevProps.tests !== this.props.tests ) {
            await this.updateData();
        }
    }

    async updateData() {
        const { tests } = this.props;

        const testData = tests.map(( element ) => {
            const ret = {
                key: element._id,
                sortName: element.testName,
                testName: element.testName,
                action: { testId: element._id },
                result: { testResult: element.testResult, testId: element._id },
                build: { buildName: element.buildName },
                duration: element.duration
            }
            return ret;
        } );

        testData.sort(( a, b ) => {
            let rt = a.result.testResult.localeCompare( b.result.testResult );
            if ( rt === 0 ) {
                return a.sortName.localeCompare( b.sortName );
            }
            return rt;
        } );

        
        this.setState( {
            testData,
        } );
    }

    render() {
        const { searchText } = this.props;
        const { testData } = this.state;
        return <TestTable title={'Found ' + testData.length + ' "' + searchText + '" in test output'} testData={testData} />
    }
}