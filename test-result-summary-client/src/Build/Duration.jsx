export default function renderDuration(ms) {
    if (ms === null) {
        return 'N/A';
    } else if (ms === Infinity) {
        return 'Hang suspected';
    }
    const milliseconds = parseInt(ms % 1000, 10);
    const seconds = parseInt((ms / 1000) % 60, 10);
    const minutes = parseInt((ms / (1000 * 60)) % 60, 10);
    const hours = parseInt((ms / (1000 * 60 * 60)) % 24, 10);
    let rt = '';
    if (hours > 0) {
        rt += hours + ' hr ';
    }
    if (minutes > 0) {
        rt += minutes + ' min ';
    }
    if (seconds > 0) {
        rt += seconds + ' sec';
    }
    if (rt === '') {
        rt += milliseconds + ' ms';
    }
    return rt;
}
