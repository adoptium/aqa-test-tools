import React, { Component } from 'react';
import { Table, Tooltip, Progress, Typography } from 'antd';
import { fetchData } from '../../../utils/Utils';

const { Title: AntTitle } = Typography;

export default class ReleaseHealthWidget extends Component {
    static Title = (props) => 'Release Health Overview';
    static defaultSize = { w: 4, h: 4 };
    static defaultSettings = {};

    state = {
        data: {},
        loading: true,
    };

    async componentDidMount() {
        await this.updateData();
        // Update every 5 minutes
        this.intervalId = setInterval(
            () => {
                this.updateData();
            },
            5 * 60 * 1000
        );
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
    }

    updateData = async () => {
        this.setState({ loading: true });
        const summary = await fetchData('/api/getReleaseSummary');
        if (summary) {
            this.setState({ data: summary, loading: false });
        } else {
            this.setState({ loading: false });
        }
    };

    render() {
        const { data, loading } = this.state;

        const tableData = Object.keys(data).map((jdkVersion) => {
            const stats = data[jdkVersion];
            const passRate =
                stats.total > 0
                    ? Math.round((stats.SUCCESS / stats.total) * 100)
                    : 0;

            return {
                key: jdkVersion,
                jdkVersion: `JDK ${jdkVersion}`,
                success: stats.SUCCESS,
                failure: stats.FAILURE,
                unstable: stats.UNSTABLE,
                total: stats.total,
                passRate: passRate,
            };
        });

        const columns = [
            {
                title: 'JDK Version',
                dataIndex: 'jdkVersion',
                key: 'jdkVersion',
                sorter: (a, b) => parseInt(a.key) - parseInt(b.key),
            },
            {
                title: 'Success',
                dataIndex: 'success',
                key: 'success',
                render: (val) => (
                    <span style={{ color: '#52c41a' }}>{val}</span>
                ),
            },
            {
                title: 'Failure',
                dataIndex: 'failure',
                key: 'failure',
                render: (val) => (
                    <span style={{ color: '#ff4d4f' }}>{val}</span>
                ),
            },
            {
                title: 'Unstable',
                dataIndex: 'unstable',
                key: 'unstable',
                render: (val) => (
                    <span style={{ color: '#faad14' }}>{val}</span>
                ),
            },
            {
                title: 'Health',
                dataIndex: 'passRate',
                key: 'passRate',
                render: (percent) => (
                    <Tooltip title={`${percent}% Success Rate`}>
                        <Progress
                            percent={percent}
                            size="small"
                            status={
                                percent > 90
                                    ? 'success'
                                    : percent > 70
                                      ? 'normal'
                                      : 'exception'
                            }
                        />
                    </Tooltip>
                ),
                sorter: (a, b) => a.passRate - b.passRate,
            },
        ];

        return (
            <div style={{ padding: '10px' }}>
                <Table
                    columns={columns}
                    dataSource={tableData}
                    pagination={false}
                    size="middle"
                    loading={loading}
                />
            </div>
        );
    }
}
