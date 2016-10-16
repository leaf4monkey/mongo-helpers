/**
 * Created on 2016/10/12.
 * @fileoverview 请填写简要的文件说明.
 * @author joc (Chen Wen)
 */

import {chai} from 'meteor/practicalmeteor:chai';
import {Mongo} from 'meteor/mongo';
import {MongoHelpers} from 'meteor/leaf4monkey:mongo-helpers';

let Coll = new Mongo.Collection('clothes');
describe('MongoHelpers', function () {
    it('#getCollectionByName()，可以通过集合名获取任意的自定义集合：', function () {
        let _Coll = MongoHelpers.getCollectionByName(Coll._name);
        chai.assert.equal(_Coll._name || _Coll.name, Coll._name);
    });

    it('#flatten()，可以将对象扁平化，使其适用于mongo更新操作：', function () {
        let date = new Date();
        let flatten = MongoHelpers.flatten({a: {b: [{aa: {0: 1, 1: 1, ccc: 1}, bb: 1}, {cc: date}]}});
        chai.assert.deepEqual(flatten, {'a.b.0.aa.0': 1, 'a.b.0.aa.1': 1, 'a.b.0.aa.ccc': 1, 'a.b.0.bb': 1, 'a.b.1.cc': date});
    });

    it('#rebuild()，可以将扁平化处理后的对象重建还原：', function () {
        let date = new Date();
        let obj = MongoHelpers.rebuild({'a.b.0.aa.0': 1, 'a.b.0.aa.1': 1, 'a.b.0.aa.ccc': 1, 'a.b.0.bb': 1, 'a.b.1.cc': date});
        chai.assert.deepEqual(obj, {a: {b: [{aa: {0: 1, 1: 1, ccc: 1}, bb: 1}, {cc: date}]}});
    });

    it('#flattenToModifier()，对比传入的对象，取得差异部分来组建mongo更新操作中的setter和unsetter部分：', function () {
        let date = new Date();
        let modifier = MongoHelpers.flattenToModifier(
            {
                a: {
                    b: [
                        {
                            aa: {
                                0: 1,
                                1: 1,
                                2: null,
                                ccc: 1
                            },
                            bb: 1
                        },
                        {cc: date}
                    ]
                }
            },
            {
                a: {
                    b: {
                        0: {
                            aa: {
                                0: 1,
                                1: 1,
                                2: 1,
                                ccc: 1
                            }
                        },
                        1: {cc: date}
                    }
                }
            }
        );
        chai.assert.deepEqual({"$set":{"a.b.0.bb":1},"$unset":{"a.b.0.aa.2":1}}, modifier);
    });
});