import React, {Component} from "react";
import { getParams } from "../utils/query";
import { Tree } from 'antd';
import { Link } from 'react-router-dom';
import { fetchData } from '../utils/Utils';
import { params } from '../utils/query';

export default class BuildTreeView extends Component {
    state = {
        buildTree : [],
        keys: [],
        autoExpandParent: true,
    }

    async updateFromParentId(parent) {
        const buildTree = this.state.buildTree
        const keys = this.state.keys
        keys.push(parent.key)
        fetchData(`/api/getChildBuilds?parentId=${parent.key}`).then(res => {
            parent.children = res.map((b) => {
                let build = {
                    title: b.buildName,
                    key: b._id,
                    build: b,
                    children: []
                }
                if (b.hasChildren) {
                    this.updateFromParentId(build);
                }
                return build
            })
            this.setState({ buildTree: [...buildTree], keys : keys, autoExpandParent : false})
        })
    }

    async componentDidMount() {
        const parentId = getParams(this.props.location.search).parentId
        fetchData(`/api/getData?_id=${parentId}`).then(res => {
            const tree = this.state.buildTree
            const rootBuild = {
                title: res[0].buildName,
                key: res[0]._id,
                build: res[0],
                children: []
            }
            this.updateFromParentId(rootBuild)
            tree.push(rootBuild)
        })

    }

    render() {
        const buildTree = this.state.buildTree;
        const keys = this.state.keys;
        const autoExpandParent = this.state.autoExpandParent

        const onExpand = (keys) => {
            this.setState({keys:keys, autoExpandParent:false})
        };

        const renderTreeTitles = (data) => {
            let build = data.build;
            return  (
                <div>
                    <Link
                        to={{
                            pathname: '/buildDetail',
                            search: params({parentId: build._id}),
                        }}
                        style={{
                            color: build.buildResult === 'SUCCESS' ? '#2cbe4e'
                                : build.buildResult === 'FAILURE' ? '#f50' : '#DAA520',
                        }}
                    >
                        {build.buildName}{' '}#{build.buildNum}
                    </Link>
                </div>
            )
        }

        return (
            <div>
                <Tree
                    onExpand={onExpand}
                    expandedKeys={keys}
                    treeData={buildTree}
                    autoExpandParent={autoExpandParent}
                    titleRender={renderTreeTitles}
                >
                </Tree>
            </div>
        )
    }
}