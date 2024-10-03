import React, { useState, useEffect, useContext, useRef } from 'react';
import { EditOutlined } from '@ant-design/icons';
import { Form } from '@ant-design/compatible';
import { Table, Input } from 'antd';
import { params } from '../utils/query';
import { Link } from 'react-router-dom';
import { fetchData } from '../utils/Utils';

const EditableContext = React.createContext();

const EditableRow = ({ form, index, ...props }) => (
    <EditableContext.Provider value={form}>
        <tr {...props} />
    </EditableContext.Provider>
);

const EditableFormRow = Form.create()(EditableRow);

const EditableCell = ({
    editable,
    dataIndex,
    title,
    record,
    index,
    handleSave,
    inputRef,
    children,
    ...restProps
}) => {
    const [editing, setEditing] = useState(false);
    const form = useContext(EditableContext);

    useEffect(() => {
        if (editing) {
            inputRef.current.focus();
        }
    }, [editing]);

    const toggleEdit = () => {
        setEditing(!editing);
    };

    const save = (e) => {
        if (e.key === 'Enter' && e.shiftKey) {
            return;
        }
        form.validateFields((error, values) => {
            if (error && error[e.currentTarget.id]) {
                return;
            }
            toggleEdit();
            handleSave({ ...record, ...values });
        });
    };

    const renderCell = () => {
        return editing ? (
            <Form>
                <Form.Item style={{ margin: 0 }}>
                    {form.getFieldDecorator(dataIndex, {
                        rules: [
                            {
                                message: `${title} is required.`,
                            },
                        ],
                        initialValue: record[dataIndex],
                    })(
                        <Input
                            style={{ width: 250 }}
                            ref={inputRef}
                            onPressEnter={save}
                            onBlur={save}
                        />
                    )}
                </Form.Item>
            </Form>
        ) : (
            <div
                className="editable-cell-value-wrap"
                style={{ paddingRight: 24 }}
                onClick={toggleEdit}
            >
                {children}
            </div>
        );
    };

    return <td {...restProps}>{editable ? renderCell() : children}</td>;
};

