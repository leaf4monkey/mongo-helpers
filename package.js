Package.describe({
    name: 'leaf4monkey:mongo-helpers',
    version: '0.1.2',
    // Brief, one-line summary of the package.
    summary: 'Some helpful APIs for mongodb.',
    // URL to the Git repository containing the source code for this package.
    git: 'https://github.com/leaf4monkey/mongo-helpers.git',
    // By default, Meteor will default to using README.md for documentation.
    // To avoid submitting documentation, set this field to null.
    documentation: 'README.md'
});

Package.onUse(function (api) {
    api.versionsFrom('1.4.1');
    api.use([
        'ecmascript',
        'mongo',
        'check',
        'underscore'
    ]);
    api.mainModule('mongo-helpers.js');
});

Package.onTest(function(api) {
    api.use('leaf4monkey:mongo-helpers');

    api.use([
        'ecmascript',
        'mongo',
        'check',
        'underscore',
        'practicalmeteor:mocha'
    ]);

    api.mainModule('mongo-helpers-tests.js');
});