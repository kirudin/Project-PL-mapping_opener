const assert = require('node:assert/strict');
const {updateMessage} = require('../pl_mapping_static/updates.js');
assert.match(updateMessage({status:'ok',latest_version:'v0.4.0',update_available:true,prerelease:true}),/New version v0.4.0 \(preview\)/);
assert.match(updateMessage({status:'ok',latest_version:'v0.3.1',current_version:'0.3.1'}),/No newer version/);
assert.match(updateMessage({status:'unavailable',error:'Offline; local work is unaffected'}),/local work is unaffected/);
assert.match(updateMessage({status:'no_release'}),/No releases/);
console.log('Update status messages passed');
