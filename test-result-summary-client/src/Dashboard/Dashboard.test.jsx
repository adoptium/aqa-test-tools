import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import Dashboard from './Dashboard';

jest.mock('./TabInfo', () => ({ tab }) => <div>tab content {tab}</div>);

const flush = () => act(() => new Promise((r) => setTimeout(r, 20)));

const render = async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
        root.render(<Dashboard />);
    });
    await flush();
    return { container, root };
};

const labels = (container) =>
    [...container.querySelectorAll('.ant-tabs-tab-btn')].map(
        (e) => e.textContent
    );

beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
});

test('has a tab for each LTS release and the latest feature release', async () => {
    global.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => ({
            available_lts_releases: [8, 11, 17, 21, 25],
            most_recent_feature_release: 27,
        }),
    }));
    const { container, root } = await render();
    expect(global.fetch.mock.calls[0][0]).toBe(
        'https://api.adoptium.net/v3/info/available_releases'
    );
    expect(labels(container)).toEqual([
        'Perf',
        'Custom',
        'JDK8',
        'JDK11',
        'JDK17',
        'JDK21',
        'JDK25',
        'JDK27',
    ]);
    await act(async () => root.unmount());
});

test('keeps the other tabs when the Adoptium API cannot be reached', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn(async () => {
        throw new Error('offline');
    });
    const { container, root } = await render();
    expect(labels(container)).toEqual(['Perf', 'Custom']);
    await act(async () => root.unmount());
});
