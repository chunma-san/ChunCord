/* SPDX-License-Identifier: GPL-3.0-or-later */
import assert from 'node:assert/strict';
import {build} from 'esbuild';
let calls=0;
const logs=[];
const history=[];
const factory=()=>{
    calls++;
    if(calls===1)history.push(['proxyLazyWebpack',[factory],'test stack']);
    return {};
};
history.push(['proxyLazyWebpack',[factory],'test stack']);
globalThis.__reporterFixture={
    history,
    logs,
    addPatch(){queueMicrotask(()=>globalThis.Vencord.Webpack._initReporter());}
};
globalThis.Vencord={Webpack:{}};
const stubs={
 '@api/PluginManager':'export const addPatch=(...args)=>globalThis.__reporterFixture.addPatch(...args);',
 '@plugins/devCompanion.dev/initWs':'export function initWs(){}',
 '@utils/Logger':'export class Logger { log(...args){globalThis.__reporterFixture.logs.push(args);} warn(){} }',
 '@webpack':'export const wreq=Object.assign(()=>{},{m:{}});export const lazyWebpackSearchHistory=globalThis.__reporterFixture.history;export async function extractAndLoadChunks(){return true;}export function mapMangledModule(){return {};}',
 '@webpack/patcher':'export const patches=[];export const patchTimings=[];export const getBuildNumber=()=>0;',
 './loadLazyChunks':'export async function loadLazyChunks(){}',
 './reporterData':'export const reporterData={};'
};
try {
 const result=await build({entryPoints:['src/debug/runReporter.ts'],bundle:true,write:false,format:'esm',platform:'node',define:{IS_REPORTER:'true',IS_WEB:'false',IS_VESKTOP:'false',IS_EQUIBOP:'false',IS_COMPANION_TEST:'false'},plugins:[{name:'reporter-fixtures',setup(b){
  b.onResolve({filter:/.*/},args=>Object.hasOwn(stubs,args.path)?{path:args.path,namespace:'fixture'}:undefined);
  b.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:stubs[args.path]}));
 }}]});
 await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].contents).toString('base64'));
 const deadline=Date.now()+2000;
 while(!logs.some(x=>x[0]==='Finished test')&&Date.now()<deadline)await new Promise(r=>setTimeout(r,5));
 assert(logs.some(x=>x[0]==='Finished test'),'Reporter must finish');
 assert.equal(calls,1,'Searches registered during replay belong to a later snapshot');
 assert.equal(history.length,2);
 console.log('Real reporter regression: self-registering lazy factory is replayed once and reporting completes. PASS');
} finally {delete globalThis.__reporterFixture;delete globalThis.Vencord;}
