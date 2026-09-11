const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../pl_mapping_static/app.js'), 'utf8');
function functionSource(name) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}\n', start) + 3;
  return (source.slice(start - 6, start) === 'async ' ? 'async ' : '') + source.slice(start, end);
}
const elements = Object.fromEntries(['import-error','import-progress'].map(id => [id,{hidden:true,textContent:''}]));
const controls = Object.fromEntries(['pickFileInput','modalPickFileInput','useSuggestedDims','importModalOpenButton'].map(id=>[id,{disabled:false}]));
let release;
const gate = new Promise(resolve => {release=resolve});
const context = vm.createContext({
  document:{getElementById:id=>elements[id]},
  els:{...controls,appError:{hidden:true,textContent:''}},state:{},console:{error(){}},
  applyLearnedImportPreset:async()=>gate,
  fetchJson:async()=>{throw new Error('Missing pickle module');},
});
vm.runInContext(['showError','clearError','uploadPickedFile'].map(functionSource).join('\n'),context);
(async()=>{
  const pending = context.uploadPickedFile({name:'측정.pickle'});
  assert.equal(elements['import-progress'].hidden,false);
  assert.match(elements['import-progress'].textContent,/Uploading/);
  assert.ok(Object.values(controls).every(c=>c.disabled));
  release(); await pending;
  assert.equal(elements['import-error'].hidden,false);
  assert.match(elements['import-error'].textContent,/Missing pickle module/);
  assert.equal(elements['import-progress'].hidden,true);
  assert.ok(Object.values(controls).every(c=>!c.disabled));
  context.clearError();
  assert.equal(elements['import-error'].hidden,true);
  console.log('Import failure is visible in dialog; progress and controls recover PASS');
})().catch(e=>{console.error(e);process.exitCode=1;});
const analysis = {pixel_count:7500,suggested_width:150,suggested_height:50,dimension_candidates:[{width:150,height:50}]};
const importContext = vm.createContext({
  state:{selectedPath:'/test.pickle',imageCache:new Map(),traceCache:new Map()},
  fetchJson:async()=>({width:150,height:50,pixel_count:7500}),
  fetchFileAnalysis:async()=>analysis,
  buildFileInfoRequest:()=>'/api/file-info',getGridDimensions:()=>null,
  ...Object.fromEntries(['syncGridInputsFromState','resetSelectionFromFile','clampSelectionToFile','syncSmoothDefaults','renderClickedList','renderMarkers','updateReferenceControls','renderSelectedFileSummary','syncRangeInputs','renderCurrentFile'].map(name=>[name,()=>{}])),
});
vm.runInContext(functionSource('refreshSelectedFileFromImportSettings'),importContext);
importContext.refreshSelectedFileFromImportSettings().then(()=>{
  assert.equal(importContext.state.fileAnalysis.suggested_width,150);
  assert.equal(importContext.state.fileAnalysis.dimension_candidates.length,1);
  console.log('Opening a file retains recommendation metadata PASS');
}).catch(e=>{console.error(e);process.exitCode=1;});
