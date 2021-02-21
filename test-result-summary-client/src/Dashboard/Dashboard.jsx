import React, { Component } from 'react';
import { Tabs } from 'antd';
import TabInfo from "./TabInfo";
const TabPane = Tabs.TabPane;

export default class Dashboard extends Component {

    render() {
        return <Tabs type="card">
            <TabPane tab="Perf" key="1"><TabInfo tab="Perf" /></TabPane>
            <TabPane tab="Custom" key="2"><TabInfo tab="Custom" /></TabPane>
        </Tabs>
    }
}