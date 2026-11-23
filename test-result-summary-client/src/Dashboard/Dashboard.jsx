import React, { Component } from 'react';
import TabInfo from './TabInfo';
import { releaseTab, releaseVersions } from './Defaults';
import { Tabs } from 'antd';

const AVAILABLE_RELEASES_URL =
    'https://api.adoptium.net/v3/info/available_releases';

export default class Dashboard extends Component {
    state = { versions: [] };

    async componentDidMount() {
        this.mounted = true;
        try {
            const response = await fetch(AVAILABLE_RELEASES_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const versions = releaseVersions(await response.json());
            if (this.mounted) this.setState({ versions });
        } catch (e) {
            console.error('Cannot get the available JDK releases', e);
        }
    }

    componentWillUnmount() {
        this.mounted = false;
    }

    render() {
        return (
            <Tabs
                type="card"
                items={[
                    {
                        label: 'Perf',
                        key: '1',
                        children: <TabInfo tab="Perf" />,
                    },
                    {
                        label: 'Custom',
                        key: '2',
                        children: <TabInfo tab="Custom" />,
                    },
                    ...this.state.versions.map((version) => ({
                        label: `JDK${version}`,
                        key: releaseTab(version),
                        children: <TabInfo tab={releaseTab(version)} />,
                    })),
                ]}
            />
        );
    }
}
