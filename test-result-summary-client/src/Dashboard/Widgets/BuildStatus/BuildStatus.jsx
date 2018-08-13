import React, { Component } from 'react';
import { Icon, Checkbox, Table, Tooltip, Input } from 'antd';
import ServerSelector from "./ServerSelector";
import Highlighter from 'react-highlight-words';

const map = {
    InternalJenkins: {
        url: "https://customJenkinsServer",
        builds: [
            "Daily-ODM",
            "Daily-SPECjbb2015",
            "Daily-Liberty-DayTrader3",
            "daily_openjdk8_j9_jcktest_ppc64le_linux",
            "daily_openjdk8_j9_jcktest_x86-64_linux",
            "daily_openjdk9_j9_jcktest_ppc64le_linux",
            "daily_openjdk9_j9_jcktest_x86-64_linux",
        ],
        default: [
            "daily_openjdk8_j9_jcktest_ppc64le_linux",
            "daily_openjdk8_j9_jcktest_x86-64_linux",
            "daily_openjdk9_j9_jcktest_ppc64le_linux",
            "daily_openjdk9_j9_jcktest_x86-64_linux",
        ]
    },
    OpenJ9: {
        url: "https://ci.eclipse.org/openj9/",
        builds: [
            "Pipeline-Build-Test-All",
            "Pipeline-Build-Test-JDK8-linux_390-64_cmprssptrs",
            "Pipeline-Build-Test-JDK8-linux_ppc-64_cmprssptrs_le",
            "Test-extended.functional-JDK8-aix_ppc-64_cmprssptrs",
            "Test-extended.functional-JDK8-linux_390-64_cmprssptrs",
            "Test-extended.functional-JDK8-linux_ppc-64_cmprssptrs_le",
            "Test-extended.functional-JDK8-linux_x86-64",
            "Test-extended.functional-JDK8-linux_x86-64_cmprssptrs",
            "Test-extended.functional-JDK8-win_x86-64_cmprssptrs",
            "Test-extended.functional-JDK10-aix_ppc-64_cmprssptrs",
            "Test-extended.functional-JDK10-linux_390-64_cmprssptrs",
            "Test-extended.functional-JDK10-linux_ppc-64_cmprssptrs_le",
            "Test-extended.functional-JDK10-linux_x86-64",
            "Test-extended.functional-JDK10-linux_x86-64_cmprssptrs",
            "Test-extended.functional-JDK10-win_x86-64_cmprssptrs",
            "Test-extended.system-JDK8-aix_ppc-64_cmprssptrs",
            "Test-extended.system-JDK8-linux_390-64_cmprssptrs",
            "Test-extended.system-JDK8-linux_ppc-64_cmprssptrs_le",
            "Test-extended.system-JDK8-linux_x86-64",
            "Test-extended.system-JDK8-linux_x86-64_cmprssptrs",
            "Test-extended.system-JDK8-win_x86-64_cmprssptrs",
            "Test-extended.system-JDK10-aix_ppc-64_cmprssptrs",
            "Test-extended.system-JDK10-linux_390-64_cmprssptrs",
            "Test-extended.system-JDK10-linux_ppc-64_cmprssptrs_le",
            "Test-extended.system-JDK10-linux_x86-64",
            "Test-extended.system-JDK10-linux_x86-64_cmprssptrs",
            "Test-extended.system-JDK10-win_x86-64_cmprssptrs",
            "Test-sanity.functional-JDK8-aix_ppc-64_cmprssptrs",
            "Test-sanity.functional-JDK8-linux_390-64_cmprssptrs",
            "Test-sanity.functional-JDK8-linux_ppc-64_cmprssptrs_le",
            "Test-sanity.functional-JDK8-linux_x86-64",
            "Test-sanity.functional-JDK8-linux_x86-64_cmprssptrs",
            "Test-sanity.functional-JDK8-win_x86-64_cmprssptrs",
            "Test-sanity.functional-JDK10-aix_ppc-64_cmprssptrs",
            "Test-sanity.functional-JDK10-linux_390-64_cmprssptrs",
            "Test-sanity.functional-JDK10-linux_ppc-64_cmprssptrs_le",
            "Test-sanity.functional-JDK10-linux_x86-64",
            "Test-sanity.functional-JDK10-linux_x86-64_cmprssptrs",
            "Test-sanity.functional-JDK10-win_x86-64_cmprssptrs",
            "Test-sanity.system-JDK8-aix_ppc-64_cmprssptrs",
            "Test-sanity.system-JDK8-linux_390-64_cmprssptrs",
            "Test-sanity.system-JDK8-linux_ppc-64_cmprssptrs_le",
            "Test-sanity.system-JDK8-linux_x86-64",
            "Test-sanity.system-JDK8-linux_x86-64_cmprssptrs",
            "Test-sanity.system-JDK8-win_x86-64_cmprssptrs",
            "Test-sanity.system-JDK10-aix_ppc-64_cmprssptrs",
            "Test-sanity.system-JDK10-linux_390-64_cmprssptrs",
            "Test-sanity.system-JDK10-linux_ppc-64_cmprssptrs_le",
            "Test-sanity.system-JDK10-linux_x86-64",
            "Test-sanity.system-JDK10-linux_x86-64_cmprssptrs",
            "Test-sanity.system-JDK10-win_x86-64_cmprssptrs",
        ],
        default: [
            "Pipeline-Build-Test-All",
            "Test-sanity.functional-JDK8-aix_ppc-64_cmprssptrs",
            "Test-sanity.functional-JDK8-linux_390-64_cmprssptrs",
            "Test-sanity.functional-JDK8-linux_ppc-64_cmprssptrs_le",
            "Test-sanity.functional-JDK8-linux_x86-64",
            "Test-sanity.functional-JDK8-linux_x86-64_cmprssptrs",
            "Test-sanity.functional-JDK8-win_x86-64_cmprssptrs",
            "Test-sanity.functional-JDK10-aix_ppc-64_cmprssptrs",
            "Test-sanity.functional-JDK10-linux_390-64_cmprssptrs",
            "Test-sanity.functional-JDK10-linux_ppc-64_cmprssptrs_le",
            "Test-sanity.functional-JDK10-linux_x86-64",
            "Test-sanity.functional-JDK10-linux_x86-64_cmprssptrs",
            "Test-sanity.functional-JDK10-win_x86-64_cmprssptrs",
        ]
    },
    AdoptOpenJDK: {
        url: "https://ci.adoptopenjdk.net/",
        builds: [
            "openjdk8_hs_openjdktest_x86-64_linux",
            "openjdk8_hs_openjdktest_x86-64_macos",
            "openjdk8_j9_openjdktest_x86-64_linux",
            "openjdk10_hs_openjdktest_aarch64_linux",
            "openjdk10_hs_openjdktest_x86-64_linux",
            "openjdk10_j9_openjdktest_x86-64_linux",
            "openjdk10_hs_systemtest_ppc64le_linux",
            "openjdk10_hs_systemtest_x86-64_linux",
        ],
        default: [
            "openjdk8_j9_openjdktest_x86-64_linux",
            "openjdk8_hs_openjdktest_x86-64_linux",
            "openjdk10_hs_openjdktest_x86-64_linux",
            "openjdk10_j9_openjdktest_x86-64_linux",
        ]
    }
};

