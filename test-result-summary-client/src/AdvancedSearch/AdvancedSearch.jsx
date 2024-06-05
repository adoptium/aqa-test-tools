import React, { Component } from 'react';
import { Space, Button, Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import { fetchData } from '../utils/Utils';
import InputAutoComplete from './InputAutoComplete';
import InputSelect from './InputSelect';
import SearchTestResult from '../Search/SearchTestResult';

export default class AdvancedSearch extends Component {
    constructor(props) {
        super(props);
        this.state = {
            testName: '',
            testNameOptions: [],
            buildNameOptions: [],
            loading: false, // Add loading state to manage spinner visibility
            result: null, // Add result state to store search results
        };
    }

    async componentDidMount() {
        await this.updateData();
    }

    async updateData() {
        const data = await fetchData(`/api/getTopLevelBuildNames?type=Test`);
        let buildNames = [];
        if (data) {
            buildNames = data.map((value) => {
                return value._id.buildName;
            });
        }
        const testNames = await fetchData(`/api/getTestNames`);

        this.setState({
            buildNameOptions: buildNames.sort(),
            testNameOptions: testNames,
        });
    }

    handleSubmit = async () => {
        const { testName, buildNames } = this.state;
        this.setState({ loading: true }); // Set loading to true when search starts
        const buildNamesStr = buildNames.join(',');
        const data = await fetchData(
            `/api/getTestByTestName?testName=${testName}&buildNames=${buildNamesStr}`
        );

        const result = data.map((element) => ({
            ...element,
            ...element.tests,
        }));

        this.setState({ result, loading: false }); // Set loading to false when search is complete
    };

    onBuildNameChange = (value) => {
        this.setState({ buildNames: value });
    };

    onTestNameChange = (value) => {
        this.setState({ testName: value });
    };

    onSelect = (value) => {
        this.setState({ value });
    };

    render() {
        const { buildNameOptions, testNameOptions, testName, loading, result } = this.state;
        const antIcon = <LoadingOutlined style={{ fontSize: 24 }} spin />; // Custom loading indicator

        return (
            <Space direction="vertical">
                <InputAutoComplete
                    value={testName}
                    options={testNameOptions}
                    onSelect={this.onSelect}
                    onChange={this.onTestNameChange}
                    message="please input test name"
                />
                <InputSelect
                    options={buildNameOptions}
                    onChange={this.onBuildNameChange}
                    message="please select build name"
                />
                <Space direction="horizontal">
                    <Button type="primary" onClick={this.handleSubmit}>
                        Search
                    </Button>
                    {loading && <Spin indicator={antIcon} />} 
                </Space>
                <br />
                {result ? <SearchTestResult tests={result} /> : ''} 
            </Space>
        );
    }
}
