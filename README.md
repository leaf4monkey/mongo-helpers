# mongo-helpers

    一些用于辅助mongodb数据和集合操作的API。


## APIs

### `MongoHelpers.flatten (obj):`

将一个文档扁平化，例如，使用该方法处理对象{a: {b: [{aa: 1, bb: 1}]}}，将会获得{'a.b.0.aa': 1, 'a.b.0.bb': 1}

```js
var o = {a: {b: [{aa: 1, bb: new Date()}]}};
o = JSON.stringify(MongoHelpers.flatten(o)); // '{"a.b.0.aa":1,"a.b.0.bb":"2016-07-06T03:42:53.511Z"}';
```


### `MongoHelpers.rebuild (flatten):`

`MongoHelpers.flatten (obj)`的反向操作，不保证具有与原对象完全一致的结构。


### `MongoHelpers.flattenToModifier (base, mirror, options):`

将传入的文档扁平化后，对比键值对，获得 modifier （包含 $set 和 $unset ）。

- 参数列表：

        `base {Object} `: 需要对比的对象

        `mirror {Object|null} `: 作为镜像来完成对比的对象

        `options.falsy {Array.<any>|undefined} `: 自定义的假值列表，如果base中的值在该列表中，则对应的属性将被纳入 unset 集，默认值为 `[null, undefined]`。

        `options.unsetNonProp {boolean} `: 是否将base中不包含的属性加入到unset集中，如果设置为 `true`，则需要先检查base中是否包含指定属性，再检查其值是否在假值列表中。

        `options.unsetAs {any} `: 统一设置 unsetter 中的键值，建议按照习惯设置为 `1` 或 `true`，如果传入的 `mirror` 参数为 `null`，则强制设置为 `true`，否则默认被设置为 `base` 对象中的值。

    
