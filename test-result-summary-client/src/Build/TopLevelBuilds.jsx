import React, { Component } from 'react';
import TopLevelBuildTable from './TopLevelBuildTable';
import BuildComparisonTable from './BuildComparisonTable';
const { order, fetchData } = require('../utils/Utils');
export default class TopLevelBuilds extends Component {

    state = {
        currentPage: 1,
    };

    async componentDidMount() {
        await this.updateData(this.props.match.params.type);
        this.intervalId = setInterval(() => {
            this.updateData(this.props.match.params.type);
        }, 5 * 60 * 1000);

    }
    async componentDidUpdate(prevProps) {
        if (prevProps.match.params.type !== this.props.match.params.type) {
            await this.updateData(this.props.match.params.type);
        }
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
    }

    async updateData(type) {
        if (!type) type = "Test";
        const results = await fetchData(`/api/getTopLevelBuildNames?type=${type}`);
        const builds = {};
        for (let i = 0; results && i < results.length; i++) {
            const url = results[i]._id.url;
            const buildName = results[i]._id.buildName;
            builds[url] = builds[url] || [];
            builds[url].push(buildName);
        }
        this.setState({ builds, type });
    }

    render() {
        const { builds, type } = this.state;
	    const pageUrl=this.props.location.pathname

        if (builds && type) {
            if( pageUrl !== "/build/compare" ) {
                Object.keys(builds).sort().map((url, i) => {
                    return builds[url].sort(order).map((buildName, j) => {
                        return <TopLevelBuildTable url={url} buildName={buildName} type={type} key={j} />
                    });
                })
            } else {
                const buildUrlList = [];
                Object.keys(builds).map((url, index) => ( 
                    buildUrlList.push([builds[url], url])
                ))
                return <BuildComparisonTable buildUrlList={buildUrlList} type={type} />
            }
        } else {
            return null;
        }
    }
}
