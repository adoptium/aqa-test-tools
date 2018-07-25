import React, { Component } from 'react';
import { Tabs } from 'antd';
import TabInfo from "./TabInfo";
const TabPane = Tabs.TabPane;

export default class Dashboard extends Component {

    render() {
        return <Tabs type="card">
            <TabPane tab="FVT" key="1"><TabInfo tab="FVT" /></TabPane>
            <TabPane tab="Perf" key="2"><TabInfo tab="Perf" /></TabPane>
        </Tabs>
    }
}