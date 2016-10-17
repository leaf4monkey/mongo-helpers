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
    diffObj (base, mirror, callback) {
        let self = this;
        base = self.flatten(base);
        mirror = mirror && self.flatten(mirror);

        _.each(base, (val, key) => {
            if ([null, undefined].indexOf(val) >= 0) {
                callback({key, val, op: 'unset'});
            } else if (!mirror || !_.isEqual(mirror[key], val)) {
                callback({key, val, op: 'set'});
            }
        });
    },
    /**
     * 将传入的文档扁平化后，对比键值对，获得两个对象的差异部分
     * @param base
     * @param mirror
     * @returns {{}}
     */
    diffToFlatten (base, mirror) {
        let self = this,
            count = 0,
            res = {};

        self.diffObj(base, mirror, ({key, val}) => {
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
     * @returns {{}}
     */
    flattenToModifier (base, mirror) {
        let self = this,
            setter = {},
            unsetter = {},
            setterCount = 0,
            unsetterCount = 0,
            res = {};

        self.diffObj(base, mirror, ({key, val, op}) => {
            if (op === 'unset') {
                unsetter[key] = 1;
                unsetterCount++;
            } else {
                setter[key] = val;
                setterCount++;
            }
        });
        if (setterCount) {
            res.$set = setter;
        }
        if (unsetterCount) {
            res.$unset = unsetter;
        }
        if (!setterCount && !unsetterCount) {
            return;
        }
        return res;
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