// Write your package code here!
var collectionMap = {users: Meteor.users};
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

MongoHelpers = {
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
        var handler = function (obj, copy, keyBase) {
            copy = copy || {};
            keyBase = keyBase || '';

            _.each(obj, function (val, key) {
                var _key = keyBase + ((keyBase ? '.' : '') + key);
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
     * 将传入的文档扁平化后，对比键值对，获得modifier(包含$set和$unset)
     * @param base
     * @param mirror
     * @returns {{}}
     */
    flattenToModifier (base, mirror) {
        var self = this,
            setter = {},
            unsetter = {},
            setterCount = 0,
            unsetterCount = 0,
            res = {};

        base = self.flatten(base);
        mirror = mirror && self.flatten(mirror);

        _.each(base, function (v, k) {
            if (!v) {
                unsetter[k] = 1;
                unsetterCount++;
            } else if (!mirror || !_.isEqual(mirror[k], v)) {
                setter[k] = v;
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
    }
};