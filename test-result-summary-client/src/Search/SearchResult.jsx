import React, { Component } from 'react';
import { params, getParams } from '../utils/query';
import { fetchData } from '../utils/Utils';
import TestBreadcrumb from '../Build/TestBreadcrumb';
import SearchTestResult from './SearchTestResult';
import SearchBuildResult from './SearchBuildResult';
import SearchOutput from './SearchOutput';
export default class SearchResult extends Component {
    state = {
        builds: [],
        tests: [],
        parent: null,
    };

    async componentDidMount() {
        await this.updateData();
    }

    async componentDidUpdate(prevProps) {
        if (prevProps.location.search !== this.props.location.search) {
            await this.updateData();
        }
    }

    async updateData() {
        const { buildId, searchText } = getParams( this.props.location.search );
        const result = await fetchData(`/api/getTestBySearch${params({ buildId, searchText })}`);

        this.setState( {
            builds: result.builds,
            tests: result.tests,
        } );
    }

    render() {
        const { builds, tests } = this.state;
        const { buildId, searchText } = getParams( this.props.location.search );
        return <div>
            <SearchOutput buildId={buildId} />
            {<TestBreadcrumb buildId={ buildId } />}
            {<SearchTestResult tests={tests} searchText={searchText} />}
            <br />
            {<SearchBuildResult builds={builds} searchText={searchText} />}
        </div>
    }
}