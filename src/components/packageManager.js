import appSettings from 'appSettings';
import pluginManager from 'pluginManager';
/* eslint-disable indent */

    class PackageManager {
        #packagesList = [];
        #settingsKey = 'installedpackages1';

        init() {
            console.groupCollapsed('loading packages');
            var manifestUrls = JSON.parse(appSettings.get(this.#settingsKey) || '[]');

            return Promise.all(manifestUrls.map((url) => {
                return this.loadPackage(url);
            }))
            .then(() => {
                console.debug('finished loading packages');
                return Promise.resolve();
            })
            .catch(() => {
                return Promise.resolve();
            }).finally(() => {
                console.groupEnd('loading packages');
            });
        }

        get packages() {
            return this.#packagesList.slice(0);
        }

        install(url) {
            return this.loadPackage(url, true).then((pkg) => {
                var manifestUrls = JSON.parse(appSettings.get(this.#settingsKey) || '[]');

                if (!manifestUrls.includes(url)) {
                    manifestUrls.push(url);
                    appSettings.set(this.#settingsKey, JSON.stringify(manifestUrls));
                }

                return pkg;
            });
        }

        uninstall(name) {
            var pkg = this.#packagesList.filter((p) => {
                return p.name === name;
            })[0];

            if (pkg) {
                this.#packagesList = this.#packagesList.filter((p) => {
                    return p.name !== name;
                });

                this.removeUrl(pkg.url);
            }

            return Promise.resolve();
        }

        mapPath(pkg, pluginUrl) {
            var urlLower = pluginUrl.toLowerCase();
            if (urlLower.startsWith('http:') || urlLower.startsWith('https:') || urlLower.startsWith('file:')) {
                return pluginUrl;
            }

            var packageUrl = pkg.url;
            packageUrl = packageUrl.substring(0, packageUrl.lastIndexOf('/'));

            packageUrl += '/';
            packageUrl += pluginUrl;

            return packageUrl;
        }

        addPackage(pkg) {
            this.#packagesList = this.#packagesList.filter((p) => {
                return p.name !== pkg.name;
            });

            this.#packagesList.push(pkg);
        }

        removeUrl(url) {
            var manifestUrls = JSON.parse(appSettings.get(this.#settingsKey) || '[]');

            manifestUrls = manifestUrls.filter((i) => {
                return i !== url;
            });

            appSettings.set(this.#settingsKey, JSON.stringify(manifestUrls));
        }

        loadPackage(url, throwError = false) {
            return new Promise((resolve, reject) => {
                var xhr = new XMLHttpRequest();
                var originalUrl = url;
                url += url.indexOf('?') === -1 ? '?' : '&';
                url += 't=' + new Date().getTime();

                xhr.open('GET', url, true);

                var onError = () => {
                    if (throwError === true) {
                        reject();
                    } else {
                        this.removeUrl(originalUrl);
                        resolve();
                    }
                };

                xhr.onload = () => {
                    if (this.status < 400) {
                        var pkg = JSON.parse(this.response);
                        pkg.url = originalUrl;

                        this.addPackage(pkg);

                        var plugins = pkg.plugins || [];
                        if (pkg.plugin) {
                            plugins.push(pkg.plugin);
                        }
                        var promises = plugins.map((pluginUrl) => {
                            return pluginManager.loadPlugin(this.mapPath(pkg, pluginUrl));
                        });
                        Promise.all(promises).then(resolve, resolve);
                    } else {
                        onError();
                    }
                };

                xhr.onerror = onError;

                xhr.send();
            });
        }
    }

/* eslint-enable indent */

export default new PackageManager();
