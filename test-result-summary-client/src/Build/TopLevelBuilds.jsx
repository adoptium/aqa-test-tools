import React, { Component } from 'react';
import { Table } from 'antd';
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
        const builds = {};

        const response = await fetch(`/api/getTopLevelBuildNames?type=${type}`, {
            method: 'get'
        });
        const results = await response.json();
        for (let i = 0; i < results.length; i++) {
            const url = results[i]._id.url;
            const buildName = results[i]._id.buildName;
            const fetchBuild = await fetch(`/api/getBuildHistory?buildName=${buildName}&url=${url}`, {
                method: 'get'
            });
            const res = await fetchBuild.json();
            if (!builds[url]) {
                builds[url] = {};
            }
            builds[url][buildName] = res;
        }
        this.setState({ builds, type });
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

            return (
                <div>
                    {Object.values(builds).map((urls, i) => {
                        return Object.values(urls).map((infos, i) => {
                            const buildInfo = infos.map(info => ({
                                key: info.buildUrl,
                                build: info,
                                date: info.timestamp ? new Date(info.timestamp).toLocaleString() : null,
                                startBy: info.startBy ? info.startBy : null,
                                jenkins: info
                            }));
                            return <Table
                                key={i}
                                columns={columns}
                                dataSource={buildInfo}
                                bordered
                                title={() => <div><b>{buildInfo[0].build.buildName}</b> in server {buildInfo[0].build.url}</div>}
                            />
                        })
                    })}
                </div>);
        } else {
            return null;
        }
    }
}
