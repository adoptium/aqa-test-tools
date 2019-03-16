import React, { Component } from 'react';
import { Icon, Checkbox, Table, Tooltip, Input } from 'antd';
import ServerSelector from "./ServerSelector";
import Highlighter from 'react-highlight-words';

const getList = (selected, serverSelected, buildInfo) => {
    if (selected[serverSelected]) {
        return selected[serverSelected];
    } else if (buildInfo && buildInfo[serverSelected]) {
        return buildInfo[serverSelected].default || buildInfo[serverSelected].builds;
    }
}

let buildInfoMap = null;

export class BuildStatusSetting extends Component {
    onChange = list => {
        const { selected, serverSelected } = this.props;
        this.props.onChange({
            selected: {
                ...selected,
                [serverSelected]: list,
            }
        });
    }
    onServerChange = obj => {
        this.props.onChange({ serverSelected: obj.target.value });
    }

    render() {
        const { selected = {}, serverSelected } = this.props;
        if (!buildInfoMap) {
            return <div/>;
        }
        const obj = buildInfoMap[serverSelected] || [];

        const options = obj.builds.map(buildName => {
            return {
                label: buildName, value: buildName
            };
        });

        const list = getList(selected, serverSelected, buildInfoMap);
        return <div style={{ maxWidth: 400 }}>
            <ServerSelector servers={Object.keys(buildInfoMap)} serverSelected={serverSelected} onChange={this.onServerChange} />
            {serverSelected && <Checkbox.Group options={options} value={list} onChange={this.onChange} />}
        </div>
    }
}

export default class BuildStatus extends Component {
    static Title = props => {
        const url = props.title ? props.title : "";
        return `${props.serverSelected} ${url}`;
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
        map: {}
    };

    async componentDidMount() {
        await this.updateData();
        // update every 5 mins
        this.intervalId = setInterval(() => {
            this.updateData(true);
        }, 5 * 60 * 1000);
    }

    async componentDidUpdate() {
        await this.updateData();
    }

    componentWillUnmount() {
        clearInterval(this.intervalId);
    }

    updateData = async (force = false) => {
        const { selected = {}, serverSelected } = this.props;
        if (!serverSelected) return;

        const res = await fetch(`/api/getDashboardBuildInfo`, {
            method: 'get'
        });
        buildInfoMap = await res.json();
        const list = getList(selected, serverSelected, buildInfoMap);
        if (!list) {
            return;
        }
        await Promise.all(list.map(async buildName => {
            const url = buildInfoMap[serverSelected].url;
            if (force || !this.state.builds[buildName]) {
                const encodeUrl = encodeURIComponent(url);
                const response = await fetch(`/api/getLastBuildInfo?url=${encodeUrl}&buildName=${buildName}`, {
                    method: 'get'
                });
                const data = await response.json();
                let result = null;
                let buildNum = null;
                let buildUrl = null;
                if (data && data.result) {
                    if (data.result.building) {
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
                    buildNum
                };
                this.setState(this.state.builds);
            }
        }));
    }

    onInputChange = e => {
        this.setState({ searchText: e.target.value });
    }

    render() {
        const { builds, filterDropdownVisible, searchText } = this.state;
        const { selected = {}, serverSelected } = this.props;
        const list = getList(selected, serverSelected, buildInfoMap);
        let data = [];

        if (builds && list) {
            list.map(listItem => {
                const build = builds[listItem];
                if (!build || !build.url) return null;

                //Set build.result value
                let info = build.result;
                info = (info ? info : "Cannot connect").toLowerCase();
                // change first char to upper case
                info = info.replace(/^\w/, c => c.toUpperCase());
                build.result = info;

                //Set jdk version value
                const jdkRegex = /jdk\d+/i;
                let jdk = "n/a";
                let m = jdkRegex.exec(build.buildName)
                if (m !== null) {
                    jdk = m[0];
                }
                jdk = jdk.toUpperCase();

                //Set Java impl value
                const javaImplRegex = /_(j9|hs|sap|ibm)_/i;
                let javaImpl = "n/a";
                m = javaImplRegex.exec(build.buildName);
                if (m !== null) {
                    javaImpl = m[1];
                }

                if (javaImpl === "n/a" && build.url.match(/openj9/i)) {
                    javaImpl = "j9";
                }
                javaImpl = javaImpl.toUpperCase();
                javaImpl = javaImpl.replace("J9", "OpenJ9");
                javaImpl = javaImpl.replace("HS", "HotSpot");

                data.push({
                    key: build.buildName + build.buildNum,
                    jdk,
                    javaImpl,
                    ...build,
                });

                return data;
            });
        }

        const renderResult = (value, row, index) => {
            let icon = "";
            if (value === "Success") {
                icon = <Icon type="check" style={{ fontSize: 16, color: '#43ed2d' }} />;
            } else if (value === "Running") {
                icon = <Icon type="loading" style={{ fontSize: 16, color: '#43ed2d' }} />;
            } else if (value === "Failure") {
                icon = <Icon type="close" style={{ fontSize: 16, color: '#f50' }} />;
            } else if (value === "Unstable") {
                icon = <Icon type="exclamation-circle-o" style={{ fontSize: 16, color: '#DAA520' }} />;
            } else if (value === "Cannot connect") {
                icon = <Icon type="question" style={{ fontSize: 16, color: '#DAA520' }} />;
            } else {
                icon = <Icon type="info" style={{ fontSize: 16, color: '#f50' }} />;
            }
            return <Tooltip title={value}>{icon}</Tooltip>;
        };

        const columns = [{
            title: 'Build Name',
            dataIndex: 'buildName',
            render: (value, record) => {
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
                this.setState({
                    filterDropdownVisible: visible,
                }, () => this.searchInput.focus());
            },
            defaultSortOrder: 'descend',
            sorter: (a, b) => a.buildName.localeCompare(b.buildName)
        }, {
            title: 'Build Num',
            dataIndex: 'buildNum',
            defaultSortOrder: 'descend',
            sorter: (a, b) => a.buildNum - b.buildNum,
        }, {
            title: 'JDK Version',
            dataIndex: 'jdk',
            defaultSortOrder: 'descend',
            sorter: (a, b) => a.jdk.localeCompare(b.jdk)
        }, {
            title: 'Java Impl',
            dataIndex: 'javaImpl',
            defaultSortOrder: 'descend',
            sorter: (a, b) => a.javaImpl.localeCompare(b.javaImpl)
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
            onFilter: (value, record) => record.result.indexOf(value) === 0,
            sorter: (a, b) => a.result.localeCompare(b.result)
        }];

        function onChange(pagination, filters, sorter) {
            console.log('params', pagination, filters, sorter);
        }

        if (searchText) {
            const reg = new RegExp(searchText, 'gi');
            data = data.filter(record => !!record.buildName.match(reg)).map(record => {
                return {
                    ...record,
                    testName: <Highlighter
                        searchWords={searchText.split(' ')}
                        autoEscape
                        textToHighlight={record.testName}
                    />
                };
            });
        }

        return <Table
            columns={columns}
            dataSource={data}
            onChange={onChange}
            pagination={{ pageSize: 6 }}
        />;
    }
}