const getList = ( selected, serverSelected ) => {
    return selected[serverSelected] || map[serverSelected].default || map[serverSelected].builds;
}

export class BuildStatusSetting extends Component {
    onChange = list => {
        const { selected, serverSelected } = this.props;
        this.props.onChange( {
            selected: {
                ...selected,
                [serverSelected]: list,
            }
        } );
    }
    onServerChange = obj => {
        this.props.onChange( { serverSelected: obj.target.value } );
    }

    render() {
        const { selected = {}, serverSelected } = this.props;
        const obj = map[serverSelected] || [];

        const options = obj.builds.map( buildName => {
            return {
                label: buildName, value: buildName
            };
        } );

        const list = getList( selected, serverSelected );
        return <div style={{ maxWidth: 400 }}>
            <ServerSelector servers={Object.keys( map )} serverSelected={serverSelected} onChange={this.onServerChange} />
            {serverSelected && <Checkbox.Group options={options} value={list} onChange={this.onChange} />}
        </div>
    }
}

export default class BuildStatus extends Component {
    static Title = props => {
        return props.serverSelected;
    };
    static Setting = BuildStatusSetting;
    static defaultSize = { w: 4, h: 4 }
    static defaultSettings = {
        serverSelected: "OpenJ9"
    }

    state = {
        builds: {},
        filterDropdownVisible: false,
        searchText: '',
    };

    async componentDidMount() {
        await this.updateData();
        // update every 30 secs
        this.intervalId = setInterval(() => {
            this.updateData( true );
        }, 30 * 1000 );
    }

    async componentDidUpdate() {
        await this.updateData();
    }

    componentWillUnmount() {
        clearInterval( this.intervalId );
    }

    updateData = async ( force = false ) => {
        const { selected = {}, serverSelected } = this.props;
        if ( !serverSelected ) return;
        const list = getList( selected, serverSelected );
        await Promise.all( list.map( async buildName => {
            const url = map[serverSelected].url;
            if ( force || !this.state.builds[buildName] ) {
                const encodeUrl = encodeURIComponent( url );
                const response = await fetch( `/api/getLastBuildInfo?url=${encodeUrl}&buildName=${buildName}`, {
                    method: 'get'
                } );
                const data = await response.json();
                let result = null;
                let buildNum = null;
                let buildUrl = null;
                if ( data && data.result ) {
                    if ( data.result.building ) {
                        result = "Running";
                    } else {
                        result = data.result.result;
                    }
                    buildUrl = data.result.url;
                    buildNum = data.result.number;
                } else {
                    buildUrl = url + "/job/" + buildName;
                }
                this.state.builds[buildName] = {
                    buildName,
                    result,
                    url: buildUrl,
                    buildNum,
                };
                this.setState( this.state.builds );
            }
        } ) );
    }

    onInputChange = e => {
        this.setState( { searchText: e.target.value } );
    }

