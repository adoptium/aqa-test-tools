import React, { Component } from 'react';
import TabInfo from './TabInfo';
import { Tabs } from 'antd';

export default class Dashboard extends Component {
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
                ]}
            />
        );
    }
}
