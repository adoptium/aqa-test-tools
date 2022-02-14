export default class LocalStorage {
    constructor(keyName) {
        this.keyName = keyName;
    }
    get() {
        return localStorage.getItem(this.keyName);
    }
    set(keyValue) {
        return localStorage.setItem(this.keyName, keyValue);
    }
    reset() {
        return localStorage.removeItem(this.keyName);
    }
}
