import React, { Component } from 'react';
import { CheckOutlined, DownOutlined, EditOutlined, GithubOutlined } from '@ant-design/icons';
import { Button, Table, Input, Popconfirm, Dropdown, Menu, message } from 'antd';
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
                            <CheckOutlined className="editable-cell-icon-check" onClick={this.check} />
                        </div>
                        :
                        <div className="editable-cell-text-wrapper">
                            {value || ' '}
                            <EditOutlined className="editable-cell-icon" onClick={this.edit} />
                        </div>
                }
            </div>
        );
    }
}

export default class Settings extends Component {
    state = { 
        data: [],
        isLoggedIn: false, 
    };

    async componentDidMount() {
        const fetchLoginStatus = await fetch(`/api/user/status`, {
            method: 'GET',
            credentials: 'include',  
          });
        const result = await fetchLoginStatus.json();

        if (result.isLoggedIn) {
            const response = await fetch( `/api/getBuildList`, {
                method: 'get'
            } );

            const results = await response.json();
            if ( results && results.length > 0 ) {
                const data = results.map(( info, i ) => {
                    return {
                        key: i,
                        ...info
                    };
                } )
                this.setState( { 
                    data,
                    isLoggedIn: true,
                 } );
                this.cacheData = data.map( item => ( { ...item } ) );
            }
        } else {
            this.setState({
                isLoggedIn: false,
            })
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
            await response.json();
        }
        this.setState( { data: data.filter( item => item.key !== key ) } );
    }

    handleAdd = () => {
        const { data } = this.state;
        const newData = {
            key: data ? data.length : 0,
            buildUrl: "",
            numBuildsToKeep: 10
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
                invalidRow = i + 1;
                if ( !data[i].buildUrl ) {
                    message.info( `Please provide a Build URL at Row ${invalidRow} and click the check mark!` );
                    return;
                }
                if ( !data[i].type ) {
                    message.info( `Please choose a Build Type at Row ${invalidRow}!` );
                    return;
                }
                if ( !data[i].numBuildsToKeep || !parseInt( data[i].numBuildsToKeep ) || parseInt( data[i].numBuildsToKeep ) < 0 ) {
                    message.info( `Invalid # of Builds To Keep at Row ${invalidRow}! ${data[i].numBuildsToKeep}` );
                    return;
                }

                data[i].numBuildsToKeep = parseInt( data[i].numBuildsToKeep, 10 );
            }

            const postData = {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify( { data } ),
            }

            const upsertBuildList = await fetch( `/api/upsertBuildList`, postData );
            await upsertBuildList.json();
            message.info( 'Data Submitted!' );

        }
    }

    handleTypeClick = ( record, e ) => {
        const { data } = this.state;
        if ( data && data.length > record.key ) {
            data[record.key].type = e.key;
            this.setState( data );
        }
    }

    handleStreamingClick = ( record, e ) => {
        const { data } = this.state;
        if ( data && data.length > record.key ) {
            data[record.key].streaming = e.key;
            this.setState( data );
        }
    }

    render() {
        const { data, isLoggedIn } = this.state;
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
                                {text ? text : "Type"} <DownOutlined />
                            </Button>
                        </Dropdown>
                    );
                }
            }, {
                title: 'Streaming',
                dataIndex: 'streaming',
                render: ( text, record ) => {
                    const menu = (
                        <Menu onClick={this.handleStreamingClick.bind( null, record )}>
                            <Menu.Item key="No">No</Menu.Item>
                            <Menu.Item key="Yes">Yes</Menu.Item>
                        </Menu>
                    );
                    return (
                        <Dropdown overlay={menu}>
                            <Button style={{ marginLeft: 8 }}>
                                {text ? text : "No"} <DownOutlined />
                            </Button>
                        </Dropdown>
                    );
                }
            },{
                title: '# of Builds to Keep ',
                dataIndex: 'numBuildsToKeep',
                width: '10%',
                render: ( text, record ) => {
                    return (
                        <EditableCell
                            value={text}
                            onChange={this.onCellChange( record.key, 'numBuildsToKeep' )}
                        />
                    )
                },
            }, {
                title: 'Action',
                dataIndex: 'action',
                render: ( text, record ) => {
                    return (
                        this.state.data.length > 0 ?
                            (
                                <Popconfirm title="Sure to delete?" onConfirm={() => this.onDelete( record.key )}>
                                    <Button>Delete</Button>
                                </Popconfirm>
                            ) : null
                    );
                },
            }];

            if (!isLoggedIn) {
                return (
                <a href='https://github.com/login/oauth/authorize?client_id=c5ab64f68ab33409e874&scope=repo+user'>
                <Button size="large">
                    <GithubOutlined />Login
                </Button>  
                </a> );
            } else {
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
}
