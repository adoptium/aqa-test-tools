import React, { Component } from 'react';
import { Table } from 'antd';

export default class Artifacts extends Component {


    render() {
        const { artifactory } = this.props;
        if ( artifactory ) {
            const columns = [{
                title: 'Test Result File Name',
                dataIndex: 'name',
                key: 'name',
                render: text => <a href={artifactory}>{text}</a>
            }];
            const tokens = artifactory.split( "/" );
            const data = [{
                key: '1',
                name: tokens[tokens.length - 1],
            }];
            return <Table columns={columns} dataSource={data} />;
        }
        return null;
    }
}