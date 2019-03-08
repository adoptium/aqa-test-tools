export const params = obj => '?' + Object.keys(obj).reduce(function (a, k) {
    if (obj[k] !== undefined) {
        a.push(k + '=' + encodeURIComponent(obj[k]));
    }
    return a;
}, []).join('&');

export const getParams = query => {
    if (!query) {
        return {};
    }
    return (/^[?#]/.test(query) ? query.slice(1) : query).split('&').reduce((params, param) => { let [key, value] = param.split('='); params[key] = value ? decodeURIComponent(value.replace(/\+/g, ' ')) : ''; return params; }, {});
};