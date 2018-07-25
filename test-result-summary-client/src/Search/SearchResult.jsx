import React, { Component } from 'react';
import { LocaleProvider } from 'antd';
import enUS from 'antd/lib/locale-provider/en_US';
import { getParams } from '../utils/query';
import TestBreadcrumb from '../Build/TestBreadcrumb';
import SearchTestResult from './SearchTestResult';
import SearchBuildResult from './SearchBuildResult';

export default class SearchResult extends Component {
    state = {
        builds: [],
        tests: [],
        parent: null,
    };

    async componentDidMount() {
        await this.updateData();
    }

    async updateData() {
        const { buildId, searchText } = getParams( this.props.location.search );

        let url = `/api/getTestBySearch?searchText=${searchText}&buildId=${buildId}`;

        const fetchBuild = await fetch( url, {
            method: 'get'
        } );
        const result = await fetchBuild.json();

        this.setState( {
            builds: result.builds,
            tests: result.tests,
        } );
    }

    render() {
        const { builds, tests } = this.state;
        const { buildId, searchText } = getParams( this.props.location.search );
        return <LocaleProvider locale={enUS}>
            <div>
                {<TestBreadcrumb buildId={ buildId } />}
                {<SearchTestResult tests={tests} searchText={searchText} />}
                <br />
                {<SearchBuildResult builds={builds} searchText={searchText} />}
            </div>
        </LocaleProvider>
    }
}