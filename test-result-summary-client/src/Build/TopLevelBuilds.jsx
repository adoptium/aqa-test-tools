import React, { Component } from 'react';
import TopLevelBuildTable from './TopLevelBuildTable';

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
        const response = await fetch(`/api/getTopLevelBuildNames?type=${type}`, {
            method: 'get'
        });
        const results = await response.json();
        const builds = {};
        for (let i = 0; i < results.length; i++) {
            const url = results[i]._id.url;
            const buildName = results[i]._id.buildName;
            builds[url] = builds[url] || [];
            builds[url].push(buildName);
        }
        this.setState({ builds, type });
    }



    render() {
        const { builds, type } = this.state;

        if (builds && type) {
            const order = (a, b) => {
                const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
                return collator.compare(a, b);
            }
            return (
                <div>
                    {Object.keys(builds).sort().map((url, i) => {
                        return builds[url].sort(order).map((buildName, j) => {
                            return <TopLevelBuildTable url={url} buildName={buildName} type={type} key={j} />
                        });
                    })}
                </div>);
        } else {
            return null;
        }
    }
}
