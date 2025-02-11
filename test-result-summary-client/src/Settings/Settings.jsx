import React, { Component } from 'react';
import { CheckOutlined, DownOutlined, EditOutlined } from '@ant-design/icons';
import {
    Button,
    Table,
    Input,
    Popconfirm,
    Dropdown,
    message,
    Spin,
} from 'antd';
import { fetchData } from '../utils/Utils';
import './settings.css';

class EditableCell extends Component {
    state = {
        value: this.props.value,
        editable: false,
    };

    handleChange = (e) => {
        const value = e.target.value;
        this.setState({ value });
    };

    check = () => {
        this.setState({ editable: false });
        if (this.props.onChange) {
            this.props.onChange(this.state.value);
        }
    };

    edit = () => {
        this.setState({ editable: true });
    };

    render() {
        const { value, editable } = this.state;
        return (
            <div className="editable-cell">
                {editable ? (
                    <div className="editable-cell-input-wrapper">
                        <Input
                            value={value}
                            onChange={this.handleChange}
                            onPressEnter={this.check}
                        />
                        <CheckOutlined
                            className="editable-cell-icon-check"
                            onClick={this.check}
                        />
                    </div>
                ) : (
                    <div className="editable-cell-text-wrapper">
                        {value || ' '}
                        <EditOutlined
                            className="editable-cell-icon"
                            onClick={this.edit}
                        />
                    </div>
                )}
            </div>
        );
    }
}

export default class Settings extends Component {
    state = {
        data: [],
        loading: false,
    };

    async componentDidMount() {
        const results = await fetchData(`/api/getBuildList`);
        if (results && results.length > 0) {
            const data = results.map((info, i) => {
                return {
                    key: i,
                    ...info,
                };
            });
            this.setState({ data });
            this.cacheData = data.map((item) => ({ ...item }));
        }
    }
    onCellChange = (key, dataIndex) => {
        return (value) => {
            const { data } = this.state;
            const target = data.find((item) => item.key === key);
            if (target) {
                target[dataIndex] = value;
                this.setState({ data });
            }
        };
    };

    onDelete = async (record) => {
        const { data } = this.state;
        const target = data.find((item) => item.key === record.key);

        if (target && target._id) {
            this.setState({ loading: true });
            await this.deleteBuilds(record);
            this.setState({ loading: false });
        }

        this.setState({ data: data.filter((item) => item.key !== record.key) });
    };

    deleteBuilds = async (record) => {
        // delete URL from monitor list
        await fetchData(`/api/deleteBuildListById?_id=${record._id}`);

        // delete build data from database
        const fetchDeleteBuildData = await fetch(
            `/api/deleteBuildData?buildUrl=${record.buildUrl}`,
            {
                method: 'get',
            }
        );
        const deleteResponse = await fetchDeleteBuildData.json();

        if (fetchDeleteBuildData.status === 400) {
            message.error(deleteResponse.message);
        } else if (fetchDeleteBuildData.status === 200) {
            message.success(`${deleteResponse.length} builds are deleted`);
        }
    };

    handleAdd = () => {
        const { data } = this.state;
        const newData = {
            key: data ? data.length : 0,
            buildUrl: '',
            numBuildsToKeep: 10,
            monitoring: 'Yes',
        };
        this.setState({
            data: [...data, newData],
        });
    };

    handleSubmit = async () => {
        const { data } = this.state;
        if (data && data.length > 0) {
            let buildUrls = [];
            let invalidRow = null;
            for (let i = 0; i < data.length; i++) {
                invalidRow = i + 1;
                if (!data[i].buildUrl) {
                    message.error(
                        `Please provide a Build URL at Row ${invalidRow} and click the check mark!`
                    );
                    return;
                }
                if (buildUrls.includes(data[i].buildUrl)) {
                    const formerRow = buildUrls.indexOf(data[i].buildUrl) + 1;
                    message.error(
                        `Duplicate Build URL found at Row ${formerRow} and ${invalidRow}`
                    );
                    return;
                }
                if (!data[i].type) {
                    message.error(
                        `Please choose a Build Type at Row ${invalidRow}!`
                    );
                    return;
                }
                if (
                    !data[i].numBuildsToKeep ||
                    !parseInt(data[i].numBuildsToKeep) ||
                    parseInt(data[i].numBuildsToKeep) < 0
                ) {
                    message.error(
                        `Invalid # of Builds To Keep at Row ${invalidRow}! ${data[i].numBuildsToKeep}`
                    );
                    return;
                }
                buildUrls.push(data[i].buildUrl);

                data[i].numBuildsToKeep = parseInt(data[i].numBuildsToKeep, 10);
            }

            const postData = {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ data }),
            };