    render() {
        const { builds, filterDropdownVisible, searchText } = this.state;
        const { selected = {}, serverSelected } = this.props;
        const list = getList( selected, serverSelected );
        let data = [];

        if ( builds && list ) {
            list.map( listItem => {
                const build = builds[listItem];
                if ( !build ) return null;

                //Set build.result value
                let info = build.result;
                info = ( info === null ? "Cannot connect" : info ).toLowerCase();
                // change first char to upper case
                info = info.replace( /^\w/, c => c.toUpperCase() );
                build.result = info;

                //Set jdk version value
                const jdkRegex = /jdk\d+/i;
                let jdk = "n/a";
                let m = jdkRegex.exec( build.buildName )
                if ( m !== null ) {
                    jdk = m[0];
                }
                jdk = jdk.toUpperCase();

                //Set Java impl value
                const javaImplRegex = /_(j9|hs|sap|ibm)_/i;
                let javaImpl = "n/a";
                m = javaImplRegex.exec( build.buildName );
                if ( m !== null ) {
                    javaImpl = m[1];
                }
                if ( javaImpl === "n/a" && build.url.match( /openj9/i ) ) {
                    javaImpl = "j9";
                }
                javaImpl = javaImpl.toUpperCase();
                javaImpl = javaImpl.replace( "J9", "OpenJ9" );
                javaImpl = javaImpl.replace( "HS", "HotSpot" );

                data.push( {
                    key: build.buildName + build.buildNum,
                    jdk,
                    javaImpl,
                    ...build,
                } );

                return data;
            } );
        }

        const renderResult = ( value, row, index ) => {
            let icon = "";
            if ( value === "Success" ) {
                icon = <Icon type="check" style={{ fontSize: 16, color: '#43ed2d' }} />;
            } else if ( value === "Running" ) {
                icon = <Icon type="loading" style={{ fontSize: 16, color: '#43ed2d' }} />;
            } else if ( value === "Failure" ) {
                icon = <Icon type="close" style={{ fontSize: 16, color: '#f50' }} />;
            } else if ( value === "Unstable" ) {
                icon = <Icon type="exclamation-circle-o" style={{ fontSize: 16, color: '#DAA520' }} />;
            } else if ( value === "Cannot connect" ) {
                icon = <Icon type="question" style={{ fontSize: 16, color: '#DAA520' }} />;
            } else {
                icon = <Icon type="info" style={{ fontSize: 16, color: '#f50' }} />;
            }
            return <Tooltip title={value}>{icon}</Tooltip>;
        };

        const columns = [{
            title: 'Build Name',
            dataIndex: 'buildName',
            render: ( value, record ) => {
                return <a key={value} href={record.url} target="_blank">{value}</a>
            },
            filterDropdown: (
                <div className="custom-filter-dropdown">
                    <Input
                        ref={ele => this.searchInput = ele}
                        placeholder="Search test name"
                        value={searchText}
                        onChange={this.onInputChange}
                        onPressEnter={this.onSearch}
                    />
                </div>
            ),
            filterDropdownVisible,
            onFilterDropdownVisibleChange: visible => {
                this.setState( {
                    filterDropdownVisible: visible,
                }, () => this.searchInput.focus() );
            },
            defaultSortOrder: 'descend',
            sorter: ( a, b ) => a.buildName.localeCompare( b.buildName )
        }, {
            title: 'Build Num',
            dataIndex: 'buildNum',
            defaultSortOrder: 'descend',
            sorter: ( a, b ) => a.buildNum - b.buildNum,
        }, {
            title: 'JDK Version',
            dataIndex: 'jdk',
            defaultSortOrder: 'descend',
            sorter: ( a, b ) => a.jdk.localeCompare( b.jdk )
        }, {
            title: 'Java Impl',
            dataIndex: 'javaImpl',
            defaultSortOrder: 'descend',
            sorter: ( a, b ) => a.javaImpl.localeCompare( b.javaImpl )
        }, {
            title: 'Result',
            dataIndex: 'result',
            render: renderResult,
            filters: [{
                text: 'Success',
                value: 'Success',
            }, {
                text: 'Running',
                value: 'Running',
            }, {
                text: 'Failure',
                value: 'Failure',
            }, {
                text: 'Unstable',
                value: 'Unstable',
            }, {
                text: 'Cannot connect',
                value: 'Cannot connect',
            }],
            filterMultiple: false,
            onFilter: ( value, record ) => record.result.indexOf( value ) === 0,
            sorter: ( a, b ) => a.result.localeCompare( b.result )
        }];


        function onChange( pagination, filters, sorter ) {
            console.log( 'params', pagination, filters, sorter );
        }

        if ( searchText ) {
            const reg = new RegExp( searchText, 'gi' );
            data = data.filter( record => !!record.buildName.match( reg ) ).map( record => {
                return {
                    ...record,
                    testName: <Highlighter
                        searchWords={searchText.split( ' ' )}
                        autoEscape
                        textToHighlight={record.testName}
                    />
                };
            } );
        }

        return <Table
            columns={columns}
            dataSource={data}
            onChange={onChange}
            pagination={{ pageSize: 6 }}
        />;
    }
}