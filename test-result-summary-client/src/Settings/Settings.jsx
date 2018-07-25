import React, { Component } from 'react';
import { Button, Table, Input, Icon, Popconfirm, Dropdown, Menu, message } from 'antd';
import './settings.css';

class EditableCell extends Component {
    state = {
        value: this.props.value,
        editable: false,
    }

    handleChange = ( e ) => {
        const value = e.target.value;
        this.setState( { value } );
    }

    check = () => {
        this.setState( { editable: false } );
        if ( this.props.onChange ) {
            this.props.onChange( this.state.value );
        }
    }

    edit = () => {
        this.setState( { editable: true } );
    }

    render() {
        const { value, editable } = this.state;
        return (
            <div className="editable-cell">
                {
                    editable ?
                        <div className="editable-cell-input-wrapper">
                            <Input
                                value={value}
                                onChange={this.handleChange}
                                onPressEnter={this.check}
                            />
                            <Icon
                                type="check"
                                className="editable-cell-icon-check"
                                onClick={this.check}
                            />
                        </div>
                        :
                        <div className="editable-cell-text-wrapper">
                            {value || ' '}
                            <Icon
                                type="edit"
                                className="editable-cell-icon"
                                onClick={this.edit}
                            />
                        </div>
                }
            </div>
        );
    }
}

export default class Settings extends Component {
    state = { data: [] };

    async componentDidMount() {
        const response = await fetch( `/api/getBuildList`, {
            method: 'get'
        } );

        const results = await response.json();
        if ( results && results.length > 0 ) {
            const data = results.map(( info, i ) => {
                return {
                    key: i,
                    _id: info._id,
                    buildUrl: info.buildUrl,
                    type: info.type
                };
            } )
            this.setState( { data } );
            this.cacheData = data.map( item => ( { ...item } ) );
        }
    }
    onCellChange = ( key, dataIndex ) => {
        return ( value ) => {
            const { data } = this.state;
            const target = data.find( item => item.key === key );
            if ( target ) {
                target[dataIndex] = value;
                this.setState( { data } );
            }
        };
    }

    onDelete = async ( key ) => {
        const { data } = this.state;
        const target = data.find( item => item.key === key );
        if ( target && target._id ) {
            const response = await fetch( `/api/deleteBuildListById?_id=${target._id}`, {
                method: 'get'
            } );
            const results = await response.json();
        }
        this.setState( { data: data.filter( item => item.key !== key ) } );
    }

    handleAdd = () => {
        const { data } = this.state;
        const newData = {
            key: data ? data.length : 0,
            buildUrl: "",
        };
        this.setState( {
            data: [...data, newData]
        } );
    }

    handleSubmit = async () => {
        const { data } = this.state;
        if ( data && data.length > 0 ) {
            let invalidRow = null;
            for ( let i = 0; i < data.length; i++ ) {
                if ( !data[i].buildUrl || !data[i].type ) {
                    invalidRow = i;
                    break;
                }
            }
            if ( !invalidRow ) {
                const postData = {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify( { data } ),
                }

                const upsertBuildList = await fetch( `/api/upsertBuildList`, postData );
                const result = await upsertBuildList.json();
                message.info( 'Data Submitted!' );
            } else {
                const row = invalidRow + 1;
                message.info( `Invalid data at Row ${row}!` );
            }
        }
    }

    handleTypeClick = ( record, e ) => {
        const { data } = this.state;
        if ( data && data.length > record.key ) {
            data[record.key].type = e.key;
            this.setState( data );
        }
    }

    render() {
        const { data } = this.state;
        if ( data ) {
            const columns = [{
                title: 'Build URL',
                dataIndex: 'buildUrl',
                width: '70%',
                render: ( text, record ) => (
                    <EditableCell
                        value={text}
                        onChange={this.onCellChange( record.key, 'buildUrl' )}
                    />
                ),
            }, {
                title: 'Build Type',
                dataIndex: 'type',
                render: ( text, record ) => {
                    const menu = (
                        <Menu onClick={this.handleTypeClick.bind( null, record )}>
                            <Menu.Item key="FVT">FVT</Menu.Item>
                            <Menu.Item key="JCK">JCK</Menu.Item>
                            <Menu.Item key="Perf">Perf</Menu.Item>
                        </Menu>
                    );
                    return (
                        <Dropdown overlay={menu}>
                            <Button style={{ marginLeft: 8 }}>
                                {text ? text : "Type"} <Icon type="down" />
                            </Button>
                        </Dropdown>
                    );
                }
            }, {
                title: 'Action',
                dataIndex: 'action',
                render: ( text, record ) => {
                    return (
                        this.state.data.length > 0 ?
                            (
                                <Popconfirm title="Sure to delete?" onConfirm={() => this.onDelete( record.key )}>
                                    <a href="#">Delete</a>
                                </Popconfirm>
                            ) : null
                    );
                },
            }];

            return (
                <div>
                    <Table
                        bordered
                        dataSource={data}
                        columns={columns}
                        title={() => <b>Build Monitoring List</b>}
                        pagination={false}
                    />
                    <div align="right">
                        <Button type="primary" onClick={this.handleAdd} >Add Row</Button>
                        <div className="divider" />
                        <Button type="primary" onClick={this.handleSubmit} >Submit</Button>
                    </div>
                </div>
            );
        }
    }
}
