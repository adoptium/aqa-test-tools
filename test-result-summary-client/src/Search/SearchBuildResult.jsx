import React, { Component } from 'react';
import BuildTable from '../Build/BuildTable';

export default class SearchResult extends Component {
    state = {
        buildData: [],
    };

    async componentDidUpdate(prevProps) {
        if (prevProps.builds !== this.props.builds) {
            await this.updateData();
        }
    }

    async updateData() {
        const { builds } = this.props;

        const buildData = builds.map((element) => {
            const ret = {
                key: element._id,
                buildData: {
                    _id: element._id,
                    buildName: element.buildName,
                    buildNum: element.buildNum,
                    buildResult: element.buildResult,
                    buildUrl: element.buildUrl,
                    type: element.type,
                    hasChildren: element.hasChildren,
                },
                jenkinsBuild: {
                    buildName: element.buildName,
                    buildNum: element.buildNum,
                    buildUrl: element.buildUrl,
                    url: element.url,
                },
                result: { _id: element._id, buildResult: element.buildResult },
                resultDetail: element.testSummary,
                date: element.timestamp
                    ? new Date(element.timestamp).toLocaleString()
                    : null,
            };
            return ret;
        });

        buildData.sort((a, b) => {
            let rt = a.buildData.buildResult.localeCompare(
                b.buildData.buildResult
            );
            if (rt === 0) {
                return a.buildData.buildName.localeCompare(
                    b.buildData.buildName
                );
            }
            return rt;
        });

        this.setState({
            buildData,
        });
    }

    render() {
        const { searchText } = this.props;
        const { buildData } = this.state;
        return (
            <BuildTable
                title={
                    'Found ' +
                    buildData.length +
                    ' "' +
                    searchText +
                    '" in build output'
                }
                buildData={buildData}
            />
        );
    }
}
