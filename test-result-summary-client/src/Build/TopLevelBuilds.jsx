import React, { Component } from 'react';
import { LocaleProvider, Table } from 'antd';
import enUS from 'antd/lib/locale-provider/en_US';
import { Link } from 'react-router-dom';
import { params } from '../utils/query';

export default class TopLevelBuilds extends Component {
    state = {};

    async componentDidMount() {
        await this.updateData( this.props.match.params.type );
        this.intervalId = setInterval(() => {
            this.updateData( this.props.match.params.type );
        }, 30 * 1000 );

    }
    async componentWillReceiveProps( nextProps ) {
        if ( nextProps.match.params.type !== this.props.match.params.type ) {
            await this.updateData( nextProps.match.params.type );
        }
    }

    componentWillUnmount() {
        clearInterval( this.intervalId );
    }

    async updateData( type ) {
        const builds = [];
        if ( type === "Perf" ) {
            const response = await fetch( `/api/getTopLevelFlatBuildNames?type=${type}`, {
                method: 'get'
            } );
            const results = await response.json();
            for ( let i = 0; i < results.length; i++ ) {
                const fetchBuild = await fetch( `/api/getBuildHistory?buildName=${results[i]._id.buildName}`, {
                    method: 'get'
                } );
                const res = await fetchBuild.json();
                builds.push( res );
            }

        } else {
            const response = await fetch( `/api/getTopLevelBuildNames?type=${type}`, {
                method: 'get'
            } );
            const results = await response.json();
            for ( let i = 0; i < results.length; i++ ) {
                const fetchBuild = await fetch( `/api/getBuildHistory?buildName=${results[i]._id.buildName}`, {
                    method: 'get'
                } );
                const res = await fetchBuild.json();
                builds.push( res );
            }
        }
        this.setState( { builds, type } );
    }

    render() {
        const { builds, type } = this.state;

        if ( builds && type ) {
            const renderFvTestBuild = ( value, row, index ) => {
                if ( value && value.buildNum ) {
                    return <div>
                        <Link to={{ pathname: '/buildDetail', search: params( { parentId: value._id } ) }}
                            style={{ color: value.buildResult === "SUCCESS" ? "#2cbe4e" : ( value.buildResult === "FAILURE" ? "#f50" : "#DAA520" ) }}> Build #{value.buildNum}
                        </Link>
                    </div>
                }
                return null;
            };

            const renderBuild = ( value, row, index ) => {
                if ( value && value.buildNum ) {
                    let result = value.buildResult;
                    if ( value.tests && value.tests.length > 0 ) {
                        result = value.tests[0].testResult;
                        if ( value.tests[0]._id ) {
                            return <div>
                                <Link to={{ pathname: '/output/test', search: params( { id: value.tests[0]._id } ) }}
                                    style={{ color: result === "PASSED" ? "#2cbe4e" : ( result === "FAILED" ? "#f50" : "#DAA520" ) }}>
                                    Build #{value.buildNum}
                                </Link>
                            </div>;
                        }
                    } else {
                        return <div>
                            <Link to={{ pathname: '/output/all', search: params( { id: value._id } ) }}
                                style={{ color: result === "SUCCESS" ? "#2cbe4e" : ( result === "FAILURE" ? "#f50" : "#DAA520" ) }}>
                                Build #{value.buildNum}
                            </Link>
                        </div>;
                    }
                }
                return null;
            };

            const renderJenkinsLinks = ( { buildName, buildNum, buildUrl, url } ) => {
                const blueOcean = `${url}/blue/organizations/jenkins/${buildName}/detail/${buildName}/${buildNum}`;
                return <div><a href={buildUrl} target="_blank">{buildName} #{buildNum}</a><br /><a href={blueOcean} target="_blank">Blue Ocean</a></div>;
            };

            const columns = [{
                title: 'Build',
                dataIndex: 'build',
                key: 'build',
                render: type === "Perf" ? renderBuild : renderFvTestBuild,
                sorter: ( a, b ) => {
                    return a.key.localeCompare( b.key );
                }
            }, {
                title: 'StartBy',
                dataIndex: 'startBy',
                key: 'startBy',
                sorter: ( a, b ) => {
                    return a.startBy.localeCompare( b.startBy );
                }
            }, {
                title: 'Jenkins Link',
                dataIndex: 'jenkins',
                key: 'jenkins',
                render: renderJenkinsLinks,
            }, {
                title: 'Date',
                dataIndex: 'date',
                key: 'date',
                sorter: ( a, b ) => {
                    return a.date.localeCompare( b.date );
                }
            }];

            const dataSource = {};

            builds.map( build => {
                build.map(( info, j ) => {
                    if ( !dataSource[info.buildName] ) {
                        dataSource[info.buildName] = [];
                    }
                    dataSource[info.buildName].push( {
                        key: info.buildName + j,
                        build: { ...info },
                        date: info.timestamp ? new Date( info.timestamp ).toLocaleString() : null,
                        startBy: info.startBy ? info.startBy : null,
                        jenkins: { buildName: info.buildName, buildNum: info.buildNum, buildUrl: info.buildUrl, url: info.url }
                    } );
                } )
            } );
            return ( <LocaleProvider locale={enUS}>
                <div>
                    {builds.map(( build, i ) => {
                        return <Table
                            key={i}
                            columns={columns}
                            dataSource={dataSource[build[0].buildName]}
                            bordered
                            title={() => <b>{build[0].buildName}</b>}
                        />
                    } )}
                </div>
            </LocaleProvider> );
        } else {
            return null;
        }
    }
}
