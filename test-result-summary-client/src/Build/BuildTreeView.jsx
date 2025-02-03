import React, { useState, useEffect } from 'react';
import { getParams } from '../utils/query';
import { Tree } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import { fetchData } from '../utils/Utils';
import { params } from '../utils/query';

const BuildTreeView = () => {
    const [buildTree, setBuildTree] = useState([]);
    const [keys, setKeys] = useState([]);
    const [autoExpandParent, setAutoExpandParent] = useState(true);
    const location = useLocation();

    const updateFromParentId = async (parent) => {
        let newKeys = [...keys, parent.key];
        fetchData(`/api/getAllChildBuilds${params({ parentId: parent.key })}`).then((res) => {
            // Create a map to store builds by their _id for easy lookup
            const buildMap = {};
            res.forEach((b) => {
                buildMap[b._id] = {
                    title: b.buildName,
                    key: b._id,
                    build: b,
                    children: [],
                };
            });
            // Nest child builds under their parents and rerun builds under their originals
            res.forEach((b) => {
                if (b.parentId && buildMap[b.parentId]) {
                    buildMap[b.parentId].children.push(buildMap[b._id]);
                    newKeys = [...keys, b.parentId];
                } else {
                    parent.children.push(buildMap[b._id]);
                }
            });
            setBuildTree((prevTree) => [...prevTree]);
            setKeys(newKeys);
            setAutoExpandParent(true);
        });
    };

    useEffect(() => {
        async function fetchRootBuild() {
            const parentId = getParams(location.search).parentId;
            const res = await fetchData(`/api/getData?_id=${parentId}`);
            const rootBuild = {
                title: res[0].buildName,
                key: res[0]._id,
                build: res[0],
                children: [],
            };
            setBuildTree([rootBuild]);
            await updateFromParentId(rootBuild);
        }

        fetchRootBuild();
    }, [location.search]);

    const onExpand = (currentKeys) => {
        setKeys(currentKeys);
        setAutoExpandParent(false);
    };

    const renderTreeTitles = (data) => {
        let build = data.build;
        return (
            <div>
                <Link
                    to={{
                        pathname: '/buildDetail',
                        search: params({ parentId: build._id }),
                    }}
                    style={{
                        color:
                            build.buildResult === 'SUCCESS'
                                ? '#2cbe4e'
                                : build.buildResult === 'FAILURE'
                                ? '#f50'
                                : '#DAA520',
                    }}
                >
                    {build.buildName} #{build.buildNum}
                </Link>
            </div>
        );
    };

    return (
        <div>
            <Tree
                onExpand={onExpand}
                expandedKeys={keys}
                treeData={buildTree}
                autoExpandParent={autoExpandParent}
                titleRender={renderTreeTitles}
            ></Tree>
        </div>
    );
};

export default BuildTreeView;
