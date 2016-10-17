// Write your package code here!
import {Meteor} from 'meteor/meteor';

let collectionMap = Meteor.isClient ? Meteor.connection._mongo_livedata_collections : {users: Meteor.users};

if (Meteor.isServer) {
    class _Collection extends Mongo.Collection {
        /**
         * @constructor
         */
        constructor (name, options) {
            super(name, options);
            collectionMap[name] = this;
        }
    }
    Mongo.Collection = _Collection;
}

let MongoHelpers = {
    getCollectionByName (name) {
        return collectionMap[name];
    },
    getCollectionName (Collection) {
        return Collection._name;
    },
    /**
     * 将一个文档扁平化，例如，使用该方法处理对象{a: {b: [{aa: 1, bb: 1}]}}，将会获得{'a.b.0.aa': 1, 'a.b.0.bb': 1}
     * @param obj
     * @returns {*|{}}
     */
    flatten (obj) {
        let handler = function (obj, copy, keyBase) {
            copy = copy || {};
            keyBase = keyBase || '';

            _.each(obj, (val, key) => {
                let _key = keyBase + ((keyBase ? '.' : '') + key);
                if ((_.isObject(val) && !_.isDate(val) &&
                     (!_.isArray(val) ||
                      !Match.test(val, [Match.OneOf(String, Number, Date, Boolean, null, undefined)])))) {
                    _.extend(copy, handler(val, copy, _key));
                    return;
                }
                copy[_key] = val;
            });
            return copy;
        };

        return handler(obj);
    },
    /**
     * 将一个扁平化处理的对象重建为一个对象
     * @param flatten
     */
    rebuild (flatten) {
        let copy = [];

        _.each(flatten, function (val, key) {
            let paths = key.split('.');
            let levels = [];
            let lastPath;
            let c = copy;
            paths.forEach((path, idx) => {
                let pathIsNum = /^\d+$/.test(path);
                if (!pathIsNum && _.isArray(c)) {
                    let o = {};
                    c.forEach((v, k) => o[k] = v);
                    c = o;
                    if (idx === 0) {
                        copy = o;
                    } else {
                        levels[idx - 1][lastPath] = o;
                    }
                }
                levels.push(c);
                if (idx === paths.length - 1) {
                    return c[path] = val;
                }
                lastPath = path;
                c = c[path] = c[path] || [];
            });
        });
        return copy;
    },
    diffObj (base, mirror, {falsy} = {}, callback) {
        let self = this;
        let keys = _.keys(base);
        base = self.flatten(base);
        mirror = mirror && self.flatten(_.pick(mirror, keys));
        if (_.isFunction(falsy)) {
            [callback, falsy] = [falsy, null];
        }
        falsy = falsy || [null, undefined];

        _.each(base, (val, key) => {
            if (falsy.indexOf(val) >= 0) {
                callback({key, val, op: 'unset'});
            } else if (!mirror || !_.isEqual(mirror[key], val)) {
                callback({key, val, op: 'set'});
            }
        });

        mirror && _.each(mirror, (val, key) => {
            if (falsy.indexOf(base[key]) >= 0) {
                callback({key, val, op: 'unset'});
            }
        });
    },
    diffObject (base, mirror, {falsy} = {}, callback) {
        let isNotSimpleArray = function (val) {
            return !_.isArray(val) || !Match.test(val, [Match.OneOf(String, Number, Date, Boolean, null, undefined)]);
        };
        let isObject = function (val) {
            return val && _.isObject(val) && !_.isDate(val) && isNotSimpleArray(val);
        };
        let isFalsy = function (val) {
            return _.contains(falsy, val);
        };
        let traverse = function (obj, mir, parents, handle) {
            if (!obj) {
                return;
            }
            parents = parents || [];
            obj && _.each(obj, (val, key) => {
                let paths = parents.concat([key]);
                let ov = mir && mir[key];
                if (_.isEqual(val, ov)) {
                    return;
                }
                if (isObject(val) && isObject(ov)) {
                    return traverse(val, ov, paths, handle);
                }
                handle(val, ov, key, paths, {obj, mir});
            });
        };

        if (_.isFunction(falsy)) {
            [callback, falsy] = [falsy, null];
        }
        falsy = falsy || [null, undefined];

        let keys = _.keys(base);
        mirror = mirror && _.pick(mirror, keys);
        traverse(base, mirror, null, (val, mv, key, paths, {obj, mir}) =>
            callback({
                key: paths.join('.'),
                val,
                oldVal: mv,
                op: isFalsy(val) ? 'unset' : 'set'
            })
        );
        traverse(mirror, base, null, (val, bv, key, paths, {mir}) =>
            !mir.hasOwnProperty(key) &&
            callback({
                key: paths.join('.'),
                val: bv,
                oldVal: val,
                op: 'unset'
            })
        );
    },
    /**
     * 将传入的文档扁平化后，对比键值对，获得两个对象的差异部分
     * @param base
     * @param mirror
     * @param falsy
     * @returns {{}}
     */
    diffToFlatten (base, mirror, {falsy} = {}) {
        let self = this,
            count = 0,
            res = {};

        self.diffObject(base, mirror, {falsy}, ({key, val}) => {
            res[key] = val;
            count++;
        });

        if (!count) {
            return;
        }
        return res;
    },
    /**
     * 将传入的文档扁平化后，对比键值对，获得modifier(包含$set和$unset)
     * @param base
     * @param mirror
     * @param falsy
     * @param unsetAs
     * @returns {{}}
     */
    flattenToModifier (base, mirror, {falsy, unsetAs} = {}) {
        let self = this,
            count = 0,
            modifier = {};

        unsetAs = unsetAs || !mirror;

        self[mirror ? 'diffObject' : 'diffObj'](base, mirror, {falsy}, ({key, val, oldVal, op}) => {
            op = '$' + op;
            let m = modifier[op] = modifier[op] || {};
            m[key] = val;
            if (op === '$unset') {
                m[key] = unsetAs || oldVal;
            }
            count++;
        });

        if (!count) {
            return;
        }
        return modifier;
    },
    multiUpdate (collection, selector, modifier, multi, isDone) {
        let count = 0;
        let flag = 1;
        let hasUpdateFailed = true;
        let result;
        if (!_.isFunction(isDone)) {
            isDone = function () {
                return false;
            };
        }

        if (!multi) {
            hasUpdateFailed = collection.update(selector, modifier);
            return {hasUpdateFailed};
        }

        while (flag) {
            flag = collection.update(selector, modifier, {multi: true});
            flag && console.log(JSON.stringify({flag, selector, modifier}));
            count += flag;
            if (isDone(count)) {
                hasUpdateFailed = false;
                break;
            }
        }
        result = {success: count, hasUpdateFailed};
        return result;
    },
    /**
     * mongodb异常解析器，目前仅能解析插入重复键异常
     * @param e
     * @returns {{isDuplKey: boolean, collection: *, index: *, value: *}}
     */
    errorParser (e) {
        let msg = e.message;
        //E11000 duplicate key error collection: duolayimeng.clothes index: _id_ dup key: { : "1521111" }
        let isDuplKey = /duplicate key error/.test(msg);
        let collection = /collection\: (\w+(\.\w+)+)/.exec(msg)[1];
        let index = /index\: ([\w\-]+)/.exec(msg)[1];
        let value = /dup key\: \{ (\w+( )?)?\: \"(\w+)\" \}/.exec(msg)[1];
        return {isDuplKey, collection, index, value};
    }
};

export {MongoHelpers};