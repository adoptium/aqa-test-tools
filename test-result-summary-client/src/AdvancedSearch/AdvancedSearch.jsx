import React, { Component } from 'react';
import { Space, Button } from 'antd';
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
        const buildNamesStr = buildNames.join(',');
        const data = await fetchData(
            `/api/getTestByTestName?testName=${testName}&buildNames=${buildNamesStr}`
        );

        const result = data.map((element) => ({
            ...element,
            ...element.tests,
        }));

        this.setState({ result });
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
        const { buildNameOptions, testNameOptions, testName, result } =
            this.state;
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
                <Button type="primary" onClick={this.handleSubmit}>
                    Search
                </Button>
                <br />
                {result ? <SearchTestResult tests={result} /> : ''}
            </Space>
        );
    }
}
