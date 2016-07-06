# mongo-helpers
    Some helpful APIs for mongodb.
===
## APIs
- `MongoHelpers.flatten (obj):` handle an plain object, change it to {'key.embedKey': val} form. for example.
```js
var o = {a: {b: [{aa: 1, bb: new Date()}]}};
o = JSON.stringify(MongoHelpers.flatten(o)); // '{"a.b.0.aa":1,"a.b.0.bb":"2016-07-06T03:42:53.511Z"}';
```
- `MongoHelpers.flattenToModifier (base, mirror):` compare the `base` and `mirror`, then add the fileds with truth-values to setter, and the fields(if the `base` has this field) with false-values to unsetter. At last, if the setter and the unsetter are both empty, it will return undefined, else return `{$set: {'key.embedKey': val}}`, `{$unset: {'key.embedKey': 1}}`, or `{$set: {'key.embedKey': val}, $unset: {'key.embedKey': 1}}`.