const BuildTable = ({ title, buildData }) => {
    const [data, setData] = useState(buildData);
    const inputRef = useRef(null);

    useEffect(() => {
        setData(buildData);
    }, [buildData]);

    const handleSave = async (row) => {
        const newData = [...data];
        const index = newData.findIndex((item) => row.key === item.key);
        const item = newData[index];
        newData.splice(index, 1, {
            ...item,
            ...row,
        });

        // update comments in database
        await fetchData(
            `/api/updateComments${params({
                _id: row.buildData._id,
                comments: row.comments,
            })}`,
            {
                method: 'get',
            }
        );
        setData(newData);
    };

    if (!data) return null;

    const components = {
        body: {
            row: EditableFormRow,
            // pass in the ref to the input
            cell: (props) => <EditableCell {...props} inputRef={inputRef} />,
        },
    };

    const renderJenkinsBuild = ({
        buildName,
        buildNum,
        buildUrl,
        url,
    } = {}) => {
        // Temporarily support BlueOcean link under folders
        let blueOcean;
        if (`${url}`.includes('/jobs') || `${url}`.includes('/build-scripts')) {
            let urls = url.split('/job/');
            let basicUrl = urls.shift();
            urls.push(buildName);
            let newUrl = urls.join('%2F');
            blueOcean = `${basicUrl}/blue/organizations/jenkins/${newUrl}/detail/${buildName}/${buildNum}`;
        } else {
            blueOcean = `${url}/blue/organizations/jenkins/${buildName}/detail/${buildName}/${buildNum}`;
        }
        return (
            <div>
                <a href={buildUrl} target="_blank" rel="noopener noreferrer">
                    {buildName} #{buildNum}
                </a>
                <br />
                <a href={blueOcean} target="_blank" rel="noopener noreferrer">
                    Blue Ocean
                </a>
            </div>
        );
    };

    const renderBuildName = (value, row, index) => {
        const resultColor =
            value.buildResult === 'SUCCESS'
                ? '#2cbe4e'
                : value.buildResult === 'FAILURE'
                ? '#f50'
                : '#DAA520';
        if (value.type === 'Build') {
            if (value.hasChildren) {
                return (
                    <Link
                        to={{
                            pathname: '/buildDetail',
                            search: params({ parentId: value._id }),
                        }}
                        style={{ color: resultColor }}
                    >
                        {' '}
                        {value.buildName}{' '}
                    </Link>
                );
            } else {
                return (
                    <Link
                        to={{
                            pathname: '/output/build',
                            search: params({ id: value._id }),
                        }}
                        style={{ color: resultColor }}
                    >
                        {' '}
                        {value.buildName}{' '}
                    </Link>
                );
            }
        }
        let limit = 1;
        if (value.type === 'Perf') {
            limit = 1;
        }
        return (
            <Link
                to={{
                    pathname: '/allTestsInfo',
                    search: params({ buildId: value._id, limit: limit }),
                }}
                style={{ color: resultColor }}
            >
                {' '}
                {value.buildName}{' '}
            </Link>
        );
    };

    const renderResult = ({ _id, buildResult }) => {
        return (
            <Link
                to={{
                    pathname: '/output/build',
                    search: params({ id: _id }),
                }}
                style={{
                    color:
                        buildResult === 'SUCCESS'
                            ? '#2cbe4e'
                            : buildResult === 'FAILURE'
                            ? '#f50'
                            : '#DAA520',
                }}
            >
                {buildResult}
            </Link>
        );
    };

    const renderResultDetail = (testSummary) => {
        let resultDetail = 'n/a';
        if (testSummary) {
            resultDetail = `Failed: ${testSummary.failed} / Passed: ${testSummary.passed} / Executed: ${testSummary.executed} / Disabled: ${testSummary.disabled} / Skipped: ${testSummary.skipped} / Total: ${testSummary.total}`;
        }
        return resultDetail;
    };

    const childBuildsColumns = [
        {
            title: 'Build Name',
            dataIndex: 'buildData',
            key: 'buildData',
            render: renderBuildName,
            sorter: (a, b) => {
                return a.buildData.buildName.localeCompare(
                    b.buildData.buildName
                );
            },
        },
        {
            title: 'Result',
            dataIndex: 'result',
            key: 'result',
            render: renderResult,
            width: 100,
            filters: [
                {
                    text: 'FAILURE',
                    value: 'FAILURE',
                },
                {
                    text: 'SUCCESS',
                    value: 'SUCCESS',
                },
                {
                    text: 'UNSTABLE',
                    value: 'UNSTABLE',
                },
                {
                    text: 'ABORTED',
                    value: 'ABORTED',
                },
            ],
            onFilter: (value, record) => {
                const res = record.result;
                return res.buildResult
                    ? res.buildResult.indexOf(value) === 0
                    : false;
            },
        },
        {
            title: 'Result Detail',
            dataIndex: 'resultDetail',
            key: 'resultDetail',
            render: renderResultDetail,
        },
        {
            title: 'Jenkins',
            dataIndex: 'jenkinsBuild',
            key: 'jenkinsBuild',
            render: renderJenkinsBuild,
            sorter: (a, b) => {
                const nameA =
                    a.jenkinsBuild.buildName + a.jenkinsBuild.buildNum;
                const nameB =
                    b.jenkinsBuild.buildName + b.jenkinsBuild.buildNum;
                return nameA.localeCompare(nameB);
            },
        },
        {
            title: 'Date',
            dataIndex: 'date',
            key: 'date',
            sorter: (a, b) => {
                return a.date.localeCompare(b.date);
            },
        },
        {
            title: 'Comments',
            dataIndex: 'comments',
            key: 'comments',
            editable: true,
            render: (comments) => (
                <div style={{ cursor: 'pointer' }}>
                    {comments}
                    <EditOutlined />
                </div>
            ),
        },
    ];

    const columns = childBuildsColumns.map((col) => {
        if (!col.editable) {
            return col;
        }
        return {
            ...col,
            onCell: (record) => ({
                record,
                editable: col.editable,
                dataIndex: col.dataIndex,
                title: col.title,
                inputRef: inputRef,
                handleSave: handleSave,
            }),
        };
    });

    return (
        <Table
            components={components}
            columns={columns}
            title={() => title}
            dataSource={data}
            pagination={{ pageSize: 20 }}
            bordered
        />
    );
};

export default BuildTable;
