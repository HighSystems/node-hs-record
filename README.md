@highsystems/record
===================

[![npm license](https://img.shields.io/npm/l/@highsystems/record.svg)](https://www.npmjs.com/package/@highsystems/record) [![npm version](https://img.shields.io/npm/v/@highsystems/record.svg)](https://www.npmjs.com/package/@highsystems/record) [![npm downloads](https://img.shields.io/npm/dm/@highsystems/record.svg)](https://www.npmjs.com/package/@highsystems/record)

A lightweight, promise based abstraction layer for High Systems Records

Written in TypeScript, targets Nodejs and the Browser

Install
-------
```
# Install
$ npm install --save @highsystems/record
```

Documentation
-------------

[TypeDoc Documentation](https://highsystems.github.io/node-hs-record/)

Server-Side Example
-------------------
```typescript
import { HSRecord } from '@highsystems/record';
import { HighSystems } from '@highsystems/client';

const highsystems = new HighSystems({
    instance: 'www',
    userToken: 'xxx'
});

const hsRecord = new HSRecord({
	highsystems: highsystems,
    applicationId: 'xxxxxxxxx',
	tableId: 'xxxxxxxxx',
	recordid: 'xxxxxxxx'
});

(async () => {
    try {
        const results = await hsRecord.load();

        console.log(hsRecord.get('recordid'), results.recordid);
    }catch(err){
        console.error(err);
    }
})();
```

Client-Side Example
-------------------
Import `HSRecord` by loading `@highsystems/record.browserify.min.js`

```javascript
var highsystems = new HighSystems({
    instance: 'www'
});

var hsRecord = new HSRecord({
	highsystems: highsystems,
    applicationId: 'xxxxxxxxx',
	tableId: 'xxxxxxxxx',
	recordid: 'xxxxxxxx'
});

hsRecord.load().then(function(results){
    console.log(qbField.get('recordid'), results.recordid);
}).catch(function(err){
    console.error(err);
});
```

License
-------
Copyright 2023 High Systems, Inc

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