            const upsertBuildList = await fetch(
                `/api/upsertBuildList`,
                postData
            );
            await upsertBuildList.json();
            message.info('Data Submitted!');
        }
    };

    handleTypeClick = (record, e, type) => {
        const { data } = this.state;
        if (data && data.length > record.key) {
            data[record.key][type] = e.key;
            this.setState(data);
        }
    };

    render() {
        const { data } = this.state;
        if (data) {
            const columns = [
                {
                    title: 'Build URL',
                    dataIndex: 'buildUrl',
                    width: '70%',
                    render: (text, record) => (
                        <EditableCell
                            value={text}
                            onChange={this.onCellChange(record.key, 'buildUrl')}
                        />
                    ),
                },
                {
                    title: 'Build Type',
                    dataIndex: 'type',
                    render: (text, record) => {
                        return (
                            <Dropdown
                                menu={{
                                    onClick: (e) =>
                                        this.handleTypeClick(record, e, 'type'),
                                    items: [
                                        {
                                            key: 'FVT',
                                            label: 'FVT',
                                            value: 'FVT',
                                        },
                                        {
                                            key: 'Perf',
                                            label: 'Perf',
                                            value: 'Perf',
                                        },
                                    ],
                                }}
                            >
                                <Button style={{ marginLeft: 8 }}>
                                    {text ? text : 'Type'} <DownOutlined />
                                </Button>
                            </Dropdown>
                        );
                    },
                },
                {
                    title: 'Streaming',
                    dataIndex: 'streaming',
                    render: (text, record) => {
                        return (
                            <Dropdown
                                menu={{
                                    onClick: (e) =>
                                        this.handleTypeClick(
                                            record,
                                            e,
                                            'streaming'
                                        ),
                                    items: [
                                        {
                                            key: 'No',
                                            label: 'No',
                                            value: 'No',
                                        },
                                        {
                                            key: 'Yes',
                                            label: 'Yes',
                                            value: 'Yes',
                                        },
                                    ],
                                }}
                            >
                                <Button style={{ marginLeft: 8 }}>
                                    {text ? text : 'No'} <DownOutlined />
                                </Button>
                            </Dropdown>
                        );
                    },
                },
                {
                    title: 'Monitoring',
                    dataIndex: 'monitoring',
                    render: (text, record) => {
                        return (
                            <Dropdown
                                menu={{
                                    onClick: (e) =>
                                        this.handleTypeClick(
                                            record,
                                            e,
                                            'monitoring'
                                        ),
                                    items: [
                                        {
                                            key: 'No',
                                            label: 'No',
                                            value: 'No',
                                        },
                                        {
                                            key: 'Yes',
                                            label: 'Yes',
                                            value: 'Yes',
                                        },
                                    ],
                                }}
                            >
                                <Button style={{ marginLeft: 8 }}>
                                    {text ? text : 'Yes'} <DownOutlined />
                                </Button>
                            </Dropdown>
                        );
                    },
                },
                {
                    title: '# of Builds to Keep ',
                    dataIndex: 'numBuildsToKeep',
                    width: '10%',
                    render: (text, record) => {
                        return (
                            <EditableCell
                                value={text}
                                onChange={this.onCellChange(
                                    record.key,
                                    'numBuildsToKeep'
                                )}
                            />
                        );
                    },
                },
                {
                    title: 'Action',
                    dataIndex: 'action',
                    render: (text, record) => {
                        return this.state.data.length > 0 ? (
                            <Popconfirm
                                title="Delete it from view and Database?"
                                okText="Delete"
                                cancelText="Cancel"
                                okButtonProps={{ type: 'default' }}
                                cancelButtonProps={{ type: 'primary' }}
                                onConfirm={() => this.onDelete(record)}
                            >
                                <Button>Delete</Button>
                            </Popconfirm>
                        ) : null;
                    },
                },
            ];

            return (
                <div>
                    <Spin spinning={this.state.loading}>
                        <Table
                            bordered
                            dataSource={data}
                            columns={columns}
                            title={() => <b>Build Monitoring List</b>}
                            pagination={false}
                        />
                        <div align="right">
                            <Button type="primary" onClick={this.handleAdd}>
                                Add Row
                            </Button>
                            <div className="divider" />
                            <Button type="primary" onClick={this.handleSubmit}>
                                Submit
                            </Button>
                        </div>
                    </Spin>
                </div>
            );
        }
    }
}
